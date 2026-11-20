"""Apply the same evidence rules to positive, adverse and unknown category findings."""
from datetime import date
import hashlib
import re
from build_static_dataset import ROOT, PILOTS, load, save, parse_date

AS_OF = date(2026, 10, 28)
SLUGS = {p[0] for p in PILOTS}
CATEGORIES = ['rent_cost', 'transportation', 'social_life', 'safety_news']


def parse_assessment(result, category):
    chunks = result['grounding_metadata'].get('grounding_chunks', [])
    supports = result['grounding_metadata'].get('grounding_supports', [])
    findings, slug = [], None
    for line in result['text'].splitlines():
        plain = line.strip().replace('**', '')
        heading = re.match(r'^(KOTEKLI|EMIRBEYAZIT|MUSLIHITTIN|ORHANIYE|AKYAKA)\b', plain)
        if heading: slug = heading[1].lower()
        if not plain.startswith(('* ', '- ')): continue
        parts = [p.strip() for p in plain.lstrip('*- ').split('|')]
        if parts[0].lower() in SLUGS:
            slug = parts.pop(0).lower()
        if slug not in SLUGS or len(parts) < 4 or parts[0] not in ['positive', 'negative', 'unknown']: continue
        sentiment, criterion, raw_date, summary = parts[:4]
        ids = set()
        for support in supports:
            text = support.get('segment', {}).get('text', '')
            if text and (text in line or summary in text): ids.update(support.get('grounding_chunk_indices', []))
        sources = [{'publisher': chunks[i]['web'].get('title', 'Kaynak'), 'url': chunks[i]['web']['uri'], 'checkedAt': result['finished_at']}
                   for i in sorted(ids) if i < len(chunks) and chunks[i].get('web')]
        if sentiment != 'unknown' and not sources: continue
        posted = parse_date(raw_date)
        status = 'dated_report' if posted else 'current_status_unverified'
        # A company office address is not evidence of a route or service quality.
        if category == 'transportation' and re.search(r'iletişim adres|ofisi bulun|bu durum.*düşündür', summary, re.I): continue
        # Announced investment is not a delivered service improvement.
        if sentiment == 'positive' and re.search(r'planlan|hedeflen|devam ediyor|devam etmek', summary, re.I):
            sentiment, status = 'unknown', 'announced_or_ongoing_not_completed'
        if posted and (AS_OF - posted).days > 365:
            sentiment, status = 'unknown', 'historical_evidence'
        if posted and posted > AS_OF: continue
        if category == 'social_life' and 'fiyat' in criterion and not re.search(r'\d[\d.,]*\s*(?:TL|₺)', summary):
            sentiment, status = 'unknown', 'no_comparable_menu_prices'
        # A guide's date is not the price date. Prices belong in separately
        # dated menu records, never in a generic search assessment paragraph.
        if category == 'social_life' and 'fiyat' in criterion:
            continue
        if category == 'rent_cost' and sentiment == 'positive' and 'kira' in criterion.casefold():
            sentiment, status = 'unknown', 'listing_price_is_not_affordability'
        findings.append({'id': hashlib.sha256((slug+category+summary).encode()).hexdigest()[:16], 'neighborhood': slug,
                         'category': category, 'sentiment': sentiment, 'criterion': criterion,
                         'date': posted.isoformat() if posted else None, 'summary': summary, 'status': status, 'sources': sources})
    return findings


def build():
    output = {s: {c: [] for c in CATEGORIES} for s in SLUGS}
    for category in CATEGORIES:
        successes = [p for p in (ROOT/'data/research').glob(f'assessment_{category}_v10*/result.json') if load(p).get('accepted_for_review')]
        if not successes: continue
        result = load(max(successes, key=lambda p: load(p)['finished_at']))
        for finding in parse_assessment(result, category):
            output[finding['neighborhood']][category].append(finding)
    save(ROOT/'data/assessments/index.json', {'asOf': AS_OF.isoformat(), 'neighborhoods': output})
    price_path = ROOT/'data/research/assessment_price_context_v11/result.json'
    price_examples = []
    if price_path.exists():
        result = load(price_path)
        chunks = result.get('grounding_metadata', {}).get('grounding_chunks', [])
        for line in result.get('text', '').splitlines():
            if not line.strip().startswith('*'): continue
            parts = [p.strip() for p in line.strip().lstrip('* ').replace('**','').split('|')]
            if len(parts) < 6: continue
            price = re.search(r'([\d.,]+)\s*TL', parts[3])
            if not price: continue
            posted = parse_date(parts[4])
            if posted and posted > AS_OF: continue
            source_indices = set()
            for support in result.get('grounding_metadata', {}).get('grounding_supports', []):
                segment = support.get('segment', {}).get('text', '')
                if segment and segment in line: source_indices.update(support.get('grounding_chunk_indices', []))
            sources = [{'publisher': chunks[i]['web'].get('title', 'Kaynak'), 'url': chunks[i]['web']['uri'], 'checkedAt': result['finished_at']}
                       for i in sorted(source_indices) if i < len(chunks) and chunks[i].get('web')]
            if not sources: continue
            price_examples.append({'id': hashlib.sha256(line.encode()).hexdigest()[:16], 'area': parts[0], 'type': parts[1],
                'item': parts[2], 'amount': float(price[1].replace('.', '').replace(',','.')), 'date': posted.isoformat() if posted else None,
                'conditions': parts[5], 'sources': sources, 'status': 'dated_2026_publication' if posted and posted.year == 2026 else 'historical' if posted else 'undated_menu'})
    save(ROOT/'data/reference/local_prices.json', price_examples)
    print({s: sum(len(v) for v in c.values()) for s,c in output.items()})


if __name__ == '__main__': build()
