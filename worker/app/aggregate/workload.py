from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

StatusBucket = Literal["backlog", "inProgress", "inReview", "closed"]

BUCKETS: tuple[StatusBucket, ...] = ("backlog", "inProgress", "inReview", "closed")


@dataclass(frozen=True)
class Issue:
    key: str
    status_name: str
    status_category: str | None
    assignee_name: str | None


@dataclass
class AssigneeWorkload:
    assignee: str
    total: int
    counts: dict[StatusBucket, int]
    percents: dict[StatusBucket, int]

    def to_dict(self) -> dict:
        return {
            "assignee": self.assignee,
            "total": self.total,
            "counts": self.counts,
            "percents": self.percents,
        }


def map_status_to_bucket(
    status_name: str,
    status_category: str | None = None,
) -> StatusBucket:
    name = status_name.strip().lower()
    category = (status_category or "").strip().lower()

    if "review" in name:
        return "inReview"

    if category == "done" or re.search(
        r"\b(done|closed|resolved|complete[d]?)\b", name
    ):
        return "closed"

    if category == "indeterminate" or re.search(
        r"\b(in progress|progress|development|building|doing)\b", name
    ):
        return "inProgress"

    return "backlog"


def percents_from_counts(
    counts: dict[StatusBucket, int],
    total: int,
) -> dict[StatusBucket, int]:
    """Largest-remainder so the four percentages always sum to 100 (or 0 if empty)."""
    empty: dict[StatusBucket, int] = {
        "backlog": 0,
        "inProgress": 0,
        "inReview": 0,
        "closed": 0,
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


def aggregate_by_assignee(issues: list[Issue]) -> list[AssigneeWorkload]:
    by_assignee: dict[str, dict[str, int]] = {}

    for issue in issues:
        assignee = (issue.assignee_name or "").strip() or "Unassigned"
        bucket = map_status_to_bucket(issue.status_name, issue.status_category)
        row = by_assignee.get(assignee)
        if row is None:
            row = {
                "backlog": 0,
                "inProgress": 0,
                "inReview": 0,
                "closed": 0,
                "total": 0,
            }
            by_assignee[assignee] = row
        row[bucket] += 1
        row["total"] += 1

    rows: list[AssigneeWorkload] = []
    for assignee, row in by_assignee.items():
        counts: dict[StatusBucket, int] = {
            "backlog": row["backlog"],
            "inProgress": row["inProgress"],
            "inReview": row["inReview"],
            "closed": row["closed"],
        }
        total = row["total"]
        rows.append(
            AssigneeWorkload(
                assignee=assignee,
                total=total,
                counts=counts,
                percents=percents_from_counts(counts, total),
            )
        )

    rows.sort(key=lambda r: (-r.total, r.assignee))
    return rows
