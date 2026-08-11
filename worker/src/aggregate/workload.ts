export type StatusBucket = "backlog" | "inProgress" | "inReview" | "closed";

export type IssueLike = {
  key: string;
  statusName: string;
  statusCategory?: string | null;
  assigneeName: string | null;
};

export type AssigneeWorkload = {
  assignee: string;
  total: number;
  counts: Record<StatusBucket, number>;
  percents: Record<StatusBucket, number>;
};

const BUCKETS: StatusBucket[] = [
  "backlog",
  "inProgress",
  "inReview",
  "closed",
];

export function mapStatusToBucket(
  statusName: string,
  statusCategory?: string | null,
): StatusBucket {
  const name = statusName.trim().toLowerCase();
  const category = (statusCategory ?? "").trim().toLowerCase();

  if (/review/.test(name)) return "inReview";

  if (
    category === "done" ||
    /\b(done|closed|resolved|complete[d]?)\b/.test(name)
  ) {
    return "closed";
  }

  if (
    category === "indeterminate" ||
    /\b(in progress|progress|development|building|doing)\b/.test(name)
  ) {
    return "inProgress";
  }

  return "backlog";
}

/** Largest-remainder so the four percentages always sum to 100 (or 0 if empty). */
export function percentsFromCounts(
  counts: Record<StatusBucket, number>,
  total: number,
): Record<StatusBucket, number> {
  const empty = { backlog: 0, inProgress: 0, inReview: 0, closed: 0 };
  if (total <= 0) return empty;

  const raw = BUCKETS.map((b) => ({
    bucket: b,
    exact: (counts[b] / total) * 100,
  }));
  const floored = raw.map((r) => ({
    ...r,
    value: Math.floor(r.exact),
    frac: r.exact - Math.floor(r.exact),
  }));
  let remaining = 100 - floored.reduce((s, r) => s + r.value, 0);
  floored
    .slice()
    .sort((a, b) => b.frac - a.frac)
    .forEach((r) => {
      if (remaining <= 0) return;
      const target = floored.find((f) => f.bucket === r.bucket);
      if (target) {
        target.value += 1;
        remaining -= 1;
      }
    });

  return Object.fromEntries(
    floored.map((f) => [f.bucket, f.value]),
  ) as Record<StatusBucket, number>;
}

export function aggregateByAssignee(issues: IssueLike[]): AssigneeWorkload[] {
  const byAssignee = new Map<
    string,
    Record<StatusBucket, number> & { total: number }
  >();

  for (const issue of issues) {
    const assignee = issue.assigneeName?.trim() || "Unassigned";
    const bucket = mapStatusToBucket(issue.statusName, issue.statusCategory);
    let row = byAssignee.get(assignee);
    if (!row) {
      row = { backlog: 0, inProgress: 0, inReview: 0, closed: 0, total: 0 };
      byAssignee.set(assignee, row);
    }
    row[bucket] += 1;
    row.total += 1;
  }

  return [...byAssignee.entries()]
    .map(([assignee, row]) => {
      const counts = {
        backlog: row.backlog,
        inProgress: row.inProgress,
        inReview: row.inReview,
        closed: row.closed,
      };
      return {
        assignee,
        total: row.total,
        counts,
        percents: percentsFromCounts(counts, row.total),
      };
    })
    .sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee));
}
