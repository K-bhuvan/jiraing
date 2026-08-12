# Assignee & commit mix dashboard

A simple web app with **two stacked-bar panels**:

1. **Jira — Assignee mix** — who owns which tickets, by status  
2. **GitHub — Commit mix** — who is committing how much, by recency  

Each person gets a stacked bar and percentages (always adding up to 100%). Both panels show a **via MCP** / **via REST** pill so you can see which path served the data.

## Dashboard preview

<p align="center">
  <img
    src="docs/dashboard-screenshot.png"
    alt="Assignee workload dashboard — stacked bars and percentages by person"
    width="920"
  />
</p>

> Live view: Jira assignees by status, plus GitHub authors by commit age (Last 7 days · 8–30 · 31–90 · Older).

---

## Big picture

| Zone | What lives there | Simple role |
|------|------------------|-------------|
| **Your machine** | Browser, Next.js (`web/`), Python worker (`worker/`) | UI + local API |
| **Worker decisions** | MCP vs REST for Jira **and** GitHub, then aggregate | Fetch + math |
| **Atlassian Cloud** | Rovo MCP + Jira | Ticket source of truth |
| **GitHub** | GitHub MCP + REST | Commit source of truth |

![Architecture flow with numbered steps from browser to Jira and back to the dashboard](docs/architecture-flow.png)

<p align="center"><em>Jira path (diagram above). GitHub follows the same pattern: worker prefers MCP, falls back to REST.</em></p>

---

## How data flows

### Jira panel

1. **Open the site** (http://localhost:3000).
2. **Ask the worker** — web loads `WORKER_URL/workload`.
3. **Authenticate** — email + Atlassian API token from `.env`.
4. **Preferred fetch (MCP)** — Atlassian Rovo MCP searches your project.
5. **Automatic backup (REST)** — if MCP cannot search, use Jira REST.
6. **Group & score** — bucket by status (Backlog / In Progress / In Review / Closed), percentages sum to 100.
7. **Render** — assignee table with stacked bars. Header pill: **via MCP** or **via REST**.

### GitHub panel

1. Same page load also calls `WORKER_URL/commits`.
2. **Authenticate** — `GITHUB_TOKEN` (PAT) from `.env`.
3. **Preferred fetch (MCP)** — GitHub MCP `list_commits` (`GITHUB_MCP_URL`, default `https://api.githubcopilot.com/mcp/`).
4. **Automatic backup (REST)** — if MCP is unavailable, use `GET /repos/{owner}/{repo}/commits`.
5. **Group & score** — bucket each commit by age:
   - **Last 7 days**
   - **8–30 days**
   - **31–90 days**
   - **Older**
6. **Render** — author table with the same stacked-bar style. Header pill: **via MCP** or **via REST**.

---

## Walkthrough with a real example (Jira)

| Ticket | Status in Jira | Assigned to | Bucket we use |
|--------|----------------|-------------|----------------|
| KAN-1 | To Do | jet | Backlog |
| KAN-5 | To Do | jet | Backlog |
| KAN-2 | In Progress | jet | In Progress |
| KAN-4 | In Review | _(nobody)_ | In Review |

| Person | Total | What you see |
|--------|-------|----------------|
| **jet** | 3 | ~67% Backlog, ~33% In Progress |
| **Unassigned** | 1 | 100% In Review |

---

## Project folders

```text
jira_ticketing/
  web/       ← dashboard UI (Jira + GitHub panels)
  worker/    ← Python FastAPI (Jira + GitHub MCP/REST)
  docs/      ← diagrams and docs assets
  .env       ← secrets — never commit this
```

---

## Setup (run it locally)

1. Copy `.env.example` to `.env` and fill in:

**Jira**
- `JIRA_EMAIL` — Atlassian login email  
- `JIRA_API_KEY` — Atlassian API token  
- `JIRA_SITE` — e.g. `https://your-site.atlassian.net`  
- `JIRA_PROJECT_KEY` — e.g. `KAN`  

**GitHub (commits panel)**
- `GITHUB_TOKEN` — GitHub PAT with **Contents: Read** (fine-grained) or `repo` / `public_repo` (classic)  
- `GITHUB_OWNER` / `GITHUB_REPO` — e.g. `K-bhuvan` / `jiraing`  
- `GITHUB_MCP_URL` — default `https://api.githubcopilot.com/mcp/`  
- Optional: `GITHUB_BRANCH` — branch or SHA to list from  

**App**
- `WORKER_PORT` — usually `4000`  
- `WORKER_URL` — usually `http://localhost:4000`  

### Getting a GitHub token

1. Open [Fine-grained tokens](https://github.com/settings/personal-access-tokens) (or [Classic tokens](https://github.com/settings/tokens)).
2. Generate a token with read access to the target repo (**Contents: Read**).
3. Put it in `.env` as `GITHUB_TOKEN=...` (quotes optional).
4. **Restart the worker** after changing `.env` so config reloads.

2. Start the worker (Terminal 1):

```bash
cd worker
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

Or from the repo root (after the venv exists): `npm run start:worker`  
Or use Conductor’s **Run** button (`scripts/dev.sh`).

3. Start the website (Terminal 2):

```bash
cd web
npm install
npm run dev
```

4. Open **http://localhost:3000** (or **http://127.0.0.1:3000**).

> **Tip:** Use Python **3.11+** for the worker. After editing `.env`, restart the worker — env is loaded at process start.

---

## Words you might see

| Term | Meaning |
|------|---------|
| **Assignee** | Person who owns the Jira ticket |
| **Author** | Person attributed on a GitHub commit |
| **via MCP** | Data came from the preferred MCP tool bridge |
| **via REST** | MCP unavailable; HTTP API fallback was used |
| **Worker** | Python FastAPI backend (`/workload` + `/commits`) |

---

## Notes for MCP

**Jira / Atlassian**
- Prefer Rovo MCP when the API token can use Jira search tools.
- Classic scope **`read:jira-work`** (“View Jira issue data”) is usually enough.
- An org admin may need to enable API-token auth for Rovo MCP.
- If MCP search fails, the app falls back to Jira REST automatically.

**GitHub**
- Prefer GitHub remote MCP (`list_commits`) with a PAT as `Authorization: Bearer …`.
- If MCP has no `list_commits` tool (or errors), the app falls back to GitHub REST automatically.
- The commits panel stays empty until `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` are set.
