"""Retry public Overpass and reuse one sufficiently wide central extract locally."""
import argparse
from collect_direct_sample import collect_social, load_json, save_json, ROOT, CACHE

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--area', choices=['central', 'akyaka'], required=True)
    args = parser.parse_args()
    if args.area == 'central':
        center = load_json(ROOT / 'data/pilot/orhaniye_direct_sample.json')['location']
        result = collect_social(center, radius=2200)
        if result['status'] == 'unavailable':
            print('Central Overpass refresh unavailable; retaining previous observations.')
        else:
            raw = load_json(CACHE / f'osm_social_{center["lat"]:.6f}_{center["lon"]:.6f}_2200m.json')
            snapshot = CACHE / 'central_overpass_extract.json'
            save_json(snapshot, {'request_url': raw['endpoint'], 'response': raw['response'], 'method': 'overpass'})
            for slug in ['emirbeyazit', 'muslihittin', 'orhaniye']:
                path = ROOT / f'data/pilot/{slug}_direct_sample.json'
                direct = load_json(path)
                direct['categories']['social_life'] = collect_social(direct['location'], snapshot=snapshot)
                save_json(path, direct)
                print(slug, len(direct['categories']['social_life']['places']), flush=True)
    else:
        path = ROOT / 'data/pilot/akyaka_direct_sample.json'
        direct = load_json(path)
        fresh = collect_social(direct['location'])
        if fresh['status'] != 'unavailable':
            direct['categories']['social_life'] = fresh
            save_json(path, direct)
        print('Akyaka', fresh['status'], len(fresh['places']), flush=True)


if __name__ == '__main__':
    main()
