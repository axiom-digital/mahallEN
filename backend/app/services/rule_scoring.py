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
VERSION = "rules-v2"
REPORT_VERSION = 3
GROUPS = [set(v.split()) for v in [
    "restaurant fast_food",
    "bar pub nightclub live_music",
    "cafe",
    "supermarket convenience marketplace bakery",
    "park playground camp_site sports_centre fitness_centre",
    "community_centre arts_centre cinema theatre library",
]]
OFFICIAL_HOSTS = {
    "ulasim.muttas.com.tr", "eshot.gov.tr", "iett.istanbul", "iett.istanbul.tr",
    "ego.gov.tr", "metro.istanbul", "izmir.bel.tr", "izdeniz.com.tr",
    "sehirhatlari.istanbul", "ulasim.istanbul", "burulas.com.tr", "bursa.bel.tr",
    "estram.com.tr", "eskisehir.bel.tr", "ulasim.mersin.bel.tr",
}
ROOM_FACTORS = {"1+1": 1.0, "1+0": 1.15, "2+0": 0.90, "2+1": 0.78, "3+1": 0.65, "4+1": 0.55}
VENUE_PATTERNS = [
    ("library", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,4}\s+[Kk]ütüphane\w*)"),
    ("arts_centre", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,4}\s+Sanat\s+Merkezi)"),
    ("community_centre", r"((?:\d+\s+)?[A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,4}\s+(?:Gençlik|Kültür)\s+Merkezi)"),
    ("sports_centre", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,4}\s+Spor\s+(?:Parkı|Salonu|Kompleksi|Tesisi))"),
    ("park", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,4}\s+Parkı)"),
    ("cafe", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,3}\s+(?:Kafe|Cafe))\b"),
    ("restaurant", r"([A-ZÇĞİÖŞÜ][\w’'-]+(?:\s+[A-ZÇĞİÖŞÜ\d][\w’'-]+){0,3}\s+(?:Restoran|Lokanta\w*))\b"),
]


def _parse_price_tl(text):
    match = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*(?:TL|₺|TRY)\b", text, re.I)
    if not match:
        return None
    return int(re.sub(r"[.,]", "", match.group(1)))


def rounded(n):
    return max(0, min(100, math.floor(n + .5)))


def age(value, today):
    try:
        return (date.fromisoformat(today[:10]) - date.fromisoformat(value[:10])).days
    except (ValueError, TypeError):
        return float("inf")


@lru_cache(maxsize=1)
def research_records():
    reports = list(json.loads((ROOT / "reports.json").read_text(encoding="utf-8"))["reports"])
    enriched_path = ROOT / "multicity_enriched.json"
    if enriched_path.exists():
        enriched = json.loads(enriched_path.read_text(encoding="utf-8")).get("reports", [])
        seen_keys = {
            (r.get("city", "").casefold(), r.get("district", "").casefold(), r.get("name", "").casefold())
            for r in reports
        }
        for item in enriched:
            key = (item.get("city", "").casefold(), item.get("district", "").casefold(), item.get("name", "").casefold())
            if key not in seen_keys:
                reports.append(item)
                seen_keys.add(key)
    return reports


def matched_record(place):
    from app.services.place_service import place_id
    return next((r for r in research_records() if place_id(r) == place_id(place)), None)


def record_for(evidence):
    """Prefer the detailed package; never infer monthly rent from an unspecified TL price."""
    known = matched_record(evidence["place"])
    if known:
        return known
    if evidence.get("research_record"):
        return evidence["research_record"]
    record = {**evidence["place"], "asOf": evidence["reference_date"],
              "rents": [], "rent_benchmarks": [], "routes": [], "venues": [], "news": [], "transportAlerts": [], "hazard": {}}
    for category in evidence["categories"]:
        items = [*category.get("items", []), *(category.get("historical_items", []) if category["id"] == "safety_news" else [])]
        for index, item in enumerate(items):
            text = item.get("evidence_quote") or item["text"]
            identity = f"{category['id']}:{index+1}"
            sources = item.get("sources", [])
            posted = item.get("date") or next(iter(re.findall(r"\b20\d\d-\d\d-\d\d\b", text)), None)
            if category["id"] == "rent_cost":
                amt = _parse_price_tl(text)
                room = re.search(r"\b\d\+\d\b", text)
                is_rental = bool(re.search(r"aylık|/\s*ay\b|kiralık|monthly", text, re.I))
                if amt and room and is_rental:
                    record["rents"].append({"id": identity, "amount": amt, "rooms": room[0],
                        "date": posted, "eligible": bool(posted), "lease": "monthly", "sources": sources})
            elif category["id"] == "transportation":
                hosts = {(urlparse(s["url"]).hostname or "").removeprefix("www.") for s in sources}
                if hosts & OFFICIAL_HOSTS:
                    record["routes"].append({"id": identity, "route": text, "localEvidence": text,
                        "officialHeadingVerified": True, "sources": sources})
                else:
                    record["transportAlerts"].append({"summary": text, "date": posted,
                        "sources": sources, "status": "reported"})
            elif category["id"] == "social_life":
                for kind, pattern in VENUE_PATTERNS:
                    found = re.findall(pattern, text)
                    if found:
                        for name in found:
                            record["venues"].append({"id": name.casefold(), "name": name, "type": kind,
                                "scope": "reported_address", "sources": sources})
                        break
            elif category["id"] == "safety_news" and sources:
                record["news"].append({"id": identity, "date": posted, "summary": text,
                    "type": "asayiş" if re.search(r"ölüm|öldür|silah|yarala|darp|hırsız|gasp|soygun|ateş", text, re.I) else "gündem",
                    "sources": sources})
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


def _confidence(sample_count, medium_min, high_min):
    if sample_count <= 0:
        return {"level": "none", "sample_count": 0, "label": "Veri yok"}
    if sample_count >= high_min:
        return {"level": "high", "sample_count": sample_count, "label": "Yüksek güven"}
    if sample_count >= medium_min:
        return {"level": "medium", "sample_count": sample_count, "label": "Orta güven"}
    return {"level": "low", "sample_count": sample_count, "label": "Sınırlı örneklem"}


def calculate(record, as_of=None):
    today = as_of or record.get("asOf", date.today().isoformat())
    rents_strict = [r for r in record.get("rents", []) if r.get("rooms") == "1+1" and r.get("eligible")
        and r.get("date") and 0 <= age(r["date"], today) <= 90 and r.get("amount", 0) > 0
        and r.get("lease") != "seasonal" and not r.get("locationConflict") and r.get("sources")]
    valid_listings = [
        r for r in record.get("rents", [])
        if r.get("amount", 0) > 0 and r.get("sources")
        and r.get("lease") != "seasonal" and not r.get("locationConflict")
        and r.get("rooms") in ROOM_FACTORS
        and (r.get("date") is None or 0 <= age(r["date"], today) <= 90)
    ]
    benchmarks = [
        b for b in record.get("rent_benchmarks", [])
        if b.get("amount", 0) > 0 and b.get("sources")
        and (b.get("date") is None or 0 <= age(b["date"], today) <= 180)
    ]
    if len(rents_strict) >= 3:
        monthly = median(r["amount"] for r in rents_strict)
        rent_sample_count = len(rents_strict)
        used_benchmarks = 0
        rent_mode = "strict_1+1"
    else:
        norm_listings = [r["amount"] * ROOM_FACTORS[r["rooms"]] for r in valid_listings]
        norm_benchmarks = [b["amount"] * (1.0 if b.get("rooms") == "1+1" else 0.78) for b in benchmarks]
        combined = norm_listings + norm_benchmarks
        if combined:
            monthly = round(median(combined))
            rent_sample_count = len(valid_listings) + len(benchmarks)
            used_benchmarks = len(benchmarks)
            if norm_benchmarks and not norm_listings:
                rent_mode = "market_index"
            elif norm_benchmarks:
                rent_mode = "normalized_with_index"
            elif all(r.get("rooms") == "1+1" for r in valid_listings):
                rent_mode = "undated_1+1"
            else:
                rent_mode = "normalized_rooms"
        else:
            monthly = None
            rent_sample_count = 0
            used_benchmarks = 0
            rent_mode = "none"
    income = json.loads((ROOT / "income_2026.json").read_text(encoding="utf-8"))["netMinimumWage"]
    rent = affordability(monthly / income["amount"]) if monthly is not None and income["validFrom"] <= today <= income["validTo"] else None

    routes = [r for r in record.get("routes", []) if (r.get("officialHeadingVerified") or r.get("mapRouteVerified")) and r.get("sources")
              and not re.search("kontrol edilmeli|bilinmiyor", r.get("localEvidence", ""), re.I)]
    route_text = " ".join(r.get("route", "") + " " + r.get("localEvidence", "") for r in routes)
    connections = sum(bool(re.search(pattern, route_text, re.I)) for pattern in [
        "otogar", "kampüs|üniversite|kyk|yurt", "hastane|tıp",
        "avm|şehir içi|şehiriçi|merkez|kadıköy|beşevler|karşıyaka|bostanlı|kızılay"])
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
    if routes and any(times):
        transport = min(rounded(connections*7.5 + service + frequency + night + weekend - penalty), cap)
        transport_mode = "timetable"
    elif routes:
        rail_bonus = 20 if re.search(
            r"metro|tramvay|vapur|feribot|iskele|marmaray|banliyö|hafif raylı|ankaray|bursaray|estram|izban|\bt[1-5]\b|\bm[1-9]\b",
            route_text,
            re.I,
        ) else 0
        transport = min(rounded(25 + min(22, len(routes)*4) + min(15, connections*7.5) + rail_bonus - penalty), 78)
        transport_mode = "route_indicator"
    else:
        transport = None
        transport_mode = "none"

    venues = list({v.get("id", v.get("name")): v for v in record.get("venues", []) if v.get("scope") != "nearby" and v.get("sources")}.values())
    if venues:
        types = {v["type"] for v in venues}
        named_groups = (
            ("yeme_icme", GROUPS[0]),
            ("gece", GROUPS[1]),
            ("kafe", GROUPS[2]),
            ("gunluk", GROUPS[3]),
            ("park_spor", GROUPS[4]),
            ("kultur_sanat", GROUPS[5]),
        )
        grp = {gname: sum(1 for v in venues if v.get("type") in gset) for gname, gset in named_groups}
        def _depth(n):
            return 8.0 if n >= 7 else 6.5 if n >= 4 else 4.5 if n >= 2 else 2.5 if n == 1 else 0.0
        group_pts = sum(_depth(n) for n in grp.values())
        food = " ".join(v["name"] for v in venues if v["type"] in GROUPS[0])
        styles = sum(bool(re.search(pattern, food, re.I)) for pattern in [
            "döner|dürüm|kebap|köfte|pide|lahmacun", "burger|tost|sandviç", "pizza|caesars",
            "ev yemek|lokanta|esnaf|çorba", "sushi|asya|hint mutfa|çin mutfa|meksika|vegan|vejetaryen"])
        style_pts = min(8.0, styles * 1.6)
        subtype_pts = min(18.0, len(types) * 1.12)
        grp_total = sum(grp.values()) or 1
        probs = [n / grp_total for n in grp.values() if n > 0]
        entropy = -sum(p * math.log(p) for p in probs)
        balance_pts = ((entropy / math.log(6)) if len(probs) > 1 else 0.0) * 16.0
        non_food = grp["park_spor"] + grp["kultur_sanat"]
        non_food_pts = min(10.0, non_food * 0.65)
        eat_share = (grp["yeme_icme"] + grp["kafe"] + grp["gece"]) / len(venues)
        monoculture_pen = (
            14 if (len(venues) >= 5 and eat_share >= 0.75 and non_food <= 4)
            else 10 if (len(venues) >= 5 and eat_share >= 0.85 and grp["kultur_sanat"] < 4)
            else 0
        )
        no_culture_pen = 6 if (grp["kultur_sanat"] == 0 and len(venues) >= 5) else 0
        social = rounded(group_pts + style_pts + subtype_pts + balance_pts + non_food_pts - monoculture_pen - no_culture_pen)
        eat_pct = round(eat_share * 100)
        active_groups = sum(1 for n in grp.values() if n > 0)
        monoculture_warning = (
            f"Mekânların %{eat_pct}'i yeme-içme, kafe ve gece odaklı; park/spor ({grp['park_spor']}) ve kültür-sanat ({grp['kultur_sanat']}) çeşitliliği sınırlı."
            if monoculture_pen > 0 else
            "Kültür-sanat (sinema, tiyatro, kütüphane, sanat merkezi) kaydı bulunamadı; çeşitlilik kısmen sınırlı."
            if no_culture_pen > 0 else
            None
        )
        social_note = monoculture_warning or (
            f"{len(types)} farklı mekân türü; {active_groups}/6 yaşam alanında dağılım "
            f"(park/spor: {grp['park_spor']}, kültür-sanat: {grp['kultur_sanat']})."
        )
        social_diversity = {
            "groups": grp,
            "distinct_types": len(types),
            "active_groups": active_groups,
            "eat_drink_share_pct": eat_pct,
            "monoculture_warning": monoculture_warning,
            "note": social_note,
        }
    else:
        social = None
        social_diversity = None

    valid_news = [n for n in record.get("news", []) if n.get("sources") and 0 <= age(n.get("date"), today) <= 365]
    if valid_news:
        incidents = {}
        for n in valid_news:
            text = (n.get("summary") or "").lower()
            is_crime_type = bool(re.search(r"suç|şiddet|asayiş|yangın|trafik", n.get("type", ""), re.I))
            severity = (25 if re.search(r"ölüm|öldür|yaşamını yitir|hayatını kaybet", text)
                        else 15 if re.search(r"ateş|silah|bıçak|darp|yarala|saldırı|soygun|gasp", text)
                        else 10 if re.search(r"hırsız|dolandır|kapkaç", text)
                        else 5 if re.search(r"yangın|kaza", text) and is_crime_type else 0)
            if severity:
                days = age(n.get("date"), today) if n.get("date") else 200
                weight = 0.5 if days > 180 else 1.0
                key = (n.get("date") or "undated") + re.sub(r"\W", "", text, flags=re.ASCII)[:90]
                incidents[key] = severity * weight
        penalties = sorted(incidents.values(), reverse=True)
        deduction = (penalties[0] if len(penalties) > 0 else 0) + (penalties[1] * 0.6 if len(penalties) > 1 else 0) + (penalties[2] * 0.3 if len(penalties) > 2 else 0)
        safety = rounded(max(10, 75 - deduction))
    else:
        safety = None

    hazard = record.get("hazard", {})
    value = hazard.get("value")
    seismic = None
    if isinstance(value, (int, float)) and hazard.get("gridDistance", 999) <= 5 and hazard.get("url"):
        lower = sum(count for point, count in dist_frequencies() if point < value)
        lower += sum(count / 2 for point, count in dist_frequencies() if point == value)
        seismic = rounded((1 - lower / dist_point_count()) * 100)
    scores = dict(zip(["rent_cost", "transportation", "social_life", "safety_news", "earthquake_hazard"], [rent, transport, social, safety, seismic]))
    rent_reason = (
        f"1+1 son 90 günlük tarihli ilan örnekleri: {rent_sample_count}. Medyan: {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL."
        if rent_mode == "strict_1+1" and rent is not None else
        f"1+1 ilan örnekleri ({rent_sample_count} kayıt, bazıları tarihsiz): medyan {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL."
        if rent_mode == "undated_1+1" and rent is not None else
        f"Farklı oda tiplerinden 1+1 eşdeğerine normalize edilmiş tahmin ({rent_sample_count} ilan): {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL."
        if rent_mode == "normalized_rooms" and rent is not None else
        f"{len(valid_listings)} oda-normalize ilan ve {used_benchmarks} piyasa kira endeksi ({rent_sample_count} toplam örnek) ile 1+1 eşdeğer medyanı: {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL."
        if rent_mode == "normalized_with_index" and rent is not None else
        f"{used_benchmarks} piyasa kira endeksi verisinden 1+1 eşdeğer medyanı: {monthly} TL/ay. Net asgari ücret referansı: {income['amount']} TL."
        if rent_mode == "market_index" and rent is not None else
        "Kiralık konut ilanı veya piyasa endeksi örneği bulunamadı; nötr 50 verilmedi."
    )
    transport_reason = (
        f"Kaynaklı hat kaydı: {len(routes)}. Hedef bağlantıları {connections*7.5}/30; hizmet yayılımı {service}/15; tarife aralığı {frequency}/15; gece {night}/10; hafta sonu {weekend}/10; yol/güzergâh bildirimi etkisi -{penalty}; erişim sınırı {cap}."
        if transport_mode == "timetable" else
        f"Kaynaklı hat kaydı ({len(routes)} hat) doğrulandı; hareket saati tablosu ayrıştırılamadığı için hat ve raylı sistem kapsamı üzerinden ön gösterge hesaplandı ({transport}/100)."
        if transport_mode == "route_indicator" else
        "Resmî ulaşım hattı kaydı doğrulanamadığı için ulaşım puanı üretilmedi."
    )
    reasons = {
        "rent_cost": rent_reason,
        "transportation": transport_reason,
        "social_life": (
            f"Kaynaklı {len(venues)} mekân kaydı; {social_diversity['distinct_types']} farklı tür ve "
            f"{social_diversity['active_groups']}/6 yaşam alanı üzerinden çeşitlilik ağırlıklı puanlandı ({social}/100). "
            f"{social_diversity['note']} Mahalledeki tüm işletmelerin sayımı değildir."
        ) if social is not None else "Sosyal yaşam veya günlük olanak kaydı bulunamadı.",
        "safety_news": f"Son 1 yıldaki {len(valid_news)} tarihli/kaynaklı haber incelemesinden {len(incidents)} tekil olay ağırlıklandırıldı ({safety}/100). Resmî suç istatistiği değildir." if safety is not None else "Güvenlik ve yerel gündem değerlendirmesi için yeterli haber kaydı bulunamadı.",
        "earthquake_hazard": f"Akademik PGA grid değeri {value} g; ters grid yüzdeliği {seismic}/100. Grid uzaklığı {hazard.get('gridDistance')} km. Bina dayanıklılığı veya resmî AFAD güvenlik puanı değildir." if seismic is not None else "Kaynaklı ve en fazla 5 km uzaklıkta PGA grid noktası yok; bina güvenliği puanı üretilmedi.",
    }
    confidence = {
        "rent_cost": _confidence(rent_sample_count if rent is not None else 0, 3, 8),
        "transportation": _confidence(len(routes) if transport is not None else 0, 3, 6),
        "social_life": _confidence(len(venues) if social is not None else 0, 10, 25),
        "safety_news": _confidence(len(valid_news) if safety is not None else 0, 4, 8),
        "earthquake_hazard": _confidence(1 if seismic is not None else 0, 1, 1),
    }
    return {"scores": scores, "reasons": reasons, "monthly_rent": monthly,
            "rent_sample_count": rent_sample_count, "benchmark_count": used_benchmarks,
            "rent_mode": rent_mode, "room_type": "1+1", "as_of": today,
            "confidence": confidence, "social_diversity": social_diversity,
            "counts": {"rents": len(record.get("rents", [])), "venues": len(venues), "routes": len(routes), "news": len(record.get("news", []))}}


@lru_cache(maxsize=1)
def _hazard_distribution():
    return json.loads((ROOT / "hazard_distribution.json").read_text(encoding="utf-8"))


def dist_frequencies():
    return _hazard_distribution()["frequencies"]


def dist_point_count():
    return _hazard_distribution()["pointCount"]
