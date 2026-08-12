from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import EmailStr, Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load repo-root .env (same location the Node worker used).
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ROOT_ENV, override=True)


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    JIRA_EMAIL: EmailStr
    JIRA_API_KEY: str = Field(min_length=1)
    JIRA_SITE: HttpUrl = Field(default="https://jetshop8900.atlassian.net")
    JIRA_PROJECT_KEY: str = Field(min_length=1)
    ATLASSIAN_MCP_URL: HttpUrl = Field(default="https://mcp.atlassian.com/v1/mcp")
    WORKER_PORT: int = 4000

    @property
    def site_str(self) -> str:
        return str(self.JIRA_SITE).rstrip("/")

    @property
    def mcp_url_str(self) -> str:
        return str(self.ATLASSIAN_MCP_URL)


@lru_cache
def get_config() -> AppConfig:
    return AppConfig()  # type: ignore[call-arg]
