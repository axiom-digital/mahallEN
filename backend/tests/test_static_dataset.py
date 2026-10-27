import hashlib
import importlib.util
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('static_builder', ROOT / 'backend/scripts/build_static_dataset.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_all_five_pilots_have_consistent_source_backed_records():
    manifest = json.loads((ROOT / 'data/manifest.json').read_text(encoding='utf8'))
    assert manifest['actual_pilot_count'] == manifest['expected_pilot_count'] == 5
    assert {r['id'] for r in manifest['neighborhoods']} == {'kotekli', 'emirbeyazit', 'muslihittin', 'orhaniye', 'akyaka'}
    for entry in manifest['neighborhoods']:
        path = ROOT / entry['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
        record = json.loads(path.read_text(encoding='utf8'))
        assert record['id'] == entry['id']
        assert set(record['categories']) == set(builder.SECTIONS.values()) | {'earthquake_hazard'}
        source_ids = {s['id'] for s in record['sources']}
        assert all(s['url'].startswith('https://') and s['retrieved_at'] for s in record['sources'])
        assert 36 < record['location']['lat'] < 38 and 27 < record['location']['lon'] < 30
        for category in builder.SECTIONS.values():
            for observation in record['categories'][category]['observations']:
                assert observation['source_ids'] and set(observation['source_ids']) <= source_ids
                assert observation['grounding_supports']
        hazard = record['categories']['earthquake_hazard']
        assert hazard['is_official_afad_tdth'] is False
        assert hazard['value'] > 0 and hazard['distance_to_grid_point_km'] <= 5
        assert hazard['score'] is None


def test_source_date_windows_and_unknown_rent_eligibility():
    for slug, *_ in builder.PILOTS:
        record = json.loads((ROOT / f'data/neighborhoods/{slug}.json').read_text(encoding='utf8'))
        for category, days in [('rent_cost', 90), ('safety_news', 365)]:
            for item in record['categories'][category]['observations']:
                if item['date']:
                    assert 0 <= (builder.REFERENCE - date.fromisoformat(item['date'])).days <= days
                if category == 'rent_cost' and not item['date']:
                    assert not item['eligible_for_current_comparison']
        for item in record['categories']['transportation']['observations']:
            assert item['official_source_ids']
            assert item['frequency_minutes'] is None and item['last_departure'] is None


def test_other_neighborhood_evidence_and_old_news_are_excluded():
    emir = json.loads((ROOT / 'data/neighborhoods/emirbeyazit.json').read_text(encoding='utf8'))
    assert any(o['reason'] == 'different_neighborhood' for o in emir['excluded_observations'])
    assert any(o['reason'] == 'outside_date_window' for o in emir['excluded_observations'])
    assert all('(Kötekli Mahallesi)' not in r['text'] for r in emir['categories']['rent_cost']['observations'])


def test_missing_search_support_rejects_record():
    import pytest
    with pytest.raises(ValueError):
        builder.extract_rows({'accepted_for_review': False})
