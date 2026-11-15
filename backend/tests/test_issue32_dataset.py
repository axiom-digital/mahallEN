"""Offline contract and regression checks for the issue #32 evidence handoff."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backend/scripts"
sys.path.insert(0, str(SCRIPTS))
import build_issue32_dataset as builder
from collect_issue32_geography import choose
from collect_issue32_rents import parse_detail


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def test_ten_targets_have_exact_identity_and_consistent_categories():
    package = load("data/pilot_neighborhoods.json")
    records = package["neighborhoods"]
    targets = load("data/issue32/targets.json")
    assert len(records) == len(targets) == 10
    assert len({r["geo_key"] for r in records}) == 10
    assert len({r["city"] for r in records}) == 6
    assert {r["id"] for r in records} == {t["id"] for t in targets}
    for record, target in zip(records, targets):
        assert all(record[k] == target[k] for k in ("id", "name", "district", "city"))
        assert set(record["categories"]) == set(builder.CATEGORIES)
        assert all(c["score"] is None for c in record["categories"].values())
    assert not any(r["id"] == "yenikoy" for r in records)
    assert next(r for r in records if r["id"] == "kultur")["district"] == "Konak"


def test_every_admitted_url_has_a_successful_response_and_matching_receipts():
    targets, sources, claims, _, _ = builder.inputs()
    audit = {r["requested_url"]: r for r in load("data/issue32/source_audit.json")["checks"]}
    receipts = load("data/issue32/review_receipts.json")
    for claim in claims:
        if claim.get("decision") != "exclude":
            builder.validate_receipt(claim, receipts, sources, audit)
    manifest = load("data/issue32/manifest.json")
    assert manifest["active_source_urls_checked"] == manifest["active_unique_source_urls"] == manifest["active_source_urls_http_200"]
    for record in load("data/pilot_neighborhoods.json")["neighborhoods"]:
        ids = {s["id"] for s in record["sources"]}
        assert all(s["url"].startswith("https://") and s["http_status"] == 200 for s in record["sources"])
        for cat in record["categories"].values():
            for observation in cat["observations"]:
                assert set(observation["source_ids"]) <= ids
                assert observation["target_id"] == record["id"]
            if cat["status"] == "missing":
                assert cat["observations"] == [] and cat["missing_reason"]


def test_changed_claim_or_failed_http_cannot_pass_previous_review():
    _, sources, claims, _, _ = builder.inputs()
    claim = next(c for c in claims if c.get("decision") != "exclude")
    receipts = load("data/issue32/review_receipts.json")
    audit = {r["requested_url"]: r for r in load("data/issue32/source_audit.json")["checks"]}
    with pytest.raises(ValueError, match="Review is stale"):
        builder.validate_receipt({**claim, "text": "unsupported replacement"}, receipts, sources, audit)
    audit[sources[claim["source_id"]]["url"]]["http_status"] = 403
    with pytest.raises(ValueError, match="Source is not readable"):
        builder.validate_receipt(claim, receipts, sources, audit)


def test_rental_update_dates_and_unknown_contracts_are_not_market_averages():
    from datetime import date
    samples = load("data/issue32/rental_samples.json")
    assert {c["target_id"] for c in samples["claims"]} == {t["id"] for t in load("data/issue32/targets.json")}
    for claim in samples["claims"]:
        assert claim["asking_amount_tl"] > 0
        assert claim["amount_tl_month"] is None and claim["price_period"] == "not_explicitly_stated"
        assert claim["date_basis"] == "listing_updated_at"
        assert 0 <= (date.fromisoformat(builder.AS_OF) - date.fromisoformat(claim["date"])).days <= 90
        assert claim["publication_date"] is None
        assert claim["lease_term"] == "unknown" and claim["eligible_for_current_comparison"] is False
    assert any(r["reason"] == "detail_address_does_not_match_target" for r in samples["rejected"])


def test_footer_neighborhood_mentions_cannot_qualify_a_rental():
    page = {"text": "Daire Orhaniye Mahallesi, Menteşe , Muğla - Haritada Gör 20000 ₺ Komşu Mahalleler Emirbeyazıt Mahallesi, Menteşe , Muğla"}
    target = {"name": "Emirbeyazıt", "district": "Menteşe", "city": "Muğla"}
    with pytest.raises(ValueError, match="detail_address"):
        parse_detail(page, target)


def test_administrative_name_suffix_is_accepted_but_other_city_is_rejected():
    target = {"name": "Kültür", "district": "Konak", "city": "İzmir"}
    valid = {"name": "Kültür Mahallesi", "display_name": "Kültür Mahallesi, Konak, İzmir", "address": {}}
    wrong = {"name": "Kültür Mahallesi", "display_name": "Kültür Mahallesi, Nilüfer, Bursa", "address": {}}
    assert choose([valid, wrong], target) == valid
    assert choose([wrong], target) is None
    assert choose([valid, valid], target) is None


def test_hazard_is_checksum_verified_point_estimate_without_building_safety():
    geography = load("data/issue32/geography.json")
    assert geography["grid_checksum_verified_against_current_metadata"] is True
    for record in load("data/pilot_neighborhoods.json")["neighborhoods"]:
        assert record["location"]["attribution"] == "© OpenStreetMap contributors"
        hazard = record["categories"]["earthquake_hazard"]
        assert hazard["research"]["is_official_afad_tdth"] is False
        assert hazard["research"]["distance_to_grid_point_km"] <= 5
        assert hazard["unit"] == "g" and hazard["value"] > 0
        assert record["missing_values"]["building_safety"] is None


def test_manifest_and_aggregate_match_and_offline_build_is_reproducible():
    package = load("data/pilot_neighborhoods.json")
    for entry, record in zip(load("data/issue32/manifest.json")["neighborhoods"], package["neighborhoods"]):
        data = (ROOT / entry["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"]
        assert json.loads(data) == record
    paths = [ROOT / "data/pilot_neighborhoods.json", ROOT / "data/issue32/manifest.json"]
    before = [p.read_bytes() for p in paths]
    subprocess.run([sys.executable, "-X", "utf8", str(SCRIPTS / "build_issue32_dataset.py")], check=True, capture_output=True)
    assert [p.read_bytes() for p in paths] == before
