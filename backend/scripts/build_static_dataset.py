"""Build all five pilot JSON records from saved sources. No network requests."""
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = date(2026, 10, 28)
PILOTS = [('kotekli', 'Kötekli', 'Menteşe', 'v4'), ('emirbeyazit', 'Emirbeyazıt', 'Menteşe', 'v5'),
          ('muslihittin', 'Muslihittin', 'Menteşe', 'v6'), ('orhaniye', 'Orhaniye', 'Menteşe', 'v5'),
          ('akyaka', 'Akyaka', 'Ula', 'v5')]
SECTIONS = {'KİRA': 'rent_cost', 'GÜVENLİK': 'safety_news', 'ULAŞIM': 'transportation', 'SOSYAL YAŞAM': 'social_life'}
OFFICIAL = {'muttas.com.tr', 'ulasim.muttas.com.tr', 'mugla.bel.tr', 'mentese.bel.tr', 'ula.bel.tr'}
MONTHS = {'Ocak': 1, 'Şubat': 2, 'Mart': 3, 'Nisan': 4, 'Mayıs': 5, 'Haziran': 6,
          'Temmuz': 7, 'Ağustos': 8, 'Eylül': 9, 'Ekim': 10, 'Kasım': 11, 'Aralık': 12}


def load(path):
    return json.loads(path.read_text(encoding='utf8'))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf8')


def parse_date(text):
    match = re.search(r'\b(20\d\d-\d\d-\d\d)\b', text)
    if match:
        try:
            return date.fromisoformat(match[1])
        except ValueError:
            return None
    match = re.search(r'\b(\d{1,2}) (' + '|'.join(MONTHS) + r') (20\d\d)\b', text)
    if match:
        try:
            return date(int(match[3]), MONTHS[match[2]], int(match[1]))
        except ValueError:
            return None
    return None


def extract_rows(result):
    if not result.get('accepted_for_review') or not result.get('google_search_confirmed'):
        raise ValueError('Research did not finish with usable search evidence')
    chunks = result['grounding_metadata']['grounding_chunks']
    supports = result['grounding_metadata'].get('grounding_supports', [])
    sources = [{'id': f'web-{i}', 'publisher': c['web']['title'], 'url': c['web']['uri'],
                'retrieved_at': result['finished_at'], 'method': 'google_search_grounding'}
               for i, c in enumerate(chunks) if c.get('web')]
    categories = {v: [] for v in SECTIONS.values()}
    category = None
    for line in result['text'].splitlines():
        heading = line.strip().replace('**', '').rstrip(':')
        if heading in SECTIONS:
            category = SECTIONS[heading]
            continue
        if heading == 'DEĞERLENDİRME':
            category = None
        if category is None or not line.lstrip().startswith(('* ', '- ')):
            continue
        ids, evidence = set(), []
        for support in supports:
            text = support.get('segment', {}).get('text', '')
            if text and text in line:
                indices = support['grounding_chunk_indices']
                ids.update(f'web-{i}' for i in indices)
                evidence.append({'text': text, 'source_ids': [f'web-{i}' for i in indices]})
        text = line.lstrip('*- ').replace('**', '')
        row_id = hashlib.sha256((category + '|' + text).encode()).hexdigest()[:14]
        categories[category].append({'id': row_id, 'text': text, 'source_ids': sorted(ids),
                                     'grounding_supports': evidence, 'review_status': 'source_check_pending'})
    return categories, sources


def normalize(slug, name, district, version):
    research_path = ROOT / f'data/research/{slug}_2026-10-28_{version}/result.json'
    direct_path = ROOT / f'data/pilot/{slug}_direct_sample.json'
    research, direct = load(research_path), load(direct_path)
    rows, sources = extract_rows(research)
    source_map = {s['id']: s for s in sources}
    excluded = []
    result_categories = {}
    for category, candidates in rows.items():
        observations, seen = [], set()
        for row in candidates:
            text = row['text']
            if text.casefold() in seen:
                continue
            seen.add(text.casefold())
            if not row['source_ids']:
                excluded.append({**row, 'category': category, 'reason': 'no_attached_grounding_support'})
                continue
            # Do not import explicitly identified other-neighborhood rental/news evidence.
            wrong_neighborhood = False
            if category == 'rent_cost':
                for other in ['Kötekli', 'Yeniköy', 'Karamehmet', 'Bayır', 'Muslihittin', 'Emirbeyazıt', 'Orhaniye', 'Akyaka']:
                    if other != name and re.search(r'\(' + other + r' Mahallesi\)', text, re.I):
                        wrong_neighborhood = True
            if category == 'safety_news':
                wrong_neighborhood = any(other != name and other + ' Mahallesi' in text
                                         for other in ['Kötekli', 'Emirbeyazıt', 'Muslihittin', 'Orhaniye', 'Akyaka'])
            if wrong_neighborhood:
                excluded.append({**row, 'category': category, 'reason': 'different_neighborhood'})
                continue
            posted = parse_date(text)
            if category in {'rent_cost', 'safety_news'}:
                max_age = 90 if category == 'rent_cost' else 365
                if posted and not 0 <= (REFERENCE - posted).days <= max_age:
                    excluded.append({**row, 'category': category, 'reason': 'outside_date_window'})
                    continue
                row['date'] = posted.isoformat() if posted else None
                row['date_status'] = 'reported_by_source_candidate' if posted else 'unknown'
            if category == 'rent_cost':
                parts = [p.strip() for p in text.split('|')]
                room = re.search(r'\d\+\d', text)
                price = re.search(r'([\d.]+)\s*TL', text)
                row.update({'rooms': room[0] if room else None,
                            'amount_tl_month': int(price[1].replace('.', '')) if price else None,
                            'furnished': None if 'bilinmiyor' in (parts[1].casefold() if len(parts) > 1 else '') else ('eşyasız' not in parts[1].casefold()) if len(parts) > 1 else None,
                            'lease_term': 'long_term_reported' if 'uzun dönem' in text.casefold() else 'unknown',
                            'eligible_for_current_comparison': posted is not None and 'uzun dönem' in text.casefold()})
                # Contract and furnished status are retained as reported, never invented.
            elif category == 'safety_news':
                # Keep non-graphic event summaries, without victim identifiers.
                row['text'] = re.sub(r'(?<!\w)(?:[A-ZÇĞİÖŞÜ]\.){2,}', '[kişisel tanımlayıcı çıkarıldı]', text)
                row['text'] = re.sub(r'\b\d{2}\s+[A-ZÇĞİÖŞÜ]{1,3}\s+\d{2,4}\b', '[plaka çıkarıldı]', row['text'])
                parts = [p.strip() for p in row['text'].split('|')]
                row['event_type'] = parts[1].casefold() if len(parts) > 2 else 'unspecified'
            elif category == 'transportation':
                official = [i for i in row['source_ids'] if source_map[i]['publisher'].lower().removeprefix('www.') in OFFICIAL]
                if not official:
                    excluded.append({**row, 'category': category, 'reason': 'no_official_transport_source'})
                    continue
                # Regional routes alone are not evidence that a central neighborhood is served.
                if slug != 'akyaka' and re.match(r'48-\d+', text):
                    excluded.append({**row, 'category': category, 'reason': 'regional_route_not_neighborhood_evidence'})
                    continue
                code = re.search(r'\b\d{1,2}-\d{1,3}\b', text)
                row.update({'code': code[0] if code else None, 'official_source_ids': official,
                            'timetable_status': 'not_verified_current', 'frequency_minutes': None, 'last_departure': None})
            elif category == 'social_life':
                parts = [p.strip() for p in text.split('|')]
                if len(parts) < 3:
                    excluded.append({**row, 'category': category, 'reason': 'unstructured_venue'})
                    continue
                kind = {'kafe': 'cafe', 'restoran': 'restaurant', 'kültür merkezi': 'community_centre'}.get(parts[1], parts[1])
                row.update({'name': parts[0], 'type': kind, 'location_description': parts[2].replace(' desteği', ''),
                            'location_scope': 'nearby_area' if 'yakın çevre' in parts[2] else 'reported_neighborhood',
                            'latitude': None, 'longitude': None, 'open_status': 'unknown', 'origin': 'google_search_supplement'})
            observations.append(row)
        result_categories[category] = {'status': 'collected' if observations else 'not_enough_local_evidence',
                                      'observations': observations, 'score': None,
                                      'missing_reason': None if observations else 'No suitable supported local record remained after source/date/location filtering.'}
    social = direct['categories']['social_life']
    result_categories['social_life']['osm'] = social
    result_categories['social_life']['scope_note'] = 'OSM radius is around a representative point, not a neighborhood boundary. Web examples may describe a wider nearby area.'
    result_categories['earthquake_hazard'] = direct['categories']['earthquake_hazard']
    # Existing direct collector limitations predate the optional UI comparison score.
    result_categories['earthquake_hazard']['score'] = None
    record = {'schema_version': '1.0.0', 'id': slug, 'name': name, 'district': district, 'city': 'Muğla',
              'reference_date': REFERENCE.isoformat(), 'dataset_status': 'source_backed_static_v1',
              'factual_review_status': 'source_check_pending', 'location': direct['location'],
              'categories': result_categories, 'sources': sources, 'excluded_observations': excluded,
              'provenance': {'grounding_result': research_path.relative_to(ROOT).as_posix(),
                             'direct_result': direct_path.relative_to(ROOT).as_posix(), 'model': research['model_returned'],
                             'research_started_at': research['started_at'], 'research_finished_at': research['finished_at']},
              'limitations': ['Initial static data release, not a verified complete business/property census.',
                             'Search supports attach only to quoted segments; all narrative claims are not thereby verified.',
                             'Unknown data remains null; academic hazard data is not official AFAD TDTH or building safety.',
                             'Survey weights, live report API and caching are separate tasks.']}
    return record


def build():
    records = []
    for args in PILOTS:
        record = normalize(*args)
        path = ROOT / f'data/neighborhoods/{record["id"]}.json'
        save(path, record)
        records.append({'id': record['id'], 'name': record['name'], 'district': record['district'],
                        'file': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'observation_counts': {k: len(v.get('observations', [])) for k, v in record['categories'].items()},
                        'osm_status': record['categories']['social_life']['osm']['status'],
                        'pga_g': record['categories']['earthquake_hazard']['value']})
    save(ROOT / 'data/manifest.json', {'schema_version': '1.0.0', 'dataset_status': 'source_backed_static_v1',
        'reference_date': REFERENCE.isoformat(), 'assembled_at': datetime.now(timezone.utc).isoformat(),
        'expected_pilot_count': 5, 'actual_pilot_count': len(records), 'neighborhoods': records,
        'factual_review_status': 'source_check_pending',
        'missing_value_policy': 'Unknown is null with reason; never zero, invented or borrowed from another neighborhood.'})
    print(json.dumps(records, ensure_ascii=False))


if __name__ == '__main__':
    build()
