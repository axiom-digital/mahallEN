from copy import deepcopy

from app.services import rule_scoring as rules


def test_kotekli_uses_the_detailed_research_and_existing_rubric():
    record = rules.matched_record({"name": "Kötekli", "district": "Menteşe", "city": "Muğla"})
    result = rules.calculate(record)
    assert result["scores"] == {"rent_cost": 18, "transportation": 35, "social_life": 53,
                                "safety_news": 44, "earthquake_hazard": 23}
    assert result["social_diversity"]["monoculture_warning"] is not None
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
    assert one["scores"]["safety_news"] == many["scores"]["safety_news"] == 50


def test_social_life_scores_verified_venues_and_keeps_empty_as_none():
    assert rules.calculate({"asOf": "2026-11-08", "venues": []})["scores"]["social_life"] is None
    cafe = {"name": "Örnek Kafe", "type": "cafe", "sources": [{"url": "https://example.org/cafe"}]}
    three_cafes = rules.calculate({
        "asOf": "2026-11-08",
        "venues": [{**cafe, "id": f"c{i}", "name": f"Kafe {i}"} for i in range(3)],
    })
    assert isinstance(three_cafes["scores"]["social_life"], int) and three_cafes["scores"]["social_life"] > 0
    diverse = rules.calculate({
        "asOf": "2026-11-08",
        "venues": [
            {**cafe, "id": "c1"},
            {"id": "r1", "name": "Ev Yemekleri Lokantası", "type": "restaurant", "sources": cafe["sources"]},
            {"id": "p1", "name": "Merkez Parkı", "type": "park", "sources": cafe["sources"]},
            {"id": "l1", "name": "İlçe Kütüphanesi", "type": "library", "sources": cafe["sources"]},
        ],
    })
    assert diverse["scores"]["social_life"] > three_cafes["scores"]["social_life"]


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


def test_comma_formatted_multicity_rental_listing_is_scored():
    evidence = {
        "place": {"name": "Test", "district": "Test", "city": "Test"},
        "reference_date": "2026-11-06",
        "categories": [{
            "id": "rent_cost",
            "items": [{
                "text": "Yayıncıda 1+1 kiralık daire için 13,500 TL isteniyor; tekil ilan örneği.",
                "date": "2026-11-04",
                "sources": [{"url": "https://www.emlakjet.com/ilan/test"}],
            }],
        }],
    }
    record = rules.record_for(evidence)
    assert record["rents"][0]["amount"] == 13500
    assert rules.calculate(record)["scores"]["rent_cost"] == 53


def test_missing_timetable_is_not_interpreted_as_zero_transport_service():
    assert rules.calculate({"asOf": "2026-11-08", "routes": []})["scores"]["transportation"] is None
    record = {"asOf": "2026-11-08", "routes": [{"code": "22B", "route": "Bebek - Kabataş",
        "officialHeadingVerified": True, "localEvidence": "Bebek durağı", "sources": [{"url": "https://iett.istanbul"}]}]}
    result = rules.calculate(record)
    assert result["counts"]["routes"] == 1
    assert 0 < result["scores"]["transportation"] <= 78


def test_high_venue_count_with_low_diversity_scores_low_with_warning():
    src = [{"url": "https://example.org/osm"}]
    monoculture = {
        "asOf": "2026-11-20",
        "venues": (
            [{"id": f"f{i}", "name": f"Dönerci {i}", "type": "fast_food", "sources": src} for i in range(17)]
            + [{"id": f"c{i}", "name": f"Kafe {i}", "type": "cafe", "sources": src} for i in range(10)]
            + [{"id": f"p{i}", "name": f"Pub {i}", "type": "pub", "sources": src} for i in range(3)]
        ),
    }
    mono_res = rules.calculate(monoculture)
    assert mono_res["scores"]["social_life"] < 30
    assert mono_res["social_diversity"]["monoculture_warning"] is not None
    assert mono_res["social_diversity"]["groups"]["park_spor"] == 0
    assert mono_res["social_diversity"]["groups"]["kultur_sanat"] == 0

    balanced_types = [
        ("restaurant", "Ev Yemekleri Lokantası"), ("restaurant", "Pizza Evi"),
        ("cafe", "Mahalle Kafe"), ("bar", "Caz Bar"),
        ("supermarket", "Semt Market"), ("bakery", "Taş Fırın"),
        ("park", "Büyük Park"), ("sports_centre", "Spor Merkezi"),
        ("fitness_centre", "Fitness Salonu"), ("playground", "Çocuk Parkı"),
        ("library", "İlçe Kütüphanesi"), ("cinema", "Semt Sineması"),
        ("theatre", "Şehir Tiyatrosu"), ("arts_centre", "Sanat Merkezi"),
    ]
    balanced = {
        "asOf": "2026-11-20",
        "venues": [{"id": f"b{i}", "name": name, "type": kind, "sources": src} for i, (kind, name) in enumerate(balanced_types)],
    }
    bal_res = rules.calculate(balanced)
    assert bal_res["scores"]["social_life"] > mono_res["scores"]["social_life"] + 25
    assert bal_res["social_diversity"]["monoculture_warning"] is None


def test_few_strict_1plus1_falls_back_to_normalized_rooms_and_rent_benchmarks():
    src = [{"url": "https://example.org/ilan"}]
    record = {
        "asOf": "2026-11-20",
        "rents": [
            {"rooms": "1+1", "date": "2026-11-10", "eligible": True, "amount": 22000, "sources": src},
            {"rooms": "2+1", "date": None, "eligible": False, "amount": 28000, "sources": src},
            {"rooms": "3+1", "date": None, "eligible": False, "amount": 34000, "sources": src},
        ],
        "rent_benchmarks": [
            {"rooms": "genel", "amount": 28000, "date": "2026-11-15", "basis": "market_index", "sources": src},
        ],
    }
    res = rules.calculate(record)
    assert res["rent_mode"] == "normalized_with_index"
    assert res["rent_sample_count"] == 4
    assert res["benchmark_count"] == 1
    # 1+1=22000, 2+1=28000*0.78=21840, 3+1=34000*0.65=22100, benchmark=28000*0.78=21840 -> median=21920
    assert res["monthly_rent"] == 21920
    assert res["scores"]["rent_cost"] is not None
    assert res["confidence"]["rent_cost"] == {"level": "medium", "sample_count": 4, "label": "Orta güven"}


def test_confidence_levels_across_all_five_categories():
    src = [{"url": "https://example.org/src"}]
    record = {
        "asOf": "2026-11-20",
        "rents": [{"rooms": "2+1", "date": "2026-11-10", "amount": 25000, "sources": src} for _ in range(9)],
        "routes": [{"code": f"H{i}", "route": f"Hat {i}", "officialHeadingVerified": True, "localEvidence": "Durak", "sources": src} for i in range(4)],
        "venues": [{"id": f"v{i}", "name": f"Kafe {i}", "type": "cafe", "sources": src} for i in range(30)],
        "news": [{"date": "2026-11-10", "type": "gündem", "summary": "Mahallede çalışma", "sources": src} for _ in range(2)],
        "hazard": {"value": 0.351, "gridDistance": 1.0, "url": "https://aperta.ulakbim.gov.tr/records/274290"},
    }
    conf = rules.calculate(record)["confidence"]
    assert conf["rent_cost"]["level"] == "high" and conf["rent_cost"]["sample_count"] == 9
    assert conf["transportation"]["level"] == "medium" and conf["transportation"]["sample_count"] == 4
    assert conf["social_life"]["level"] == "high" and conf["social_life"]["sample_count"] == 30
    assert conf["safety_news"]["level"] == "low" and conf["safety_news"]["label"] == "Sınırlı örneklem"
    assert conf["earthquake_hazard"]["level"] == "high" and conf["earthquake_hazard"]["sample_count"] == 1
    empty_conf = rules.calculate({"asOf": "2026-11-20"})["confidence"]
    assert all(empty_conf[k] == {"level": "none", "sample_count": 0, "label": "Veri yok"} for k in conf)


def test_multicity_enriched_records_load_via_research_records():
    rules.research_records.cache_clear()
    records = rules.research_records()
    names = {(r["name"], r["city"]) for r in records}
    assert ("Kötekli", "Muğla") in names
    if (rules.ROOT / "multicity_enriched.json").exists():
        for name, city in [("Caferağa", "İstanbul"), ("Bahçelievler", "Ankara"), ("Kültür", "İzmir"), ("Yenibağlar", "Eskişehir"), ("Görükle", "Bursa")]:
            assert (name, city) in names
            rec = rules.matched_record({"name": name, "district": next(r["district"] for r in records if r["name"] == name), "city": city})
            assert rec is not None and len(rec.get("venues", [])) >= 10
