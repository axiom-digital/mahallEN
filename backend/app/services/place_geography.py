"""Location-matched public geography, separate from LLM-generated observations."""
import csv
import gzip
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import httpx
from app.services.place_service import lookup_neighborhoods, place_id

ROOT = Path(__file__).resolve().parents[3] / "data/geography"


def distance_km(a, b, x, y):
    da, db = math.radians(x-a), math.radians(y-b)
    h = math.sin(da/2)**2 + math.cos(math.radians(a))*math.cos(math.radians(x))*math.sin(db/2)**2
    return 12742.0176 * math.asin(min(1, math.sqrt(h)))


@lru_cache(maxsize=1)
def grid():
    meta = json.loads((ROOT / "metadata.json").read_text(encoding="utf-8"))
    raw = gzip.decompress((ROOT / "pga.csv.gz").read_bytes())
    if "md5:" + hashlib.md5(raw).hexdigest() != meta["checksum"]:
        raise ValueError("Published PGA grid checksum mismatch")
    buckets = {}
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        lat, lon, value = float(row["lat"]), float(row["lon"]), float(row["PGA"])
        buckets.setdefault((math.floor(lat), math.floor(lon)), []).append((lat, lon, value))
    return meta, buckets


def hazard_for(lat, lon):
    meta, buckets = grid()
    candidates = [point for x in range(math.floor(lat)-1, math.floor(lat)+2)
        for y in range(math.floor(lon)-1, math.floor(lon)+2) for point in buckets.get((x,y), [])]
    if not candidates:
        return {}
    nearest = min(candidates, key=lambda point: distance_km(lat, lon, point[0], point[1]))
    km = distance_km(lat, lon, nearest[0], nearest[1])
    if km > 5:
        return {}
    return {"value": nearest[2], "gridDistance": round(km, 4), "url": meta["source_url"],
        "title": meta["title"], "license": meta["license"], "sourceYear": 2025,
        "gridPoint": {"lat": nearest[0], "lon": nearest[1]}, "method": "nearest published grid point; no interpolation"}


def resolve_point(target):
    if target.get("location"):
        return target["location"]
    matches = [row for row in lookup_neighborhoods(", ".join(target[k] for k in ("name", "district", "city")))
        if place_id(row) == place_id(target)]
    return matches[0]["location"] if len(matches) == 1 else None


def osm_venues(target, point):
    """Use an actual named administrative area, never label a radius as a mahalle."""
    name = target["name"].replace('"', '').replace("\\", "")
    query = (f'[out:json][timeout:18];is_in({point["lat"]},{point["lon"]})->.near;'
        f'area.near["boundary"="administrative"]["name"~"^{name}( Mahallesi)?$",i]->.mahalle;('
        'nwr(area.mahalle)["name"]["amenity"~"^(cafe|restaurant|fast_food|bar|pub|nightclub|cinema|theatre|library|community_centre|arts_centre)$"];'
        'nwr(area.mahalle)["name"]["leisure"~"^(park|sports_centre|fitness_centre|playground)$"];'
        'nwr(area.mahalle)["name"]["shop"~"^(supermarket|convenience)$"];);out center tags;')
    with httpx.Client(timeout=5) as client:
        response = client.post("https://overpass-api.de/api/interpreter", data={"data": query},
            headers={"User-Agent": "MahallEN/1.0 (+https://github.com/axiom-digital/mahallEN)"})
        response.raise_for_status()
        data = response.json()
    if data.get("remark"):
        return []
    venues = []
    for row in data.get("elements", []):
        tags, position = row.get("tags", {}), row.get("center", row)
        if not tags.get("name") or not all(isinstance(position.get(k), (int, float)) for k in ("lat", "lon")):
            continue
        # Catch a wrong same-name administrative area rather than importing distant POIs.
        if distance_km(point["lat"], point["lon"], position["lat"], position["lon"]) > 10:
            continue
        url = f'https://www.openstreetmap.org/{row["type"]}/{row["id"]}'
        venues.append({"id": f'osm:{row["type"]}:{row["id"]}', "name": tags["name"],
            "type": tags.get("amenity") or tags.get("leisure") or tags.get("shop"),
            "lat": position["lat"], "lon": position["lon"], "scope": "osm_administrative_area",
            "address": " ".join(tags[k] for k in ("addr:street", "addr:housenumber") if tags.get(k)) or None,
            "sources": [{"url": url, "publisher": "OpenStreetMap · ODbL-1.0"}]})
    return venues[:150]


def collect_geography(target):
    result = {"location": None, "hazard": {}, "venues": []}
    try:
        point = resolve_point(target)
        if not point:
            return result
        result["location"] = point
        result["hazard"] = hazard_for(point["lat"], point["lon"])
        try:
            result["venues"] = osm_venues(target, point)
        except (httpx.HTTPError, ValueError):
            pass  # Unavailable geography never becomes a zero-facility claim.
    except (httpx.HTTPError, ValueError):
        pass
    return result


def enrich_report(report, geography):
    record = report["research_record"]
    if geography.get("location"):
        report["place"]["location"] = geography["location"]
    if geography.get("hazard"):
        record["hazard"] = geography["hazard"]
    existing = {" ".join(v["name"].casefold().split()) for v in record["venues"]}
    for venue in geography.get("venues", []):
        key = " ".join(venue["name"].casefold().split())
        if key not in existing:
            record["venues"].append(venue)
            existing.add(key)
        else:
            match = next(v for v in record["venues"] if " ".join(v["name"].casefold().split()) == key)
            match.update(lat=venue["lat"], lon=venue["lon"])
            match["sources"] += venue["sources"]
    if record["hazard"].get("value") is not None:
        h = record["hazard"]
        category = next(c for c in report["categories"] if c["id"] == "earthquake_hazard")
        category["items"].insert(0, {"text": f'2025 akademik gridinde temsil noktasına en yakın PGA değeri {h["value"]} g; grid uzaklığı {h["gridDistance"]} km.',
            "sources": [{"title": h["title"], "url": h["url"]}], "date": None,
            "scope": "reference_point", "note": "CC-BY-SA-4.0. Resmî AFAD veya bina dayanıklılığı ölçümü değildir."})
        category["missing_reason"] = None
    return report
