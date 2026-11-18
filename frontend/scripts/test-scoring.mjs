import assert from 'node:assert/strict';
import {
  CATEGORY_DEFINITIONS,
  agreedWeights,
  budgetScore,
  extractCategoryScores,
  housingComparison,
  housingPreferences,
  normalizeScoreValue,
  profiles,
  weightedScore,
} from '../src/scoring.mjs';
import { adaptPlaceReport } from '../src/services/placeAdapter.mjs';

assert.equal(budgetScore(30000, 30000), 50);
assert.equal(budgetScore(27000, 30000), 70);
assert.equal(budgetScore(27000, 10000), 0);
assert.equal(budgetScore(21000, 60000), 100);
assert.equal(budgetScore(null, 30000), null);
assert.equal(budgetScore(27000, 0), null);
for (const profile of Object.values(profiles)) {
  assert.equal(Object.values(profile.weights).reduce((a, b) => a + b, 0), 100);
  assert.ok(profile.weights.hazard > 0, 'Every profile includes earthquake hazard');
}
assert.deepEqual(agreedWeights, { rent: 32, transport: 10, social: 28, news: 20, hazard: 10 });
assert.equal(weightedScore({ rent: 70, transport: 70, social: 70, news: 55, hazard: 23 }, profiles.general.weights), 62);
assert.equal(weightedScore({ rent: 70, transport: 70, social: 70, news: 55, hazard: 100 }, profiles.general.weights), 70);
assert.equal(weightedScore({ rent: 70, hazard: null }, profiles.general.weights), 70);
assert.equal(weightedScore({ hazard: null }, profiles.general.weights), null);
const listings = [{ rooms: '1+1', amount: 21000 }, { rooms: '1+1', amount: 22000 }, { rooms: '2+1', amount: 30000 }];
assert.equal(housingPreferences('', 30000), null);
assert.equal(housingPreferences('1+1', ''), null);
assert.equal(housingPreferences('4+9', 30000), null);
assert.equal(housingPreferences('1+1', Infinity), null);
assert.equal(housingComparison(listings, null).score, null);
const smallHome = housingComparison(listings, housingPreferences('1+1', '25000'));
assert.equal(smallHome.listings.length, 2);
assert.equal(smallHome.median, 21500);
assert.equal(smallHome.score, 78);
assert.equal(housingComparison(listings, housingPreferences('2+1', '25000')).score, 10);
assert.deepEqual(housingComparison(listings, housingPreferences('1+0', '25000')), { listings: [], median: null, score: null });

// Issue #10 & #33: Category score normalization & missing data policy (never coerce null/undefined to 0)
assert.equal(CATEGORY_DEFINITIONS.length, 5);
assert.deepEqual(
  CATEGORY_DEFINITIONS.map((c) => c.label),
  ['Maliyet', 'Sosyal yaşam', 'Güvenlik / haberler', 'Afet', 'Ulaşım']
);
assert.equal(normalizeScoreValue(null), null);
assert.equal(normalizeScoreValue(undefined), null);
assert.equal(normalizeScoreValue(''), null);
assert.equal(normalizeScoreValue(false), null);
assert.equal(normalizeScoreValue(-5), null);
assert.equal(normalizeScoreValue(105), null);
assert.equal(normalizeScoreValue(0), 0);
assert.equal(normalizeScoreValue(74.4), 74);
assert.equal(normalizeScoreValue(100), 100);

const backendScores = {
  overall_livability: 75,
  cost_affordability: 62,
  safety: 72,
  disaster_resilience: 74,
  transportation: 90,
};
const mapped = extractCategoryScores(backendScores);
assert.deepEqual(
  mapped.map((m) => [m.key, m.value]),
  [
    ['cost_affordability', 62],
    ['social_life', null],
    ['safety', 72],
    ['disaster_resilience', 74],
    ['transportation', 90],
  ]
);

// Issue #33: Verify adaptPlaceReport maps scores, sources, PGA, rent range, and keeps missing values as null
const samplePlaceReport = {
  place: { id: 'abc123', name: 'Kötekli', district: 'Menteşe', city: 'Muğla' },
  reference_date: '2026-11-06',
  summary: 'Kaynaklı özet',
  limitations: ['Örnek sınırlılık'],
  generated_by: 'Google Gemini (gemini-3.5-flash-lite) · kural tabanlı puanlar',
  categories: [
    {
      id: 'rent_cost',
      label: 'Kira ve maliyet',
      items: [{ text: '1+1 ilan: 21000 TL', sources: [{ id: 's1', title: 'Emlakjet', url: 'https://www.emlakjet.com/ilan/1' }] }],
    },
    { id: 'social_life', label: 'Sosyal yaşam', items: [] },
    {
      id: 'safety_news',
      label: 'Haberler ve güvenlik',
      items: [],
      historical_items: [{ text: 'Arşiv haberi', date: '2024-01-10', sources: [{ id: 's2', title: 'Yerel Basın', url: 'https://example.com/haber' }] }],
    },
    {
      id: 'earthquake_hazard',
      label: 'Deprem verisi',
      items: [{ text: 'Araştırma gridinde temsil noktasının PGA değeri 0.351 g.', sources: [{ id: 's3', title: 'Aperta', url: 'https://aperta.ulakbim.gov.tr/record/274290' }] }],
    },
    { id: 'transportation', label: 'Ulaşım', items: [{ text: '1-48 Yeniköy - Kötekli - Kampüs', sources: [] }] },
  ],
  assessment: {
    overall_score: 26,
    profile_scores: { students: 26, families: 24, professionals: 27 },
    categories: [
      { category: 'rent_cost', score: 18 },
      { category: 'social_life', score: null },
      { category: 'safety_news', score: null },
      { category: 'earthquake_hazard', score: 23 },
      { category: 'transportation', score: 35 },
    ],
    calculation: { monthly_rent: 21500, rent_sample_count: 2 },
    briefing: {
      hazard: { value: 0.351 },
      rent_types: [{ rooms: '1+1', sample_count: 2, median: 21500, min: 21000, max: 22000 }],
    },
    executive_summary: 'Kötekli değerlendirme özeti.',
    pros: ['Kampüse yakın hatlar'],
    cons: ['Kira düzeyi'],
    methodology: 'Kural tabanlı proje değerlendirmesi.',
  },
};

const adapted = adaptPlaceReport(samplePlaceReport);
assert.equal(adapted.scores.overall_livability, 26);
assert.equal(adapted.scores.cost_affordability, 18);
assert.equal(adapted.scores.transportation, 35);
assert.equal(adapted.scores.disaster_resilience, 23);
assert.equal(adapted.scores.social_life, null);
assert.equal(adapted.scores.safety, null);
assert.equal(adapted.disaster_risk.pga_value_g, 0.351);
assert.ok(adapted.rent_analysis.rent_range_tl.includes('21.000'));
assert.equal(adapted.data_sources.length, 3);

console.log('Scoring and placeAdapter checks passed: boundaries, weights, missing data and earthquake contribution.');
