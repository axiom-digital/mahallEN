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
