"""Reuse overlapping saved Overpass extracts, explicitly preserving partial coverage."""
from datetime import datetime, timezone
import re
from collect_direct_sample import ROOT, CACHE, load_json, save_json, collect_social, distance_km
from build_static_dataset import PILOTS


if __name__ == '__main__':
    extracts=[]
    for path in CACHE.glob('osm_social_*.json'):
        match=re.match(r'osm_social_(-?[\d.]+)_(-?[\d.]+)_(\d+)m.json', path.name)
        if match:
            raw=load_json(path)
            if raw.get('response',{}).get('elements'):
                extracts.append((float(match[1]),float(match[2]),int(match[3]),path,raw))
    for slug,*_ in PILOTS:
        target=ROOT/f'data/pilot/{slug}_direct_sample.json'
        direct=load_json(target); old=direct['categories']['social_life']
        if old['status'] not in ['unavailable','partial_sample']: continue
        point=direct['location']
        candidates=[e for e in extracts if distance_km(point['lat'],point['lon'],e[0],e[1])*1000 < e[2]+1000]
        if not candidates: continue
        source=min(candidates,key=lambda e:distance_km(point['lat'],point['lon'],e[0],e[1]))
        snapshot=CACHE/f'{slug}_partial_overpass.json'
        save_json(snapshot,{'request_url':source[4]['endpoint'],'response':source[4]['response'],'method':'overpass'})
        social=collect_social(point,snapshot=snapshot)
        if not social['places']: continue
        social.update({'status':'partial_sample','access_mode':'partial_cached_overpass_extract',
            'retrieved_at':datetime.fromtimestamp(source[3].stat().st_mtime,timezone.utc).isoformat(),
            'attempts':old.get('attempts',[]), 'partial_coverage':True,
            'source_extract_scope':{'latitude':source[0],'longitude':source[1],'radius_m':source[2]},
            'coverage_note':'Only the overlap of the saved source extract and target 1 km radius is represented. No completeness or neighborhood-boundary claim.'})
        direct['categories']['social_life']=social;save_json(target,direct)
        print(slug,len(social['places']),'partial source coverage',flush=True)
