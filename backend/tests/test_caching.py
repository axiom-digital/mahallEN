import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock
import pytest

from app.core.config import settings
from app.models.report_cache import ReportCache
from app.services import ai_service
from app.services.pilot_report import load_pilot_neighborhoods


def test_report_caching_lifecycle(client):
    """
    Validates Issue #11 caching lifecycle:
    1. First request -> MISS (generates and stores in persistent cache)
    2. Second request -> HIT (served directly from cache, hit_count = 1)
    3. Third request -> HIT (served directly from cache, hit_count = 2)
    """
    # 1. First call: Cache MISS
    res1 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res1.status_code == 200
    assert res1.headers.get("X-Cache") == "MISS"
    assert res1.headers.get("X-Cache-Hits") == "0"
    data1 = res1.json()
    assert data1["slug"] == "kotekli"

    # 2. Second call: Cache HIT
    res2 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res2.status_code == 200
    assert res2.headers.get("X-Cache") == "HIT"
    assert res2.headers.get("X-Cache-Hits") == "1"
    data2 = res2.json()
    assert data2["slug"] == "kotekli"
    assert data2 == data1

    # 3. Third call: Cache HIT with incremented count
    res3 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res3.status_code == 200
    assert res3.headers.get("X-Cache") == "HIT"
    assert res3.headers.get("X-Cache-Hits") == "2"


def test_kotekli_ignores_existing_demo_cache(client):
    with client.app.state.session_factory() as db:
        db.add(ReportCache(
            slug="tr/mugla/mentese/kotekli",
            report_data={"slug": "kotekli", "demo": True},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        db.commit()

    response = client.get("/api/v1/neighborhoods/kotekli/report")
    assert response.status_code == 200
    assert response.headers["X-Cache"] == "MISS"
    assert response.json()["ai_report"]["generated_by"] == "MahallEN Pilot Sentezi"
    assert client.get("/api/v1/neighborhoods/kotekli/report").headers["X-Cache"] == "HIT"


def test_report_cache_expiration(client):
    """
    Validates that expired cache entries are discarded and regenerated.
    """
    # Initial request to populate cache
    res1 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res1.status_code == 200
    assert res1.headers.get("X-Cache") == "MISS"

    # Verify second is HIT
    res2 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res2.headers.get("X-Cache") == "HIT"

    # Expire the cache entry manually in DB
    app = client.app
    with app.state.session_factory() as db:
        cached = db.query(ReportCache).filter(ReportCache.slug == "tr/mugla/mentese/kotekli").first()
        assert cached is not None
        cached.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        db.commit()

    # Next call should be MISS due to expiration
    res3 = client.get("/api/v1/neighborhoods/kotekli/report")
    assert res3.status_code == 200
    assert res3.headers.get("X-Cache") == "MISS"


def test_report_cache_invalidation_endpoint(client, monkeypatch):
    """
    Validates that authorized cache invalidation deletes the cache entry.
    """
    token = "a" * 32
    monkeypatch.setattr(settings, "AI_REFRESH_TOKEN", token)

    # Populate cache
    res1 = client.get("/api/v1/neighborhoods/akyaka/report")
    assert res1.headers.get("X-Cache") == "MISS"

    # Confirm cache HIT
    res2 = client.get("/api/v1/neighborhoods/akyaka/report")
    assert res2.headers.get("X-Cache") == "HIT"

    # Unauthorized delete should fail
    del_unauth = client.delete("/api/v1/neighborhoods/akyaka/cache")
    assert del_unauth.status_code == 403

    # Authorized delete
    del_res = client.delete(
        "/api/v1/neighborhoods/akyaka/cache",
        headers={"X-AI-Refresh-Token": token},
    )
    assert del_res.status_code == 200
    assert del_res.json()["cache_invalidated"] is True

    # Next call must be MISS
    res3 = client.get("/api/v1/neighborhoods/akyaka/report")
    assert res3.status_code == 200
    assert res3.headers.get("X-Cache") == "MISS"


def test_report_cache_force_refresh_bypasses_cache(client, monkeypatch):
    """
    Validates that live refresh bypasses cache and writes fresh report.
    """
    token = "b" * 32
    monkeypatch.setattr(settings, "AI_REFRESH_TOKEN", token)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-key")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-1.5-flash")

    # Initial request -> MISS
    res1 = client.get("/api/v1/neighborhoods/emirbeyazit/report")
    assert res1.headers.get("X-Cache") == "MISS"

    # Cache hit
    res2 = client.get("/api/v1/neighborhoods/emirbeyazit/report")
    assert res2.headers.get("X-Cache") == "HIT"

    # Mock live generation
    mock_content = (
        '{"executive_summary": "Fresh live report", '
        '"pros": ["Pro 1"], "cons": ["Con 1"]}'
    )
    monkeypatch.setattr(ai_service, "_request_gemini", Mock(return_value=mock_content))

    # Force live refresh
    res_refresh = client.get(
        "/api/v1/neighborhoods/emirbeyazit/report",
        params={"refresh_ai": "true"},
        headers={"X-AI-Refresh-Token": token},
    )
    assert res_refresh.status_code == 200
    assert res_refresh.headers.get("X-Cache") == "MISS"
    assert res_refresh.json()["ai_report"]["executive_summary"].endswith("Fresh live report")

    # Subsequent normal request should hit the new cached report
    res_subsequent = client.get("/api/v1/neighborhoods/emirbeyazit/report")
    assert res_subsequent.status_code == 200
    assert res_subsequent.headers.get("X-Cache") == "HIT"
    assert res_subsequent.json()["ai_report"]["executive_summary"].endswith("Fresh live report")


def test_report_cache_disabled_flag(client, monkeypatch):
    """
    Validates that if REPORT_CACHE_ENABLED is False, reports are never served from cache.
    """
    monkeypatch.setattr(settings, "REPORT_CACHE_ENABLED", False)

    res1 = client.get("/api/v1/neighborhoods/orhaniye/report")
    assert res1.status_code == 200
    assert res1.headers.get("X-Cache") == "MISS"

    res2 = client.get("/api/v1/neighborhoods/orhaniye/report")
    assert res2.status_code == 200
    assert res2.headers.get("X-Cache") == "MISS"


@pytest.mark.parametrize("provider_failure", [TimeoutError(), '{"scores": {"safety": 100}}'])
def test_kotekli_gemini_refresh_cache_lifecycle(client, monkeypatch, provider_failure):
    monkeypatch.setattr(settings, "AI_REFRESH_TOKEN", "k" * 32)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-key")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "test-model")
    narrative = {
        "executive_summary": "Pilot gözlemler toplu taşıma bağlantılarını gösteriyor.",
        "pros": ["Kampüs bağlantısı olan hat adayları var."],
        "cons": ["Sefer sıklığı belirsiz."],
    }
    import google.generativeai as genai

    failure = (
        SimpleNamespace(text=provider_failure)
        if isinstance(provider_failure, str) else provider_failure
    )
    provider = Mock(side_effect=[SimpleNamespace(text=json.dumps(narrative)), failure])
    model = Mock(return_value=SimpleNamespace(generate_content=provider))
    monkeypatch.setattr(genai, "configure", Mock())
    monkeypatch.setattr(genai, "GenerativeModel", model)
    url = "/api/v1/neighborhoods/kotekli/report"
    refresh_url = f"{url}?refresh_ai=true"
    headers = {"X-AI-Refresh-Token": "k" * 32}

    local = client.get(url)
    assert (local.status_code, local.headers["X-Cache"]) == (200, "MISS")
    assert client.get(refresh_url).status_code == 403
    provider.assert_not_called()

    refresh = client.get(refresh_url, headers=headers)
    assert (refresh.status_code, refresh.headers["X-Cache"]) == (200, "MISS")
    updated = refresh.json()
    original = local.json()
    assert {key: value for key, value in updated.items() if key != "ai_report"} == {
        key: value for key, value in original.items() if key != "ai_report"
    }
    assert updated["ai_report"] == {
        **original["ai_report"],
        **narrative,
        "executive_summary": f"{original['tagline']}. {narrative['executive_summary']}",
        "generated_by": "Google Gemini (test-model) - neighborhood pilot",
    }
    assert "tools" not in model.call_args.kwargs
    evidence = json.loads(provider.call_args.args[0])
    _, pilot, _ = load_pilot_neighborhoods()["kotekli"]
    assert evidence["reference_date"] == pilot["reference_date"]
    assert evidence["computed_scores"] == original["scores"]
    assert evidence["earthquake_pga_g"] == original["disaster_risk"]["pga_value_g"]
    assert evidence["categories"]["rent_cost"]["observations"][0]["source_ids"]
    assert original["pilot_evidence"]["sources"] == pilot["sources"]
    assert original["pilot_evidence"]["categories"] == pilot["categories"]

    hit = client.get(url)
    assert (hit.status_code, hit.headers["X-Cache"], hit.headers["X-Cache-Hits"]) == (200, "HIT", "1")
    assert hit.json() == updated
    assert provider.call_count == 1

    client.app.state.ai_refresh_not_before = 0
    failed = client.get(refresh_url, headers=headers)
    assert failed.status_code == 502
    assert "cache was not changed" in failed.json()["detail"]
    preserved = client.get(url)
    assert (preserved.headers["X-Cache"], preserved.headers["X-Cache-Hits"]) == ("HIT", "2")
    assert preserved.json() == updated
    assert provider.call_count == 2
