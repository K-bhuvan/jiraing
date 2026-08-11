import type { StatusBucket } from "@/lib/types";

const LABELS: Record<StatusBucket, string> = {
  backlog: "Backlog",
  inProgress: "In Progress",
  inReview: "In Review",
  closed: "Closed",
};

const COLORS: Record<StatusBucket, string> = {
  backlog: "var(--bucket-backlog)",
  inProgress: "var(--bucket-progress)",
  inReview: "var(--bucket-review)",
  closed: "var(--bucket-closed)",
};

const ORDER: StatusBucket[] = [
  "backlog",
  "inProgress",
  "inReview",
  "closed",
];

type Props = {
  percents: Record<StatusBucket, number>;
  total: number;
};

export function StackedBar({ percents, total }: Props) {
  if (total === 0) {
    return <div className="bar bar--empty" aria-hidden />;
  }

  return (
    <div
      className="bar"
      role="img"
      aria-label={ORDER.map((b) => `${LABELS[b]} ${percents[b]}%`).join(", ")}
    >
      {ORDER.map((bucket) => {
        const pct = percents[bucket];
        if (pct <= 0) return null;
        return (
          <div
            key={bucket}
            className="bar__seg"
            style={{ width: `${pct}%`, background: COLORS[bucket] }}
            title={`${LABELS[bucket]}: ${pct}%`}
          />
        );
      })}
    </div>
  );
}

export { LABELS, ORDER, COLORS };
