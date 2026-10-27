import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    """Every test owns its in-memory database and cannot call the live provider."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "")
    monkeypatch.setattr(settings, "AI_REFRESH_TOKEN", "")
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    with TestClient(create_app(database_url="sqlite://")) as test_client:
        yield test_client
