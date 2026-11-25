"""Reader-facing facts built from the same inputs as scoring, never from prose guesses."""
from collections import defaultdict
from statistics import median
from app.services.rule_scoring import age


TYPE_LABELS = {"cafe": "Kafe", "restaurant": "Restoran", "fast_food": "Yeme içme",
    "bar": "Bar", "pub": "Pub", "nightclub": "Gece kulübü", "live_music": "Canlı müzik",
    "bakery": "Fırın", "fitness_centre": "Spor salonu", "sports_centre": "Spor alanı", "supermarket": "Market", "convenience": "Market", "marketplace": "Pazar",
    "park": "Park", "playground": "Oyun alanı", "community_centre": "Kültür merkezi",
    "arts_centre": "Sanat merkezi", "cinema": "Sinema", "theatre": "Tiyatro", "library": "Kütüphane"}


def money(value):
    return f"{value:,.0f}".replace(",", ".") + " TL"


def explain_daily_life(record, calculation, rents, routes, venues):
    """Explain what the observed examples mean for someone choosing an address."""
    notes = {}
    groups = [group for group in rents if group["listings"]]
    if groups:
        group = max(groups, key=lambda g: (g["sample_count"], len(g["listings"])))
        price = group["median"]
        if price is not None:
            notes["rent_cost"] = (f"{group['rooms']} bir ev düşünüyorsan, karşılaştırılabilir {group['sample_count']} ilanın "
                f"ortasındaki istenen kira {money(price)}. Bütçeni bununla karşılaştırırken aidatı ve faturaları ayrıca ekle.")
        else:
            row = group["listings"][0]
            notes["rent_cost"] = (f"{group['rooms']} için bir ilanda {money(row['amount'])} istenmiş. "
                "Bu örnekle bütün mahalleye fiyat biçmek zor. Evi ararken bedelin hangi dönem için olduğunu ve aidatı sor.")
    elif calculation.get("monthly_rent") is not None:
        notes["rent_cost"] = (f"Kira karşılaştırmasında 1+1 için kullanılan tahmin {money(calculation['monthly_rent'])}. "
            "Ev bakarken aynı oda sayısındaki güncel ilanlarla karşılaştır.")
    if calculation["scores"].get("rent_cost") == 0 and calculation.get("monthly_rent") is not None:
        basis = ("Farklı oda tiplerini 1+1 bir evin tahmini kirasına çevirince"
            if calculation.get("rent_mode") in {"normalized_rooms", "normalized_with_index", "market_index"}
            else "1+1 kira örnekleri üzerinden")
        notes["rent_cost"] += (f" {basis} karşılaştırma tutarı {money(calculation['monthly_rent'])}. "
            "Bu tutar tek bir net asgari ücretin tamamına yakınını veya daha fazlasını aldığı için maliyet puanı 0/100.")
    if routes:
        route = next((r for r in routes if r.get("code")), routes[0])
        name = route.get("code") or route.get("route")
        if name:
            notes["transportation"] = (f"Günlük yolculuğunu planlarken {name} hattına bakabilirsin. "
                "Evin hangi durağa yakın olduğu ve o duraktan işe ya da okula gideceğin saatte sefer bulunması, hat sayısından daha belirleyici.")
    if venues:
        venue = venues[0]
        notes["social_life"] = (f"{venue['name']} çevrede kayda geçmiş bir {venue['kind'].lower()} örneği. "
            "Ev ilanının adresinden buraya yürüyüş yolunu haritada açarsan günlük hayatına uyup uymadığını daha kolay anlarsın.")
    news = [n for n in record.get("news", []) if n.get("sources") and 0 <= age(n.get("date"), calculation["as_of"]) <= 365]
    if news:
        item = max(news, key=lambda n: n["date"])
        title = item["summary"].strip().rstrip(".")
        notes["safety_news"] = (f"{item['date']} tarihli haberde “{title}” bilgisi yer alıyor. "
            "Ev bakacağın sokağı seçerken haberin nerede geçtiğine bak. Mahallenin başka bir ucundaki olay senin günlük yolunu etkilemeyebilir.")
    if calculation["scores"]["earthquake_hazard"] is not None:
        notes["earthquake_hazard"] = ("Deprem puanı bölgenin beklenen yer sarsıntısını karşılaştırıyor. "
            "Aynı sokaktaki iki bina farklı dayanabilir. Ev seçerken bina özelindeki inceleme raporunu iste.")
    return notes


def build_briefing(record, calculation):
    room_groups = defaultdict(list)
    for row in record.get("rents", []):
        if row.get("amount", 0) > 0 and row.get("sources"):
            room_groups[row.get("rooms", "Belirtilmemiş")].append({
                "amount": row["amount"], "date": row.get("date"), "rooms": row.get("rooms"),
                "comparable": bool(row.get("eligible") and 0 <= age(row.get("date"), calculation["as_of"]) <= 90 and not row.get("locationConflict") and row.get("lease") != "seasonal"),
                "sources": [{"url": s["url"], "title": s.get("publisher") or s.get("title") or "İlan kaynağı"} for s in row["sources"]],
            })
    rents = []
    for room, rows in sorted(room_groups.items()):
        valid = [r for r in rows if r["comparable"]]
        rents.append({"rooms": room, "sample_count": len(valid), "median": median(r["amount"] for r in valid) if valid else None,
            "min": min((r["amount"] for r in valid), default=None), "max": max((r["amount"] for r in valid), default=None),
            "listings": sorted(rows, key=lambda r: r["date"] or "", reverse=True)})
    routes = [{"code": r.get("code"), "route": r.get("route"), "local_evidence": r.get("localEvidence"), "timetable": r.get("timetable", []),
        "sources": [{"url": s["url"], "title": s.get("publisher") or s.get("title") or "Hat kaynağı"} for s in r.get("sources", [])[:2]]}
        for r in record.get("routes", []) if (r.get("officialHeadingVerified") or r.get("mapRouteVerified")) and "kontrol edilmeli" not in r.get("localEvidence", "")]
    venues = [{"id": v.get("id", v["name"]), "name": v["name"], "kind": TYPE_LABELS.get(v.get("type"), "Mekân"),
        "address": v.get("address"), "scope": v.get("scope"), "lat": v.get("lat"), "lon": v.get("lon"),
        "sources": [{"url": s["url"], "title": s.get("publisher") or s.get("title") or "Mekân kaynağı"} for s in v.get("sources", [])[:2]]}
        for v in record.get("venues", []) if v.get("scope") != "nearby" and v.get("sources")]
    alerts = [{"text": a["summary"], "date": a.get("date"), "observed_at": a.get("observedAt"), "status": a.get("status"),
        "sources": [{"url": s["url"], "title": s.get("publisher") or s.get("title") or "Duyuru kaynağı"} for s in a.get("sources", [])[:2]]}
        for a in record.get("transportAlerts", []) if a.get("sources")]
    benchmarks = [
        {
            "amount": b.get("amount"),
            "label": money(b["amount"]) if b.get("amount") else None,
            "rooms": b.get("rooms") or "genel",
            "basis": b.get("basis") or "market_index",
            "description": b.get("description") or f"{b.get('rooms') or 'Mahalle'} kira endeksi: {money(b['amount'])}",
            "date": b.get("date"),
            "sources": [
                {"title": s.get("publisher") or s.get("title") or "Kaynak", "url": s["url"]}
                for s in b.get("sources", []) if s.get("url")
            ],
        }
        for b in record.get("rent_benchmarks", [])
        if b.get("amount", 0) > 0 and b.get("sources")
    ]
    monthly = calculation.get("monthly_rent")
    rent_mode = calculation.get("rent_mode")
    benchmark_count = calculation.get("benchmark_count", 0)
    facts = []
    if monthly is not None:
        if rent_mode == "market_index":
            facts.append(f"{benchmark_count} piyasa kira endeksi verisinden 1+1 eşdeğeri {money(monthly)}.")
        elif rent_mode == "normalized_with_index":
            facts.append(f"Oda-normalize ilan ve {benchmark_count} piyasa endeksi ({calculation['rent_sample_count']} örnek) 1+1 eşdeğeri {money(monthly)}.")
        elif rent_mode == "normalized_rooms":
            facts.append(f"{calculation['rent_sample_count']} farklı oda ilanı 1+1 eşdeğerine normalize edildi ({money(monthly)}).")
        elif rent_mode == "undated_1+1":
            facts.append(f"{calculation['rent_sample_count']} adet 1+1 ilanın medyanı {money(monthly)}.")
        else:
            facts.append(f"Tarihli {calculation['rent_sample_count']} adet 1+1 ilanının medyanı {money(monthly)}.")
    if routes:
        facts.append(f"Kaynaklarda {len(routes)} hat ve {len(venues)} örnek mekân kaydı derlendi; bu sayı mahalle toplamı değildir.")
    elif venues:
        facts.append(f"Kaynak taramasında {len(venues)} örnek mekân kaydı derlendi; mahalle toplamı değildir.")
    if alerts:
        facts.append("Ulaşım kararında tarihli yol ve erişim duyurularını da hesaba kat.")
    return {"daily_life": explain_daily_life(record, calculation, rents, routes, venues), "version": 1, "overview": " ".join(facts) or "Bu mahalleyi kaynaklı bulgular ve kategori ayrıntılarıyla incele.",
        "rent_types": rents, "rent_benchmarks": benchmarks, "routes": routes, "venues": venues, "transport_notices": alerts,
        "hazard": record.get("hazard", {}), "source_date": record.get("asOf", calculation.get("as_of")),
        "confidence": calculation.get("confidence", {}), "social_diversity": calculation.get("social_diversity"),
        "counts": calculation.get("counts", {})}
