from copy import deepcopy

from app.services import rule_scoring as rules


def test_kotekli_uses_the_detailed_research_and_existing_rubric():
    record = rules.matched_record({"name": "Kötekli", "district": "Menteşe", "city": "Muğla"})
    result = rules.calculate(record)
    assert result["scores"] == {"rent_cost": 18, "transportation": 35, "social_life": 73,
                                "safety_news": 25, "earthquake_hazard": 23}
    assert len(record["venues"]) == 44 and len(record["routes"]) == 4
    assert result["counts"] == {"rents": 8, "venues": 40, "routes": 3, "news": 8}
    assert rules.matched_record({"name": "Kötekli", "district": "Başka İlçe", "city": "Muğla"}) is None


def test_unknown_is_never_neutral_fifty_and_true_zero_survives():
    result = rules.calculate({"asOf": "2026-11-07"})
    assert all(value is None for value in result["scores"].values())
    record = {"asOf": "2026-11-07", "rents": [
        {"rooms": "1+1", "date": "2026-11-01", "eligible": True, "amount": 40000,
         "sources": [{"url": "https://example.org/listing"}]}]}
    assert rules.calculate(record)["scores"]["rent_cost"] == 0
    record["rents"][0]["date"] = "2025-01-01"
    assert rules.calculate(record)["scores"]["rent_cost"] is None


def test_extra_coverage_of_the_same_incident_does_not_multiply_its_effect():
    event = {"date": "2026-11-01", "type": "asayiş", "summary": "Silahlı olayda bir kişi yaşamını yitirdi.",
             "sources": [{"url": "https://example.org/news"}]}
    one = rules.calculate({"asOf": "2026-11-07", "news": [event]})
    many = rules.calculate({"asOf": "2026-11-07", "news": [deepcopy(event) for _ in range(10)]})
    assert one["scores"]["safety_news"] == many["scores"]["safety_news"] == 30


def test_grid_comparison_is_computed_and_rejects_far_away_points():
    record = {"asOf": "2026-11-07", "hazard": {"value": .351, "score": 99, "gridDistance": 1,
        "url": "https://aperta.ulakbim.gov.tr/records/274290"}}
    assert rules.calculate(record)["scores"]["earthquake_hazard"] == 23
    record["hazard"]["gridDistance"] = 6
    assert rules.calculate(record)["scores"]["earthquake_hazard"] is None


def test_price_without_explicit_monthly_period_does_not_become_affordability():
    evidence = {"place": {"name": "Test", "district": "Test", "city": "Test"}, "reference_date": "2026-11-07",
        "categories": [{"id": "rent_cost", "items": [{"text": "1+1 25000 TL 2026-11-01",
        "evidence_quote": "1+1 25000 TL 2026-11-01", "sources": [{"url": "https://example.org/listing"}]}]}]}
    assert rules.record_for(evidence)["rents"] == []
    evidence["categories"][0]["items"][0]["evidence_quote"] = "1+1 25000 TL/ay 2026-11-01"
    assert rules.record_for(evidence)["rents"][0]["amount"] == 25000
