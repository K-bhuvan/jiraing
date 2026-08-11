import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateByAssignee,
  mapStatusToBucket,
  percentsFromCounts,
} from "./workload.ts";

describe("mapStatusToBucket", () => {
  it("maps review by name first", () => {
    assert.equal(mapStatusToBucket("In Review", "indeterminate"), "inReview");
    assert.equal(mapStatusToBucket("Code Review", "to do"), "inReview");
  });

  it("maps done category and closed names", () => {
    assert.equal(mapStatusToBucket("Shipped", "done"), "closed");
    assert.equal(mapStatusToBucket("Closed", "to do"), "closed");
  });

  it("maps in progress", () => {
    assert.equal(mapStatusToBucket("In Progress", "indeterminate"), "inProgress");
    assert.equal(mapStatusToBucket("Doing", null), "inProgress");
  });

  it("defaults to backlog", () => {
    assert.equal(mapStatusToBucket("To Do", "to do"), "backlog");
    assert.equal(mapStatusToBucket("Backlog", null), "backlog");
  });
});

describe("percentsFromCounts", () => {
  it("sums to 100", () => {
    const p = percentsFromCounts(
      { backlog: 1, inProgress: 1, inReview: 1, closed: 0 },
      3,
    );
    assert.equal(p.backlog + p.inProgress + p.inReview + p.closed, 100);
  });
});

describe("aggregateByAssignee", () => {
  it("groups and sorts by total", () => {
    const rows = aggregateByAssignee([
      {
        key: "A-1",
        statusName: "To Do",
        statusCategory: "to do",
        assigneeName: "Sam",
      },
      {
        key: "A-2",
        statusName: "In Progress",
        statusCategory: "indeterminate",
        assigneeName: "Sam",
      },
      {
        key: "A-3",
        statusName: "Done",
        statusCategory: "done",
        assigneeName: "John",
      },
      {
        key: "A-4",
        statusName: "Backlog",
        statusCategory: "to do",
        assigneeName: null,
      },
    ]);
    assert.equal(rows[0].assignee, "Sam");
    assert.equal(rows[0].total, 2);
    assert.equal(rows[0].counts.backlog, 1);
    assert.equal(rows[0].counts.inProgress, 1);
    assert.ok(rows.some((r) => r.assignee === "Unassigned"));
  });
});
