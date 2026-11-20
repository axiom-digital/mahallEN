from app.services.place_research import Finding
from app.services.research_facts import grounded_record, source_date
from app.services.rule_scoring import record_for

TARGET = {"name": "Bebek", "district": "Beşiktaş", "city": "İstanbul"}


def build(category, quote, details, url="https://example.org/bebek", extra=""):
    sources = {"S1": {"id": "S1", "title": "Bebek kaynağı", "url": url}}
    findings = [Finding(category=category, text=quote, evidence_quote=quote, source_ids=["S1"], details=details)]
    return grounded_record(TARGET, "2026-11-08", findings, sources, [{"text": quote + extra, "source_ids": ["S1"]}])


def test_price_after_listing_date_and_linebreak_is_not_lost():
    record = build("rent_cost", "Beşiktaş Bebek Mahallesi 3+1 · 23.10.2026\n250.000 ₺",
        {"amount_tl": 250000, "rooms": "3+1", "date": "2026-10-23", "payment_period": "unknown"})
    assert record["rents"][0]["amount"] == 250000
    assert record["rents"][0]["date"] == "2026-10-23"
    assert not record["rents"][0]["eligible"]  # No explicit monthly payment.


def test_monthly_listing_preserves_room_type_date_and_eligibility():
    r = build("rent_cost", "Bebek 1+1 aylık 30.000 TL 02.11.2026",
        {"amount_tl": 30000, "rooms": "1+1", "date": "2026-11-02", "payment_period": "month"})
    assert r["rents"][0]["eligible"]
    assert r["rents"][0]["rooms"] == "1+1"


def test_other_neighborhood_recommendation_and_unquoted_price_are_rejected():
    d = {"amount_tl": 40000, "rooms": "1+1", "local_evidence": "Bebek Mahallesi"}
    assert not build("rent_cost", "Dikilitaş 1+1 40.000 TL", d, extra="\nBebek Mahallesi")["rents"]
    assert not build("rent_cost", "Bebek 1+1 kiralık daire", d)["rents"]


def test_category_average_is_not_an_individual_listing():
    r = build("rent_cost", "Bebek ortalama kira 163.597 TL", {"amount_tl": 163597})
    assert not r["rents"]
    assert len(r["rent_benchmarks"]) == 1
    assert r["rent_benchmarks"][0]["amount"] == 163597
    assert r["rent_benchmarks"][0]["basis"] == "market_index"


def test_kira_endeksi_is_captured_as_benchmark_only():
    r = build(
        "rent_cost",
        "Bebek Mahallesi kira endeksi ortalama 42.500 TL düzeyindedir.",
        {"amount_tl": 42500, "rooms": "2+1", "date": "2026-11-05"},
        url="https://endeksa.com/bebek",
    )
    assert r["rents"] == []
    assert len(r["rent_benchmarks"]) == 1
    assert r["rent_benchmarks"][0]["amount"] == 42500
    assert r["rent_benchmarks"][0]["rooms"] == "2+1"


def test_official_route_code_survives_but_third_party_is_not_official():
    d = {"route_code": "22B", "route_name": "Bebek - Kabataş"}
    r = build("transportation", "22B / BEBEK - KABATAŞ", d, "https://iett.istanbul/RouteDetail?hkod=22B")
    assert r["routes"][0]["code"] == "22B"
    assert not build("transportation", "22B / BEBEK - KABATAŞ", d)["routes"]


def test_publication_date_is_kept_and_event_year_is_not_invented():
    r = build("safety_news", "Bebek: 17.05.2026 tarihinde yayımlandı. Olay 24 Nisan günü silahlı saldırı.",
        {"published_date": "2026-05-17", "date": "2026-04-24"})
    assert r["news"][0]["date"] == "2026-05-17"
    assert source_date("2026-04-24", "24 Nisan günü olay oldu", []) is None


def test_typed_record_is_used_directly_without_regex_reinterpreting_it():
    r = build("social_life", "Bebek Test Kahvecisi", {"name": "Test Kahvecisi", "venue_type": "cafe"})
    assert r["venues"][0]["name"] == "Test Kahvecisi"
    assert record_for({"place": TARGET, "research_record": r}) is r


def test_deterministic_portal_rent_extractor_collects_multiple_listings_and_rejects_satilik_or_foreign():
    sources = {
        "S1": {"id": "S1", "title": "Bebek Kiralık Daire", "url": "https://www.emlakjet.com/kiralik-daire/istanbul-besiktas-bebek-mahallesi"},
        "S2": {"id": "S2", "title": "Bebek Satılık Daire", "url": "https://www.emlakjet.com/satilik-daire/istanbul-besiktas-bebek-mahallesi"},
        "S3": {"id": "S3", "title": "Etiler Kiralık Daire", "url": "https://www.emlakjet.com/kiralik-daire/istanbul-besiktas-etiler-mahallesi"},
    }
    supports = [
        {
            "category": "rent_cost",
            "source_ids": ["S1"],
            "text": "2+1 · 95 m² · Bebek 42.000 ₺   1+1 · 60 m² 31.000 TL   3+1 · 130 m² 55.000 TL",
        },
        {
            "category": "rent_cost",
            "source_ids": ["S2"],
            "text": "3+1 Satılık 95.000 TL (yanlış kategori URL)",
        },
        {
            "category": "rent_cost",
            "source_ids": ["S3"],
            "text": "2+1 Etiler 29.000 TL",
        },
    ]
    r = grounded_record(TARGET, "2026-11-20", [], sources, supports)
    extracted = sorted((x["rooms"], x["amount"]) for x in r["rents"])
    assert extracted == [("1+1", 31000), ("2+1", 42000), ("3+1", 55000)]
