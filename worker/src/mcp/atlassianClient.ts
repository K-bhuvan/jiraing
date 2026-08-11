import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AppConfig } from "../config.ts";
import type { IssueLike } from "../aggregate/workload.ts";

function basicAuthHeader(email: string, apiKey: string): string {
  return `Basic ${Buffer.from(`${email}:${apiKey}`).toString("base64")}`;
}

function textFromToolResult(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}): unknown {
  if (result.structuredContent != null) return result.structuredContent;
  const texts = (result.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text as string);
  if (texts.length === 0) return null;
  const joined = texts.join("\n");
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}

export type McpIssueFetchResult = {
  source: "mcp";
  issues: IssueLike[];
  tools: string[];
};

export async function fetchIssuesViaMcp(
  config: AppConfig,
): Promise<McpIssueFetchResult | { source: "mcp-unavailable"; tools: string[]; reason: string }> {
  const transport = new StreamableHTTPClientTransport(
    new URL(config.ATLASSIAN_MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: basicAuthHeader(config.JIRA_EMAIL, config.JIRA_API_KEY),
        },
      },
    },
  );

  const client = new Client({
    name: "jira-workload-worker",
    version: "0.1.0",
  });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const tools = listed.tools.map((t) => t.name);

    if (!tools.includes("searchJiraIssuesUsingJql")) {
      return {
        source: "mcp-unavailable",
        tools,
        reason:
          "MCP session has no searchJiraIssuesUsingJql tool. Create an API token with Jira read/search scopes, and ensure Rovo MCP API-token auth is enabled for your org.",
      };
    }

    let cloudId: string | undefined;
    if (tools.includes("getAccessibleAtlassianResources")) {
      const resources = await client.callTool({
        name: "getAccessibleAtlassianResources",
        arguments: {},
      });
      const parsed = textFromToolResult(
        resources as {
          content?: Array<{ type: string; text?: string }>;
          structuredContent?: unknown;
        },
      );
      cloudId = extractCloudId(parsed, config.JIRA_SITE);
    }
    if (!cloudId) {
      cloudId = await resolveCloudIdFromSite(config.JIRA_SITE);
    }
    if (!cloudId) {
      return {
        source: "mcp-unavailable",
        tools,
        reason:
          "Could not resolve Atlassian cloudId for MCP Jira tools. Check JIRA_SITE.",
      };
    }

    const jql = `project = ${config.JIRA_PROJECT_KEY} ORDER BY updated DESC`;
    const args: Record<string, unknown> = {
      cloudId,
      jql,
      maxResults: 100,
      fields: ["summary", "status", "assignee"],
    };

    const all: IssueLike[] = [];
    const seen = new Set<string>();
    let nextPageToken: string | undefined;
    let startAt = 0;

    for (let page = 0; page < 20; page += 1) {
      const pageArgs: Record<string, unknown> = { ...args };
      if (nextPageToken) pageArgs.nextPageToken = nextPageToken;
      else if (startAt > 0) pageArgs.startAt = startAt;

      const result = await client.callTool({
        name: "searchJiraIssuesUsingJql",
        arguments: pageArgs,
      });
      if ("isError" in result && result.isError) {
        const errText = textFromToolResult(
          result as {
            content?: Array<{ type: string; text?: string }>;
            structuredContent?: unknown;
          },
        );
        return {
          source: "mcp-unavailable",
          tools,
          reason: `MCP searchJiraIssuesUsingJql failed: ${String(errText).slice(0, 300)}`,
        };
      }
      const payload = textFromToolResult(
        result as {
          content?: Array<{ type: string; text?: string }>;
          structuredContent?: unknown;
        },
      );
      const pageIssues = normalizeMcpIssues(payload);
      let added = 0;
      for (const issue of pageIssues.issues) {
        if (!issue.key || seen.has(issue.key)) continue;
        seen.add(issue.key);
        all.push(issue);
        added += 1;
      }

      if (added === 0) break;
      if (pageIssues.nextPageToken) {
        nextPageToken = pageIssues.nextPageToken;
        continue;
      }
      if (!pageIssues.hasMore) break;
      startAt += pageIssues.issues.length;
    }

    return { source: "mcp", issues: all, tools };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function extractCloudId(parsed: unknown, siteUrl: string): string | undefined {
  const host = new URL(siteUrl).hostname;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const url = String(rec.url ?? rec.siteUrl ?? "");
        if (url.includes(host) && typeof rec.id === "string") return rec.id;
        if (url.includes(host) && typeof rec.cloudId === "string")
          return rec.cloudId;
      }
    }
  }
  if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    if (Array.isArray(rec.resources)) return extractCloudId(rec.resources, siteUrl);
    if (typeof rec.cloudId === "string") return rec.cloudId;
  }
  return undefined;
}

async function resolveCloudIdFromSite(siteUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `${siteUrl.replace(/\/$/, "")}/_edge/tenant_info`,
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { cloudId?: string };
    return data.cloudId;
  } catch {
    return undefined;
  }
}

function normalizeMcpIssues(payload: unknown): {
  issues: IssueLike[];
  hasMore: boolean;
  nextPageToken?: string;
} {
  if (!payload) return { issues: [], hasMore: false };

  let issuesRaw: unknown[] = [];
  let total = 0;
  let startAt = 0;
  let maxResults = 0;
  let nextPageToken: string | undefined;
  let isLast: boolean | undefined;

  if (Array.isArray(payload)) {
    issuesRaw = payload;
  } else if (typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    if (Array.isArray(rec.issues)) issuesRaw = rec.issues;
    else if (Array.isArray(rec.values)) issuesRaw = rec.values;
    total = Number(rec.total ?? 0);
    startAt = Number(rec.startAt ?? 0);
    maxResults = Number(rec.maxResults ?? 0);
    if (typeof rec.nextPageToken === "string" && rec.nextPageToken) {
      nextPageToken = rec.nextPageToken;
    }
    if (typeof rec.isLast === "boolean") isLast = rec.isLast;
  }

  const issues: IssueLike[] = issuesRaw.map((raw) => {
    const issue = raw as Record<string, unknown>;
    const fields = (issue.fields ?? issue) as Record<string, unknown>;
    const status = (fields.status ?? {}) as Record<string, unknown>;
    const statusCategory = (status.statusCategory ?? {}) as Record<
      string,
      unknown
    >;
    const assignee = (fields.assignee ?? null) as Record<string, unknown> | null;
    return {
      key: String(issue.key ?? fields.key ?? ""),
      statusName: String(status.name ?? "Unknown"),
      statusCategory:
        (statusCategory.name as string | undefined) ??
        (statusCategory.key as string | undefined) ??
        null,
      assigneeName:
        (assignee?.displayName as string | undefined) ??
        (assignee?.name as string | undefined) ??
        null,
    };
  });

  if (isLast === true) {
    return { issues, hasMore: false, nextPageToken: undefined };
  }
  if (nextPageToken) {
    return { issues, hasMore: true, nextPageToken };
  }

  const hasMore =
    total > 0
      ? startAt + issues.length < total
      : maxResults > 0 && issues.length >= maxResults;

  return { issues, hasMore };
}
