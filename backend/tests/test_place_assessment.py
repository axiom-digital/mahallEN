import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google import genai

from app.core.config import settings
from app.services import place_assessment as assessment, place_research


def test_weighted_scores_preserve_zero_and_exclude_missing_categories():
    categories = [SimpleNamespace(category="rent_cost", score=0),
                  SimpleNamespace(category="social_life", score=100),
                  SimpleNamespace(category="safety_news", score=None)]
    assert assessment.weighted_score(categories, assessment.CATEGORY_WEIGHTS) == 47
    assert assessment.weighted_score([SimpleNamespace(category="rent_cost", score=None)], assessment.CATEGORY_WEIGHTS) is None


def test_failed_upgrade_preserves_saved_evidence(client, monkeypatch):
    from app.models.report_cache import ReportCache
    from app.services import place_service
    found = client.get("/api/v1/places/search?q=Caferağa").json()["results"][0]
    key = "place:" + found["id"]
    with client.app.state.session_factory() as db:
        original = db.query(ReportCache).filter_by(slug=key).one().report_data
    monkeypatch.setattr(assessment, "assess_place_report", Mock(side_effect=place_research.ResearchUnavailable("Rapor doğrulanamadı.")))
    path = f"/api/v1/places/{found['id']}/report"
    assert client.post(path).status_code == 503
    assert client.get(path).status_code == 404
    with client.app.state.session_factory() as db:
        assert db.query(ReportCache).filter_by(slug=key).one().report_data == original


@pytest.mark.parametrize("mode", ["valid", "wrong_category", "no_evidence", "duplicate_category", "truncated"])
def test_assessment_checks_category_evidence_and_completion(monkeypatch, mode):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test")
    evidence = {"place": {"name": "Test", "district": "İlçe", "city": "Şehir"}, "reference_date": "2026-11-07",
        "limitations": [], "categories": [{"id": key, "items": [{"text": "Kaynaklı bulgu", "sources": []}]} for key in assessment.CATEGORY_WEIGHTS]}
    categories = [{"category": key, "score": None if key in {"safety_news", "earthquake_hazard"} else 60,
        "rationale": "Bu kategori yalnız kaynaklı bulgularla değerlendirildi.", "evidence_ids": [key+":1"]} for key in assessment.CATEGORY_WEIGHTS]
    if mode == "wrong_category":
        categories[0]["evidence_ids"] = ["social_life:1"]
    if mode == "no_evidence":
        categories[0]["evidence_ids"] = []
    if mode == "duplicate_category":
        categories[0] = categories[1]
    data = {"categories": categories, "executive_summary": "Kaynaklarla desteklenen ayrıntılı mahalle raporu. " * 5,
        "pros": ["Kaynaklı olanak"], "cons": ["Erişim kısıtı"], "student_verdict": "Öğrenci yorumu",
        "family_verdict": "Aile yorumu", "professional_verdict": "Çalışan yorumu"}
    fake = Mock()
    fake.models.generate_content.return_value = SimpleNamespace(text=json.dumps(data),
        candidates=[SimpleNamespace(finish_reason="MAX_TOKENS" if mode == "truncated" else "STOP")])
    monkeypatch.setattr(genai, "Client", Mock(return_value=Mock(
        __enter__=Mock(return_value=fake), __exit__=Mock(return_value=False))))
    if mode != "valid":
        with pytest.raises(place_research.ResearchUnavailable):
            assessment.assess_place_report(evidence)
    else:
        report = assessment.assess_place_report(evidence)
        assert report["report_version"] == 2
        assert report["assessment"]["overall_score"] == 60
        assert report["assessment"]["coverage"] == 3
        assert report["categories"] == evidence["categories"]
