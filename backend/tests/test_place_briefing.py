from copy import deepcopy

from app.services.place_briefing import build_briefing
from app.services.rule_scoring import calculate, matched_record


def test_reader_rent_groups_match_scoring_and_do_not_mix_room_types():
    record = matched_record({"name": "Kötekli", "district": "Menteşe", "city": "Muğla"})
    calculation = calculate(record)
    briefing = build_briefing(record, calculation)
    groups = {group["rooms"]: group for group in briefing["rent_types"]}
    assert groups["1+1"]["median"] == calculation["monthly_rent"] == 23000
    assert groups["1+1"]["sample_count"] == calculation["rent_sample_count"] == 3
    assert groups["3+1"]["median"] == 36000
    assert all(row["rooms"] == group["rooms"] for group in groups.values() for row in group["listings"])
    assert len(briefing["routes"]) == calculation["counts"]["routes"]
    assert all(venue["sources"] for venue in briefing["venues"])


def test_old_seasonal_and_conflicting_rents_are_visible_but_not_compared():
    source = [{"url": "https://example.org/listing"}]
    base = {"amount": 15000, "rooms": "1+1", "eligible": True, "date": "2026-11-01", "sources": source}
    rows = [deepcopy(base) for _ in range(4)]
    rows[1].update(date="2025-01-01", amount=1000)
    rows[2].update(lease="seasonal", amount=2000)
    rows[3].update(locationConflict=True, amount=3000)
    record = {"asOf": "2026-11-07", "rents": rows}
    group = build_briefing(record, calculate(record))["rent_types"][0]
    assert group["median"] == 15000 and group["sample_count"] == 1
    assert len(group["listings"]) == 4


def test_empty_record_does_not_invent_prices_or_places():
    record = {"asOf": "2026-11-07"}
    briefing = build_briefing(record, calculate(record))
    assert briefing["rent_types"] == briefing["venues"] == briefing["routes"] == []
    assert "TL" not in briefing["overview"]


def test_notice_read_date_is_not_presented_as_publication_date():
    record = {"asOf": "2026-11-07", "transportAlerts": [{"summary": "Durak erişim duyurusu",
        "observedAt": "2026-11-06", "sources": [{"url": "https://example.org/route"}]}]}
    notice = build_briefing(record, calculate(record))["transport_notices"][0]
    assert notice["date"] is None
    assert notice["observed_at"] == "2026-11-06"


def test_writer_context_is_bounded_and_keeps_diverse_named_examples():
    import json
    from app.services.place_assessment import CATEGORY_WEIGHTS, detailed_evidence, narrative_package
    record = matched_record({"name": "Kötekli", "district": "Menteşe", "city": "Muğla"})
    evidence = {"place": {key: record[key] for key in ("name", "district", "city")}, "reference_date": record["asOf"],
        "limitations": [], "categories": [{"id": key, "label": key, "items": []} for key in CATEGORY_WEIGHTS]}
    calculation = calculate(record)
    briefing = build_briefing(record, calculation)
    package = narrative_package(detailed_evidence(evidence, record), calculation, briefing)
    encoded = json.dumps(package, ensure_ascii=False)
    assert "vertexaisearch" not in encoded
    assert len(encoded) < 40000
    assert len({venue["kind"] for venue in package["facts"]["venue_examples"]}) >= 6
