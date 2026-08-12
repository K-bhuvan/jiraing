from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

CommitBucket = Literal["last7Days", "last30Days", "last90Days", "older"]

BUCKETS: tuple[CommitBucket, ...] = (
    "last7Days",
    "last30Days",
    "last90Days",
    "older",
)


@dataclass(frozen=True)
class Commit:
    sha: str
    author_name: str | None
    authored_at: datetime


@dataclass
class AuthorCommits:
    author: str
    total: int
    counts: dict[CommitBucket, int]
    percents: dict[CommitBucket, int]

    def to_dict(self) -> dict:
        return {
            "author": self.author,
            "total": self.total,
            "counts": self.counts,
            "percents": self.percents,
        }


def map_commit_to_bucket(
    authored_at: datetime,
    *,
    now: datetime | None = None,
) -> CommitBucket:
    now = now or datetime.now(timezone.utc)
    if authored_at.tzinfo is None:
        authored_at = authored_at.replace(tzinfo=timezone.utc)
    age_days = (now - authored_at.astimezone(timezone.utc)).total_seconds() / 86400.0
    if age_days <= 7:
        return "last7Days"
    if age_days <= 30:
        return "last30Days"
    if age_days <= 90:
        return "last90Days"
    return "older"


def percents_from_counts(
    counts: dict[CommitBucket, int],
    total: int,
) -> dict[CommitBucket, int]:
    empty: dict[CommitBucket, int] = {
        "last7Days": 0,
        "last30Days": 0,
        "last90Days": 0,
        "older": 0,
    }
    if total <= 0:
        return empty

    floored: list[dict] = []
    for b in BUCKETS:
        exact = (counts[b] / total) * 100
        floored.append(
            {
                "bucket": b,
                "value": int(exact // 1),
                "frac": exact - int(exact // 1),
            }
        )

    remaining = 100 - sum(r["value"] for r in floored)
    for r in sorted(floored, key=lambda x: x["frac"], reverse=True):
        if remaining <= 0:
            break
        target = next(f for f in floored if f["bucket"] == r["bucket"])
        target["value"] += 1
        remaining -= 1

    return {f["bucket"]: f["value"] for f in floored}


def aggregate_by_author(commits: list[Commit]) -> list[AuthorCommits]:
    now = datetime.now(timezone.utc)
    by_author: dict[str, dict[str, int]] = {}

    for commit in commits:
        author = (commit.author_name or "").strip() or "Unknown"
        bucket = map_commit_to_bucket(commit.authored_at, now=now)
        row = by_author.get(author)
        if row is None:
            row = {
                "last7Days": 0,
                "last30Days": 0,
                "last90Days": 0,
                "older": 0,
                "total": 0,
            }
            by_author[author] = row
        row[bucket] += 1
        row["total"] += 1

    rows: list[AuthorCommits] = []
    for author, row in by_author.items():
        counts: dict[CommitBucket, int] = {
            "last7Days": row["last7Days"],
            "last30Days": row["last30Days"],
            "last90Days": row["last90Days"],
            "older": row["older"],
        }
        total = row["total"]
        rows.append(
            AuthorCommits(
                author=author,
                total=total,
                counts=counts,
                percents=percents_from_counts(counts, total),
            )
        )

    rows.sort(key=lambda r: (-r.total, r.author.lower()))
    return rows
