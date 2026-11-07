"""Search real localities and prepare source-backed reports on explicit selection."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
from functools import lru_cache
import gzip
from threading import Lock
from time import monotonic, sleep
import unicodedata

import httpx
from sqlalchemy.exc import IntegrityError

from app.models.place import Place
from app.models.report_cache import ReportCache
from app.services.cache_service import set_cached_report

ROOT = Path(__file__).resolve().parents[3]
DATASET = ROOT / "data/pilot_neighborhoods.json"
CATEGORY_LABELS = {"rent_cost": "Kira ve maliyet", "safety_news": "Haberler ve güvenlik",
    "transportation": "Ulaşım", "social_life": "Sosyal yaşam", "earthquake_hazard": "Deprem verisi"}
_search_lock = Lock()
_last_search = 0.0
_search_cache = {}


@lru_cache(maxsize=1)
def neighborhood_directory():
    """Local name directory for autocomplete; never turns names into report facts."""
    directory = ROOT / "data/place_directory"
    if not directory.exists():
        return []
    provinces = {p["id"]: p["name"] for p in json.loads((directory / "provinces.json").read_text(encoding="utf-8"))}
    districts = {p["id"]: p["name"] for p in json.loads((directory / "districts.json").read_text(encoding="utf-8"))}
    rows = json.loads(gzip.decompress((directory / "neighborhoods.json.gz").read_bytes()))
    result = []
    for row in rows:
        if row["province_id"] not in provinces or row["district_id"] not in districts:
            continue
        target = {"name": row["name"], "city": provinces[row["province_id"]], "district": districts[row["district_id"]],
                  "location": None, "identity_source": "turkiye-data:a0a453c75134e4a690d6c453cc7e8b514aa1d2c1"}
        result.append((normalize(" ".join(target[k] for k in ("name", "district", "city"))), normalize(target["name"]), target))
    return result


def suggest_neighborhoods(query, limit=10):
    words = [w for w in normalize(query).split() if w not in {"mahallesi", "mah"}]
    if not words:
        return []
    matching = [(0 if name.startswith(words[0]) else 1, text, target) for text, name, target in neighborhood_directory()
                if all(word in text for word in words)]
    matching.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in matching[:limit]]


def normalize(value):
    value = unicodedata.normalize("NFKD", value.casefold().replace("ı", "i"))
    return " ".join("".join(c for c in value if not unicodedata.combining(c)).replace(",", " ").split())


def name_only(value):
    return value.removesuffix(" Mahallesi").removesuffix(" mahallesi").strip()


def place_id(target):
    identity = [normalize(name_only(target[k])) for k in ("city", "district", "name")]
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()[:32]


def register(db, target):
    identity = place_id(target)
    existing = db.get(Place, identity)
    if not existing:
        db.add(Place(id=identity, target=target))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # A simultaneous search may have registered this same place.
    return db.get(Place, identity)


def cached_available(db, identity):
    row = db.query(ReportCache).filter_by(slug="place:" + identity).first()
    if not row:
        return False
    expires = row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at
    from app.services.place_assessment import is_current_report
    return expires > datetime.now(timezone.utc) and is_current_report(row.report_data)


def public_place(db, row):
    available = cached_available(db, row.id)
    cached = db.query(ReportCache).filter_by(slug="place:" + row.id).first() if available else None
    assessment = cached.report_data.get("assessment", {}) if cached else {}
    profiles = assessment.get("profile_scores", {})
    return {"id": row.id, **{k: row.target[k] for k in ("name", "district", "city")},
            "label": f"{row.target['name']} / {row.target['district']} / {row.target['city']}",
            "report_available": available, "overall_score": assessment.get("overall_score"),
            "avg_rent_tl": assessment.get("calculation", {}).get("monthly_rent"),
            "suitability_student": profiles.get("students"), "suitability_family": profiles.get("families"),
            "suitability_professional": profiles.get("professionals")}


def saved_report(record, identity):
    source_map = {s["id"]: {"id": s["id"], "title": s["publisher"], "url": s["url"]} for s in record["sources"]}
    categories = []
    for key, label in CATEGORY_LABELS.items():
        category = record["categories"][key]
        items = [{"text": item["text"], "date": item.get("date"), "date_basis": item.get("date_basis"),
                  "note": item.get("limitations"), "sources": [source_map[s] for s in item["source_ids"]]}
                 for item in category["observations"]]
        if key == "earthquake_hazard" and category.get("value") is not None:
            items.append({"text": f"Araştırma gridinde temsil noktasının PGA değeri {category['value']} g.",
                "date": None, "date_basis": "research_grid",
                "note": "Akademik nokta tahmini; resmî AFAD TDTH veya bina sağlamlığı sonucu değildir.",
                "sources": [source_map[s] for s in category.get("source_ids", [])]})
        categories.append({"id": key, "label": label, "items": items, "missing_reason": category.get("missing_reason")})
    return {"place": {"id": identity, **{k: record[k] for k in ("name", "district", "city")}},
        "reference_date": record["reference_date"], "summary": "Mahallenin kayıtlı kaynaklarını kategori bazında inceleyebilirsin. Bulunamayan bilgiler eksik olarak bırakıldı.",
        "categories": categories, "limitations": record["limitations"], "origin": "reviewed_evidence_snapshot",
        "generated_by": "MahallEN kaynak özeti"}


def prewarm_saved(db, ttl):
    if not DATASET.exists():
        return
    for record in json.loads(DATASET.read_text(encoding="utf-8"))["neighborhoods"]:
        target = {k: record[k] for k in ("name", "district", "city")}
        target["location"] = record.get("location")
        row = register(db, target)
        existing = db.query(ReportCache).filter_by(slug="place:" + row.id).first()
        # Never replace a generated narrative merely because the API restarted.
        if existing is None:
            set_cached_report(db, "place:" + row.id, saved_report(record, row.id), ttl, "places-v1:saved")


def lookup_neighborhoods(query):
    """Only explicit searches call Nominatim, globally spaced at <=1 request/sec."""
    global _last_search
    with _search_lock:
        cached = _search_cache.get(normalize(query))
        if cached and monotonic() - cached[0] < 300:
            return cached[1]
        sleep(max(0, 1.1 - (monotonic() - _last_search)))
        _last_search = monotonic()
        response = httpx.get("https://nominatim.openstreetmap.org/search",
            params={"q": query, "countrycodes": "tr", "format": "jsonv2", "addressdetails": 1, "limit": 12},
            headers={"User-Agent": "MahallEN/1.0 (+https://github.com/axiom-digital/mahallEN)"}, timeout=12)
        response.raise_for_status()
        results = []
        for candidate in response.json():
            address = candidate.get("address", {})
            kind = candidate.get("addresstype")
            if address.get("country_code") != "tr" or kind not in {"suburb", "neighbourhood", "quarter", "village", "hamlet"}:
                continue
            city = address.get("province") or address.get("state")
            district = address.get("town") or address.get("city_district") or address.get("county") or address.get("municipality")
            name = candidate.get("name")
            if not city or not district or not name or any(len(v) > 100 for v in (city, district, name)):
                continue
            lat, lon = float(candidate["lat"]), float(candidate["lon"])
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            results.append({"name": name_only(name), "city": city, "district": district,
                "location": {"lat": lat, "lon": lon, "osm_type": candidate["osm_type"], "osm_id": candidate["osm_id"],
                    "label": candidate.get("display_name"), "attribution": "© OpenStreetMap contributors"}})
        if len(_search_cache) >= 100:
            _search_cache.pop(next(iter(_search_cache)))
        _search_cache[normalize(query)] = (monotonic(), results)
        return results
