import importlib.util
import json
from pathlib import Path
import sys
import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT/'backend/scripts'


def script(name):
    sys.path.insert(0, str(SCRIPTS))
    try:
        spec = importlib.util.spec_from_file_location(name, SCRIPTS/f'{name}.py')
        result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
        return result
    finally:
        sys.path.remove(str(SCRIPTS))


quality = script('build_quality_reports')
assessment = script('build_assessments')
official = script('verify_official_routes')
pool = script('provider_pool')


def test_exact_and_approximate_dates_are_distinct():
    assert quality.parse_date('15.10.2026').isoformat() == '2026-10-15'
    assert quality.parse_date('29 gün önce (yaklaşık 29.09.2026)') is None
    assert quality.parse_date('31.02.2026') is None


def test_no_quality_score_is_invented_from_record_counts():
    reports = json.loads((ROOT/'data/reports/index.json').read_text(encoding='utf8'))['reports']
    assert len(reports) == 5
    for report in reports:
        assert report['safetyScore'] is None
        assert all('score' not in route for route in report['routes'])
        assert report['rents'] and report['venues']
        for rent in report['rents']:
            assert rent['sources'] and rent['amount'] > 0
            if rent['eligible']:
                assert rent['date'] and not rent['locationConflict'] and rent['lease'] != 'seasonal'
        for venue in report['venues']:
            assert venue['sources']
            if venue['origin'] == 'web' and venue['lat'] is not None:
                assert venue['coordinateMethod'] == 'name_and_radius_matched_nominatim'
        for category in report['assessments'].values():
            for finding in category:
                if finding['sentiment'] in ['positive','negative']: assert finding['sources']


def test_historical_claims_and_plans_are_not_current_improvements():
    result = {'finished_at': '2026-10-28T12:00:00Z', 'text': 'KOTEKLI:\n* positive | bağlantı | 2026-10-01 | MUTTAŞ iletişim adresi Muslihittin Mahallesi adresindedir.\n* positive | altyapı | 2026-10-01 | Yeni yol yapılması planlanmaktadır.\n* positive | hayat | 2021-01-01 | Eğlence seçenekleri var.\n',
      'grounding_metadata': {'grounding_chunks': [{'web': {'uri':'https://example.org','title':'example.org'}}],
         'grounding_supports': [{'segment': {'text': s}, 'grounding_chunk_indices':[0]} for s in ['MUTTAŞ iletişim adresi Muslihittin Mahallesi adresindedir.','Yeni yol yapılması planlanmaktadır.','Eğlence seçenekleri var.']]}}
    rows = assessment.parse_assessment(result, 'transportation')
    assert len(rows) == 2
    assert all(r['sentiment'] == 'unknown' for r in rows)


def test_ambiguous_location_is_not_used_for_rent_comparison():
    report = json.loads((ROOT/'data/reports/muslihittin.json').read_text(encoding='utf8'))
    conflicts = [p for p in report['rents'] if p['locationConflict']]
    assert conflicts and all(not p['eligible'] for p in conflicts)


def test_locally_disputed_venue_is_excluded_from_public_reports():
    directory = ROOT / 'data/reports'
    report = json.loads((directory / 'kotekli.json').read_text(encoding='utf8'))
    index = json.loads((directory / 'index.json').read_text(encoding='utf8'))
    assert report == next(row for row in index['reports'] if row['id'] == 'kotekli')
    assert all(quality.normalized(venue['name']) != 'doyurandoner' for venue in report['venues'])
    assert report['coverage']['venues'] == len(report['venues'])


def test_transport_conditions_are_not_hardcoded_to_one_neighborhood():
    report = json.loads((ROOT/'data/reports/orhaniye.json').read_text(encoding='utf8'))
    assert report['transportAlerts']
    assert all(a['sources'] for a in report['transportAlerts'])


def test_old_and_undated_menu_prices_are_separate_from_dated_examples():
    prices = json.loads((ROOT/'data/reference/local_prices.json').read_text(encoding='utf8'))
    assert any(p['status']=='undated_menu' for p in prices)
    for p in prices:
        if p['status']=='dated_2026_publication': assert p['date'].startswith('2026-')


def test_foreign_neighborhood_news_and_guide_prices_are_not_published():
    reports = json.loads((ROOT/'data/reports/index.json').read_text(encoding='utf8'))['reports']
    for report in reports:
        assert all('İnegöl' not in n['summary'] and 'iletişim adresi' not in n['summary'] for n in report['news'])
        assert all('fiyat' not in f['criterion'] for f in report['assessments'].get('social_life', []))
    assert quality.corrected_venue_type('cafe', 'Kebapçı Ökkeş Restoranı') == 'restaurant'


def test_offline_hazard_reference_does_not_require_ignored_cache(tmp_path):
    destination = tmp_path/'data/reference/hazard_distribution.json'
    destination.parent.mkdir(parents=True)
    destination.write_bytes((ROOT/'data/reference/hazard_distribution.json').read_bytes())
    values = quality.hazard_values(tmp_path)
    assert len(values) == 201920 and values == sorted(values)


@pytest.mark.parametrize('name', ['configure_local_keys','run_category_jobs','refresh_pilot_osm','geocode_report_venues'])
def test_operator_modules_are_import_safe(name):
    assert callable(script(name).main)


def test_timetable_title_and_day_columns_are_verified():
    html = '<title>1-8 - Otogar - Merkez | MUTTAŞ</title><h2>Otogar Kalkış</h2><table><tr><th>Hafta İçi</th><th>Cumartesi</th><th>Pazar</th></tr><tr><td>07:00</td><td>08:00</td><td>09:00</td></tr><tr><td>23:00</td><td>22:00</td><td>21:00</td></tr></table>'
    result = official.parse_page(html, '1-8')
    assert result['name'] == 'Otogar - Merkez'
    assert result['schedules'][0]['days']['weekday']['last'] == '23:00'
    assert result['schedules'][0]['days']['sunday']['first'] == '09:00'
    assert official.parse_page(html, '1-43') is None
    modal = '<div>Gidiş Dönüş</div><div>1-8 GÜZERGAHINDA YOL ÇALIŞMASI NEDENİ İLE GİRİŞ YAPILAMAMAKTADIR.</div>'
    assert official.parse_page(html + modal, '1-8')['alerts'], 'Notices after the timetable must not be lost'


class ProviderError(Exception):
    def __init__(self, code, message): self.code=code; self.message=message


def test_pool_daily_exhaustion_is_bounded_and_reused(tmp_path):
    calls=[]
    def generate(**kw):
        calls.append(kw['api_key']); raise ProviderError(429, 'requests_per_day exhausted')
    config={'GEMINI_API_KEYS':json.dumps(['one-test-key','two-test-key','one-test-key'])}
    path=tmp_path/'state.json'
    for _ in range(2):
        with pytest.raises(pool.DailyQuotaExhausted):
            pool.generate_with_pool(config,model='test',prompt='test',generate=generate,state_path=path,now=100)
    assert calls == ['one-test-key','two-test-key']
    assert 'one-test-key' not in path.read_text()


@pytest.mark.parametrize('code,message', [(429,'requests_per_minute exhausted'),(503,'busy'),(401,'not authorized')])
def test_pool_does_not_rotate_for_other_errors(tmp_path, code, message):
    calls=[]
    def generate(**kw): calls.append(kw['api_key']); raise ProviderError(code,message)
    with pytest.raises(ProviderError):
        pool.generate_with_pool({'GEMINI_API_KEYS':'["test-one", "test-two"]'},model='test',prompt='test',generate=generate,state_path=tmp_path/'state.json')
    assert calls == ['test-one']


def test_pool_skips_an_unavailable_model_without_changing_models(tmp_path):
    def generate(**kw):
        if kw['api_key']=='new-test-key': raise ProviderError(404,'model unavailable')
        return kw['model']
    response, alias = pool.generate_with_pool({'GEMINI_API_KEYS':'["new-test-key","working-test-key"]'},model='configured-model',prompt='test',generate=generate,state_path=tmp_path/'state.json')
    assert response=='configured-model' and alias=='credential-2'
