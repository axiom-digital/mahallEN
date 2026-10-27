"""Build a reviewable UI dataset from saved research only; no provider calls."""
import csv
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import re
import statistics

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = date(2026, 10, 28)
OFFICIAL = {"muttas.com.tr", "ulasim.muttas.com.tr", "mugla.bel.tr"}


def hazard_score(value, grid_values):
    """Inverse midpoint empirical percentile; a comparison, never building safety."""
    values = [v for v in grid_values if math.isfinite(v) and v >= 0]
    if value is None or not math.isfinite(value) or value < 0 or not values:
        return None
    percentile = (sum(v < value for v in values) + .5 * sum(v == value for v in values)) / len(values)
    return round(100 * (1 - percentile))


def rent_score(amount, budget):
    if amount is None or not math.isfinite(amount) or amount <= 0 or not math.isfinite(budget) or budget <= 0:
        return None
    return max(0, min(100, math.floor(50 + 200 * (budget - amount) / budget + .5)))


def build():
    result = json.loads((ROOT / 'data/research/kotekli_2026-10-28_v4/result.json').read_text(encoding='utf8'))
    direct = json.loads((ROOT / 'data/pilot/kotekli_direct_sample.json').read_text(encoding='utf8'))
    if not result.get('accepted_for_review'):
        raise ValueError('Incomplete grounding result')
    chunks = result['grounding_metadata']['grounding_chunks']
    supports = result['grounding_metadata']['grounding_supports']
    sections = {}
    section = None
    for line in result['text'].splitlines():
        if line.rstrip(':') in ['KİRA', 'GÜVENLİK', 'ULAŞIM', 'SOSYAL YAŞAM', 'DEĞERLENDİRME']:
            section = line.rstrip(':')
        if not line.lstrip().startswith('*'):
            continue
        indices, evidence = set(), []
        for support in supports:
            segment = support.get('segment', {}).get('text', '')
            if segment and segment in line:
                indices.update(support['grounding_chunk_indices'])
                evidence.append(segment)
        sources = [{'publisher': chunks[i]['web']['title'], 'url': chunks[i]['web']['uri']} for i in sorted(indices)]
        sections.setdefault(section, []).append({'text': line.lstrip('* ').replace('**', ''), 'sources': sources,
                                                'supportedSegments': evidence, 'reviewStatus': 'source_check_pending'})
    excluded = []
    rents = []
    for item in sections['KİRA']:
        match = re.search(r'\d{4}-\d{2}-\d{2}', item['text'])
        posted = date.fromisoformat(match[0]) if match else None
        if not posted or not 0 <= (REFERENCE - posted).days <= 90 or not item['sources']:
            excluded.append({'category': 'rent', 'reason': 'Missing date/support or outside 90-day window', 'text': item['text']})
            continue
        rents.append({**item, 'date': posted.isoformat(), 'rooms': re.search(r'\d\+\d', item['text'])[0],
                      'amount': int(re.search(r'([\d.]+) TL', item['text'])[1].replace('.', '')), 'furnished': True})
    news = []
    # Redacted summaries of the saved candidates; no victim names/initials or graphic details.
    summaries = [('2026-09-01', 'Bir konutta iki kişinin yaşamını yitirmesine ilişkin soruşturma haberi.'),
                 ('2026-03-31', 'Gece havaya ateş açılması üzerine polis incelemesine ilişkin haber.')]
    for item, (posted, summary) in zip(sections['GÜVENLİK'][:2], summaries):
        if item['sources']:
            news.append({**item, 'text': summary, 'date': posted})
    excluded.extend({'category': 'safety', 'reason': 'Outside 12-month window'} for _ in sections['GÜVENLİK'][2:])
    routes = []
    for item in sections['ULAŞIM']:
        official = [s for s in item['sources'] if s['publisher'].lower().removeprefix('www.') in OFFICIAL]
        if not official:
            excluded.append({'category': 'transport', 'reason': 'No official publisher attached', 'text': item['text']})
            continue
        # Discard unsupported timetable claims, retain route description as a research candidate.
        text = re.sub(r'Hafta içi, Cumartesi.*$', '', item['text']).strip()
        code = re.search(r'1-\d+', text)[0]
        routes.append({**item, 'text': text, 'code': code, 'sources': official,
                       'mixedSourceCandidate': len(official) != len(item['sources'])})
    raw_social = direct['categories']['social_life']
    places, quarantined = [], []
    # Conservative display selection. Ambiguous OSM building names remain in the raw artifact.
    cafe_names = {'Başka Kahve', 'Coffy', 'Mackbear', 'Arabica', 'Kaptan Kıraathanesi', 'Waffleinn'}
    for p in raw_social['places']:
        name = p.get('name') or ''
        category = p['category']
        useful = category != 'cafe' or any(n.casefold() in name.casefold() for n in cafe_names)
        if not name or not useful:
            quarantined.append({'name': name, 'id': p['osm_id'], 'reason': 'Unnamed or ambiguous cafe tag; needs review'})
            continue
        places.append({'id': f"{p['osm_type']}-{p['osm_id']}", 'name': name, 'category': category,
                       'lat': p['latitude'], 'lon': p['longitude'], 'distance': p['distance_to_reference_point_m'],
                       'url': p['source_url'], 'origin': 'OSM', 'sources': [{'publisher': 'OpenStreetMap', 'url': p['source_url']}]})
    seen = {re.sub(r'\W+', '', p['name'].casefold()) for p in places}
    for i, item in enumerate(sections['SOSYAL YAŞAM']):
        parts = [p.strip() for p in item['text'].split('|')]
        name, kind, address = parts[:3]
        key = re.sub(r'\W+', '', name.casefold())
        if key in seen or not item['sources']:
            continue
        seen.add(key)
        category = {'bar': 'pub', 'kafe': 'cafe', 'fast_food': 'fast_food', 'eğlence merkezi': 'entertainment'}.get(kind, 'entertainment')
        places.append({'id': f'web-{i}', 'name': name, 'category': category, 'address': address.replace(' desteği', ''),
                       'lat': None, 'lon': None, 'distance': None, 'origin': 'Gemini + Google Search',
                       'url': item['sources'][0]['url'], 'sources': item['sources'], 'supportedSegments': item['supportedSegments'],
                       'reviewStatus': 'listing_candidate_not_verified_open'})
    hazard = direct['categories']['earthquake_hazard']
    grid = ROOT / 'data/cache/PGA_0.10_50yrs.csv'
    if 'md5:' + hashlib.md5(grid.read_bytes()).hexdigest() != hazard['file_checksum']:
        raise ValueError('Hazard grid checksum mismatch')
    with grid.open(encoding='utf-8-sig', newline='') as handle:
        values = [float(row['PGA']) for row in csv.DictReader(handle)]
    pga_score = hazard_score(hazard['value'], values)
    model_scores = json.loads(result['text'][result['text'].index('{"rent_cost"'):])
    for entry in model_scores.values():
        if type(entry.get('score')) is not int or not 0 <= entry['score'] <= 100:
            raise ValueError('Invalid provisional model score')
    median = statistics.median(p['amount'] for p in rents if p['rooms'] == '2+1')
    scores = {
        'rent': {'value': rent_score(median, 30000), 'label': 'Kira ve maliyet', 'confidence': 'Sınırlı örneklem',
                 'reason': '2+1 ilanlarının ortanca kirasının seçtiğin bütçeye uyumu. Aidat ve faturalar dahil değil.', 'method': 'budget'},
        'transport': {'value': model_scores['transportation']['score'], 'label': 'Ulaşım', 'confidence': 'Kaynak kontrolünde',
                      'reason': 'Kampüs, tıp fakültesi, otogar ve merkez bağlantıları için hat adayları var; sıklık ve son sefer belirsiz.', 'method': 'gemini'},
        'social': {'value': model_scores['social_life']['score'], 'label': 'Sosyal yaşam', 'confidence': 'Kaynak kontrolünde',
                   'reason': 'Kafe, market, park, restoran ve pub seçenekleri bir arada. Webden bulunan işletmelerin güncel faaliyeti doğrulanmadı.', 'method': 'gemini'},
        'news': {'value': model_scores['safety_news']['score'], 'label': 'Güvenlik', 'confidence': 'Düşük veri güveni',
                 'reason': 'Yerel olay haberlerine dayanan Gemini deneme puanı. Resmî suç oranı ve mahalle ölçeğinde güvenlik ölçümü yok.', 'method': 'gemini'},
        'hazard': {'value': pga_score, 'label': 'Deprem tehlikesi', 'confidence': 'Araştırma modeli',
                   'reason': f'{hazard["value"]} g için araştırma gridindeki ters yüzdelik sıra. Yüksek puan, modelde daha düşük sarsıntı tehlikesi demek.', 'method': 'inverse_grid_percentile'},
    }
    preview = {'name': direct['neighborhood'], 'district': direct['district'], 'city': direct['city'], 'date': REFERENCE.isoformat(),
               'location': direct['location'], 'rent': rents, 'transport': routes, 'news': news, 'scores': scores,
               'social': {'places': places, 'radius': 1000, 'sourceUrl': raw_social['license_url'], 'quarantined': quarantined,
                          'counts': {k: sum(p['category'] == k for p in places) for k in {p['category'] for p in places}},
                          'total': len(places)},
               'hazard': {'value': hazard['value'], 'unit': 'g', 'gridDistance': hazard['distance_to_grid_point_km'],
                          'gridRows': len(values), 'sourceTitle': hazard['source_title'], 'url': hazard['source_url'],
                          'authors': hazard['authors'], 'license': hazard['license']['id'], 'officialAfad': False,
                          'checksum': hazard['file_checksum'], 'score': pga_score},
               'excluded': excluded, 'scoringStatus': 'experimental_not_validated',
               'research': {'model': result['model_returned'], 'source': 'kotekli_2026-10-28_v4',
                            'categories': ['rent_cost', 'safety_news', 'transportation', 'social_life']}}
    output = ROOT / 'data/pilot/kotekli.ui.v0.2.json'
    output.write_text(json.dumps(preview, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'output': str(output), 'rents': len(rents), 'routes': len(routes), 'places': len(places),
                      'quarantined': len(quarantined), 'hazard_score': pga_score}))


if __name__ == '__main__':
    build()
