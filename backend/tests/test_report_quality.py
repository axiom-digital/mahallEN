from app.services.report_quality import evidence_view


def test_old_and_undated_news_are_archived_without_losing_sources():
    def item(date, text):
        return {'date': date, 'text': text, 'sources': [{'url': 'https://example.org/' + text}]}
    current = item('2026-10-20', 'current')
    old = item('2025-09-28', 'old')
    unknown = item(None, 'unknown')
    raw = {'reference_date': '2026-11-08', 'categories': [{'id': 'safety_news', 'items': [current, old, unknown, old]}]}
    result = evidence_view(raw)
    assert result['categories'][0]['items'] == [current]
    assert result['categories'][0]['historical_items'] == [old, unknown]
    assert evidence_view(result) == result
    assert len(raw['categories'][0]['items']) == 4
