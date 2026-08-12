import type { CommitBucket } from "@/lib/types";

const LABELS: Record<CommitBucket, string> = {
  last7Days: "Last 7 days",
  last30Days: "8–30 days",
  last90Days: "31–90 days",
  older: "Older",
};

const COLORS: Record<CommitBucket, string> = {
  last7Days: "var(--commit-week)",
  last30Days: "var(--commit-month)",
  last90Days: "var(--commit-quarter)",
  older: "var(--commit-older)",
};

const ORDER: CommitBucket[] = [
  "last7Days",
  "last30Days",
  "last90Days",
  "older",
];

type Props = {
  percents: Record<CommitBucket, number>;
  total: number;
};

export function CommitStackedBar({ percents, total }: Props) {
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

export { LABELS as COMMIT_LABELS, ORDER as COMMIT_ORDER, COLORS as COMMIT_COLORS };
