import type { AuthorCommits } from "@/lib/types";
import {
  COMMIT_COLORS,
  COMMIT_LABELS,
  COMMIT_ORDER,
  CommitStackedBar,
} from "./CommitStackedBar";

type Props = {
  rows: AuthorCommits[];
};

export function CommitTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        No commits found for this repository. Check the owner/repo or token
        scopes.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table className="workload">
        <thead>
          <tr>
            <th scope="col">Author</th>
            <th scope="col">Mix</th>
            <th scope="col">Breakdown</th>
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.author}>
              <th scope="row">{row.author}</th>
              <td className="mix">
                <CommitStackedBar percents={row.percents} total={row.total} />
              </td>
              <td>
                <ul className="pct-list">
                  {COMMIT_ORDER.map((bucket) => (
                    <li key={bucket}>
                      <span
                        className="swatch"
                        style={{ background: COMMIT_COLORS[bucket] }}
                      />
                      <span className="pct-label">{COMMIT_LABELS[bucket]}</span>
                      <span className="pct-val">{row.percents[bucket]}%</span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="num">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
