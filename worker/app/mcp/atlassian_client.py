from __future__ import annotations

import base64
import json
from typing import Any
from urllib.parse import urlparse

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
from mcp.types import Implementation

from app.aggregate.workload import Issue
from app.config import AppConfig


def _basic_auth_header(email: str, api_key: str) -> str:
    token = base64.b64encode(f"{email}:{api_key}".encode()).decode()
    return f"Basic {token}"


def _text_from_tool_result(result: Any) -> Any:
    structured = getattr(result, "structured_content", None)
    if structured is not None:
        return structured

    texts: list[str] = []
    for content in getattr(result, "content", None) or []:
        if getattr(content, "type", None) == "text" and getattr(content, "text", None):
            texts.append(content.text)
    if not texts:
        return None
    joined = "\n".join(texts)
    try:
        return json.loads(joined)
    except json.JSONDecodeError:
        return joined


def _extract_cloud_id(parsed: Any, site_url: str) -> str | None:
    host = urlparse(site_url).hostname or ""
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict):
                url = str(item.get("url") or item.get("siteUrl") or "")
                if host in url and isinstance(item.get("id"), str):
                    return item["id"]
                if host in url and isinstance(item.get("cloudId"), str):
                    return item["cloudId"]
    if isinstance(parsed, dict):
        resources = parsed.get("resources")
        if isinstance(resources, list):
            return _extract_cloud_id(resources, site_url)
        if isinstance(parsed.get("cloudId"), str):
            return parsed["cloudId"]
    return None


async def _resolve_cloud_id_from_site(site_url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(f"{site_url.rstrip('/')}/_edge/tenant_info")
            if res.status_code >= 400:
                return None
            data = res.json()
            cloud_id = data.get("cloudId")
            return cloud_id if isinstance(cloud_id, str) else None
    except Exception:
        return None


def _normalize_mcp_issues(payload: Any) -> tuple[list[Issue], bool, str | None]:
    if not payload:
        return [], False, None

    issues_raw: list[Any] = []
    total = 0
    start_at = 0
    max_results = 0
    next_page_token: str | None = None
    is_last: bool | None = None

    if isinstance(payload, list):
        issues_raw = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("issues"), list):
            issues_raw = payload["issues"]
        elif isinstance(payload.get("values"), list):
            issues_raw = payload["values"]
        total = int(payload.get("total") or 0)
        start_at = int(payload.get("startAt") or 0)
        max_results = int(payload.get("maxResults") or 0)
        token = payload.get("nextPageToken")
        if isinstance(token, str) and token:
            next_page_token = token
        if isinstance(payload.get("isLast"), bool):
            is_last = payload["isLast"]

    issues: list[Issue] = []
    for raw in issues_raw:
        if not isinstance(raw, dict):
            continue
        fields = raw.get("fields") if isinstance(raw.get("fields"), dict) else raw
        status = fields.get("status") if isinstance(fields.get("status"), dict) else {}
        status_category = (
            status.get("statusCategory")
            if isinstance(status.get("statusCategory"), dict)
            else {}
        )
        assignee = fields.get("assignee") if isinstance(fields.get("assignee"), dict) else None
        issues.append(
            Issue(
                key=str(raw.get("key") or fields.get("key") or ""),
                status_name=str(status.get("name") or "Unknown"),
                status_category=status_category.get("name")
                or status_category.get("key"),
                assignee_name=(assignee or {}).get("displayName")
                or (assignee or {}).get("name"),
            )
        )

    if is_last is True:
        return issues, False, None
    if next_page_token:
        return issues, True, next_page_token

    if total > 0:
        has_more = start_at + len(issues) < total
    else:
        has_more = max_results > 0 and len(issues) >= max_results
    return issues, has_more, None


async def fetch_issues_via_mcp(
    config: AppConfig,
) -> dict[str, Any]:
    """
    Returns either:
      { source: "mcp", issues: [...], tools: [...] }
    or
      { source: "mcp-unavailable", tools: [...], reason: "..." }
    """
    auth = _basic_auth_header(config.JIRA_EMAIL, config.JIRA_API_KEY)
    http_client = create_mcp_http_client(headers={"Authorization": auth})

    async with http_client:
        async with streamable_http_client(
            config.mcp_url_str, http_client=http_client
        ) as (read_stream, write_stream):
            async with ClientSession(
                read_stream,
                write_stream,
                client_info=Implementation(
                    name="jira-workload-worker",
                    version="0.1.0",
                ),
            ) as session:
                await session.initialize()
                listed = await session.list_tools()
                tools = [t.name for t in listed.tools]

                if "searchJiraIssuesUsingJql" not in tools:
                    return {
                        "source": "mcp-unavailable",
                        "tools": tools,
                        "reason": (
                            "MCP session has no searchJiraIssuesUsingJql tool. "
                            "Create an API token with Jira read/search scopes, and ensure "
                            "Rovo MCP API-token auth is enabled for your org."
                        ),
                    }

                cloud_id: str | None = None
                if "getAccessibleAtlassianResources" in tools:
                    resources = await session.call_tool(
                        "getAccessibleAtlassianResources",
                        arguments={},
                    )
                    parsed = _text_from_tool_result(resources)
                    cloud_id = _extract_cloud_id(parsed, config.site_str)
                if not cloud_id:
                    cloud_id = await _resolve_cloud_id_from_site(config.site_str)
                if not cloud_id:
                    return {
                        "source": "mcp-unavailable",
                        "tools": tools,
                        "reason": (
                            "Could not resolve Atlassian cloudId for MCP Jira tools. "
                            "Check JIRA_SITE."
                        ),
                    }

                jql = f"project = {config.JIRA_PROJECT_KEY} ORDER BY updated DESC"
                args: dict[str, Any] = {
                    "cloudId": cloud_id,
                    "jql": jql,
                    "maxResults": 100,
                    "fields": ["summary", "status", "assignee"],
                }

                all_issues: list[Issue] = []
                seen: set[str] = set()
                next_page_token: str | None = None
                start_at = 0

                for _ in range(20):
                    page_args = dict(args)
                    if next_page_token:
                        page_args["nextPageToken"] = next_page_token
                    elif start_at > 0:
                        page_args["startAt"] = start_at

                    result = await session.call_tool(
                        "searchJiraIssuesUsingJql",
                        arguments=page_args,
                    )
                    if getattr(result, "is_error", False):
                        err_text = _text_from_tool_result(result)
                        return {
                            "source": "mcp-unavailable",
                            "tools": tools,
                            "reason": (
                                "MCP searchJiraIssuesUsingJql failed: "
                                f"{str(err_text)[:300]}"
                            ),
                        }

                    payload = _text_from_tool_result(result)
                    page_issues, has_more, token = _normalize_mcp_issues(payload)
                    added = 0
                    for issue in page_issues:
                        if not issue.key or issue.key in seen:
                            continue
                        seen.add(issue.key)
                        all_issues.append(issue)
                        added += 1

                    if added == 0:
                        break
                    if token:
                        next_page_token = token
                        continue
                    if not has_more:
                        break
                    start_at += len(page_issues)

                return {
                    "source": "mcp",
                    "issues": all_issues,
                    "tools": tools,
                }
