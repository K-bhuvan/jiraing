import "./loadEnv.ts";
import cors from "cors";
import express from "express";
import { loadConfig } from "./config.ts";
import { aggregateByAssignee } from "./aggregate/workload.ts";
import { fetchIssuesViaMcp } from "./mcp/atlassianClient.ts";
import { fetchIssuesViaRest } from "./jira/fetchIssues.ts";

const config = loadConfig();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    projectKey: config.JIRA_PROJECT_KEY,
    site: config.JIRA_SITE,
  });
});

app.get("/workload", async (_req, res) => {
  try {
    const mcp = await fetchIssuesViaMcp(config);
    let issues;
    let source: "mcp" | "rest" = "rest";
    let mcpNote: string | undefined;

    if (mcp.source === "mcp") {
      issues = mcp.issues;
      source = "mcp";
    } else {
      mcpNote = `${mcp.reason} Available MCP tools: ${mcp.tools.join(", ") || "(none)"}. Falling back to Jira REST for this response.`;
      const rest = await fetchIssuesViaRest(config);
      issues = rest.issues;
      source = "rest";
    }

    const assignees = aggregateByAssignee(issues);
    res.json({
      projectKey: config.JIRA_PROJECT_KEY,
      site: config.JIRA_SITE,
      source,
      mcpNote,
      generatedAt: new Date().toISOString(),
      issueCount: issues.length,
      assignees,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[workload]", message);
    res.status(502).json({
      error: "Failed to load workload",
      detail: message,
    });
  }
});

app.listen(config.WORKER_PORT, () => {
  console.log(
    `Worker listening on http://localhost:${config.WORKER_PORT} (project ${config.JIRA_PROJECT_KEY})`,
  );
});
