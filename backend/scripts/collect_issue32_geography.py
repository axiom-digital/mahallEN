"""Collect explicit administrative matches and labelled academic hazard estimates.

Nominatim is queried sequentially at less than one request per second. No radius
POI census or administrative boundary is inferred from a representative point.
The previously downloaded academic grid is used only after a fresh checksum check.
"""
import hashlib
from pathlib import Path
import time
from urllib.parse import urlencode

from check_issue32_sources import ROOT, fetch, read_json, write_json
from collect_issue32_rents import folded
from collect_direct_sample import lookup_hazard, PGA_FILENAME, METADATA_URL, RECORD_URL


def place_name(value):
    return folded(value).removesuffix(" mahallesi").strip()


def choose(candidates, target):
    found = []
    for candidate in candidates:
        address = candidate.get("address", {})
        names = [candidate.get("name", "")] + [address.get(k, "") for k in ("neighbourhood", "suburb", "quarter", "village")]
        locality = candidate.get("display_name", "")
        if (place_name(target["name"]) in {place_name(n) for n in names}
                and all(folded(part) in folded(locality) for part in (target["district"], target["city"]))):
            found.append(candidate)
    return found[0] if len(found) == 1 else None


def main():
    targets = read_json(ROOT / "data/issue32/targets.json")
    metadata = fetch(METADATA_URL)
    sources = [{"id": "aperta-metadata", "url": METADATA_URL}, {"id": "aperta-record", "url": RECORD_URL}]
    grid = ROOT / "data/cache" / PGA_FILENAME
    expected = next((f["checksum"] for f in metadata.get("payload", {}).get("files", []) if f["key"] == PGA_FILENAME), None)
    checksum_ok = (grid.exists() and expected is not None
                   and "md5:" + hashlib.md5(grid.read_bytes()).hexdigest() == expected)
    results = {}
    for target in targets:
        url = "https://nominatim.openstreetmap.org/search?" + urlencode({"q": f"{target['name']}, {target['district']}, {target['city']}",
            "countrycodes": "tr", "format": "jsonv2", "limit": 5, "addressdetails": 1})
        page = fetch(url)
        sources.append({"id": "geocode-" + target["id"], "url": url})
        candidate = choose(page.get("payload", []), target) if page["status"] == "data_read" else None
        result = {"location": None, "hazard": None, "missing_reason": "No unique administrative geocoding match was returned."}
        if candidate:
            result["location"] = {"lat": float(candidate["lat"]), "lon": float(candidate["lon"]), "label": candidate["display_name"],
                "osm_type": candidate["osm_type"], "osm_id": candidate["osm_id"],
                "source_id": "geocode-" + target["id"], "checked_at": page["checked_at"],
                "method": "Unique name + district + city match; OSM representative point, not a boundary or building address.",
                "attribution": "© OpenStreetMap contributors", "license": "ODbL-1.0"}
            result["missing_reason"] = None
            if checksum_ok:
                result["hazard"] = lookup_hazard(float(candidate["lat"]), float(candidate["lon"]))
            else:
                result["hazard_missing_reason"] = "The local academic grid could not be verified against current publisher metadata."
        results[target["id"]] = result
        print(target["id"], "point:", bool(candidate), "academic grid:", bool(result["hazard"]), flush=True)
        time.sleep(1.1)
    write_json(ROOT / "data/issue32/geography.json", {"sources": sources,
        "grid_checksum_verified_against_current_metadata": checksum_ok, "records": results})


if __name__ == "__main__":
    main()
