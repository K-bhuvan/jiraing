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
