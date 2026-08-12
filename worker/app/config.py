from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import EmailStr, Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load repo-root .env (same location the Node worker used).
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ROOT_ENV, override=True)


def _strip_quotes(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        text = text[1:-1].strip()
    return text or None


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    JIRA_EMAIL: EmailStr
    JIRA_API_KEY: str = Field(min_length=1)
    JIRA_SITE: HttpUrl = Field(default="https://jetshop8900.atlassian.net")
    JIRA_PROJECT_KEY: str = Field(min_length=1)
    ATLASSIAN_MCP_URL: HttpUrl = Field(default="https://mcp.atlassian.com/v1/mcp")
    WORKER_PORT: int = 4000

    # GitHub commit panel (optional until configured).
    GITHUB_TOKEN: str | None = None
    GITHUB_OWNER: str | None = None
    GITHUB_REPO: str | None = None
    GITHUB_BRANCH: str | None = None
    GITHUB_MCP_URL: HttpUrl = Field(default="https://api.githubcopilot.com/mcp/")

    @field_validator(
        "JIRA_API_KEY",
        "GITHUB_TOKEN",
        "GITHUB_OWNER",
        "GITHUB_REPO",
        "GITHUB_BRANCH",
        mode="before",
    )
    @classmethod
    def unquote_secrets(cls, value: object) -> object:
        if isinstance(value, str):
            return _strip_quotes(value)
        return value

    @property
    def site_str(self) -> str:
        return str(self.JIRA_SITE).rstrip("/")

    @property
    def mcp_url_str(self) -> str:
        return str(self.ATLASSIAN_MCP_URL)

    @property
    def github_mcp_url_str(self) -> str:
        return str(self.GITHUB_MCP_URL)

    @property
    def github_configured(self) -> bool:
        return bool(
            (self.GITHUB_TOKEN or "").strip()
            and (self.GITHUB_OWNER or "").strip()
            and (self.GITHUB_REPO or "").strip()
        )


@lru_cache
def get_config() -> AppConfig:
    return AppConfig()  # type: ignore[call-arg]
