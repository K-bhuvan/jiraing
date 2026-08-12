import { WorkloadTable } from "@/components/WorkloadTable";
import { CommitTable } from "@/components/CommitTable";
import { COLORS, ORDER, LABELS } from "@/components/StackedBar";
import {
  COMMIT_COLORS,
  COMMIT_LABELS,
  COMMIT_ORDER,
} from "@/components/CommitStackedBar";
import type {
  CommitsError,
  CommitsResponse,
  WorkloadError,
  WorkloadResponse,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function workerBase() {
  return (process.env.WORKER_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

async function loadWorkload(): Promise<
  { ok: true; data: WorkloadResponse } | { ok: false; error: WorkloadError }
> {
  try {
    const res = await fetch(`${workerBase()}/workload`, { cache: "no-store" });
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
        detail: `${err instanceof Error ? err.message : "Unknown error"}. Is the worker running at ${workerBase()}?`,
      },
    };
  }
}

async function loadCommits(): Promise<
  { ok: true; data: CommitsResponse } | { ok: false; error: CommitsError }
> {
  try {
    const res = await fetch(`${workerBase()}/commits`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body as CommitsError };
    }
    return { ok: true, data: body as CommitsResponse };
  } catch (err) {
    return {
      ok: false,
      error: {
        error: "Can't reach commits worker",
        detail: `${err instanceof Error ? err.message : "Unknown error"}. Is the worker running at ${workerBase()}?`,
      },
    };
  }
}

export default async function Home() {
  const [jira, github] = await Promise.all([loadWorkload(), loadCommits()]);

  return (
    <main className="shell">
      <header className="hero">
        <p className="kicker">Team workload</p>
        <h1>Assignee &amp; commit mix</h1>
        <p className="sub">
          Who owns Jira tickets and who is shipping commits — each as a share of
          that person&apos;s total, with the same stacked-bar breakdown.
        </p>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Jira</p>
            <h2 className="panel-title">Assignee mix</h2>
          </div>
          {jira.ok ? (
            <div className="meta meta--compact">
              <span className="pill">
                <span className="dot" />
                {jira.data.projectKey}
              </span>
              <span className="pill">
                <span
                  className={`dot ${jira.data.source === "mcp" ? "" : "warn"}`}
                />
                via {jira.data.source === "mcp" ? "MCP" : "REST"}
              </span>
              <span>{jira.data.issueCount} issues</span>
              <span>
                Updated {new Date(jira.data.generatedAt).toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>

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

        {!jira.ok ? (
          <p className="error">
            {jira.error.error}
            {jira.error.detail ? ` — ${jira.error.detail}` : ""}
          </p>
        ) : (
          <>
            {jira.data.mcpNote ? (
              <p className="note">{jira.data.mcpNote}</p>
            ) : null}
            <WorkloadTable rows={jira.data.assignees} />
          </>
        )}
      </section>

      <section className="panel panel--spaced">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">GitHub</p>
            <h2 className="panel-title">Commit mix</h2>
          </div>
          {github.ok ? (
            <div className="meta meta--compact">
              <span className="pill">
                <span className="dot" />
                {github.data.owner}/{github.data.repo}
              </span>
              <span className="pill">
                <span
                  className={`dot ${github.data.source === "mcp" ? "" : "warn"}`}
                />
                via {github.data.source === "mcp" ? "MCP" : "REST"}
              </span>
              <span>{github.data.commitCount} commits</span>
              <span>
                Updated {new Date(github.data.generatedAt).toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="meta meta--compact">
              <span className="pill">
                <span className="dot warn" />
                MCP / REST unavailable
              </span>
            </div>
          )}
        </div>

        <ul className="legend">
          {COMMIT_ORDER.map((bucket) => (
            <li key={bucket}>
              <span
                className="swatch"
                style={{ background: COMMIT_COLORS[bucket] }}
              />
              {COMMIT_LABELS[bucket]}
            </li>
          ))}
        </ul>

        {!github.ok ? (
          <p className="error">
            {github.error.error}
            {github.error.detail ? ` — ${github.error.detail}` : ""}
          </p>
        ) : (
          <>
            {github.data.mcpNote ? (
              <p className="note">{github.data.mcpNote}</p>
            ) : null}
            <CommitTable rows={github.data.authors} />
          </>
        )}
      </section>
    </main>
  );
}
