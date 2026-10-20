import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application configuration loaded from environment variables."""

    APP_NAME: str = os.getenv("APP_NAME", "MahallEN API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://mahallen_user:mahallen_pass@localhost:5432/mahallen_db",
    )
    AUTO_FALLBACK_SQLITE: bool = os.getenv("AUTO_FALLBACK_SQLITE", "True").lower() in (
        "true",
        "1",
        "yes",
    )

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    @property
    def cors_origins(self) -> List[str]:
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return [o.strip() for o in origins.split(",") if o.strip()]


settings = Settings()
