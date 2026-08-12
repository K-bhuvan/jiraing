from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.aggregate.commits import Commit
from app.config import AppConfig


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


async def fetch_commits_via_rest(config: AppConfig) -> list[Commit]:
    assert config.GITHUB_OWNER and config.GITHUB_REPO and config.GITHUB_TOKEN
    owner = config.GITHUB_OWNER.strip()
    repo = config.GITHUB_REPO.strip()
    token = config.GITHUB_TOKEN.strip()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "jira-workload-worker",
    }

    all_commits: list[Commit] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=60.0) as client:
        for page in range(1, 11):
            params: dict[str, str | int] = {"per_page": 100, "page": page}
            if config.GITHUB_BRANCH:
                params["sha"] = config.GITHUB_BRANCH.strip()

            res = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits",
                headers=headers,
                params=params,
            )
            if res.status_code >= 400:
                raise RuntimeError(
                    f"GitHub REST commits failed ({res.status_code}): {res.text[:300]}"
                )

            batch = res.json()
            if not isinstance(batch, list) or len(batch) == 0:
                break

            for raw in batch:
                if not isinstance(raw, dict):
                    continue
                sha = str(raw.get("sha") or "")
                if not sha or sha in seen:
                    continue
                seen.add(sha)

                author_login = None
                gh_author = raw.get("author")
                if isinstance(gh_author, dict) and gh_author.get("login"):
                    author_login = str(gh_author["login"])

                commit_obj = raw.get("commit") if isinstance(raw.get("commit"), dict) else {}
                commit_author = (
                    commit_obj.get("author")
                    if isinstance(commit_obj.get("author"), dict)
                    else {}
                )
                name = author_login or (
                    str(commit_author.get("name")) if commit_author.get("name") else None
                )
                authored_at = _parse_iso(
                    str(commit_author.get("date")) if commit_author.get("date") else None
                )
                all_commits.append(
                    Commit(sha=sha, author_name=name, authored_at=authored_at)
                )

            if len(batch) < 100:
                break

    return all_commits
