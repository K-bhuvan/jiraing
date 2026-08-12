# Jira workload worker (Python / FastAPI)

Fetches Jira issues (MCP preferred, REST fallback) and returns assignee workload summaries.

## Setup

```bash
cd worker
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ensure the repo-root `.env` is filled in (see `../.env.example`).

## Run

```bash
# from worker/
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

Or from the repo root:

```bash
npm run start:worker
```

## Test

```bash
cd worker
source .venv/bin/activate
pytest
```
