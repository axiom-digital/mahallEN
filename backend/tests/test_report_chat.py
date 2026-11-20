import httpx

from app.api.routes import report_chat
from app.core.config import settings
from app.services.report_chat import asks_open_choice, is_report_question, load_report, select_evidence


def test_general_chat_and_greeting_go_to_provider_with_history(client, monkeypatch):
    received = []
    history = [{"question": "Bugün müzik dinledim.", "answer": "Ne dinledin?"}]

    async def provider(report, question, turns):
        received.append((question, turns))
        return {"answer": "Model yanıtı", "sources": []}

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(report_chat, "answer_question", provider)

    for question in ("Naber?", "Bana bir fıkra anlat."):
        reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={
            "question": question, "history": history,
        })
        assert reply.status_code == 200
        assert reply.json()["answer"] == "Model yanıtı"
    assert received == [("Naber?", history), ("Bana bir fıkra anlat.", history)]


def test_greeting_with_report_question_answers_from_report_without_provider(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")

    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={"question": "Selam, kiralar nasıl?"})
    assert reply.status_code == 200
    assert "23.000 TL" in reply.json()["answer"]
    assert reply.json()["sources"]


def test_rate_limit_returns_report_answer_and_pauses_provider_calls(client, monkeypatch):
    calls = 0

    async def rate_limited(*args):
        nonlocal calls
        calls += 1
        response = httpx.Response(
            429,
            headers={"Retry-After": "8"},
            request=httpx.Request("POST", "https://api.groq.com"),
        )
        response.raise_for_status()

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(report_chat, "answer_question", rate_limited)

    for _ in range(2):
        reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={"question": "Kiralar nasıl?"})
        assert reply.status_code == 200
        assert "23.000 TL" in reply.json()["answer"]
        assert reply.json()["sources"]
    assert calls == 1


def test_general_chat_does_not_return_rental_data_without_provider(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={
        "question": "En sevdiğin film ne?",
    })
    assert reply.status_code == 503


def test_general_chat_does_not_need_report_evidence():
    report = load_report("kotekli")
    assert not is_report_question(report, "Naber?")
    assert not is_report_question(report, "Bana bir fıkra anlat.", "Kötekli'de kiralar ne kadar?")
    assert is_report_question(report, "Peki ortancası kaç?", "Kötekli'de kiralar ne kadar?")


def test_food_preference_continues_locally_without_unasked_price_records():
    report = load_report("kotekli")
    history = ["Kötekli'de ne yesem?"]
    followup = "Doyurucu ve pratik olsun."
    assert is_report_question(report, followup, history[-1])
    evidence, _ = select_evidence(report, followup, history)
    assert "Mekân " in evidence
    assert "Yerel fiyat örneği " not in evidence


def test_venue_names_come_from_report_even_if_provider_invents_names(client, monkeypatch):
    async def provider_reply(self, url, **kwargs):
        return httpx.Response(200, request=httpx.Request("POST", url), json={
            "choices": [{"message": {"content": '{"answer":"Döner Dükkanı kesin açık.", "source_ids":["K1","K999"]}'}}],
        })

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(httpx.AsyncClient, "post", provider_reply)
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={
        "question": "Döner tarzı bir şey istiyorum",
        "history": [{"question": "Kötekli'de ne yesem?", "answer": "Nasıl bir yemek istiyorsun?"}],
    })
    assert reply.status_code == 200
    result = reply.json()
    assert "Patlıycan Döner" in result["answer"]
    assert "Döner Dükkanı" not in result["answer"]
    assert "kesin açık" not in result["answer"]
    assert [source["id"] for source in result["sources"]] == ["K1"]


def test_no_matching_venue_does_not_substitute_an_unrelated_place(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={"question": "Kötekli'de sushi nerede?"})
    assert reply.status_code == 200
    assert "uyan kaynaklı bir mekân kaydı bulamadım" in reply.json()["answer"]
    assert reply.json()["sources"] == []


def test_veterinarian_lookup_answers_with_local_address_and_source(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={"question": "köteklide veteriner var mı"})
    assert reply.status_code == 200
    result = reply.json()
    assert "Vetapet Veteriner Kliniği" in result["answer"]
    assert "149/1" in result["answer"]
    assert result["sources"][0]["url"] == "https://veterinerveri.com/il/mugla/mentese/vetapet/"


def test_veterinarian_lookup_uses_the_named_neighborhood(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={
        "question": "muslihittinde veteriner var mı?",
    })
    assert reply.status_code == 200
    assert "Muğla Hayvan Hastanesi" in reply.json()["answer"]
    assert reply.json()["sources"][0]["url"] == "https://www.muglahayvanhastanesi.com/"


def test_veterinarian_followup_can_search_other_neighborhoods(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/kotekli/chat", json={
        "question": "Başka bir mahallede var mı?",
        "history": [{"question": "Kötekli'de veteriner var mı?", "answer": "Vetapet Veteriner Kliniği"}],
    })
    assert reply.status_code == 200
    assert "Muslihittin: Muğla Hayvan Hastanesi" in reply.json()["answer"]
    assert "Vetapet" not in reply.json()["answer"]


def test_other_neighborhoods_are_labeled_when_local_report_has_no_match(client, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    reply = client.post("/api/v1/neighborhoods/akyaka/chat", json={"question": "Burada veteriner var mı?"})
    assert reply.status_code == 200
    answer = reply.json()["answer"]
    assert "Akyaka raporunda eşleşen kayıt bulamadım." in answer
    assert "Kötekli: Vetapet" in answer
    assert "Muslihittin: Muğla Hayvan Hastanesi" in answer
    assert len(reply.json()["sources"]) == 2


def test_open_choices_are_recognized_across_subjects():
    assert asks_open_choice("Kötekli’de ne yesem?")
    assert asks_open_choice("Bu akşam ne izlesem?")
    assert asks_open_choice("Hafta sonu ne yapsam?")
    assert not asks_open_choice("Hafif ve komik bir film olsun.")
    assert not asks_open_choice("Kötekli’de 1+1 kira ortancası kaç TL?")


def test_rent_context_excludes_undated_and_seasonal_listings_from_median():
    evidence, sources = select_evidence(load_report("akyaka"), "1+1 kira ortancası kaç?", [])

    summary = next(line for line in evidence.splitlines() if line.startswith("Kira özeti 1+1:"))
    assert "1 tarihli ilan, ortanca 35000 TL" in summary
    source_id = summary.rsplit("[", 1)[1].rstrip("]")
    assert source_id in sources
