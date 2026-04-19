from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    default_ai_provider: str = "openai"
    sparky_database_path: str = "../fitness.sqlite"
    sparky_upload_dir: str = "../uploads"
    cors_allow_origins: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_path(self) -> Path:
        path = Path(self.sparky_database_path)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def upload_dir(self) -> Path:
        path = Path(self.sparky_upload_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()

