"""Location isolation and common evidence gates; no live provider calls."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from research_spec import Target, specification, job_id, prompts, check_records


class ResearchSpecTests(unittest.TestCase):
    def spec(self, target=None, topic='safety', when='2026-10-29'):
        return specification(target or Target('Muğla', 'Menteşe', 'Kötekli'), topic, when)

    def test_homonymous_neighborhoods_do_not_share_cache(self):
        self.assertNotEqual(job_id(self.spec(Target('Muğla', 'Menteşe', 'Orhaniye'))),
                            job_id(self.spec(Target('Bursa', 'İnegöl', 'Orhaniye'))))

    def test_normalized_input_reuses_identity(self):
        self.assertEqual(job_id(self.spec(Target('MUĞLA', ' Menteşe ', 'KÖTEKLİ'))), job_id(self.spec()))

    def test_date_category_model_version_are_part_of_cache(self):
        spec = self.spec()
        for field, value in [('as_of', '2026-10-30'), ('topic', 'rent'),
                             ('report_model', 'different-model'), ('prompt_version', 'v-next')]:
            self.assertNotEqual(job_id(spec), job_id({**spec, field: value}))

    def test_prompt_has_no_pilot_location_dependency(self):
        for topic in ('safety', 'transport', 'rent', 'social'):
            research, report = prompts(self.spec(Target('İstanbul', 'Kadıköy', 'Caferağa'), topic))
            self.assertIn('caferağa', research)
            self.assertIn('kadıköy', report)
            self.assertNotIn('Kötekli', research + report)
            self.assertNotIn('muttas.com.tr', research + report)

    def test_invalid_geography_rejected(self):
        with self.assertRaises(ValueError):
            Target('Muğla', '', 'Kötekli')

    def test_invalid_reference_date_rejected(self):
        with self.assertRaises(ValueError):
            self.spec(when='2026-02-30')

    def test_shared_filters_and_no_publication_date_invention(self):
        base = {'title': 'Haber', 'summary': 'Kaynak iddiası', 'source_ids': ['S1'],
                'event_date': None, 'publication_date': '2026-09-01', 'location_evidence': 'Muğla Menteşe Kötekli Mahallesi'}
        records = [base, {**base, 'title': 'Yanlış kaynak', 'source_ids': ['S9']},
                   {**base, 'title': 'Eski', 'publication_date': '2025-05-01'},
                   {**base, 'title': 'İleri tarih', 'event_date': '2026-11-01'},
                   {**base, 'title': 'Yanlış yer', 'location_evidence': 'Akyer Mahallesi'},
                   {**base, 'title': 'Bozuk tarih', 'publication_date': '2026-02-30'}, base]
        result = check_records({'events': records}, {'sources': [{'id': 'S1'}]}, self.spec())
        self.assertEqual(len(result['records']), 1)
        self.assertEqual(len(result['rejected']), 6)
        self.assertIsNone(result['records'][0]['event_date'])
        self.assertEqual(result['records'][0]['date_basis'], 'publication_date')

    def test_old_event_with_new_article_stays_historical(self):
        record = {'title': 'Haber', 'summary': 'Özet', 'source_ids': ['S1'], 'event_date': '2026-03-31',
                  'publication_date': '2026-10-20', 'location_evidence': 'Muğla Menteşe Kötekli'}
        result = check_records({'events': [record]}, {'sources': [{'id': 'S1'}]}, self.spec())
        self.assertEqual(result['records'][0]['period'], 'history')

    def test_same_neighborhood_wrong_province_is_rejected(self):
        record = {'title': 'Haber', 'summary': 'Özet', 'source_ids': ['S1'], 'event_date': None,
                  'publication_date': '2026-10-20', 'location_evidence': 'Bursa İnegöl Orhaniye Mahallesi'}
        result = check_records({'events': [record]}, {'sources': [{'id': 'S1'}]},
                               self.spec(Target('Muğla', 'Menteşe', 'Orhaniye')))
        self.assertFalse(result['records'])
        self.assertIn('missing_province_evidence', result['rejected'][0]['errors'])

    def test_malformed_model_records_fail_closed(self):
        result = check_records({'events': [None, {'title': [], 'summary': {}, 'location_evidence': 4}]},
                               {'sources': []}, self.spec())
        self.assertFalse(result['records'])
        self.assertEqual(len(result['rejected']), 2)
        with self.assertRaises(ValueError):
            check_records({'events': 'not-an-array'}, {'sources': []}, self.spec())


if __name__ == '__main__':
    unittest.main()
