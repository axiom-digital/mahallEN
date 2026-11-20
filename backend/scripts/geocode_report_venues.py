"""Small cached Nominatim pass; one request per second, no invented map pins."""
from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
import time
from urllib.parse import urlencode
from build_quality_reports import normalized
from collect_direct_sample import ROOT, CACHE, fetch, distance_km, save_json, load_json

def main():
    cache = CACHE / 'venue_geocodes.json'
    saved = load_json(cache) if cache.exists() else {}
    report_set = load_json(ROOT / 'data/reports/index.json')['reports']
    count = 0
    for report in report_set:
        if report['coverage']['mappedVenues'] > 0: continue
        # Prefer distinct, named venues with precise addresses over branch-ambiguous markets.
        candidates = sorted([p for p in report['venues'] if p['origin'] == 'web'],
                            key=lambda p: (p['type'] in ['supermarket', 'other'], len(p['address']) < 25))[:6]
        for place in candidates:
            key = report['id'] + ':' + normalized(place['name'])
            if key in saved and (saved[key]['status'] == 'matched' or saved[key].get('boundedAttempt')): continue
            query = place['name']
            lat, lon = report['location']['lat'], report['location']['lon']
            viewbox = f'{lon-.03},{lat+.025},{lon+.03},{lat-.025}'
            url = 'https://nominatim.openstreetmap.org/search?' + urlencode({'q': query, 'viewbox': viewbox, 'bounded': 1, 'format': 'jsonv2', 'countrycodes': 'tr', 'limit': 5})
            result = {'status': 'not_matched', 'boundedAttempt': True, 'queryUrl': url, 'checkedAt': datetime.now(timezone.utc).isoformat()}
            try:
                matches = json.loads(fetch(url, timeout=12))
                for item in matches:
                    title = normalized(item.get('name') or item.get('display_name', '').split(',')[0])
                    wanted = normalized(place['name'])
                    match = SequenceMatcher(None, wanted, title).ratio() >= .8 or (len(title) >= 6 and (title in wanted or wanted in title))
                    distance = distance_km(report['location']['lat'], report['location']['lon'], float(item['lat']), float(item['lon']))
                    if match and distance <= 2.5:
                        result.update({'status': 'matched', 'lat': float(item['lat']), 'lon': float(item['lon']),
                            'distance': round(distance * 1000), 'url': f'https://www.openstreetmap.org/{item["osm_type"]}/{item["osm_id"]}'})
                        break
            except Exception as exc:
                result['status'] = 'unavailable'; result['errorType'] = type(exc).__name__
            saved[key] = result; save_json(cache, saved); count += 1
            print(json.dumps({'report': report['id'], 'status': result['status'], 'request': count}), flush=True)
            time.sleep(1.1)
    print('Venue coordinate pass finished; unmatched names remain unpinned.')


if __name__ == '__main__':
    main()
