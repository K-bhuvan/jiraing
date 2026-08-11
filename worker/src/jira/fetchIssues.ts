import type { AppConfig } from "../config.ts";
import type { IssueLike } from "../aggregate/workload.ts";

type JiraSearchJqlResponse = {
  issues?: Array<{
    key: string;
    fields: {
      status?: {
        name?: string;
        statusCategory?: { name?: string; key?: string };
      };
      assignee?: { displayName?: string } | null;
    };
  }>;
  nextPageToken?: string;
  isLast?: boolean;
};

export async function fetchIssuesViaRest(
  config: AppConfig,
): Promise<{ source: "rest"; issues: IssueLike[] }> {
  const auth = Buffer.from(
    `${config.JIRA_EMAIL}:${config.JIRA_API_KEY}`,
  ).toString("base64");
  const url = `${config.JIRA_SITE.replace(/\/$/, "")}/rest/api/3/search/jql`;

  const all: IssueLike[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < 50; page += 1) {
    const body: Record<string, unknown> = {
      jql: `project = ${config.JIRA_PROJECT_KEY} ORDER BY updated DESC`,
      maxResults: 100,
      fields: ["status", "assignee"],
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Jira REST search failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as JiraSearchJqlResponse;
    const issues = data.issues ?? [];
    for (const issue of issues) {
      all.push({
        key: issue.key,
        statusName: issue.fields.status?.name ?? "Unknown",
        statusCategory:
          issue.fields.status?.statusCategory?.name ??
          issue.fields.status?.statusCategory?.key ??
          null,
        assigneeName: issue.fields.assignee?.displayName ?? null,
      });
    }

    if (data.isLast === true || !data.nextPageToken || issues.length === 0) {
      break;
    }
    nextPageToken = data.nextPageToken;
  }

  return { source: "rest", issues: all };
}
