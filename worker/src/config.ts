import { z } from "zod";

const envSchema = z.object({
  JIRA_EMAIL: z.string().email(),
  JIRA_API_KEY: z.string().min(1),
  JIRA_SITE: z
    .string()
    .url()
    .default("https://jetshop8900.atlassian.net"),
  JIRA_PROJECT_KEY: z.string().min(1),
  ATLASSIAN_MCP_URL: z
    .string()
    .url()
    .default("https://mcp.atlassian.com/v1/mcp"),
  WORKER_PORT: z.coerce.number().default(4000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
