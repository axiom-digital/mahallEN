import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google import genai

from app.core.config import settings
from app.services import place_assessment as assessment, place_research


def test_weighted_scores_require_all_categories_and_preserve_real_zero():
    categories = [SimpleNamespace(category=key, score=0) for key in assessment.CATEGORY_WEIGHTS]
    assert assessment.weighted_score(categories, assessment.CATEGORY_WEIGHTS) == 0
    categories[0].score = None
    assert assessment.weighted_score(categories, assessment.CATEGORY_WEIGHTS) is None


@pytest.mark.parametrize("text", [
    "Üç ilandan mahalle genelinde konut piyasası bu seviyede seyretmektedir.",
    "1+1 için ortalama aylık kira 23.000 TL olarak hesaplandı.",
    "Güzergâhlar aktif olarak kullanılmaktadır.",
])
def test_report_rejects_observed_unsupported_generalizations(text):
    with pytest.raises(place_research.ResearchUnavailable):
        assessment.validate_narrative(SimpleNamespace(executive_summary=text), {})


def test_report_rejects_read_date_relabelled_as_announcement_date():
    record = {"transportAlerts": [{"observedAt": "2026-10-28", "date": None}]}
    with pytest.raises(place_research.ResearchUnavailable):
        assessment.validate_narrative(SimpleNamespace(executive_summary="2026-10-28 tarihli resmî duyuruda durak erişimi anlatıldı."), record)


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


@pytest.mark.parametrize("mode", ["valid", "model_scores", "truncated"])
def test_model_writes_prose_but_cannot_assign_scores(monkeypatch, mode):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test")
    evidence = {"place": {"name": "Test", "district": "İlçe", "city": "Şehir"}, "reference_date": "2026-11-07",
        "limitations": [], "categories": [{"id": key, "label": key, "items": []} for key in assessment.CATEGORY_WEIGHTS]}
    data = {"executive_summary": "Kaynaklarla desteklenen ayrıntılı mahalle raporu. " * 5,
        "pros": [], "cons": [], "student_verdict": "Öğrenci yorumu", "family_verdict": "Aile yorumu", "professional_verdict": "Çalışan yorumu"}
    if mode == "model_scores":
        data["categories"] = [{"category": key, "score": 50} for key in assessment.CATEGORY_WEIGHTS]
    fake = Mock()
    fake.models.generate_content.return_value = SimpleNamespace(text=json.dumps(data),
        candidates=[SimpleNamespace(finish_reason="MAX_TOKENS" if mode == "truncated" else "STOP")])
    monkeypatch.setattr(genai, "Client", Mock(return_value=Mock(
        __enter__=Mock(return_value=fake), __exit__=Mock(return_value=False))))
    if mode == "truncated":
        with pytest.raises(place_research.ResearchUnavailable): assessment.assess_place_report(evidence)
    elif mode == "model_scores":
        from pydantic import ValidationError
        with pytest.raises(ValidationError): assessment.assess_place_report(evidence)
    else:
        report = assessment.assess_place_report(evidence)
        assert report["report_version"] == 3
        assert report["assessment"]["overall_score"] is None
        assert report["assessment"]["coverage"] == 0
        assert all(c["score"] is None for c in report["assessment"]["categories"])
