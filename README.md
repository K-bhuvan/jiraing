# Jira assignee workload dashboard

A simple web app that shows **who owns which Jira tickets**, grouped by person, with a visual breakdown of:

- **Backlog** (To Do / not started)
- **In Progress**
- **In Review**
- **Closed** (Done)

Each person gets a stacked bar and percentages (always adding up to 100%).

---

## Big picture

Think of the system as **four boxes** talking to each other:

| Piece | What it is | Simple role |
|-------|------------|-------------|
| **Browser** | Your web browser | Shows the dashboard |
| **Web app** (`web/`) | Next.js website | Builds the page and asks the worker for data |
| **Worker** (`worker/`) | Small backend API | Fetches tickets from Jira and does the math |
| **Atlassian / Jira** | Your company’s Jira cloud | Source of truth for tickets |

![Architecture flow: Browser → Next.js → Worker → Atlassian MCP / Jira REST → aggregate → dashboard](docs/architecture-flow.png)

---

## How data flows (plain English)

When you open or refresh the dashboard, this is what happens:

1. **You open the site** in the browser (http://localhost:3000).
2. **The web app** asks the worker: “Give me the latest workload summary.”
3. **The worker** logs into Atlassian using the email + API token from your `.env` file.
4. **Preferred path (MCP):** the worker talks to **Atlassian Rovo MCP** (a standard “tool bridge” into Jira) and searches tickets in your project (for example `KAN`).
5. **Backup path (REST):** if MCP cannot search tickets, the worker calls **Jira’s normal API** instead. Same login, different door. The dashboard still works.
6. **The worker sorts tickets** by the person assigned to them. Tickets with no assignee become **Unassigned**.
7. **Each ticket is put in one bucket** based on its status name:
   - status contains “review” → **In Review**
   - Done / Closed / Resolved → **Closed**
   - In Progress → **In Progress**
   - otherwise → **Backlog**
8. **Percentages are calculated** per person (example: 2 of 3 tickets in backlog → about 67% backlog).
9. **The web app draws the table** — one row per person, with a colored stacked bar and the four percentages.

The header pill **via MCP** means step 4 worked. **via REST** means the backup path in step 5 was used.

---

## Walkthrough with a real example

Suppose Jira project `KAN` has these tickets:

| Ticket | Status in Jira | Assigned to | Bucket we use |
|--------|----------------|-------------|----------------|
| KAN-1 | To Do | jet | Backlog |
| KAN-5 | To Do | jet | Backlog |
| KAN-2 | In Progress | jet | In Progress |
| KAN-4 | In Review | _(nobody)_ | In Review |

The dashboard shows:

| Person | Total | What you see |
|--------|-------|----------------|
| **jet** | 3 | ~67% Backlog, ~33% In Progress, 0% Review, 0% Closed |
| **Unassigned** | 1 | 100% In Review |

So if **In Review** looks empty for jet, check who owns that ticket on the Jira board — it may be Unassigned.

---

## Project folders

```text
jira_ticketing/
  web/       ← the website (dashboard UI)
  worker/    ← the API that talks to Jira / MCP
  docs/      ← diagrams and docs assets
  .env       ← secrets (email, API token, project key) — never commit this
```

---

## Setup (run it locally)

1. Copy `.env.example` to `.env` and fill in:
   - `JIRA_EMAIL` — your Atlassian login email  
   - `JIRA_API_KEY` — Atlassian API token  
   - `JIRA_SITE` — e.g. `https://your-site.atlassian.net`  
   - `JIRA_PROJECT_KEY` — e.g. `KAN`  
   - `WORKER_PORT` — usually `4000`

2. Start the worker (Terminal 1):

```bash
cd worker
npm install
npm run start
```

3. Start the website (Terminal 2):

```bash
cd web
npm install
npm run dev
```

4. Open **http://localhost:3000** in your browser.

> **Tip:** Install and run from the **same** environment (all Windows **or** all WSL). Mixing them can break native packages like `esbuild`.

Optional for the website: set `WORKER_URL=http://localhost:4000` in `web/.env.local` (this is the default).

---

## Words you might see

| Term | Meaning |
|------|---------|
| **Assignee** | The person who owns the ticket |
| **MCP** | Model Context Protocol — a standard way apps call tools (here: Jira tools hosted by Atlassian) |
| **REST API** | Jira’s normal HTTP interface for reading/writing tickets |
| **cloudId** | Atlassian’s internal ID for your Jira site (needed for MCP Jira calls) |
| **Worker** | Our small backend that fetches and summarizes tickets |

---

## Notes for MCP

- MCP is preferred when your API token can use Jira search tools.
- Create an API token with classic scope **`read:jira-work`** (“View Jira issue data”). You usually will **not** see a scope literally named `search:jira-work` in the UI.
- An org admin may need to enable **API token authentication** for Rovo MCP in Atlassian Administration.
- If MCP search is unavailable, the app automatically uses Jira REST so the dashboard keeps working.
