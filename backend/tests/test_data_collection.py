import csv
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


def load_script(name):
    path = Path(__file__).resolve().parents[1] / "scripts" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


direct = load_script("collect_direct_sample")
builder = load_script("build_pilot_sample")


@pytest.fixture
def grid(tmp_path, monkeypatch):
    path = tmp_path / direct.PGA_FILENAME
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["lon", "lat", "PGA"])
        writer.writerows([[28.0, 37.0, 0.2], [28.02, 37.0, 0.3]])
    metadata = {"metadata": {"creators": [{"name": "Test author"}], "license": {"id": "cc-by-sa-4.0"}},
                "files": [{"key": direct.PGA_FILENAME,
                           "checksum": "md5:" + hashlib.md5(path.read_bytes()).hexdigest()}]}
    direct.save_json(tmp_path / "aperta_274290_metadata.json", metadata)
    monkeypatch.setattr(direct, "CACHE", tmp_path)
    return path


def test_grid_lookup_retains_source_and_method(grid):
    result = direct.lookup_hazard(37.0, 28.02)
    assert result["value"] == 0.3
    assert result["distance_to_grid_point_km"] == 0
    assert result["unit"] == "g"
    assert result["is_official_afad_tdth"] is False
    assert result["method"] == "nearest published grid point; no interpolation"


def test_grid_lookup_does_not_extrapolate(grid):
    result = direct.lookup_hazard(50, 10)
    assert result["value"] is None
    assert result["status"] == "outside_supported_grid_distance"


def test_grid_rejects_wrong_checksum(grid):
    grid.write_text("changed", encoding="utf-8")
    with pytest.raises(ValueError, match="checksum"):
        direct.lookup_hazard(37, 28)


@pytest.mark.parametrize("lat,lon", [(91, 28), (37, 181), (float("nan"), 28)])
def test_grid_rejects_invalid_coordinates(grid, lat, lon):
    with pytest.raises(ValueError, match="coordinates"):
        direct.lookup_hazard(lat, lon)


def test_social_snapshot_filters_radius_and_categories(tmp_path):
    snapshot = tmp_path / "snapshot.json"
    direct.save_json(snapshot, {"request_url": "https://example.org/snapshot", "response": {
        "elements": [
            {"type": "node", "id": 1, "lat": 37, "lon": 28, "tags": {"amenity": "cafe", "name": "Test cafe"}},
            {"type": "node", "id": 2, "lat": 38, "lon": 28, "tags": {"amenity": "cafe"}},
            {"type": "node", "id": 3, "lat": 37, "lon": 28, "tags": {"building": "yes"}},
        ]}})
    result = direct.collect_social({"lat": 37, "lon": 28}, snapshot=snapshot)
    assert result["counts"] == {"cafe": 1}
    assert result["osm_object_count"] == 1
    assert result["access_mode"] == "local_one_off_osm_snapshot"
    assert result["scope"]["type"] == "radius_around_representative_point"


def test_grounding_import_excludes_unofficial_transport_and_preserves_segments():
    result = {
        "accepted_for_review": True, "model_returned": "test-model",
        "text": "KİRA:\n* A rental example. Date unknown.\nHABER:\n* An event.\nULAŞIM:\n* An unofficial route.\n",
        "grounding_metadata": {
            "grounding_chunks": [{"web": {"uri": "https://example.org/rent", "title": "example.org"}},
                                 {"web": {"uri": "https://moovitapp.com/route", "title": "moovitapp.com"}}],
            "grounding_supports": [{"segment": {"text": "Date unknown."}, "grounding_chunk_indices": [0]},
                                   {"segment": {"text": "An unofficial route."}, "grounding_chunk_indices": [1]}],
        },
    }
    categories, sources, excluded = builder.build_grounded_categories(result)
    assert len(categories["rent_cost"]["observations"]) == 1
    observation = categories["rent_cost"]["observations"][0]
    assert observation["grounding_supports"][0]["supported_text_segment"] == "Date unknown."
    assert observation["review_status"] == "requires_human_source_check"
    assert categories["transportation"]["observations"] == []
    assert any(e["reason"] == "Non-official transport publisher" for e in excluded)
    assert len(sources) == 2


def test_incomplete_grounding_cannot_be_imported():
    with pytest.raises(ValueError, match="did not finish"):
        builder.build_grounded_categories({"accepted_for_review": False})
