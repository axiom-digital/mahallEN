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
import re
from time import sleep
import xml.etree.ElementTree as ET

import httpx
from app.services.place_service import lookup_neighborhoods, place_id

ROOT = Path(__file__).resolve().parents[3] / "data/geography"
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
ALLOWED_VENUE_TYPES = {
    "cafe", "restaurant", "fast_food", "bar", "pub", "nightclub", "live_music",
    "bakery", "fitness_centre", "sports_centre", "supermarket", "convenience",
    "marketplace", "park", "playground", "community_centre", "arts_centre",
    "cinema", "theatre", "library",
}
PHOTON_TAG_QUERIES = [
    ("kafe", "amenity:cafe"),
    ("restoran", "amenity:restaurant"),
    ("market", "shop:supermarket"),
    ("park", "leisure:park"),
    ("bar", "amenity:bar"),
    ("spor", "leisure:sports_centre"),
    ("kütüphane", "amenity:library"),
    ("kültür", "amenity:community_centre"),
    ("sanat", "amenity:arts_centre"),
    ("fırın", "shop:bakery"),
]
PHOTON_FALLBACK_QUERIES = [
    ("a", "amenity:cafe"),
    ("a", "amenity:restaurant"),
    ("a", "shop:supermarket"),
    ("a", "amenity:fast_food"),
]


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


def _parse_overpass_elements(elements, point, scope):
    venues = []
    for row in elements:
        tags, position = row.get("tags", {}), row.get("center", row)
        if not tags.get("name") or not all(isinstance(position.get(k), (int, float)) for k in ("lat", "lon")):
            continue
        # Catch a wrong same-name administrative area rather than importing distant POIs.
        max_km = 10 if scope == "osm_administrative_area" else 1.2
        if distance_km(point["lat"], point["lon"], position["lat"], position["lon"]) > max_km:
            continue
        url = f'https://www.openstreetmap.org/{row["type"]}/{row["id"]}'
        venues.append({"id": f'osm:{row["type"]}:{row["id"]}', "name": tags["name"],
            "type": tags.get("amenity") or tags.get("leisure") or tags.get("shop"),
            "lat": position["lat"], "lon": position["lon"], "scope": scope,
            "address": " ".join(tags[k] for k in ("addr:street", "addr:housenumber") if tags.get(k)) or None,
            "sources": [{"url": url, "publisher": "OpenStreetMap · ODbL-1.0"}]})
    return venues[:150]


def _osm_map_data(point):
    """Fetch ODbL-1.0 venues and transit routes directly from official OSM 0.6 map XML bbox."""
    allowed_am = {
        "cafe", "restaurant", "fast_food", "bar", "pub", "nightclub",
        "cinema", "theatre", "library", "community_centre", "arts_centre",
    }
    allowed_le = {"park", "sports_centre", "fitness_centre", "playground"}
    allowed_sh = {"supermarket", "convenience", "bakery"}
    transit_modes = {
        "subway": ("metro", 0),
        "light_rail": ("hafif raylı / metro", 1),
        "tram": ("tramvay", 2),
        "ferry": ("vapur / feribot", 3),
        "train": ("tren / banliyö", 4),
        "trolleybus": ("troleybüs", 5),
        "bus": ("otobüs", 6),
    }
    headers = {"User-Agent": "MahallEN/1.0 (+https://github.com/axiom-digital/mahallEN)"}

    def _venue_type(tags):
        if tags.get("amenity") in allowed_am:
            return tags["amenity"]
        if tags.get("leisure") in allowed_le:
            return tags["leisure"]
        if tags.get("shop") in allowed_sh:
            return tags["shop"]
        return None

    def _make_venue(elem_type, eid, name, vtype, vlat, vlon, tags):
        dist_km = distance_km(point["lat"], point["lon"], vlat, vlon)
        if dist_km > 1.5:
            return None
        addr = " ".join(tags[k] for k in ("addr:street", "addr:housenumber") if tags.get(k)) or None
        return dist_km, {
            "id": f"osm:{elem_type}:{eid}",
            "name": name,
            "type": vtype,
            "lat": round(vlat, 6),
            "lon": round(vlon, 6),
            "scope": "reference_radius",
            "address": addr,
            "sources": [{"url": f"https://www.openstreetmap.org/{elem_type}/{eid}", "publisher": "OpenStreetMap · ODbL-1.0"}],
        }

    def _fetch_bbox(client, d):
        lat, lon = point["lat"], point["lon"]
        response = client.get(
            f"https://api.openstreetmap.org/api/0.6/map?bbox={lon - d},{lat - d},{lon + d},{lat + d}",
            headers=headers,
        )
        if response.status_code == 400:
            return None
        response.raise_for_status()
        root = ET.fromstring(response.content)
        node_coords = {}
        candidates = []
        for node in root.findall("node"):
            nid = node.attrib.get("id")
            try:
                nlat = float(node.attrib["lat"])
                nlon = float(node.attrib["lon"])
            except (KeyError, ValueError):
                continue
            node_coords[nid] = (nlat, nlon)
            tags = {t.attrib["k"]: t.attrib["v"] for t in node.findall("tag") if "k" in t.attrib and "v" in t.attrib}
            vname = tags.get("name")
            vtype = _venue_type(tags) if vname else None
            if vtype:
                built = _make_venue("node", nid, vname, vtype, nlat, nlon, tags)
                if built:
                    candidates.append(built)
        for way in root.findall("way"):
            wid = way.attrib.get("id")
            tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag") if "k" in t.attrib and "v" in t.attrib}
            vname = tags.get("name")
            vtype = _venue_type(tags) if vname else None
            if not vtype:
                continue
            pts = [node_coords[nd.attrib["ref"]] for nd in way.findall("nd") if nd.attrib.get("ref") in node_coords]
            if pts:
                wlat = sum(p[0] for p in pts) / len(pts)
                wlon = sum(p[1] for p in pts) / len(pts)
                built = _make_venue("way", wid, vname, vtype, wlat, wlon, tags)
                if built:
                    candidates.append(built)

        candidates.sort(key=lambda item: item[0])
        deduped = []
        seen_names = set()
        for dist_km, venue in candidates:
            norm_name = " ".join(str(venue["name"]).casefold().split())
            if norm_name in seen_names:
                continue
            seen_names.add(norm_name)
            deduped.append((dist_km, venue))

        picked = []
        picked_ids = set()
        per_type = {}
        for dist_km, venue in deduped:
            vtype = venue["type"]
            if per_type.get(vtype, 0) < 3:
                picked.append(venue)
                picked_ids.add(venue["id"])
                per_type[vtype] = per_type.get(vtype, 0) + 1
                if len(picked) >= 150:
                    break
        if len(picked) < 150:
            for _, venue in deduped:
                if venue["id"] not in picked_ids:
                    picked.append(venue)
                    if len(picked) >= 150:
                        break

        route_candidates = []
        seen_routes = set()
        for rel in root.findall("relation"):
            rel_id = rel.attrib.get("id")
            tags = {t.attrib["k"]: t.attrib["v"] for t in rel.findall("tag") if "k" in t.attrib and "v" in t.attrib}
            if tags.get("type") != "route" or tags.get("route") not in transit_modes:
                continue
            rname = (tags.get("name") or "").strip()
            if re.search(r"\byük\b|freight|cargo", rname, re.I):
                continue
            rtype = tags["route"]
            mode_tr, prio = transit_modes[rtype]
            ref = (tags.get("ref") or "").strip()
            from_to = " – ".join(v for v in (tags.get("from"), tags.get("to")) if v)
            operator = (tags.get("operator") or tags.get("network") or "").strip()
            code = ref or ("Vapur" if rtype == "ferry" else mode_tr.split()[0].capitalize())
            title = rname or from_to or f"{code} {mode_tr} hattı"
            rkey = (rtype, (ref or title).casefold())
            if not (ref or title) or rkey in seen_routes:
                continue
            seen_routes.add(rkey)
            route_candidates.append((prio, ref, {
                "id": f"osm:relation:{rel_id}",
                "code": code[:16],
                "route": title[:140],
                "localEvidence": f"{operator + ' ' if operator else ''}{mode_tr} hattı ({from_to or title}); OpenStreetMap rota kaydı mahalle çevresinde doğrulandı.",
                "mapRouteVerified": True,
                "sources": [{"id": f"osm:rel:{rel_id}", "publisher": f"OpenStreetMap · {operator}" if operator else "OpenStreetMap · ODbL-1.0", "url": f"https://www.openstreetmap.org/relation/{rel_id}"}],
            }))
        route_candidates.sort(key=lambda item: (item[0], item[1]))
        routes = [item[2] for item in route_candidates[:25]]
        return picked, routes

    with httpx.Client(timeout=12) as client:
        used_d = 0.0045
        result = _fetch_bbox(client, 0.0045)
        if result is None:
            used_d = 0.003
            result = _fetch_bbox(client, 0.003)
        venues, routes = result or ([], [])
        if len(venues) < 15:
            try:
                wider = _fetch_bbox(client, 0.014)
                if wider is not None:
                    w_venues, w_routes = wider
                    if len(w_venues) > len(venues):
                        venues = w_venues
                    if len(w_routes) > len(routes):
                        routes = w_routes
            except (httpx.HTTPError, ValueError, ET.ParseError):
                pass
        elif len(routes) < 3 and used_d == 0.0045:
            try:
                wider_r = _fetch_bbox(client, 0.0065)
                if wider_r is not None and len(wider_r[1]) > len(routes):
                    routes = wider_r[1]
            except (httpx.HTTPError, ValueError, ET.ParseError):
                pass
        return venues, routes


def _photon_venues(point):
    """Fallback OpenStreetMap POI search via Photon with fail-fast circuit breaker."""
    d = 0.0085
    bbox = f"{point['lon'] - d},{point['lat'] - d},{point['lon'] + d},{point['lat'] + d}"
    headers = {"User-Agent": "MahallEN/1.0 (+https://github.com/axiom-digital/mahallEN)"}
    seen_ids, seen_names, venues = set(), set(), []
    ok_responses, last_error, consecutive_errors = 0, None, 0

    def query_batch(client, batch):
        nonlocal ok_responses, last_error, consecutive_errors
        for idx, (q, osm_tag) in enumerate(batch):
            if consecutive_errors >= 2:
                break
            if idx > 0 or ok_responses > 0:
                sleep(0.2)
            try:
                response = client.get(
                    "https://photon.komoot.io/api/",
                    params={"q": q, "lat": point["lat"], "lon": point["lon"], "bbox": bbox, "osm_tag": osm_tag, "limit": 15},
                    headers=headers,
                )
                response.raise_for_status()
                ok_responses += 1
                consecutive_errors = 0
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                consecutive_errors += 1
                if consecutive_errors >= 2:
                    break
                continue
            default_kind = osm_tag.split(":", 1)[1]
            for feat in response.json().get("features", []):
                props = feat.get("properties", {})
                coords = (feat.get("geometry") or {}).get("coordinates") or []
                name, osm_id = props.get("name"), props.get("osm_id")
                if not name or not osm_id or len(coords) < 2:
                    continue
                lon, lat = coords[0], coords[1]
                if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
                    continue
                if distance_km(point["lat"], point["lon"], lat, lon) > 1.2:
                    continue
                osm_type = {"N": "node", "W": "way", "R": "relation"}.get(str(props.get("osm_type", "")).upper(), "node")
                key = (osm_type, osm_id)
                norm_name = " ".join(str(name).casefold().split())
                if key in seen_ids or norm_name in seen_names:
                    continue
                seen_ids.add(key)
                seen_names.add(norm_name)
                raw_val = props.get("osm_value")
                kind = raw_val if raw_val in ALLOWED_VENUE_TYPES else default_kind
                address = " ".join(str(props[k]) for k in ("street", "housenumber") if props.get(k)) or None
                venues.append({
                    "id": f"osm:{osm_type}:{osm_id}",
                    "name": name,
                    "type": kind,
                    "lat": lat,
                    "lon": lon,
                    "scope": "reference_radius",
                    "address": address,
                    "sources": [{"url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}", "publisher": "OpenStreetMap · ODbL-1.0"}],
                })

    with httpx.Client(timeout=4) as client:
        query_batch(client, PHOTON_TAG_QUERIES)
        if len(venues) < 15 and consecutive_errors < 2:
            query_batch(client, PHOTON_FALLBACK_QUERIES)

    if ok_responses == 0 and last_error is not None:
        raise last_error
    return venues[:150]


def osm_geography(target, point):
    """Fetch bounded OSM venues & transit routes via OSM 0.6 map API, then Photon/Overpass fallbacks."""
    best_venues = []
    osm_routes = []
    last_error = None

    try:
        venues, routes = _osm_map_data(point)
        if len(venues) >= 5 or len(routes) >= 2:
            return venues, routes
        best_venues = venues
        osm_routes = routes
    except (httpx.HTTPError, ValueError, ET.ParseError) as exc:
        last_error = exc

    try:
        results = _photon_venues(point)
        if len(results) >= 5:
            return results, osm_routes
        if len(results) > len(best_venues):
            best_venues = results
    except (httpx.HTTPError, ValueError) as exc:
        last_error = exc

    radius_query = (
        f'[out:json][timeout:5];('
        f'nwr(around:900,{point["lat"]},{point["lon"]})["name"]["amenity"~"^(cafe|restaurant|fast_food|bar|pub|nightclub|cinema|theatre|library|community_centre|arts_centre)$"];'
        f'nwr(around:900,{point["lat"]},{point["lon"]})["name"]["leisure"~"^(park|sports_centre|fitness_centre|playground)$"];'
        f'nwr(around:900,{point["lat"]},{point["lon"]})["name"]["shop"~"^(supermarket|convenience|bakery)$"];);out center tags 120;'
    )
    headers = {"User-Agent": "MahallEN/1.0 (+https://github.com/axiom-digital/mahallEN)"}
    with httpx.Client(timeout=5) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = client.post(endpoint, data={"data": radius_query}, headers=headers)
                response.raise_for_status()
                data = response.json()
                if data.get("remark"):
                    continue
                parsed = _parse_overpass_elements(data.get("elements", []), point, "reference_radius")
                if parsed:
                    return parsed, osm_routes
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                continue

    if best_venues or osm_routes:
        return best_venues, osm_routes
    if last_error is not None:
        raise last_error
    return [], []


def osm_venues(target, point):
    """Fetch bounded OSM venues for backward compatibility."""
    return osm_geography(target, point)[0]


def collect_geography(target):
    result = {"location": None, "hazard": {}, "venues": [], "routes": []}
    try:
        point = resolve_point(target)
        if not point:
            return result
        result["location"] = point
        result["hazard"] = hazard_for(point["lat"], point["lon"])
        try:
            venues, routes = osm_geography(target, point)
            result["venues"] = venues
            result["routes"] = routes
        except (httpx.HTTPError, ValueError, ET.ParseError):
            pass  # Unavailable geography never becomes a zero-facility claim.
    except (httpx.HTTPError, ValueError, ET.ParseError):
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
    existing_routes = {
        (str(r.get("code", "")).casefold(), str(r.get("route", "")).casefold())
        for r in record.get("routes", [])
    }
    added_routes = []
    for route in geography.get("routes", []):
        rkey = (str(route.get("code", "")).casefold(), str(route.get("route", "")).casefold())
        if rkey not in existing_routes:
            record.setdefault("routes", []).append(route)
            existing_routes.add(rkey)
            added_routes.append(route)
    t_cat = next((c for c in report.get("categories", []) if c["id"] == "transportation"), None)
    if t_cat is not None and not t_cat.get("items") and added_routes:
        for rt in added_routes[:6]:
            t_cat["items"].append({
                "text": f"{rt['code']} · {rt['route']}. {rt['localEvidence']}",
                "sources": [{"title": s.get("publisher", "OpenStreetMap · ODbL-1.0"), "url": s["url"]} for s in rt.get("sources", [])],
                "date": None,
                "scope": "reference_radius",
                "note": "OpenStreetMap ODbL-1.0 rota kaydı; resmî sefer saati tarifesi değildir.",
            })
        t_cat["missing_reason"] = None
    if record["hazard"].get("value") is not None:
        h = record["hazard"]
        category = next(c for c in report["categories"] if c["id"] == "earthquake_hazard")
        category["items"].insert(0, {"text": f'2025 akademik gridinde temsil noktasına en yakın PGA değeri {h["value"]} g; grid uzaklığı {h["gridDistance"]} km.',
            "sources": [{"title": h["title"], "url": h["url"]}], "date": None,
            "scope": "reference_point", "note": "CC-BY-SA-4.0. Resmî AFAD veya bina dayanıklılığı ölçümü değildir."})
        category["missing_reason"] = None
    return report
