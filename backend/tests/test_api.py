import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.models.neighborhood import Neighborhood
from app.services import ai_service


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "MahallEN" in data["project"]
    assert data["database_backend"] == "sqlite"
    assert data["data_mode"] == "demo"


def test_list_pilot_neighborhoods(client):
    res = client.get("/api/v1/neighborhoods")
    assert res.status_code == 200
    items = res.json()
    assert {item["slug"] for item in items} == {
        "kotekli", "emirbeyazit", "muslihittin", "orhaniye", "akyaka"
    }
    assert [item["overall_score"] for item in items] == sorted(
        [item["overall_score"] for item in items], reverse=True
    )


def test_get_kotekli_full_report(client):
    res = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res.status_code == 200
    report = res.json()
    assert report["slug"] == "kotekli"
    assert report["suitability"]["students"] >= 90
    assert report["ai_report"]["executive_summary"]
    assert "demo" in report["ai_report"]["disclaimer"].lower()


@pytest.mark.parametrize("query", ["Kötekli", "KÖTEKLİ", "KOTEKLI"])
def test_turkish_search(client, query):
    response = client.get("/api/v1/neighborhoods", params={"q": query})
    assert [item["slug"] for item in response.json()] == ["kotekli"]


@pytest.mark.parametrize("query", ["%", "_", "does-not-exist"])
def test_search_treats_wildcards_literally(client, query):
    assert client.get("/api/v1/neighborhoods", params={"q": query}).json() == []


@pytest.mark.parametrize("profile", ["student", "family", "professional"])
def test_profile_sorting(client, profile):
    items = client.get("/api/v1/neighborhoods", params={"profile": profile}).json()
    scores = [item[f"suitability_{profile}"] for item in items]
    assert scores == sorted(scores, reverse=True)


def test_invalid_search_parameters(client):
    assert client.get("/api/v1/neighborhoods", params={"q": "x" * 101}).status_code == 422
    assert client.get("/api/v1/neighborhoods", params={"profile": "invalid"}).status_code == 422


def test_missing_neighborhood(client):
    assert client.get("/api/v1/neighborhoods/missing/report").status_code == 404


def test_cors_rejects_unlisted_origin(client):
    response = client.options("/api/v1/neighborhoods", headers={
        "Origin": "https://untrusted.example",
        "Access-Control-Request-Method": "GET",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    allowed = client.options("/api/v1/neighborhoods", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    })
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in allowed.headers


def _configure_live(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key-never-sent")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "test-model")
    monkeypatch.setattr(settings, "AI_REFRESH_TOKEN", "t" * 32)


def _live_content():
    return {
        "executive_summary": "Illustrative live summary.",
        "pros": ["One example advantage."],
        "cons": ["One example limitation."],
        "student_verdict": "Illustrative student assessment.",
        "family_verdict": "Illustrative family assessment.",
        "professional_verdict": "Illustrative professional assessment.",
    }


def test_live_refresh_disabled_by_default(client, monkeypatch):
    provider = Mock()
    monkeypatch.setattr(ai_service, "_generate_live_content", provider)
    assert client.get("/api/v1/neighborhoods/kotekli/report?refresh_ai=true").status_code == 403
    provider.assert_not_called()


@pytest.mark.parametrize("token", [None, "wrong", "x" * 32])
def test_live_refresh_requires_operator_secret(client, monkeypatch, token):
    _configure_live(monkeypatch)
    provider = Mock()
    monkeypatch.setattr(ai_service, "_generate_live_content", provider)
    headers = {} if token is None else {"X-AI-Refresh-Token": token}
    assert client.get(
        "/api/v1/neighborhoods/kotekli/report?refresh_ai=true", headers=headers
    ).status_code == 403
    provider.assert_not_called()


def test_live_refresh_has_global_cooldown(client, monkeypatch):
    _configure_live(monkeypatch)
    provider = Mock(return_value=json.dumps(_live_content()))
    monkeypatch.setattr(ai_service, "_generate_live_content", provider)
    headers = {"X-AI-Refresh-Token": "t" * 32}
    first = client.get("/api/v1/neighborhoods/kotekli/report?refresh_ai=true", headers=headers)
    second = client.get("/api/v1/neighborhoods/akyaka/report?refresh_ai=true", headers=headers)
    assert first.status_code == 200
    assert first.json()["ai_report"]["executive_summary"] == _live_content()["executive_summary"]
    assert second.status_code == 429
    assert 1 <= int(second.headers["Retry-After"]) <= 60
    assert provider.call_count == 1


@pytest.mark.parametrize("raw", [
    "not JSON", "[]", json.dumps({**_live_content(), "pros": None}),
    json.dumps({**_live_content(), "executive_summary": "<script>bad</script>"}),
    json.dumps({**_live_content(), "pros": ["x" * 601]}),
    json.dumps({**_live_content(), "unexpected": "field"}), "x" * 20001,
])
def test_invalid_live_output_falls_back_without_500(client, monkeypatch, raw):
    _configure_live(monkeypatch)
    monkeypatch.setattr(ai_service, "_generate_live_content", Mock(return_value=raw))
    response = client.get(
        "/api/v1/neighborhoods/kotekli/report?refresh_ai=true",
        headers={"X-AI-Refresh-Token": "t" * 32},
    )
    assert response.status_code == 200
    assert response.json()["ai_report"]["generated_by"] == "MahallEN Demo Synthesis (sample data)"


def test_provider_failure_falls_back(client, monkeypatch):
    _configure_live(monkeypatch)
    monkeypatch.setattr(ai_service, "_generate_live_content", Mock(side_effect=TimeoutError))
    response = client.get(
        "/api/v1/neighborhoods/kotekli/report?refresh_ai=true",
        headers={"X-AI-Refresh-Token": "t" * 32},
    )
    assert response.status_code == 200
    assert "Demo" in response.json()["ai_report"]["generated_by"]


def test_read_with_missing_summary_never_calls_provider(client, monkeypatch):
    _configure_live(monkeypatch)
    provider = Mock()
    monkeypatch.setattr(ai_service, "_generate_live_content", provider)
    with client.app.state.session_factory() as db:
        db.query(Neighborhood).filter_by(slug="kotekli").first().ai_summary = None
        db.commit()
    assert client.get("/api/v1/neighborhoods/kotekli/report").status_code == 200
    provider.assert_not_called()


def test_import_does_not_connect_or_create_database(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    env = {**os.environ, "PYTHONPATH": str(backend), "PYTHONDONTWRITEBYTECODE": "1"}
    result = subprocess.run(
        [sys.executable, "-c", (
            "from unittest.mock import patch; "
            "p=patch('sqlalchemy.create_engine', side_effect=AssertionError('DB import side effect')); "
            "p.start(); import app.main; p.stop()"
        )],
        cwd=tmp_path, env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    assert not list(tmp_path.glob("*.db"))
