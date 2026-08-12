from app.aggregate.workload import (
    Issue,
    aggregate_by_assignee,
    map_status_to_bucket,
    percents_from_counts,
)


def test_map_status_to_bucket_review_first():
    assert map_status_to_bucket("In Review", "indeterminate") == "inReview"
    assert map_status_to_bucket("Code Review", "to do") == "inReview"


def test_map_status_to_bucket_done_and_closed():
    assert map_status_to_bucket("Shipped", "done") == "closed"
    assert map_status_to_bucket("Closed", "to do") == "closed"


def test_map_status_to_bucket_in_progress():
    assert map_status_to_bucket("In Progress", "indeterminate") == "inProgress"
    assert map_status_to_bucket("Doing", None) == "inProgress"


def test_map_status_to_bucket_defaults_to_backlog():
    assert map_status_to_bucket("To Do", "to do") == "backlog"
    assert map_status_to_bucket("Backlog", None) == "backlog"


def test_percents_from_counts_sums_to_100():
    p = percents_from_counts(
        {"backlog": 1, "inProgress": 1, "inReview": 1, "closed": 0},
        3,
    )
    assert p["backlog"] + p["inProgress"] + p["inReview"] + p["closed"] == 100


def test_aggregate_by_assignee_groups_and_sorts():
    rows = aggregate_by_assignee(
        [
            Issue("A-1", "To Do", "to do", "Sam"),
            Issue("A-2", "In Progress", "indeterminate", "Sam"),
            Issue("A-3", "Done", "done", "John"),
            Issue("A-4", "Backlog", "to do", None),
        ]
    )
    assert rows[0].assignee == "Sam"
    assert rows[0].total == 2
    assert rows[0].counts["backlog"] == 1
    assert rows[0].counts["inProgress"] == 1
    assert any(r.assignee == "Unassigned" for r in rows)
