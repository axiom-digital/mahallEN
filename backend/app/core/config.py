import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application configuration loaded from environment variables."""

    APP_NAME: str = os.getenv("APP_NAME", "MahallEN API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./mahallen_local.db",
    )
    AUTO_FALLBACK_SQLITE: bool = os.getenv("AUTO_FALLBACK_SQLITE", "False").lower() in (
        "true",
        "1",
        "yes",
    )

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Select a supported model during the planned LLM integration work (#9).
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "")
    # Server-side operator secret; never put this in a VITE_* variable.
    AI_REFRESH_TOKEN: str = os.getenv("AI_REFRESH_TOKEN", "")

    @property
    def cors_origins(self) -> List[str]:
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return [o.strip() for o in origins.split(",") if o.strip()]


settings = Settings()
