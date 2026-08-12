from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client
from mcp.types import Implementation

from app.aggregate.commits import Commit
from app.config import AppConfig


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


def _parse_iso(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    text = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _normalize_commits(payload: Any) -> list[Commit]:
    if not payload:
        return []

    raw_list: list[Any]
    if isinstance(payload, list):
        raw_list = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("commits"), list):
            raw_list = payload["commits"]
        elif isinstance(payload.get("items"), list):
            raw_list = payload["items"]
        elif isinstance(payload.get("data"), list):
            raw_list = payload["data"]
        else:
            # Single commit object
            raw_list = [payload]
    else:
        return []

    commits: list[Commit] = []
    for raw in raw_list:
        if not isinstance(raw, dict):
            continue
        sha = str(raw.get("sha") or raw.get("oid") or "")
        if not sha:
            continue

        author_login = None
        gh_author = raw.get("author")
        if isinstance(gh_author, dict) and gh_author.get("login"):
            author_login = str(gh_author["login"])
        elif isinstance(gh_author, str) and gh_author.strip():
            author_login = gh_author.strip()

        commit_obj = raw.get("commit") if isinstance(raw.get("commit"), dict) else {}
        commit_author = (
            commit_obj.get("author") if isinstance(commit_obj.get("author"), dict) else {}
        )
        name = author_login or (
            str(commit_author.get("name")) if commit_author.get("name") else None
        )
        date_raw = (
            commit_author.get("date")
            or raw.get("authoredDate")
            or raw.get("date")
        )
        if not date_raw and isinstance(commit_obj, dict):
            nested_author = commit_obj.get("author")
            if isinstance(nested_author, dict):
                date_raw = nested_author.get("date")
        if isinstance(date_raw, dict):
            date_raw = date_raw.get("date")
        commits.append(
            Commit(
                sha=sha,
                author_name=name,
                authored_at=_parse_iso(str(date_raw) if date_raw else None),
            )
        )
    return commits


async def fetch_commits_via_mcp(config: AppConfig) -> dict[str, Any]:
    """
    Returns either:
      { source: "mcp", commits: [...], tools: [...] }
    or
      { source: "mcp-unavailable", tools: [...], reason: "..." }
    """
    assert config.GITHUB_OWNER and config.GITHUB_REPO and config.GITHUB_TOKEN
    owner = config.GITHUB_OWNER.strip()
    repo = config.GITHUB_REPO.strip()
    token = config.GITHUB_TOKEN.strip()

    http_client = create_mcp_http_client(
        headers={"Authorization": f"Bearer {token}"},
    )

    async with http_client:
        async with streamable_http_client(
            config.github_mcp_url_str, http_client=http_client
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

                if "list_commits" not in tools:
                    return {
                        "source": "mcp-unavailable",
                        "tools": tools,
                        "reason": (
                            "GitHub MCP session has no list_commits tool. "
                            "Use a PAT with repo read access, or check GITHUB_MCP_URL."
                        ),
                    }

                all_commits: list[Commit] = []
                seen: set[str] = set()

                for page in range(1, 11):
                    args: dict[str, Any] = {
                        "owner": owner,
                        "repo": repo,
                        "perPage": 100,
                        "page": page,
                    }
                    # Some MCP builds use snake_case.
                    args_snake = {
                        "owner": owner,
                        "repo": repo,
                        "per_page": 100,
                        "page": page,
                    }
                    if config.GITHUB_BRANCH:
                        args["sha"] = config.GITHUB_BRANCH.strip()
                        args_snake["sha"] = config.GITHUB_BRANCH.strip()

                    result = await session.call_tool("list_commits", arguments=args)
                    if getattr(result, "is_error", False):
                        # Retry with snake_case params once on first page.
                        if page == 1:
                            result = await session.call_tool(
                                "list_commits", arguments=args_snake
                            )
                        if getattr(result, "is_error", False):
                            err_text = _text_from_tool_result(result)
                            return {
                                "source": "mcp-unavailable",
                                "tools": tools,
                                "reason": (
                                    "GitHub MCP list_commits failed: "
                                    f"{str(err_text)[:300]}"
                                ),
                            }

                    payload = _text_from_tool_result(result)
                    page_commits = _normalize_commits(payload)
                    added = 0
                    for commit in page_commits:
                        if commit.sha in seen:
                            continue
                        seen.add(commit.sha)
                        all_commits.append(commit)
                        added += 1

                    if added == 0 or len(page_commits) < 50:
                        break

                return {
                    "source": "mcp",
                    "commits": all_commits,
                    "tools": tools,
                }
