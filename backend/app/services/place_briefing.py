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
        for r in record.get("routes", []) if r.get("officialHeadingVerified") and "kontrol edilmeli" not in r.get("localEvidence", "")]
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
        facts.append(f"Kaynaklarda {len(routes)} resmî hat ve {len(venues)} örnek mekân kaydı derlendi; bu sayı mahalle toplamı değildir.")
    elif venues:
        facts.append(f"Kaynak taramasında {len(venues)} örnek mekân kaydı derlendi; mahalle toplamı değildir.")
    if alerts:
        facts.append("Ulaşım kararında tarihli yol ve erişim duyurularını da hesaba kat.")
    return {"version": 1, "overview": " ".join(facts) or "Bu mahalleyi kaynaklı bulgular ve kategori ayrıntılarıyla incele.",
        "rent_types": rents, "rent_benchmarks": benchmarks, "routes": routes, "venues": venues, "transport_notices": alerts,
        "hazard": record.get("hazard", {}), "source_date": record.get("asOf", calculation.get("as_of")),
        "confidence": calculation.get("confidence", {}), "social_diversity": calculation.get("social_diversity"),
        "counts": calculation.get("counts", {})}
