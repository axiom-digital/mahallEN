"""Collect one OSM sample and query an explicitly labelled research hazard grid."""

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/cache"
USER_AGENT = "MahallEN-SE3003-prototype/0.1 (+https://github.com/axiom-digital/mahallEN)"
RECORD_URL = "https://aperta.ulakbim.gov.tr/records/274290"
METADATA_URL = "https://aperta.ulakbim.gov.tr/api/records/274290"
PGA_FILENAME = "PGA_0.10_50yrs.csv"
OVERPASS_ENDPOINTS = (
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)


def fetch(url, data=None, timeout=30):
    request = Request(url, data=data, headers={
        "User-Agent": USER_AGENT, "Accept": "application/json,*/*;q=0.5",
    })
    with urlopen(request, timeout=timeout) as response:
        return response.read(15000000)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def distance_km(lat1, lon1, lat2, lon2):
    a, b = math.radians(lat1), math.radians(lat2)
    dlat, dlon = b - a, math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(h)))


def geocode():
    cache = CACHE / "kotekli_geocode_utf8.json"
    if cache.exists():
        data = load_json(cache)
    else:
        url = "https://nominatim.openstreetmap.org/search?" + urlencode({
            "q": "Kötekli, Muğla", "countrycodes": "tr", "format": "jsonv2",
            "limit": 5, "addressdetails": 1,
        })
        data = {"request_url": url, "results": json.loads(fetch(url))}
        save_json(cache, data)
    for item in data["results"]:
        address = item.get("address", {})
        label = item.get("display_name", "")
        if "Muğla" in label and ("Menteşe" in label or "Menteşe" in str(address)):
            return {
                "lat": float(item["lat"]), "lon": float(item["lon"]),
                "label": label, "osm_type": item["osm_type"], "osm_id": item["osm_id"],
                "source_url": data["request_url"],
                "retrieved_at": datetime.fromtimestamp(cache.stat().st_mtime, timezone.utc).isoformat(),
                "method": "OSM/Nominatim representative point; not an address or whole-neighborhood measurement",
            }
    raise ValueError("No unambiguous Kotekli/Mentese/Mugla geocoding match")


def lookup_hazard(lat, lon):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates")
    metadata_path = CACHE / "aperta_274290_metadata.json"
    if not metadata_path.exists():
        save_json(metadata_path, json.loads(fetch(METADATA_URL)))
    metadata = load_json(metadata_path)
    file_info = next(f for f in metadata["files"] if f["key"] == PGA_FILENAME)
    grid = CACHE / PGA_FILENAME
    if not grid.exists():
        grid.write_bytes(fetch(file_info["links"]["self"]))
    checksum = hashlib.md5(grid.read_bytes()).hexdigest()
    if "md5:" + checksum != file_info["checksum"]:
        raise ValueError("Hazard grid checksum mismatch")
    closest = None
    closest_distance = float("inf")
    count = 0
    with grid.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            count += 1
            rlat, rlon, pga = float(row["lat"]), float(row["lon"]), float(row["PGA"])
            # Use great-circle distance; never silently extrapolate outside coverage.
            distance = distance_km(lat, lon, rlat, rlon)
            if distance < closest_distance:
                closest_distance = distance
                closest = {"latitude": rlat, "longitude": rlon, "pga_g": pga}
    covered = closest is not None and closest_distance <= 5
    return {
        "status": "research_estimate" if covered else "outside_supported_grid_distance",
        "value": closest["pga_g"] if covered else None, "unit": "g",
        "probability": "10% probability of exceedance in 50 years (publisher file/map label)",
        "method": "nearest published grid point; no interpolation",
        "nearest_grid_point": closest, "distance_to_grid_point_km": round(closest_distance, 4),
        "maximum_supported_distance_km": 5, "grid_row_count": count,
        "source_url": RECORD_URL, "metadata_url": METADATA_URL,
        "source_title": "Jeodezik Deprem Tehlike Haritası",
        "source_version": "v1, 2025-02-16",
        "authors": [c.get("name") for c in metadata.get("metadata", {}).get("creators", [])],
        "license": metadata.get("metadata", {}).get("license"),
        "file_checksum": file_info["checksum"],
        "file_retrieved_at": datetime.fromtimestamp(grid.stat().st_mtime, timezone.utc).isoformat(),
        "unit_evidence": "Publisher companion image PGA_0.10.png labels its legend PGA (g).",
        "is_official_afad_tdth": False,
        "limitations": [
            "Academic geodetic model, not the official AFAD TDTH hazard grid.",
            "This is a point estimate with a reported grid distance, not a neighborhood-wide value.",
            "No soil class, building safety conclusion, risk label or score is derived.",
        ],
    }


def collect_social(location, radius=1000, snapshot=None):
    # A cache key must identify the actual location, not just the pilot name.
    cache = CACHE / f'osm_social_{location["lat"]:.6f}_{location["lon"]:.6f}_{radius}m.json'
    access_mode = "overpass"
    if snapshot is not None:
        # Only process an existing local feasibility snapshot. Never fetch the
        # editing API here: ongoing read-only queries belong on Overpass.
        saved = load_json(snapshot)
        raw, endpoint = saved["response"], saved["request_url"]
        attempts = []
        access_mode = "local_one_off_osm_snapshot"
        nodes = {e["id"]: e for e in raw.get("elements", []) if e["type"] == "node"}
        for item in raw.get("elements", []):
            if item["type"] == "way":
                points = [nodes[n] for n in item.get("nodes", []) if n in nodes]
                if points:
                    item["center"] = {
                        "lat": (min(p["lat"] for p in points)+max(p["lat"] for p in points))/2,
                        "lon": (min(p["lon"] for p in points)+max(p["lon"] for p in points))/2,
                    }
    elif cache.exists():
        saved = load_json(cache)
        raw, endpoint = saved["response"], saved["endpoint"]
        attempts = []
    else:
        query = (
            '[out:json][timeout:20];('
            f'nwr(around:{radius},{location["lat"]},{location["lon"]})'
            '["amenity"~"^(cafe|restaurant|fast_food|food_court|bar|pub|nightclub|biergarten|ice_cream|pharmacy|cinema|theatre|library|community_centre|arts_centre)$"];'
            f'nwr(around:{radius},{location["lat"]},{location["lon"]})'
            '["leisure"~"^(park|sports_centre|fitness_centre|playground)$"];'
            f'nwr(around:{radius},{location["lat"]},{location["lon"]})'
            '["shop"~"^(supermarket|convenience)$"];);out center tags;'
        )
        attempts = []
        raw = None
        endpoint = None
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                raw = json.loads(fetch(endpoint, urlencode({"data": query}).encode(), timeout=30))
                if raw.get("remark"):
                    raise ValueError("Overpass returned a partial query result")
                if not isinstance(raw.get("elements"), list):
                    raise ValueError("Overpass response missing elements")
                attempts.append({"endpoint": endpoint, "status": "ok"})
                save_json(cache, {"endpoint": endpoint, "query": query, "response": raw})
                break
            except Exception as exc:
                attempts.append({"endpoint": endpoint, "status": "failed", "error": type(exc).__name__, "http_code": getattr(exc, "code", None)})
                raw = None
        if raw is None:
            return {"status": "unavailable", "places": [], "counts": None, "attempts": attempts,
                    "missing_reason": "No complete response from public Overpass instances; not zero facilities."}
    places, counts = [], {}
    seen = set()
    allowed = {"cafe", "restaurant", "fast_food", "food_court", "bar", "pub", "nightclub", "biergarten", "ice_cream", "pharmacy", "cinema", "theatre", "library",
               "community_centre", "arts_centre", "park", "sports_centre", "fitness_centre",
               "playground", "supermarket", "convenience"}
    for item in raw.get("elements", []):
        tags = item.get("tags", {})
        kind = tags.get("amenity") or tags.get("leisure") or tags.get("shop")
        if kind not in allowed:
            continue
        point = item.get("center", item)
        lat, lon = point.get("lat"), point.get("lon")
        if lat is None or lon is None:
            continue
        distance_m = distance_km(location["lat"], location["lon"], lat, lon)*1000
        if distance_m > radius:
            continue
        key = (item["type"], item["id"])
        if key in seen:
            continue
        seen.add(key)
        counts[kind] = counts.get(kind, 0) + 1
        places.append({
            "osm_type": item["type"], "osm_id": item["id"], "name": tags.get("name"),
            "category": kind, "latitude": lat, "longitude": lon,
            "distance_to_reference_point_m": round(distance_m),
            "location_method": "OSM node coordinate" if item["type"] == "node" else "OSM object bounding-box midpoint",
            "source_url": f'https://www.openstreetmap.org/{item["type"]}/{item["id"]}',
        })
    return {
        "status": "collected_snapshot" if snapshot else "collected",
        "access_mode": access_mode, "endpoint": endpoint, "attempts": attempts,
        "retrieved_at": datetime.fromtimestamp((snapshot or cache).stat().st_mtime, timezone.utc).isoformat(),
        "osm_timestamp": raw.get("osm3s", {}).get("timestamp_osm_base"),
        "scope": {"type": "radius_around_representative_point", "radius_m": radius},
        "counts": counts, "osm_object_count": len(places), "places": places,
        "attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0",
        "license_url": "https://www.openstreetmap.org/copyright",
        "limitations": [
            "Sample radius is not the neighborhood boundary.",
            "OSM completeness varies; absence is not proof that a facility does not exist.",
            "Counts are OSM objects, not a deduplicated business census; names may be missing.",
            "No current opening status, quality rating or affordability is inferred.",
            "Ongoing read-only collection must use Overpass or an appropriate extract/provider, not the OSM editing API.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/pilot/kotekli_direct_sample.json")
    parser.add_argument("--osm-snapshot", type=Path, help="Use an existing local OSM JSON snapshot; no editing-API fetch is made")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    location = geocode()
    print(json.dumps({"status": "location_matched", "location": location}, ensure_ascii=False), flush=True)
    hazard = lookup_hazard(location["lat"], location["lon"])
    social = collect_social(location, snapshot=args.osm_snapshot)
    result = {
        "schema_version": "0.1.0", "dataset_status": "technical_sample_requires_review",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "neighborhood": "Kötekli", "district": "Menteşe", "city": "Muğla",
        "location": location,
        "categories": {"social_life": social, "earthquake_hazard": hazard},
    }
    save_json(args.output, result)
    print(json.dumps({"output": str(args.output), "social_status": social["status"],
                      "social_counts": social.get("counts"), "hazard_status": hazard["status"],
                      "hazard_grid_distance_km": hazard["distance_to_grid_point_km"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
