import json
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from google import genai

from app.core.config import settings
from app.services import place_research as research
from app.services import place_assessment


TARGET = {"name": "Erzene", "district": "Bornova", "city": "İzmir"}


def test_search_deduplicates_urls_preserves_excerpts_and_excludes_empty_or_unsafe_sources(monkeypatch):
    responses = [Mock(json=lambda i=i: {"results": [
        {"url": "https://example.org/park", "content": f"Erzene Bornova park bilgisi {i}"},
        {"url": "http://example.org/unsafe", "content": "Yeterince uzun bir metin"},
        {"url": "https://tavily.com/knowledge/company/x", "content": "Yeterince uzun bir metin"},
        {"url": "https://example.org/empty", "content": ""},
    ]}) for i in range(5)]
    client = Mock()
    client.post.side_effect = responses
    monkeypatch.setattr(research.httpx, "Client", Mock(return_value=Mock(
        __enter__=Mock(return_value=client), __exit__=Mock(return_value=False))))
    sources, supports = research.collect_sources(TARGET)
    assert len(sources) == 1 and len(supports) == 5
    assert all(s["source_ids"] == ["S1"] for s in supports)
    for call in client.post.call_args_list:
        request = call.kwargs["json"]
        assert all(word in request["query"] for word in TARGET.values())
        assert request["search_depth"] == "basic" and not request["auto_parameters"]
        assert request["max_results"] == 3


def test_tavily_failure_stops_research_without_partial_success(monkeypatch):
    client = Mock()
    response = httpx.Response(429, request=httpx.Request("POST", "https://api.tavily.com/search"))
    client.post.return_value = response
    monkeypatch.setattr(research.httpx, "Client", Mock(return_value=Mock(
        __enter__=Mock(return_value=client), __exit__=Mock(return_value=False))))
    with pytest.raises(httpx.HTTPStatusError):
        research.collect_sources(TARGET)
    assert client.post.call_count == 1


def test_missing_tavily_key_is_not_cached(client, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    found = client.get("/api/v1/places/search?q=Erzene").json()["results"][0]
    path = f"/api/v1/places/{found['id']}/report"
    assert client.post(path).status_code == 503
    assert "Tavily" in client.post(path).json()["detail"]
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("quote,source_id,finish", [
    ("Erzene park alanı", "S1", "STOP"),
    ("Kaynakta olmayan alıntı", "S1", "STOP"),
    ("Erzene park alanı", "S99", "STOP"),
    ("Erzene park alanı", "S1", "MAX_TOKENS"),
])
def test_gemini_uses_tavily_evidence_and_rejects_unmatched_or_truncated_output(monkeypatch, quote, source_id, finish):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "TAVILY_API_KEY", "test-key")
    monkeypatch.setattr(place_assessment, "assess_place_report", lambda report: report)
    sources = {"S1": {"id": "S1", "title": "Park", "url": "https://example.org/park"}}
    supports = [{"text": "Erzene park alanı için yeni proje planlanıyor.", "source_ids": ["S1"]}]
    monkeypatch.setattr(research, "collect_sources", Mock(return_value=(sources, supports)))
    result = SimpleNamespace(candidates=[SimpleNamespace(finish_reason=finish)], text=json.dumps({
        "summary": "Park projesi", "findings": [{"category": "social_life", "text": "Park planı var.",
        "evidence_quote": quote, "source_ids": [source_id]}], "limitations": []}))
    fake = Mock()
    fake.models.generate_content.return_value = result
    monkeypatch.setattr(genai, "Client", Mock(return_value=Mock(
        __enter__=Mock(return_value=fake), __exit__=Mock(return_value=False))))
    if source_id == "S1" and quote == "Erzene park alanı" and finish == "STOP":
        report = research.generate_place_report(TARGET, "identity")
        assert report["generated_by"].startswith("Tavily + Google Gemini")
        assert report["categories"][3]["items"][0]["sources"] == [sources["S1"]]
        request = fake.models.generate_content.call_args.kwargs
        assert json.loads(request["contents"])["supports"] == supports
        assert not request["config"].tools  # Gemini must not perform a second web search.
    else:
        with pytest.raises(research.ResearchUnavailable):
            research.generate_place_report(TARGET, "identity")
