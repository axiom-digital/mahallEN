import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from review_source_pages import page_text, source_cards, review_candidate, public_url
from research_spec import Target, specification


class PageReviewTests(unittest.TestCase):
    def setUp(self):
        self.spec = specification(Target('Bursa', 'İnegöl', 'Orhaniye'), 'safety', '2026-10-29')

    def test_footer_address_does_not_prove_article_location(self):
        parsed = page_text('<html><h1>Haber</h1><article>Başka yerde yaşanan olay.</article><footer>Bursa İnegöl Orhaniye</footer></html>')
        self.assertNotIn('Orhaniye', parsed['text'])

    def test_missing_article_body_is_not_accepted(self):
        self.assertEqual(page_text('<html><body>Menü Bursa Orhaniye</body></html>')['status'], 'article_body_unavailable')

    def test_publication_date_comes_from_metadata(self):
        parsed = page_text('<html><meta property="article:published_time" content="2026-09-04T12:00:00+03:00"><article>Haber</article></html>')
        self.assertEqual(parsed['published'], '2026-09-04')

    def test_source_cards_keep_unknown_event_date_and_work_outside_pilot(self):
        page = {'id': 'S1', 'title': 'Mahallede güvenlik operasyonu', 'published': '2026-09-04'}
        record = source_cards([page], self.spec)['records'][0]
        self.assertIsNone(record['event_date'])
        self.assertEqual(record['category'], 'denetim')
        self.assertEqual(record['date_basis'], 'publication_date')
        self.assertNotIn('Kötekli', record['summary'])

    def test_fabricated_quote_cannot_pass(self):
        page = {'id': 'S1', 'title': 'Haber', 'published': '2026-09-04', 'text': 'Bursa İnegöl Orhaniye Mahallesi için yayımlanan haber.'}
        candidate = {'events': [{'title': 'Haber', 'summary': 'İddia', 'source_ids': ['S1'], 'claim_quote': 'Kaynakta bulunmayan uydurma alıntı.'}]}
        checked = review_candidate(candidate, [page], self.spec)
        self.assertFalse(checked['records'])

    def test_private_and_plain_http_urls_rejected(self):
        for url in ['https://127.0.0.1/x', 'http://example.com', 'https://localhost/x']:
            self.assertFalse(public_url(url))
        self.assertTrue(public_url('https://example.com/news'))


if __name__ == '__main__': unittest.main()
