"""Reader-facing facts built from the same inputs as scoring, never from prose guesses."""
from collections import defaultdict
from statistics import median
from app.services.rule_scoring import age


TYPE_LABELS = {"cafe": "Kafe", "restaurant": "Restoran", "fast_food": "Yeme içme",
    "bar": "Bar", "pub": "Pub", "nightclub": "Gece kulübü", "live_music": "Canlı müzik",
    "supermarket": "Market", "convenience": "Market", "marketplace": "Pazar",
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
                "sources": [{"url": s["url"], "title": s.get("publisher", "İlan kaynağı")} for s in row["sources"]],
            })
    rents = []
    for room, rows in sorted(room_groups.items()):
        valid = [r for r in rows if r["comparable"]]
        rents.append({"rooms": room, "sample_count": len(valid), "median": median(r["amount"] for r in valid) if valid else None,
            "min": min((r["amount"] for r in valid), default=None), "max": max((r["amount"] for r in valid), default=None),
            "listings": sorted(rows, key=lambda r: r["date"] or "", reverse=True)})
    routes = [{"code": r.get("code"), "route": r.get("route"), "local_evidence": r.get("localEvidence"),
        "sources": [{"url": s["url"], "title": s.get("publisher", "Hat kaynağı")} for s in r.get("sources", [])[:2]]}
        for r in record.get("routes", []) if r.get("officialHeadingVerified") and "kontrol edilmeli" not in r.get("localEvidence", "")]
    venues = [{"id": v.get("id", v["name"]), "name": v["name"], "kind": TYPE_LABELS.get(v.get("type"), "Mekân"),
        "address": v.get("address"), "scope": v.get("scope"), "lat": v.get("lat"), "lon": v.get("lon"),
        "sources": [{"url": s["url"], "title": s.get("publisher", "Mekân kaynağı")} for s in v.get("sources", [])[:2]]}
        for v in record.get("venues", []) if v.get("scope") != "nearby" and v.get("sources")]
    alerts = [{"text": a["summary"], "date": a.get("date"), "observed_at": a.get("observedAt"), "status": a.get("status"),
        "sources": [{"url": s["url"], "title": s.get("publisher", "Duyuru kaynağı")} for s in a.get("sources", [])[:2]]}
        for a in record.get("transportAlerts", []) if a.get("sources")]
    monthly = calculation.get("monthly_rent")
    facts = []
    if monthly is not None:
        facts.append(f"Tarihli {calculation['rent_sample_count']} adet 1+1 ilanının medyanı {money(monthly)}.")
    if routes:
        facts.append(f"Kaynaklarda {len(routes)} resmî hat ve {len(venues)} mekân kaydı bulunuyor.")
    elif venues:
        facts.append(f"Mahalle ve çevresinden {len(venues)} mekân kaydı var.")
    if alerts:
        facts.append("Ulaşım kararında tarihli yol ve erişim duyurularını da hesaba kat.")
    return {"version": 1, "overview": " ".join(facts) or "Bu mahalleyi kaynaklı bulgular ve kategori ayrıntılarıyla incele.",
        "rent_types": rents, "routes": routes, "venues": venues, "transport_notices": alerts,
        "hazard": record.get("hazard", {}), "source_date": record.get("asOf", calculation.get("as_of")),
        "counts": calculation.get("counts", {})}
