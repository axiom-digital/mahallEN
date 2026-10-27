"""Collect remaining pilot reference points, research PGA and OSM data once."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode

from collect_direct_sample import CACHE, ROOT, fetch, load_json, lookup_hazard, collect_social, save_json
from prepare_pilot_prompts import PILOTS


def geocode(slug, name, district):
    cache = CACHE / f'{slug}_geocode.json'
    if not cache.exists():
        url = 'https://nominatim.openstreetmap.org/search?' + urlencode({
            'q': f'{name}, {district}, Muğla', 'countrycodes': 'tr', 'format': 'jsonv2',
            'limit': 5, 'addressdetails': 1})
        save_json(cache, {'request_url': url, 'results': json.loads(fetch(url))})
    data = load_json(cache)
    for item in data['results']:
        label = item.get('display_name', '')
        if name.casefold() in label.casefold() and 'Muğla' in label and district in label:
            return {'lat': float(item['lat']), 'lon': float(item['lon']), 'label': label,
                    'osm_type': item['osm_type'], 'osm_id': item['osm_id'], 'source_url': data['request_url'],
                    'retrieved_at': datetime.fromtimestamp(cache.stat().st_mtime, timezone.utc).isoformat(),
                    'method': 'Nominatim representative point; not a building address or neighborhood-wide measurement'}
    raise ValueError(f'No unambiguous geocoding match for {slug}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--slug', required=True, choices=[p[0] for p in PILOTS])
    args = parser.parse_args()
    slug, name, district = next(p for p in PILOTS if p[0] == args.slug)
    output = ROOT / f'data/pilot/{slug}_direct_sample.json'
    if output.exists():
        print(json.dumps({'slug': slug, 'status': 'already_saved'})); return
    location = geocode(slug, name, district)
    print(json.dumps({'slug': slug, 'status': 'location_matched', 'lat': location['lat'], 'lon': location['lon']}), flush=True)
    hazard = lookup_hazard(location['lat'], location['lon'])
    social = collect_social(location)
    save_json(output, {'schema_version': '0.1.0', 'dataset_status': 'source_backed_sample',
        'processed_at': datetime.now(timezone.utc).isoformat(), 'neighborhood': name, 'district': district,
        'city': 'Muğla', 'location': location, 'categories': {'social_life': social, 'earthquake_hazard': hazard}})
    print(json.dumps({'slug': slug, 'status': 'saved', 'social_status': social['status'],
                      'osm_places': len(social['places']), 'pga_g': hazard['value']}), flush=True)


if __name__ == '__main__':
    main()
