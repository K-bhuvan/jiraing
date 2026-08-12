export type StatusBucket = "backlog" | "inProgress" | "inReview" | "closed";

export type AssigneeWorkload = {
  assignee: string;
  total: number;
  counts: Record<StatusBucket, number>;
  percents: Record<StatusBucket, number>;
};

export type WorkloadResponse = {
  projectKey: string;
  site: string;
  source: "mcp" | "rest";
  mcpNote?: string;
  generatedAt: string;
  issueCount: number;
  assignees: AssigneeWorkload[];
};

export type WorkloadError = {
  error: string;
  detail?: string;
};

export type CommitBucket =
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "older";

export type AuthorCommits = {
  author: string;
  total: number;
  counts: Record<CommitBucket, number>;
  percents: Record<CommitBucket, number>;
};

export type CommitsResponse = {
  owner: string;
  repo: string;
  branch?: string | null;
  source: "mcp" | "rest";
  mcpNote?: string;
  generatedAt: string;
  commitCount: number;
  authors: AuthorCommits[];
};

export type CommitsError = {
  error: string;
  detail?: string;
};
