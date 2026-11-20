import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptResearchReport, researchList, targetMatches, profileEvaluations } from '../src/services/researchAdapter.mjs';
const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const reference = await load('../src/data/income-reference.json');
const safety = await load('../src/data/safety-research.json');
const reports = await Promise.all(['kotekli','emirbeyazit','muslihittin','orhaniye','akyaka'].map(slug => load(`../src/data/reports/${slug}.json`)));
for (const raw of reports) {
  const adapted = adaptResearchReport(raw, reference, [safety]);
  assert.equal(adapted.slug, raw.id);
  assert.equal(adapted.source_mode, 'research');
  assert.equal(adapted.suitability.students, adapted.profile_evaluations.student.score);
  assert.equal(adapted.transport_analysis.bus_frequency_min, null);
  assert.equal(adapted.community_comments.length, 0);
  assert.equal(!!adapted.research_news, targetMatches(raw, safety));
}
const noRents = adaptResearchReport({ ...reports[0], rents: [] }, reference, [safety]);
assert.equal(noRents.rent_analysis.average_rent_tl, null);
assert.equal(noRents.scores.cost_affordability, null);
assert.equal(noRents.suitability.students, null);
const profile = profileEvaluations({ rent: 100, transport: 0, social: 0, news: 0, hazard: 0 });
assert.equal(profile.student.score, 30);
assert.equal(profile.family.score, 20);
assert.equal(profile.professional.score, 20);
assert.equal(profileEvaluations({}).student.score, null);
for (const selected of ['student', 'family', 'professional']) {
  const sorted = researchList(reports, reference, [safety], '', selected);
  const field = `suitability_${selected}`;
  const values = sorted.filter(r => r[field] != null).map(r => r[field]);
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
}
assert.equal(targetMatches({ ...reports[0], city: 'Bursa', district: 'İnegöl' }, safety), false);
assert.equal(researchList(reports, reference, [safety], 'Kotekli').length, 1);
assert.equal(researchList(reports, reference, [safety], 'Akyaka')[0].slug, 'akyaka');
assert.ok(safety.records.every(r => !Object.hasOwn(r, 'location_evidence')));
console.log('Five-report UI adapter, missing data, geography isolation and search checks passed.');
