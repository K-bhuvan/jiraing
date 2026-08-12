from datetime import datetime, timedelta, timezone

from app.aggregate.commits import (
    Commit,
    aggregate_by_author,
    map_commit_to_bucket,
    percents_from_counts,
)


def test_map_commit_to_bucket_windows():
    now = datetime(2026, 8, 12, tzinfo=timezone.utc)
    assert (
        map_commit_to_bucket(now - timedelta(days=2), now=now) == "last7Days"
    )
    assert (
        map_commit_to_bucket(now - timedelta(days=14), now=now) == "last30Days"
    )
    assert (
        map_commit_to_bucket(now - timedelta(days=45), now=now) == "last90Days"
    )
    assert map_commit_to_bucket(now - timedelta(days=120), now=now) == "older"


def test_commit_percents_sum_to_100():
    p = percents_from_counts(
        {"last7Days": 1, "last30Days": 1, "last90Days": 1, "older": 0},
        3,
    )
    assert p["last7Days"] + p["last30Days"] + p["last90Days"] + p["older"] == 100


def test_aggregate_by_author_groups_and_sorts():
    now = datetime.now(timezone.utc)
    rows = aggregate_by_author(
        [
            Commit("a", "sam", now - timedelta(days=1)),
            Commit("b", "sam", now - timedelta(days=20)),
            Commit("c", "jet", now - timedelta(days=2)),
            Commit("d", None, now - timedelta(days=100)),
        ]
    )
    assert rows[0].author == "sam"
    assert rows[0].total == 2
    assert rows[0].counts["last7Days"] == 1
    assert rows[0].counts["last30Days"] == 1
    assert any(r.author == "Unknown" for r in rows)
