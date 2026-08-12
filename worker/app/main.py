from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.aggregate.workload import aggregate_by_assignee
from app.config import get_config
from app.jira.fetch_issues import fetch_issues_via_rest
from app.mcp.atlassian_client import fetch_issues_via_mcp

config = get_config()

app = FastAPI(title="jira-workload-worker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "projectKey": config.JIRA_PROJECT_KEY,
        "site": config.site_str,
    }


@app.get("/workload")
async def workload():
    try:
        mcp = await fetch_issues_via_mcp(config)
        mcp_note: str | None = None

        if mcp["source"] == "mcp":
            issues = mcp["issues"]
            source = "mcp"
        else:
            tools = mcp.get("tools") or []
            mcp_note = (
                f"{mcp['reason']} Available MCP tools: "
                f"{', '.join(tools) or '(none)'}. "
                "Falling back to Jira REST for this response."
            )
            issues = await fetch_issues_via_rest(config)
            source = "rest"

        assignees = aggregate_by_assignee(issues)
        payload = {
            "projectKey": config.JIRA_PROJECT_KEY,
            "site": config.site_str,
            "source": source,
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "issueCount": len(issues),
            "assignees": [a.to_dict() for a in assignees],
        }
        if mcp_note:
            payload["mcpNote"] = mcp_note
        return payload
    except Exception as err:
        message = str(err) or "Unknown error"
        print(f"[workload] {message}")
        return JSONResponse(
            status_code=502,
            content={
                "error": "Failed to load workload",
                "detail": message,
            },
        )


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=config.WORKER_PORT,
        reload=False,
    )


if __name__ == "__main__":
    main()
