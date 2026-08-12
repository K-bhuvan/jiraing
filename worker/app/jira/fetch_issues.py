from __future__ import annotations

import base64

import httpx

from app.aggregate.workload import Issue
from app.config import AppConfig


def _auth_header(email: str, api_key: str) -> str:
    token = base64.b64encode(f"{email}:{api_key}".encode()).decode()
    return f"Basic {token}"


async def fetch_issues_via_rest(config: AppConfig) -> list[Issue]:
    url = f"{config.site_str}/rest/api/3/search/jql"
    headers = {
        "Authorization": _auth_header(config.JIRA_EMAIL, config.JIRA_API_KEY),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    all_issues: list[Issue] = []
    next_page_token: str | None = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(50):
            body: dict = {
                "jql": f"project = {config.JIRA_PROJECT_KEY} ORDER BY updated DESC",
                "maxResults": 100,
                "fields": ["status", "assignee"],
            }
            if next_page_token:
                body["nextPageToken"] = next_page_token

            res = await client.post(url, headers=headers, json=body)
            if res.status_code >= 400:
                raise RuntimeError(
                    f"Jira REST search failed ({res.status_code}): {res.text[:300]}"
                )

            data = res.json()
            issues = data.get("issues") or []
            for issue in issues:
                fields = issue.get("fields") or {}
                status = fields.get("status") or {}
                status_category = status.get("statusCategory") or {}
                assignee = fields.get("assignee")
                all_issues.append(
                    Issue(
                        key=issue.get("key") or "",
                        status_name=status.get("name") or "Unknown",
                        status_category=status_category.get("name")
                        or status_category.get("key"),
                        assignee_name=(assignee or {}).get("displayName")
                        if assignee
                        else None,
                    )
                )

            if (
                data.get("isLast") is True
                or not data.get("nextPageToken")
                or len(issues) == 0
            ):
                break
            next_page_token = data.get("nextPageToken")

    return all_issues
