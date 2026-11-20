from app.services.place_geography import hazard_for, enrich_report


def test_actual_bebek_point_gets_a_nearby_checksum_verified_grid_cell():
    h = hazard_for(41.0790159, 29.0439589)
    assert h["value"] == .388
    assert 1.3 < h["gridDistance"] < 1.5
    assert h["license"] == "cc-by-sa-4.0"
    assert "aperta.ulakbim.gov.tr" in h["url"]


def test_point_outside_coverage_has_no_invented_hazard():
    assert hazard_for(0, 0) == {}


def test_failed_optional_map_collection_does_not_erase_web_venues():
    report = {"place": {}, "research_record": {"venues": [{"name": "Kafe", "sources": []}], "hazard": {}}, "categories": []}
    assert len(enrich_report(report, {})["research_record"]["venues"]) == 1


def test_enrich_report_merges_osm_transit_routes_without_erasing_existing():
    existing_route = {
        "id": "t1", "code": "448", "route": "Beşevler - Bahçelievler",
        "localEvidence": "EGO resmî hat", "officialHeadingVerified": True,
        "sources": [{"url": "https://ego.gov.tr/448", "publisher": "ego.gov.tr"}],
    }
    osm_route = {
        "id": "osm:relation:1", "code": "A", "route": "A1 Ankaray (Dikimevi - AŞTİ)",
        "localEvidence": "EGO hafif raylı / metro hattı", "officialHeadingVerified": True,
        "sources": [{"url": "https://www.openstreetmap.org/relation/1", "publisher": "OpenStreetMap · EGO"}],
    }
    report = {
        "place": {},
        "research_record": {"venues": [], "routes": [existing_route], "hazard": {}},
        "categories": [{"id": "transportation", "label": "Ulaşım", "items": [], "missing_reason": "Veri yok"}],
    }
    enriched = enrich_report(report, {"routes": [existing_route, osm_route], "venues": []})
    codes = [r["code"] for r in enriched["research_record"]["routes"]]
    assert codes == ["448", "A"]
    t_cat = next(c for c in enriched["categories"] if c["id"] == "transportation")
    assert len(t_cat["items"]) == 1 and "Ankaray" in t_cat["items"][0]["text"]
    assert t_cat["missing_reason"] is None
