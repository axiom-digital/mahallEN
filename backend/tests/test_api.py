from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "MahallEN" in data["project"]


def test_list_pilot_neighborhoods():
    with TestClient(app) as client:
        res = client.get("/api/v1/neighborhoods")
        assert res.status_code == 200
        items = res.json()
        assert len(items) >= 5
        slugs = {item["slug"] for item in items}
        assert {"kotekli", "emirbeyazit", "muslihittin", "orhaniye", "akyaka"}.issubset(slugs)


def test_get_kotekli_full_report():
    with TestClient(app) as client:
        res = client.get("/api/v1/neighborhoods/kotekli/report")
        assert res.status_code == 200
        report = res.json()
        assert report["slug"] == "kotekli"
        assert report["suitability"]["students"] >= 90
        assert "executive_summary" in report["ai_report"]
        assert len(report["data_sources"]) > 0
