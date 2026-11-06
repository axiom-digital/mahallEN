import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.services import ai_service


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "MahallEN" in data["project"]
    assert data["database_backend"] == "sqlite"
    assert data["data_mode"] == "pilot"


def test_list_pilot_neighborhoods(client):
    res = client.get("/api/v1/neighborhoods")
    assert res.status_code == 200
    items = res.json()
    dataset = json.loads(
        (Path(__file__).resolve().parents[2] / "data/pilot_neighborhoods.json").read_text()
    )
    assert len(items) == 10
    assert {item["slug"] for item in items} == {item["id"] for item in dataset["neighborhoods"]}
    assert all(item["overall_score"] is None for item in items)


@pytest.mark.parametrize("slug", ["kotekli", "caferaga"])
def test_pilot_reports_use_the_new_dataset(client, slug):
    url = f"/api/v1/neighborhoods/{slug}/report"
    first = client.get(url)
    assert (first.status_code, first.headers["X-Cache"]) == (200, "MISS")
    report = first.json()
    assert report["slug"] == slug
    dataset = json.loads(
        (Path(__file__).resolve().parents[2] / "data/pilot_neighborhoods.json").read_text()
    )
    pilot = next(record for record in dataset["neighborhoods"] if record["id"] == slug)
    evidence = report["pilot_evidence"]
    assert evidence["geo_key"] == pilot["geo_key"]
    assert evidence["reference_date"] == "2026-11-06"
    assert evidence["categories"] == pilot["categories"]
    assert set(report["data_sources"]) == {source["url"] for source in pilot["sources"]}
    assert all(value is None for value in report["scores"].values())
    assert all(value is None for value in report["suitability"].values())
    assert report["disaster_risk"]["pga_value_g"] == pilot["categories"]["earthquake_hazard"]["value"]
    assert report["rent_analysis"]["average_rent_tl"] is None
    second = client.get(url)
    assert second.headers["X-Cache"] == "HIT"
    assert second.json() == report


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
    assert len(scores) == 10
    assert all(score is None for score in scores)


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
    }


def test_live_refresh_disabled_by_default(client, monkeypatch):
    provider = Mock()
    monkeypatch.setattr(ai_service, "_request_gemini", provider)
    assert client.get("/api/v1/neighborhoods/kotekli/report?refresh_ai=true").status_code == 403
    provider.assert_not_called()


@pytest.mark.parametrize("token", [None, "wrong", "x" * 32])
def test_live_refresh_requires_operator_secret(client, monkeypatch, token):
    _configure_live(monkeypatch)
    provider = Mock()
    monkeypatch.setattr(ai_service, "_request_gemini", provider)
    headers = {} if token is None else {"X-AI-Refresh-Token": token}
    assert client.get(
        "/api/v1/neighborhoods/kotekli/report?refresh_ai=true", headers=headers
    ).status_code == 403
    provider.assert_not_called()


def test_live_refresh_has_global_cooldown(client, monkeypatch):
    _configure_live(monkeypatch)
    provider = Mock(return_value=json.dumps(_live_content()))
    monkeypatch.setattr(ai_service, "_request_gemini", provider)
    headers = {"X-AI-Refresh-Token": "t" * 32}
    first = client.get("/api/v1/neighborhoods/emirbeyazit/report?refresh_ai=true", headers=headers)
    second = client.get("/api/v1/neighborhoods/akyaka/report?refresh_ai=true", headers=headers)
    assert first.status_code == 200
    assert first.json()["ai_report"]["executive_summary"].endswith(_live_content()["executive_summary"])
    assert second.status_code == 429
    assert 1 <= int(second.headers["Retry-After"]) <= 60
    assert provider.call_count == 1


@pytest.mark.parametrize("raw", [
    "not JSON", "[]", json.dumps({**_live_content(), "pros": None}),
    json.dumps({**_live_content(), "executive_summary": "<script>bad</script>"}),
    json.dumps({**_live_content(), "pros": ["x" * 601]}),
    json.dumps({**_live_content(), "unexpected": "field"}), "x" * 20001,
])
def test_invalid_live_output_returns_bad_gateway(client, monkeypatch, raw):
    _configure_live(monkeypatch)
    monkeypatch.setattr(ai_service, "_request_gemini", Mock(return_value=raw))
    response = client.get(
        "/api/v1/neighborhoods/emirbeyazit/report?refresh_ai=true",
        headers={"X-AI-Refresh-Token": "t" * 32},
    )
    assert response.status_code == 502
    assert "cache was not changed" in response.json()["detail"]


def test_provider_failure_preserves_normal_pilot_response(client, monkeypatch):
    _configure_live(monkeypatch)
    monkeypatch.setattr(ai_service, "_request_gemini", Mock(side_effect=TimeoutError))
    response = client.get(
        "/api/v1/neighborhoods/emirbeyazit/report?refresh_ai=true",
        headers={"X-AI-Refresh-Token": "t" * 32},
    )
    assert response.status_code == 502
    normal = client.get("/api/v1/neighborhoods/emirbeyazit/report")
    assert normal.status_code == 200
    assert normal.json()["ai_report"]["generated_by"] == "MahallEN Pilot Sentezi"


def test_normal_read_never_calls_provider(client, monkeypatch):
    _configure_live(monkeypatch)
    provider = Mock()
    monkeypatch.setattr(ai_service, "_request_gemini", provider)
    assert client.get("/api/v1/neighborhoods/emirbeyazit/report").status_code == 200
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
