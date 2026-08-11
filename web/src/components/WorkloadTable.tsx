import type { AssigneeWorkload } from "@/lib/types";
import { COLORS, LABELS, ORDER, StackedBar } from "./StackedBar";

type Props = {
  rows: AssigneeWorkload[];
};

export function WorkloadTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        No issues found for this project. Check the project key or create sample
        tickets in Jira.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table className="workload">
        <thead>
          <tr>
            <th scope="col">Assignee</th>
            <th scope="col">Mix</th>
            <th scope="col">Breakdown</th>
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.assignee}>
              <th scope="row">{row.assignee}</th>
              <td className="mix">
                <StackedBar percents={row.percents} total={row.total} />
              </td>
              <td>
                <ul className="pct-list">
                  {ORDER.map((bucket) => (
                    <li key={bucket}>
                      <span
                        className="swatch"
                        style={{ background: COLORS[bucket] }}
                      />
                      <span className="pct-label">{LABELS[bucket]}</span>
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
