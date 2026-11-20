"""Produce five consistent, source-traceable user reports from saved research."""
import bisect
import csv
from collections import Counter
from datetime import date, datetime, timezone
import hashlib
import json
import re
import unicodedata
from functools import lru_cache
from difflib import SequenceMatcher
from pathlib import Path
from build_static_dataset import ROOT, PILOTS, SECTIONS, OFFICIAL, parse_date, load, save

AS_OF = date(2026, 10, 28)
HEADINGS = {h: c for h, c in SECTIONS.items()}
HEADINGS['HABER'] = 'safety_news'
VENUE_GROUPS = {'food': ['restaurant', 'fast_food'], 'coffee': ['cafe'],
                'nightlife': ['bar', 'pub', 'nightclub', 'live_music'], 'shopping': ['supermarket', 'convenience', 'marketplace'],
                'outdoors': ['park', 'playground', 'camp_site'], 'culture': ['community_centre', 'arts_centre', 'cinema', 'theatre', 'library']}
VENUE_EXCLUSIONS = {'kotekli': {'doyurandoner'}}


def normalized(text):
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in unicodedata.normalize('NFKD', text.casefold().replace('ı', 'i')) if not unicodedata.combining(c)))


def venue_type(value):
    s = value.casefold()
    if 'gece kul' in s or 'nightclub' in s: return 'nightclub'
    if 'canlı müzik' in s or 'live_music' in s: return 'live_music'
    if 'pub' in s: return 'pub'
    if 'bar' in s: return 'bar'
    if any(t in s for t in ['restoran', 'restaurant', 'kebap', 'pide', 'pizza']): return 'restaurant'
    if 'fast' in s: return 'fast_food'
    if any(t in s for t in ['kafe', 'cafe', 'café']): return 'cafe'
    if 'pazar' in s or 'marketplace' in s: return 'marketplace'
    if 'market' in s or 'bakkal' in s: return 'supermarket'
    if 'kamp' in s or 'camp_site' in s: return 'camp_site'
    if 'su park' in s: return 'water_park'
    if 'park' in s: return 'park'
    if 'kültür' in s or 'community' in s: return 'community_centre'
    return s if s in {v for group in VENUE_GROUPS.values() for v in group} else 'other'


def corrected_venue_type(kind, name):
    if kind == 'cafe' and re.search(r'kebapçı|restoran|restaurant|dönerci', name, re.I):
        return 'restaurant'
    return kind


@lru_cache(maxsize=1)
def explicit_location_claims():
    claims = {}
    for path in (ROOT / 'data/research').glob('*/result.json'):
        data = load(path)
        if not data.get('accepted_for_review'): continue
        for line in data['text'].splitlines():
            room, price, posted = re.search(r'\b\d\+\d\b', line), re.search(r'([\d.]+)\s*TL', line), parse_date(line)
            place = re.search(r'\(([^()]+) Mahallesi\)', line)
            if room and price and posted and place:
                claims.setdefault((room[0], int(price[1].replace('.', '')), posted.isoformat()), set()).add(place[1])
    return claims


def source_rows(path, slug, forced_category=None, batched=False):
    result = load(path)
    if not result.get('accepted_for_review'): return [], []
    prefix = path.parent.name
    sources = [{'id': f'{prefix}:{i}', 'publisher': c['web'].get('title', 'Kaynak'), 'url': c['web']['uri'],
                'checkedAt': result['finished_at'], 'method': 'google_search'}
               for i, c in enumerate(result['grounding_metadata'].get('grounding_chunks', [])) if c.get('web')]
    source_ids = {s['id'] for s in sources}
    category, place = forced_category, None if batched else slug
    blocks, offset = [], 0
    for line in result['text'].splitlines(keepends=True):
        heading = re.sub(r'^[#\s]+', '', line.strip().replace('**', '')).rstrip(':').strip()
        if heading in HEADINGS: category = HEADINGS[heading]
        for pilot_slug, pilot_name, _, _ in PILOTS:
            if normalized(heading) in {normalized(pilot_slug), normalized(pilot_name)}: place = pilot_slug
        if heading == 'DEĞERLENDİRME': category = None
        indentation = len(line) - len(line.lstrip())
        if line.lstrip().startswith(('* ', '- ')) and indentation < 4 and category and place == slug:
            blocks.append({'category': category, 'raw': line.strip(), 'start': offset, 'end': offset + len(line), 'fields': {}})
        elif blocks and line.strip() and not heading.endswith(':') and not line.lstrip().startswith('#'):
            # Continuation is attached only while the same category and pilot remain active.
            if blocks[-1]['category'] == category and place == slug and heading not in HEADINGS:
                blocks[-1]['raw'] += ' ' + line.strip()
                blocks[-1]['end'] = offset + len(line)
                label, _, value = line.strip().lstrip('*- ').partition(':')
                if value: blocks[-1]['fields'][label.strip()] = value.strip()
        offset += len(line)
    rows = []
    for block in blocks:
        ids, segments = set(), []
        for support in result['grounding_metadata'].get('grounding_supports', []):
            segment = support.get('segment', {}).get('text', '')
            start = result['text'].find(segment) if segment else -1
            overlaps = start >= 0 and start < block['end'] and start + len(segment) > block['start']
            if segment and (segment in block['raw'] or overlaps):
                linked = [f'{prefix}:{i}' for i in support.get('grounding_chunk_indices', []) if f'{prefix}:{i}' in source_ids]
                ids.update(linked)
                segments.append({'text': segment, 'sourceIds': linked})
        if not ids: continue
        text = block['raw'].lstrip('*- ').replace('**', '')
        if block['category'] == 'transportation' and block['fields']:
            f = block['fields']
            code = re.search(r'\b\d{1,2}-\d{1,3}\b', text)
            text = ' | '.join([code[0] if code else 'bilinmiyor', f.get('başlangıç/bitiş', 'bilinmiyor'),
                f.get('mahalle veya durak bağlantısının kaynaktaki desteği', ''), f.get('kullanıcıya faydası', ''),
                f.get('güncel sıklık ve son sefer', 'bilinmiyor'), f.get('resmî yayıncı', '')])
        rows.append({'id': hashlib.sha256((slug + block['category'] + text).encode()).hexdigest()[:16],
                     'category': block['category'], 'text': text, 'sourceIds': sorted(ids), 'supports': segments,
                     'checkedAt': result['finished_at']})
    return rows, sources


def newest_success(pattern):
    paths = [p for p in (ROOT / 'data/research').glob(pattern) if load(p).get('accepted_for_review')]
    return max(paths, key=lambda p: load(p)['finished_at']) if paths else None


def hazard_values(root=ROOT):
    csv_path = root / 'data/cache/PGA_0.10_50yrs.csv'
    reference = root / 'data/reference/hazard_distribution.json'
    expected = '62c2c510f923d8cc68b2207fcb62c6da'
    if csv_path.exists():
        if hashlib.md5(csv_path.read_bytes()).hexdigest() != expected:
            raise ValueError('Hazard grid checksum mismatch')
        with csv_path.open(encoding='utf-8-sig') as stream:
            values = sorted(float(r['PGA']) for r in csv.DictReader(stream))
        save(reference, {'sourceChecksum': 'md5:' + expected, 'sourceUrl': 'https://aperta.ulakbim.gov.tr/records/274290',
            'license': 'CC-BY-SA-4.0', 'authors': ['Aktuğ, Bahadır', 'Şentürk, Murat Doruk', 'Özsaraç, Vedat', 'KILIÇ, Nazan'],
            'derivation': 'Frequency histogram of the published PGA grid, not a population or neighborhood distribution.',
            'pointCount': len(values), 'frequencies': sorted(Counter(values).items())})
        return values
    data = load(reference)
    if data['sourceChecksum'] != 'md5:' + expected: raise ValueError('Unknown hazard reference source')
    values = [value for value, count in data['frequencies'] for _ in range(count)]
    if len(values) != data['pointCount']: raise ValueError('Invalid hazard distribution')
    return sorted(values)


def build_one(slug, name, district, old_version, grid):
    direct = load(ROOT / f'data/pilot/{slug}_direct_sample.json')
    baseline = ROOT / f'data/research/{slug}_2026-10-28_{old_version}/result.json'
    fresh = newest_success(f'{slug}_2026-10-28_v7*/result.json')
    rows, sources = source_rows(fresh or baseline, slug)
    base_rows, base_sources = source_rows(baseline, slug)
    # Keep older local route candidates available when a refreshed search confuses a namesake district.
    if fresh:
        rows = [r for r in base_rows if r['category'] == 'transportation'] + rows
        sources += base_sources
    provenance = [str((fresh or baseline).relative_to(ROOT))]
    for category in ['rent_cost', 'transportation', 'social_life', 'safety_news']:
        pattern = f'focused_{slug}_rent_v8*/result.json' if category == 'rent_cost' else f'focused_all_{category}_v*/result.json'
        focus = newest_success(pattern)
        if focus:
            extra, registry = source_rows(focus, slug, category, category != 'rent_cost')
            if category == 'transportation':
                extra = [r for r in extra if re.search(r'\b\d{1,2}-\d{1,3}\b', r['text']) and not any(t in r['text'] for t in ['Marmaris', 'Datça', 'Bodrum', 'Fethiye'])]
            if category == 'safety_news':
                extra = [r for r in extra if normalized(name) in normalized(r['text']) and parse_date(r['text'])]
            # Focused rent replaces old prices; other focused categories supplement local evidence.
            if extra:
                rows = ([r for r in rows if r['category'] != category] if category == 'rent_cost' else rows) + extra
            sources += registry; provenance.append(str(focus.relative_to(ROOT)))
        if category in ['safety_news', 'social_life']:
            local_focus = newest_success(f'focused_{slug}_{category}_v*/result.json')
            if local_focus:
                extra, registry = source_rows(local_focus, slug, category, False)
                rows += extra
                sources += registry; provenance.append(str(local_focus.relative_to(ROOT)))
    source_map = {s['id']: s for s in sources}
    rents, routes, news, venues, exclusions = [], [], [], [], []
    for row in rows:
        text = row['text']; parts = [re.sub(r'^(?:KONUT_TİPİ|FİYAT TL/ay|ilan tarihi|uzun dönem/sezonluk/bilinmiyor|yayıncı):\s*', '', p.strip(), flags=re.I) for p in text.split('|')]
        category = row['category']
        source_list = [source_map[s] for s in row['sourceIds']]
        common = {'id': row['id'], 'sources': source_list, 'supports': row['supports'], 'checkedAt': row['checkedAt'], 'verification': 'search_supported'}
        if category == 'rent_cost':
            room, price = re.search(r'\b\d\+\d\b', text), re.search(r'([\d.]+)\s*TL', text)
            if not room or not price or len(parts) < 5: continue
            posted = parse_date(parts[3])
            if posted and not 0 <= (AS_OF - posted).days <= 90:
                exclusions.append({'category': category, 'reason': 'outside_90_day_window', 'id': row['id']}); continue
            wrong = any(other != name and normalized(other + ' Mahallesi') in normalized(text)
                        for _, other, _, _ in PILOTS)
            if wrong:
                exclusions.append({'category': category, 'reason': 'different_neighborhood', 'id': row['id']}); continue
            condition = parts[4].casefold()
            seasonal = any(w in condition for w in ['sezon', 'kış', 'günlük', 'haftalık'])
            amount = int(price[1].replace('.', ''))
            conflicts = explicit_location_claims().get((room[0], amount, posted.isoformat() if posted else None), set()) - {name}
            rents.append({**common, 'rooms': room[0], 'amount': amount,
                          'date': posted.isoformat() if posted else None,
                          'furnished': None if 'bilinmiyor' in parts[1].casefold() else 'eşyasız' not in parts[1].casefold(),
                          'lease': 'seasonal' if seasonal else 'long_term' if 'uzun dönem' in condition else 'unknown',
                          'eligible': posted is not None and not seasonal and not conflicts,
                          'locationConflict': bool(conflicts)})
        elif category == 'transportation':
            code = re.search(r'\b\d{1,2}-\d{1,3}\b', text)
            official = [s for s in source_list if s['publisher'].lower().removeprefix('www.') in OFFICIAL]
            if not code or not official or any(place in text for place in ['Marmaris', 'Datça', 'Bodrum', 'Fethiye']): continue
            if code[0].startswith('48-') and slug != 'akyaka': continue
            if len(parts) < 5 and normalized(name) not in normalized(text):
                exclusions.append({'category': category, 'reason': 'no_local_connection_in_record', 'id': row['id']}); continue
            if re.search(r'iletişim adres|ofisi bulun|bu durum.*düşündür', text, re.I):
                exclusions.append({'category': category, 'reason': 'office_address_is_not_route_evidence', 'id': row['id']}); continue
            # Raw timetable prose is not copied into user-facing route fields.
            clean = lambda s: re.sub(r'[^.!?]*\b\d{1,2}:\d{2}\b[^.!?]*[.!?]?', '', s).strip(' |.')
            route = parts[1] if len(parts) > 2 else text.split(':', 1)[0]
            proof = clean(parts[2]) if len(parts) >= 5 else 'Mahalle bağlantısı kaynak incelemesiyle kontrol edilmeli.'
            benefit = clean(parts[3]) if len(parts) >= 6 else clean(parts[2]) if len(parts) >= 4 else ''
            routes.append({**common, 'code': code[0], 'route': clean(route), 'localEvidence': proof,
                           'benefit': benefit, 'sources': official, 'frequency': None, 'lastDeparture': None,
                           'serviceStatus': 'current_timetable_not_verified'})
        elif category == 'safety_news':
            if re.search(r'İnegöl|Inegol|Bursa|Marmaris|Fethiye|Datça|Bodrum|Kars|İstanbul|Ankara', text, re.I):
                exclusions.append({'category': category, 'reason': 'different_city_or_district', 'id': row['id']})
                continue
            posted = parse_date(text)
            if posted and not 0 <= (AS_OF - posted).days <= 365: continue
            event = parts[2] if len(parts) > 2 else text
            if re.search(r'leylek|NASA|turizm köyleri', event, re.I):
                exclusions.append({'category': category, 'reason': 'not_daily_service_or_safety_evidence', 'id': row['id']})
                continue
            if re.search(r'iletişim adres|gazetenin adres|yayın organının adres', event, re.I):
                exclusions.append({'category': category, 'reason': 'publisher_address_is_not_local_event', 'id': row['id']})
                continue
            # No raw graphic descriptions or personal identifiers in the public narrative.
            event = re.sub(r'(?<!\w)(?:[A-ZÇĞİÖŞÜ]\.){2,}', '', event)
            event = re.sub(r'\b\d{2}\s+[A-ZÇĞİÖŞÜ]{1,3}\s+\d{2,4}\b', '', event)
            event = event.replace('silahla başlarından vurulmuş halde ölü bulundu', 'yaşamını yitirdiğine ilişkin haber yayımlandı')
            event_type = parts[1].casefold() if len(parts) > 2 else 'duyuru'
            if re.search(r'cüzdan.*kaybol|kaybol.*cüzdan', event, re.I): event_type = 'kamu hizmeti'
            if re.search(r'ölü bulun|yaşamını yitirdiğine', event, re.I) and not re.search(r'öldür|cinayet|darp|saldır|şüpheli.*tutuk|kasten', event, re.I): event_type = 'asayiş / inceleme'
            if 'yangın' in event.casefold(): event_type = 'yangın'
            if any(w in event.casefold() for w in ['baygın', 'sağlık durum', 'hastalandı']): event_type = 'sağlık'
            if any(w in event.casefold() for w in ['trafik', 'çarpış', 'kaza']): event_type = 'trafik'
            event_date = posted.isoformat() if posted else None
            duplicate = next((n for n in news if n['date'] == event_date and (
                normalized(n['summary']) == normalized(event) or
                SequenceMatcher(None, normalized(n['summary']), normalized(event)).ratio() > .65)), None)
            if duplicate:
                duplicate['sources'] = list({s['url']:s for s in duplicate['sources'] + source_list}.values())
                continue
            news.append({**common, 'date': event_date, 'type': event_type, 'summary': event.strip()})
        elif category == 'social_life' and len(parts) >= 3:
            kind = corrected_venue_type(venue_type(parts[1]), parts[0]); address = parts[2]
            if re.search(r'benzin|petrol istasyonu', parts[1], re.I): continue
            scope = 'nearby' if any(t in address.casefold() for t in ['yakın', 'uzaklık', 'mesaf', 'çevre']) else 'reported_address'
            if any(other in address for other in ['Marmaris Mah', 'Marmaris,', 'Datça', 'Bodrum', 'Fethiye']): continue
            if slug == 'akyaka' and 'orman' in parts[0].casefold() and 'kamp' in parts[0].casefold(): kind = 'camp_site'
            if slug == 'akyaka' and 'town market' in parts[0].casefold(): kind = 'marketplace'
            venues.append({**common, 'name': parts[0], 'type': kind, 'address': address, 'scope': scope,
                           'lat': None, 'lon': None, 'distance': None, 'origin': 'web', 'openStatus': 'unknown'})
    news_review_path = ROOT / 'data/verified/news_reviews.json'
    news_reviews = load(news_review_path) if news_review_path.exists() else {}
    for event in news:
        review = news_reviews.get(event['id'])
        if review:
            event.update({k:review[k] for k in ['date','summary'] if k in review})
            event['sources'].insert(0, {'publisher': review['publisher'], 'url': review['url'], 'checkedAt': AS_OF.isoformat(), 'method': 'publisher_page_read'})
    osm = direct['categories']['social_life']
    quarantined = []
    old_quarantine = set()
    if slug == 'kotekli':
        old_quarantine = {q['id'] for q in load(ROOT / 'data/pilot/kotekli.ui.v0.2.json')['social']['quarantined']}
    for p in osm.get('places', []):
        title = p.get('name') or ''
        suspicious = p['category'] == 'cafe' and (p['osm_id'] in old_quarantine or re.search(r'yurdu|boya|ticaret|apartman|\bblok\b|market', title, re.I))
        if not title or suspicious:
            quarantined.append({'osmId': p['osm_id'], 'reason': 'unnamed_or_conflicting_type'}); continue
        src = {'id': f'osm:{p["osm_type"]}:{p["osm_id"]}', 'publisher': 'OpenStreetMap', 'url': p['source_url'], 'checkedAt': osm.get('retrieved_at'), 'method': 'osm'}
        venues.append({'id': src['id'], 'name': title, 'type': corrected_venue_type(p['category'], title), 'address': 'Referans noktasının 1 km çevresi · açık adres kaynakta',
                       'scope': 'reference_radius', 'lat': p['latitude'], 'lon': p['longitude'],
                       'distance': p['distance_to_reference_point_m'], 'origin': 'osm', 'openStatus': 'unknown', 'sources': [src], 'checkedAt': src['checkedAt']})
    venue_additions_path = ROOT / 'data/reference/venue_additions.json'
    if venue_additions_path.exists():
        venues.extend(load(venue_additions_path).get(slug, []))
    excluded_names = VENUE_EXCLUSIONS.get(slug, set())
    for venue in venues:
        if normalized(venue['name']) in excluded_names:
            exclusions.append({'category': 'social_life', 'reason': 'location_disputed_by_local_feedback', 'id': venue['id']})
    venues = [venue for venue in venues if normalized(venue['name']) not in excluded_names]

    # Merge an exact name only when there is a single possible mapped branch.
    mapped_names = {}
    for p in venues:
        if p['lat'] is not None: mapped_names.setdefault(normalized(p['name']), []).append(p)
    merged, seen_web = [], set()
    for p in venues:
        norm = normalized(p['name'])
        if p['origin'] == 'web' and len(mapped_names.get(norm, [])) == 1:
            match = mapped_names[norm][0]
            match['sources'] += p['sources']; continue
        if p['origin'] == 'web' and norm in seen_web: continue
        if p['origin'] == 'web': seen_web.add(norm)
        merged.append(p)
    unique_rents = { (p['rooms'], p['amount'], p['date'], p['lease']): p for p in rents }
    unique_routes = { p['code']: p for p in routes }
    official_path = ROOT / 'data/verified/official_routes.json'
    official = load(official_path) if official_path.exists() else []
    for route in unique_routes.values():
        verified = [p for p in official if p['code'] == route['code'] and p['status'] == 'official_page_read']
        if verified:
            item = max(verified, key=lambda p: (len(p.get('schedules', [])), p['checkedAt']))
            route.update({'route': item['name'], 'timetable': item['schedules'], 'officialHeadingVerified': True,
                          'publisherUpdated': item['publisherUpdated'], 'officialCheckedAt': item['checkedAt'],
                          'officialAlerts': item.get('alerts', [])})
            route['sources'].insert(0, {'id': route['id'] + ':official', 'publisher': 'MUTTAŞ · resmî hat sayfası',
                'url': item['url'], 'checkedAt': item['checkedAt'], 'method': 'official_page_read'})
    # A code with no readable official route page remains in the source archive,
    # rather than appearing beside positively verified current route headings.
    if official:
        verified_codes = {p['code'] for p in official if p['status'] == 'official_page_read'}
        unique_routes = {code: route for code, route in unique_routes.items() if code in verified_codes}
    assessment_path = ROOT / 'data/assessments/index.json'
    assessments = load(assessment_path)['neighborhoods'].get(slug, {}) if assessment_path.exists() else {}
    price_path = ROOT/'data/reference/local_prices.json'
    prices = [p for p in load(price_path) if (p['area'] == 'AKYAKA' and slug == 'akyaka') or (p['area'] != 'AKYAKA' and (slug != 'akyaka' or p['area'] == 'MUĞLA'))] if price_path.exists() else []
    transport_alerts = []
    review_path = ROOT / 'data/verified/transport_reviews.json'
    if review_path.exists():
        transport_alerts += load(review_path).get(slug, [])
    for route in unique_routes.values():
        for notice in route.get('officialAlerts', []):
            transport_alerts.append({'id': route['id'] + ':notice:' + hashlib.sha256(notice.encode()).hexdigest()[:8],
                'date': None, 'observedAt': route['officialCheckedAt'][:10], 'summary': notice,
                'affected': route['code'], 'status': 'official_notice_visible', 'sources': route['sources'][:1]})
    for path in (ROOT / 'data/research').glob(f'focused_{slug}_transport_conditions_v*/result.json'):
        if not load(path).get('accepted_for_review'): continue
        advisory_rows, registry = source_rows(path, slug, 'transportation')
        registry = {s['id']: s for s in registry}
        for row in advisory_rows:
            p = [v.strip() for v in row['text'].split('|')]
            if len(p) < 5: continue
            posted = parse_date(p[0])
            if posted and not 0 <= (AS_OF-posted).days <= 365: continue
            summary = p[2]
            # Do not present ordinary route stop lists as disruption alerts.
            if not re.search(r'çalış|çök|kapan|düzenle|giriş|sapma|iptal|taşın', summary, re.I): continue
            transport_alerts.append({'id': row['id'], 'date': posted.isoformat() if posted else None,
                'summary': summary, 'affected': p[3], 'status': 'publication_report_current_effect_unverified',
                'sources': [registry[i] for i in row['sourceIds']]})
    for finding in assessments.get('transportation', []):
        work_evidence = re.search(r'çalış|çök|kapan|düzenle|iptal|taşın', finding['summary'], re.I)
        if finding['sources'] and (finding['sentiment'] == 'negative' or work_evidence):
            transport_alerts.append({'id': finding['id'], 'date': finding['date'], 'summary': finding['summary'],
                                    'affected': finding['criterion'], 'status': 'completion_reported' if re.search(r'\btamamlandı\b|\bulaşıma açıldı\b', finding['summary'], re.I) else finding['status'], 'sources': finding['sources']})
    for event in news:
        if re.search(r'yol.*çalış|altyapı.*çalış|yol.*çök|güzerg.h.*değiş|durak.*taşın', event['summary'], re.I):
            transport_alerts.append({'id': event['id'], 'date': event['date'], 'summary': event['summary'],
                                    'affected': 'Yol ve altyapı bağlantılı haber', 'status': 'publication_report_current_effect_unverified', 'sources': event['sources']})
    transport_alerts = sorted({normalized(a['summary']):a for a in transport_alerts}.values(), key=lambda a:a['date'] or '', reverse=True)
    hazard = direct['categories']['earthquake_hazard']
    value = hazard['value']
    score = round(100 * (1 - (bisect.bisect_left(grid, value) + bisect.bisect_right(grid, value)) / (2 * len(grid)))) if value is not None else None
    hazard_view = {'value': value, 'score': score, 'gridDistance': hazard['distance_to_grid_point_km'],
                   'gridRows': len(grid), 'url': hazard['source_url'], 'title': hazard['source_title'],
                   'authors': hazard['authors'], 'license': hazard['license']['id'], 'officialAfad': False,
                   'sourceYear': 2025, 'probability': '50 yılda %10 aşılma olasılığı'}
    geocodes_path = ROOT / 'data/cache/venue_geocodes.json'
    geocodes_verified = ROOT / 'data/verified/venue_coordinates.json'
    geocodes = load(geocodes_path) if geocodes_path.exists() else load(geocodes_verified) if geocodes_verified.exists() else {}
    save(geocodes_verified, {k:v for k,v in geocodes.items() if v['status'] == 'matched'})
    for p in merged:
        geo = geocodes.get(slug + ':' + normalized(p['name']))
        if p['lat'] is None and geo and geo['status'] == 'matched':
            p.update({'lat': geo['lat'], 'lon': geo['lon'], 'distance': geo['distance'], 'coordinateMethod': 'name_and_radius_matched_nominatim'})
            p['sources'].append({'id': p['id'] + ':geocode', 'publisher': 'OpenStreetMap / Nominatim', 'url': geo['url'], 'checkedAt': geo['checkedAt'], 'method': 'nominatim'})
    latest = max([r['checkedAt'] for r in rows], default=direct['processed_at'])
    return {'schemaVersion': '2.0', 'id': slug, 'name': name, 'district': district, 'city': 'Muğla',
            'asOf': AS_OF.isoformat(), 'checkedAt': latest, 'location': direct['location'],
            'rents': list(unique_rents.values()), 'routes': list(unique_routes.values()), 'news': news,
            'venues': merged, 'hazard': hazard_view, 'osmStatus': osm['status'], 'osmRadius': 1000,
            'quarantined': quarantined, 'exclusions': exclusions, 'provenance': provenance,
            'coverage': {'datedRents': sum(p['eligible'] for p in unique_rents.values()), 'rentCandidates': len(unique_rents),
                         'routes': len(unique_routes), 'venues': len(merged), 'mappedVenues': sum(p['lat'] is not None for p in merged),
                         'events': len(news)}, 'safetyScore': None,
            'assessments': assessments, 'transportAlerts': transport_alerts, 'priceContext': prices,
            'reviewNote': 'Kaynak destekli araştırma kayıtları; kaynağın tüm iddiaları bağımsız olarak doğrulanmış değildir.'}


def build():
    grid = hazard_values()
    reports = [build_one(*p, grid) for p in PILOTS]
    for report in reports:
        save(ROOT / f'data/reports/{report["id"]}.json', report)
    save(ROOT / 'data/reports/manifest.json', {'version': '2.0', 'asOf': AS_OF.isoformat(),
        'reports': [{'id': r['id'], 'file': f'{r["id"]}.json', 'coverage': r['coverage'],
                     'sha256': hashlib.sha256((ROOT/f'data/reports/{r["id"]}.json').read_bytes()).hexdigest()} for r in reports]})
    save(ROOT / 'data/reports/index.json', {'version': '2.0', 'reports': reports})
    print(json.dumps([{'id': p['id'], **p['coverage']} for p in reports]))


if __name__ == '__main__':
    build()
