import { WorkloadTable } from "@/components/WorkloadTable";
import { COLORS, ORDER, LABELS } from "@/components/StackedBar";
import type { WorkloadError, WorkloadResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadWorkload(): Promise<
  { ok: true; data: WorkloadResponse } | { ok: false; error: WorkloadError }
> {
  const workerUrl = (
    process.env.WORKER_URL ?? "http://localhost:4000"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${workerUrl}/workload`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body as WorkloadError };
    }
    return { ok: true, data: body as WorkloadResponse };
  } catch (err) {
    return {
      ok: false,
      error: {
        error: "Can't reach workload worker",
        detail: `${err instanceof Error ? err.message : "Unknown error"}. Is the worker running at ${workerUrl}?`,
      },
    };
  }
}

export default async function Home() {
  const result = await loadWorkload();

  return (
    <main className="shell">
      <header className="hero">
        <p className="kicker">Jira workload</p>
        <h1>Assignee mix</h1>
        <p className="sub">
          Top-down view of who owns what — backlog, in progress, in review, and
          closed — as a share of each person&apos;s tickets.
        </p>
        {result.ok ? (
          <div className="meta">
            <span className="pill">
              <span className="dot" />
              {result.data.projectKey}
            </span>
            <span className="pill">
              <span
                className={`dot ${result.data.source === "mcp" ? "" : "warn"}`}
              />
              via {result.data.source.toUpperCase()}
            </span>
            <span>{result.data.issueCount} issues</span>
            <span>
              Updated {new Date(result.data.generatedAt).toLocaleString()}
            </span>
          </div>
        ) : null}
      </header>

      <section className="panel">
        <ul className="legend">
          {ORDER.map((bucket) => (
            <li key={bucket}>
              <span
                className="swatch"
                style={{ background: COLORS[bucket] }}
              />
              {LABELS[bucket]}
            </li>
          ))}
        </ul>

        {!result.ok ? (
          <p className="error">
            {result.error.error}
            {result.error.detail ? ` — ${result.error.detail}` : ""}
          </p>
        ) : (
          <WorkloadTable rows={result.data.assignees} />
        )}
      </section>
    </main>
  );
}
