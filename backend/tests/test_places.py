from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Event
from unittest.mock import Mock

from app.core.config import settings
from app.models.place import Place
from app.models.report_cache import ReportCache
from app.services import place_service, place_research, place_assessment


TARGET = {"name": "Erzene", "district": "Bornova", "city": "İzmir", "location": {"lat": 38.47, "lon": 27.22}}


def discovered(client, monkeypatch):
    monkeypatch.setattr(place_service, "lookup_neighborhoods", lambda q: [TARGET])
    found = client.get("/api/v1/places/search?q=Erzene").json()["results"]
    return "/api/v1/places/" + found[0]["id"] + "/report"


def fixture_report(identity):
    return {"place": {"id": identity, **{k: TARGET[k] for k in ("name", "district", "city")}},
        "summary": "Kaynaklı rapor", "reference_date": "2026-11-06", "categories": [],
        "origin": "grounded_research_candidate", "limitations": [], "generated_by": "test", "report_version": 3, "writer_model": settings.GEMINI_REPORT_MODEL}


def test_empty_search_does_not_return_a_pilot_catalog(client, monkeypatch):
    lookup = Mock()
    monkeypatch.setattr(place_service, "lookup_neighborhoods", lookup)
    assert client.get("/api/v1/places/search?q=").status_code == 422
    assert client.get("/api/v1/places/search?q=%20%20").status_code == 400
    lookup.assert_not_called()


def test_search_can_discover_a_neighborhood_outside_saved_ten(client, monkeypatch):
    path = discovered(client, monkeypatch)
    assert client.get(path).status_code == 404
    identity = path.split("/")[-2]
    with client.app.state.session_factory() as db:
        assert db.get(Place, identity).target["district"] == "Bornova"


def test_saved_sources_are_upgraded_once_without_search_and_full_report_is_cached(client, monkeypatch):
    generate = Mock(side_effect=AssertionError("Search must not run for saved evidence"))
    assess = Mock(side_effect=lambda evidence: {**evidence, "report_version": 3, "writer_model": settings.GEMINI_REPORT_MODEL, "assessment": {"test": True}})
    monkeypatch.setattr(place_research, "generate_place_report", generate)
    monkeypatch.setattr(place_assessment, "assess_place_report", assess)
    found = client.get("/api/v1/places/search?q=Caferağa").json()["results"]
    path = f"/api/v1/places/{found[0]['id']}/report"
    assert client.get(path).status_code == 404
    first = client.post(path)
    assert first.status_code == 201 and first.headers["x-cache"] == "MISS"
    a, b = client.get(path), client.post(path)
    assert a.status_code == b.status_code == 200
    assert a.headers["x-cache"] == b.headers["x-cache"] == "HIT"
    assert a.json() == b.json() == first.json()
    generate.assert_not_called()
    assess.assert_called_once()


def test_new_place_is_generated_once_and_next_read_and_post_hit_cache(client, monkeypatch):
    path = discovered(client, monkeypatch)
    generate = Mock(side_effect=lambda target, identity: fixture_report(identity))
    monkeypatch.setattr(place_research, "generate_place_report", generate)
    first = client.post(path)
    assert first.status_code == 201 and first.headers["x-cache"] == "MISS"
    for method in (client.get, client.post):
        next_response = method(path)
        assert next_response.status_code == 200 and next_response.headers["x-cache"] == "HIT"
        assert next_response.json() == first.json()
    generate.assert_called_once()


def test_cache_from_another_model_is_not_served_as_flash_lite(client, monkeypatch):
    path = discovered(client, monkeypatch)
    identity = path.split("/")[-2]
    wrong = {**fixture_report(identity), "writer_model": "gemini-2.5-flash"}
    with client.app.state.session_factory() as db:
        db.add(ReportCache(slug="place:" + identity, report_data=wrong, model_version="old-writer",
            cached_at=datetime.now(timezone.utc), expires_at=datetime.now(timezone.utc) + timedelta(hours=1), hit_count=0))
        db.commit()
    assert client.get(path).status_code == 404
    upgrade = Mock(return_value=fixture_report(identity))
    monkeypatch.setattr(place_assessment, "assess_place_report", upgrade)
    assert client.post(path).status_code == 201
    result = client.get(path)
    assert result.status_code == 200 and result.headers["x-cache"] == "HIT"
    assert result.json()["writer_model"] == settings.GEMINI_REPORT_MODEL
    upgrade.assert_called_once()


def test_failure_does_not_create_cache_and_expired_previous_report_is_preserved(client, monkeypatch):
    path = discovered(client, monkeypatch)
    identity = path.split("/")[-2]
    with client.app.state.session_factory() as db:
        previous = fixture_report(identity)
        db.add(ReportCache(slug="place:" + identity, report_data=previous, model_version="old",
            cached_at=datetime.now(timezone.utc), expires_at=datetime.now(timezone.utc) - timedelta(hours=1), hit_count=3))
        db.commit()
    monkeypatch.setattr(place_research, "generate_place_report", Mock(side_effect=RuntimeError("secret-provider-error")))
    response = client.post(path)
    assert response.status_code == 502
    assert "secret-provider-error" not in response.text
    with client.app.state.session_factory() as db:
        entry = db.query(ReportCache).filter_by(slug="place:" + identity).one()
        assert entry.report_data == previous and entry.hit_count == 3


def test_missing_key_is_actionable_and_not_cached(client, monkeypatch):
    path = discovered(client, monkeypatch)
    response = client.post(path)
    assert response.status_code == 503 and "API anahtarı" in response.json()["detail"]
    assert client.get(path).status_code == 404


def test_local_search_survives_geocoder_outage_without_claiming_new_results(client, monkeypatch):
    lookup = Mock(side_effect=RuntimeError("offline"))
    monkeypatch.setattr(place_service, "lookup_neighborhoods", lookup)
    response = client.get("/api/v1/places/search?q=Akyaka")
    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Akyaka"
    lookup.assert_not_called()
    assert client.get("/api/v1/places/search?q=UnregisteredPlace").status_code == 503


def test_autocomplete_searches_national_directory_without_network_or_generation(client, monkeypatch):
    lookup = Mock(side_effect=AssertionError("Autocomplete must stay local"))
    generate = Mock(side_effect=AssertionError("Typing must not create a report"))
    monkeypatch.setattr(place_service, "lookup_neighborhoods", lookup)
    monkeypatch.setattr(place_research, "generate_place_report", generate)
    response = client.get("/api/v1/places/suggest?q=erze")
    assert response.status_code == 200
    first = response.json()["results"][0]
    assert (first["name"], first["district"], first["city"]) == ("Erzene", "Bornova", "İzmir")
    assert not first["report_available"]
    lookup.assert_not_called()
    generate.assert_not_called()


def test_autocomplete_disambiguates_city_and_is_accent_insensitive(client):
    response = client.get("/api/v1/places/suggest?q=caferaga%20kadikoy")
    assert response.status_code == 200
    assert len(response.json()["results"]) == 1
    assert response.json()["results"][0]["city"] == "İstanbul"


def test_concurrent_clicks_share_one_generation(client, monkeypatch):
    path = discovered(client, monkeypatch)
    started, release = Event(), Event()
    def generate(target, identity):
        started.set()
        assert release.wait(5)
        return fixture_report(identity)
    spy = Mock(side_effect=generate)
    monkeypatch.setattr(place_research, "generate_place_report", spy)
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(client.post, path)
        assert started.wait(5)
        second = executor.submit(client.post, path)
        release.set()
        responses = [first.result(), second.result()]
    assert sorted(r.status_code for r in responses) == [200, 201]
    assert responses[0].json() == responses[1].json()
    spy.assert_called_once()


def test_identity_separates_same_name_in_different_cities():
    assert place_service.place_id(TARGET) != place_service.place_id({**TARGET, "city": "Ankara"})
    assert place_service.place_id(TARGET) == place_service.place_id({**TARGET, "name": "Erzene Mahallesi"})
