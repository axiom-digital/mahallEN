"""Port of the existing categoryEvaluation.mjs project rubric; no LLM scores."""
from datetime import date
from functools import lru_cache
import json
import math
from pathlib import Path
import re
from statistics import median
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3] / "data/scoring_research"
VERSION = "rules-v1"
REPORT_VERSION = 3
GROUPS = [set(v.split()) for v in ["restaurant fast_food", "bar pub nightclub live_music", "cafe",
    "supermarket convenience marketplace", "park playground camp_site", "community_centre arts_centre cinema theatre library"]]


def rounded(n):
    return max(0, min(100, math.floor(n + .5)))


def age(value, today):
    try:
        return (date.fromisoformat(today[:10]) - date.fromisoformat(value[:10])).days
    except (ValueError, TypeError):
        return float("inf")


@lru_cache(maxsize=1)
def research_records():
    return json.loads((ROOT / "reports.json").read_text(encoding="utf-8"))["reports"]


def matched_record(place):
    from app.services.place_service import place_id
    return next((r for r in research_records() if place_id(r) == place_id(place)), None)


def record_for(evidence):
    """Prefer the detailed package; never infer monthly rent from an unspecified TL price."""
    known = matched_record(evidence["place"])
    if known:
        return known
    record = {**evidence["place"], "asOf": evidence["reference_date"],
              "rents": [], "routes": [], "venues": [], "news": [], "hazard": {}}
    for category in evidence["categories"]:
        for index, item in enumerate(category["items"]):
            text = item.get("evidence_quote") or item["text"]
            identity = f"{category['id']}:{index+1}"
            sources = item.get("sources", [])
            posted = item.get("date") or next(iter(re.findall(r"\b20\d\d-\d\d-\d\d\b", text)), None)
            if category["id"] == "rent_cost":
                price = re.search(r"([\d.]+)\s*(?:TL|₺)\s*/\s*ay", text, re.I)
                room = re.search(r"\b\d\+\d\b", text)
                if price and room and posted:
                    record["rents"].append({"id": identity, "amount": int(price[1].replace('.', '')),
                        "rooms": room[0], "date": posted, "eligible": True, "sources": sources})
            if category["id"] == "transportation":
                official = {"ulasim.muttas.com.tr", "eshot.gov.tr", "www.eshot.gov.tr", "iett.istanbul",
                    "www.iett.istanbul", "ego.gov.tr", "www.ego.gov.tr", "metro.istanbul", "www.metro.istanbul",
                    "izmir.bel.tr", "www.izmir.bel.tr", "izdeniz.com.tr", "www.izdeniz.com.tr"}
                if any(urlparse(s["url"]).hostname in official for s in sources):
                    record["routes"].append({"id": identity, "route": text, "localEvidence": text,
                        "officialHeadingVerified": True, "sources": sources})
            if category["id"] == "social_life":
                # Only explicit facility names in the evidence count; no imaginary POI rows.
                patterns = {"cafe": r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ][\w’'-]+){0,3}\s+(?:Kafe|Cafe))\b",
                    "park": r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ][\w’'-]+){0,4}\s+Parkı)\b",
                    "library": r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ][\w’'-]+){0,4}\s+Kütüphanesi)\b"}
                for kind, pattern in patterns.items():
                    for name in re.findall(pattern, text):
                        record["venues"].append({"id": name.casefold(), "name": name, "type": kind,
                            "scope": "reported_address", "sources": sources})
            if category["id"] == "safety_news" and posted:
                record["news"].append({"id": identity, "date": posted, "summary": text,
                    "type": "asayiş" if re.search("ölüm|öldür|silah|yarala|darp|hırsız|gasp", text, re.I) else "gündem", "sources": sources})
    # The ten source packages already contain licensed nearest-grid data.
    from app.services.place_service import DATASET, place_id
    pilots = json.loads(DATASET.read_text(encoding="utf-8"))["neighborhoods"]
    pilot = next((p for p in pilots if place_id(p) == place_id(evidence["place"])), None)
    if pilot:
        h = pilot["categories"]["earthquake_hazard"].get("research", {})
        record["hazard"] = {"value": h.get("value"), "gridDistance": h.get("distance_to_grid_point_km", 999),
                            "url": h.get("source_url")}
    return record


def affordability(ratio):
    anchors = [(0, 100), (.2, 100), (.3, 80), (.5, 50), (.75, 25), (1, 0)]
    if ratio >= 1:
        return 0
    for (x0, y0), (x1, y1) in zip(anchors, anchors[1:]):
        if ratio <= x1:
            return rounded(y0 + (y1-y0) * (ratio-x0) / (x1-x0))


def calculate(record, as_of=None):
    today = as_of or record.get("asOf", date.today().isoformat())
    rents = [r for r in record.get("rents", []) if r.get("rooms") == "1+1" and r.get("eligible")
        and r.get("date") and 0 <= age(r["date"], today) <= 90 and r.get("amount", 0) > 0
        and r.get("lease") != "seasonal" and not r.get("locationConflict") and r.get("sources")]
    monthly = median(r["amount"] for r in rents) if rents else None
    income = json.loads((ROOT / "income_2026.json").read_text(encoding="utf-8"))["netMinimumWage"]
    rent = affordability(monthly / income["amount"]) if monthly is not None and income["validFrom"] <= today <= income["validTo"] else None

    routes = [r for r in record.get("routes", []) if r.get("officialHeadingVerified") and r.get("sources")
              and not re.search("kontrol edilmeli|bilinmiyor", r.get("localEvidence", ""), re.I)]
    route_text = " ".join(r.get("route", "") + " " + r.get("localEvidence", "") for r in routes)
    connections = sum(bool(re.search(pattern, route_text, re.I)) for pattern in ["otogar", "kampüs|üniversite|kyk|yurt", "hastane|tıp", "avm|şehir içi|şehiriçi|merkez"])
    schedules = [s for r in routes for s in r.get("timetable", [])]
    weekdays = [s["days"]["weekday"] for s in schedules if s.get("days", {}).get("weekday")]
    def minutes(t):
        h, m = map(int, t.split(":"))
        return h * 60 + m
    times = [sorted(minutes(t) for t in day.get("times", [])) for day in weekdays]
    spans = [max(t)-min(t) for t in times if t]
    gaps = [median([b-a for a, b in zip(t, t[1:]) if b > a]) for t in times if any(b > a for a, b in zip(t, t[1:]))]
    span, gap = max(spans, default=0), min(gaps, default=None)
    service = 15 if span >= 960 else 10 if span >= 720 else 5 if span else 0
    frequency = 0 if gap is None else 15 if gap <= 15 else 10 if gap <= 30 else 5 if gap <= 60 else 0
    night = 10 if any(t >= 1380 or t < 180 for ts in times for t in ts) else 0
    weekend = 10 if any(s["days"].get("saturday", {}).get("count") and s["days"].get("sunday", {}).get("count") for s in schedules) else 0
    alerts = record.get("transportAlerts", [])
    recent = [a for a in alerts if 0 <= age(a.get("date") or (a.get("observedAt") if a.get("status") == "official_notice_visible" else None), today) <= 90 and a.get("status") != "completion_reported"]
    alert_text = " ".join(a["summary"] for a in recent).lower()
    penalty = (12 if re.search("çök|giriş yapılam|kapan|ulaşım.*kilit|yol.*çalış|altyapı.*çalış", alert_text) else 0) + (8 if re.search("güzerg.h.*düzen|güzerg.h.*değiş|durak.*taş|giriş yapılam", alert_text) else 0)
    cap = 35 if any(a.get("status") == "official_access_restriction" and 0 <= age(a.get("observedAt"), today) <= 30 for a in alerts) else 45 if any(a.get("status") == "official_notice_visible" and "giriş yapılam" in a["summary"].lower() for a in recent) else 100
    transport = min(rounded(connections*7.5 + service + frequency + night + weekend - penalty), cap) if routes else None

    venues = list({v.get("id", v.get("name")): v for v in record.get("venues", []) if v.get("scope") != "nearby" and v.get("sources")}.values())
    types = {v["type"] for v in venues}
    group_points = sum(bool(types & group) for group in GROUPS) * 10
    food = " ".join(v["name"] for v in venues if v["type"] in GROUPS[0])
    styles = sum(bool(re.search(pattern, food, re.I)) for pattern in ["döner|dürüm|kebap|köfte|pide|lahmacun", "burger|tost|sandviç", "pizza|caesars", "ev yemek|lokanta|esnaf|çorba", "sushi|asya|hint mutfa|çin mutfa|meksika|vegan|vejetaryen"])
    activity = 2 if any(f.get("sources") and f.get("sentiment") == "positive" and re.search("aktivite|kafe dışı", f.get("criterion", ""), re.I) and 0 <= age(f.get("date"), today) <= 90 for f in record.get("assessments", {}).get("social_life", [])) else 0
    menus = [v for v in venues if v.get("menuPrices") and 0 <= age(v.get("menuVerifiedAt"), today) <= 90]
    social = rounded(group_points + min(10, styles*2) + (5 if types & GROUPS[5] else 0) + (3 if types & {"sports_centre", "fitness_centre"} else 0) + activity + (10 if len(menus) >= 3 else 5 if menus else 0)) if venues else None

    incidents = {}
    for n in record.get("news", []):
        days = age(n.get("date"), today)
        if not (0 <= days <= 365 and n.get("sources") and re.search("suç|şiddet|asayiş", n.get("type", ""))):
            continue
        text = n["summary"].lower()
        severity = 20 if re.search("ölüm|öldür|yaşamını yitir|hayatını kaybet", text) else 10 if re.search("ateş|silah|bıçak|darp|yarala", text) else 8 if re.search("hırsız|soygun|gasp", text) else 0
        if severity:
            key = n["date"] + re.sub(r"\W", "", text, flags=re.ASCII)[:90]
            incidents[key] = severity * (.5 if days > 180 else 1)
    penalties = sorted(incidents.values(), reverse=True)
    safety = rounded(50 - penalties[0] - min(5, penalties[1] if len(penalties) > 1 else 0)) if penalties else None

    hazard = record.get("hazard", {})
    value = hazard.get("value")
    seismic = None
    if isinstance(value, (int, float)) and hazard.get("gridDistance", 999) <= 5 and hazard.get("url"):
        distribution = json.loads((ROOT / "hazard_distribution.json").read_text(encoding="utf-8"))
        lower = sum(count for point, count in distribution["frequencies"] if point < value)
        lower += sum(count / 2 for point, count in distribution["frequencies"] if point == value)
        seismic = rounded((1 - lower / distribution["pointCount"]) * 100)
    scores = dict(zip(["rent_cost", "transportation", "social_life", "safety_news", "earthquake_hazard"], [rent, transport, social, safety, seismic]))
    reasons = {
        "rent_cost": f"1+1 son 90 günlük tarihli ilan örnekleri: {len(rents)}. Medyan: {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL. Kira/gelir oranı açıklanmış eşiklere uygulanır; gerçekleşen kira veya mahalle ortalaması değildir." if rent is not None else "Ödeme dönemi/tarihi doğrulanmış karşılaştırılabilir 1+1 örneği bulunmadı; nötr 50 verilmedi.",
        "transportation": f"Resmî hat kaydı: {len(routes)}. Hedef bağlantıları {connections*7.5}/30; hizmet yayılımı {service}/15; tarife aralığı {frequency}/15; gece {night}/10; hafta sonu {weekend}/10; yol/güzergâh bildirimi etkisi -{penalty}; erişim sınırı {cap}. Gerçek gecikme ölçülmedi.",
        "social_life": f"Kaynaklı mekân {len(venues)}; olanak türleri {group_points}/60, yemek çeşitleri ipucu {min(10, styles*2)}/20, kültür/spor/aktivite {(5 if types & GROUPS[5] else 0)+(3 if types & {'sports_centre','fitness_centre'} else 0)+activity}/10. Menü fiyatı doğrulanmış işletme: {len(menus)}. Sayım hizmet kalitesi ölçümü değildir.",
        "safety_news": f"Haber temelli düşük güvenli proje göstergesi: 50 başlangıçtan en güçlü iki tarihli asayiş kaydının etkisi çıkarılır. Değerlendirilen olay: {len(penalties)}. Suç oranı veya kişisel güvenlik tahmini değildir." if safety is not None else "Puanlanabilir tarihli asayiş kaydı yok; haber bulunmaması güvenli mahalle anlamına gelmez, 50 verilmez.",
        "earthquake_hazard": f"Akademik PGA grid değeri {value} g; ters grid yüzdeliği {seismic}/100. Grid uzaklığı {hazard.get('gridDistance')} km. Bina dayanıklılığı veya resmî AFAD güvenlik puanı değildir." if seismic is not None else "Kaynaklı ve en fazla 5 km uzaklıkta PGA grid noktası yok; bina güvenliği puanı üretilmedi.",
    }
    return {"scores": scores, "reasons": reasons, "monthly_rent": monthly,
            "rent_sample_count": len(rents), "room_type": "1+1", "as_of": today,
            "counts": {"rents": len(record.get("rents", [])), "venues": len(venues), "routes": len(routes), "news": len(record.get("news", []))}}
