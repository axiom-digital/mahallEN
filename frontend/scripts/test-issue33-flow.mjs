import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  CATEGORY_DEFINITIONS,
  extractCategoryScores,
  normalizeScoreValue,
} from '../src/scoring.mjs';
import { adaptPlaceReport } from '../src/services/placeAdapter.mjs';
import { openReportPage, reportId, reportPath } from '../src/navigation.mjs';

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

const PILOT_TARGETS = [
  { slug: 'kotekli', name: 'Kötekli', district: 'Menteşe', city: 'Muğla', expectedOverall: 35, expectedCost: 18, expectedSocial: 53, expectedSafety: 44, expectedTransport: 35, expectedHazard: 23, pga: 0.351 },
  { slug: 'emirbeyazit', name: 'Emirbeyazıt', district: 'Menteşe', city: 'Muğla', expectedOverall: 43, expectedCost: 0, expectedSocial: 83, expectedSafety: 53, expectedTransport: 60, expectedHazard: 29, pga: 0.334 },
  { slug: 'muslihittin', name: 'Muslihittin', district: 'Menteşe', city: 'Muğla', expectedOverall: 48, expectedCost: 5, expectedSocial: 87, expectedSafety: 61, expectedTransport: 68, expectedHazard: 29, pga: 0.334 },
  { slug: 'orhaniye', name: 'Orhaniye', district: 'Menteşe', city: 'Muğla', expectedOverall: 40, expectedCost: 0, expectedSocial: 84, expectedSafety: 50, expectedTransport: null, expectedHazard: 29, pga: 0.334 },
  { slug: 'akyaka', name: 'Akyaka', district: 'Ula', city: 'Muğla', expectedOverall: 39, expectedCost: 0, expectedSocial: 71, expectedSafety: 70, expectedTransport: 43, expectedHazard: 11, pga: 0.391 },
  { slug: 'caferaga', name: 'Caferağa', district: 'Kadıköy', city: 'İstanbul', expectedOverall: 50, expectedCost: 0, expectedSocial: 96, expectedSafety: 75, expectedTransport: 78, expectedHazard: 8, pga: 0.401 },
  { slug: 'bahcelievler', name: 'Bahçelievler', district: 'Çankaya', city: 'Ankara', expectedOverall: 46, expectedCost: 0, expectedSocial: 75, expectedSafety: 75, expectedTransport: 62, expectedHazard: 41, pga: 0.304 },
  { slug: 'kultur', name: 'Kültür', district: 'Konak', city: 'İzmir', expectedOverall: 40, expectedCost: 0, expectedSocial: 58, expectedSafety: 75, expectedTransport: 75, expectedHazard: 17, pga: 0.368 },
  { slug: 'yenibaglar', name: 'Yenibağlar', district: 'Tepebaşı', city: 'Eskişehir', expectedOverall: 58, expectedCost: 41, expectedSocial: 70, expectedSafety: 68, expectedTransport: 65, expectedHazard: 56, pga: 0.271 },
  { slug: 'gorukle', name: 'Görükle', district: 'Nilüfer', city: 'Bursa', expectedOverall: 56, expectedCost: 54, expectedSocial: 71, expectedSafety: 46, expectedTransport: 72, expectedHazard: 25, pga: 0.344 },
];

async function fetchJson(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  const elapsedMs = Number((performance.now() - t0).toFixed(2));
  const body = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body, elapsedMs };
}

async function runComprehensiveIssue33Checks() {
  console.log('=== Issue #33 Kapsamlı API & Frontend Doğrulama Testi Başlıyor ===\n');

  // 1. Health Check
  const health = await fetchJson(`${API_BASE}/health`);
  assert.equal(health.status, 200, 'Health endpoint 200 dönmeli');
  assert.equal(health.body.status, 'ok');
  console.log(`[1/6] Sistem sağlık kontrolü (/api/v1/health): 200 OK (${health.elapsedMs} ms)`);

  // 2. Autocomplete (suggest) & Search Validation
  const emptySearch = await fetchJson(`${API_BASE}/places/search?q=`);
  assert.equal(emptySearch.status, 422, 'Boş arama 422 dönmeli');
  const whitespaceSearch = await fetchJson(`${API_BASE}/places/search?q=%20%20`);
  assert.equal(whitespaceSearch.status, 400, 'Sadece boşluk içeren arama 400 dönmeli');

  const accentSuggest = await fetchJson(`${API_BASE}/places/suggest?q=${encodeURIComponent('KÖTEKLİ MENTEŞE')}`);
  assert.equal(accentSuggest.status, 200);
  assert.equal(accentSuggest.body.results[0].name, 'Kötekli');

  const nationalSuggest = await fetchJson(`${API_BASE}/places/suggest?q=erze`);
  assert.equal(nationalSuggest.status, 200);
  assert.equal(nationalSuggest.body.results[0].name, 'Erzene');
  assert.equal(nationalSuggest.body.results[0].district, 'Bornova');
  assert.equal(nationalSuggest.body.results[0].report_available, false);
  console.log('[2/6] Arama & Otomatik Tamamlama (/places/suggest & /places/search): Türkçe karakter, ulusal dizin ve boş sorgu korumaları doğrulandı.');

  // 3. Muğla Arama Sıralaması & Eksik Puan (null vs 0) Sıralama Kontrolü
  const muglaSearch = await fetchJson(`${API_BASE}/places/search?q=${encodeURIComponent('Muğla')}`);
  assert.equal(muglaSearch.status, 200);
  const muglaPilots = muglaSearch.body.results.filter((r) =>
    ['Kötekli', 'Emirbeyazıt', 'Muslihittin', 'Orhaniye', 'Akyaka'].includes(r.name)
  );
  assert.equal(muglaPilots.length, 5, 'Muğla aramasında 5 pilot mahalle dönmeli');

  // Verify frontend ranking logic: numeric scores (including 0) come before null
  const sortedByOverall = [...muglaPilots].sort((a, b) => {
    const scoreA = normalizeScoreValue(a.overall_score);
    const scoreB = normalizeScoreValue(b.overall_score);
    return (scoreB ?? -1) - (scoreA ?? -1);
  });
  assert.deepEqual(
    sortedByOverall.map((x) => [x.name, x.overall_score]),
    [
      ['Muslihittin', 48],
      ['Emirbeyazıt', 43],
      ['Orhaniye', 40],
      ['Akyaka', 39],
      ['Kötekli', 35],
    ],
    'Genel puanı hesaplanan Muğla pilotları büyükten küçüğe sıralanmalı'
  );
  // Verify frontend ranking preserves real 0 ahead of null
  const mixedZeroAndNull = [
    { name: 'Eksik', overall_score: null },
    { name: 'Sıfır', overall_score: 0 },
  ].sort((a, b) => (normalizeScoreValue(b.overall_score) ?? -1) - (normalizeScoreValue(a.overall_score) ?? -1));
  assert.deepEqual(mixedZeroAndNull.map((x) => x.name), ['Sıfır', 'Eksik'], 'Gerçek 0 puan null değerin önünde yer almalı');
  console.log('[3/6] Arama sonuç sıralaması ve eksik puan (null vs 0) ayrımı doğrulandı.');

  // 4. 10 Pilot Mahalle İçin Seçim, Rapor Sayfası (200 HIT), Kaynaklar ve Eksik Veri Kontrolü
  console.log('\n[4/6] 10 Pilot Mahalle Rapor Sayfası (/places/{id}/report), Kaynak ve Eksik Veri Kontrolü:');
  for (const target of PILOT_TARGETS) {
    const sug = await fetchJson(
      `${API_BASE}/places/suggest?q=${encodeURIComponent(`${target.name} ${target.district} ${target.city}`)}`
    );
    assert.equal(sug.status, 200);
    const matched = sug.body.results.find(
      (p) =>
        p.name.toLocaleLowerCase('tr-TR') === target.name.toLocaleLowerCase('tr-TR') &&
        p.district.toLocaleLowerCase('tr-TR') === target.district.toLocaleLowerCase('tr-TR')
    );
    assert.ok(matched, `${target.name} suggest sonucunda bulunmalı`);
    assert.match(matched.id, /^[a-f0-9]{32}$/, 'place_id 32 karakter hex olmalı');

    // Navigation URL check
    const path = reportPath(matched.id);
    assert.equal(reportId(path), matched.id, 'Rapor URL parametresi doğru çözülmeli');

    // Metadata endpoint check
    const meta = await fetchJson(`${API_BASE}/places/${matched.id}`);
    assert.equal(meta.status, 200);
    assert.equal(meta.body.report_available, true, `${target.name} raporu hazır olmalı`);
    assert.equal(meta.body.overall_score, target.expectedOverall);

    // Report endpoint check (must be 200 HIT)
    const rep = await fetchJson(`${API_BASE}/places/${matched.id}/report`);
    assert.equal(rep.status, 200, `${target.name} raporu 200 OK dönmeli`);
    assert.equal(rep.headers.get('x-cache'), 'HIT', `${target.name} raporu X-Cache: HIT dönmeli`);

    // Adapt with frontend placeAdapter.mjs
    const adapted = adaptPlaceReport(rep.body);
    assert.equal(adapted.name, target.name);
    assert.equal(adapted.scores.overall_livability, target.expectedOverall);
    assert.equal(adapted.scores.cost_affordability, target.expectedCost);
    assert.equal(adapted.scores.social_life, target.expectedSocial);
    assert.equal(adapted.scores.safety, target.expectedSafety);
    assert.equal(adapted.scores.transportation, target.expectedTransport);
    assert.equal(adapted.scores.disaster_resilience, target.expectedHazard);

    // Check extractCategoryScores consistency with ScoreCard & ComparisonView
    const chartBars = extractCategoryScores(adapted.scores);
    assert.equal(chartBars.length, 5);
    for (const def of CATEGORY_DEFINITIONS) {
      const bar = chartBars.find((b) => b.key === def.key);
      assert.equal(bar.value, adapted.scores[def.key], `${target.name} ${def.key} grafik ve kart değeri tutarlı olmalı`);
      const metaInfo = adapted.category_meta?.[def.key];
      assert.ok(metaInfo, `${target.name} ${def.key} category_meta alanı dönmeli`);
      if (adapted.scores[def.key] === null) {
        assert.equal(metaInfo.confidence, 'none');
        assert.equal(metaInfo.sample_count, 0);
      } else {
        assert.ok(metaInfo.sample_count > 0, `${target.name} ${def.key} sample_count > 0 olmalı`);
        assert.ok(['high', 'medium', 'low'].includes(metaInfo.confidence));
        assert.ok(typeof metaInfo.confidence_label === 'string' && metaInfo.confidence_label.length > 0);
      }
    }

    // Check PGA and sources
    assert.equal(adapted.disaster_risk.pga_value_g, target.pga, `${target.name} PGA değeri eşleşmeli`);
    assert.ok(adapted.data_sources.length >= 6, `${target.name} en az 6 doğrulanmış kaynak URL'si içermeli`);
    assert.ok(
      adapted.data_sources.every((u) => /^https?:\/\//i.test(u)),
      `${target.name} tüm kaynak bağlantıları geçerli HTTP/HTTPS URL olmalı`
    );

    // Check profile scores rule: when overall is null, profile scores must also be null
    if (target.expectedOverall === null) {
      assert.equal(adapted.suitability.students, null);
      assert.equal(adapted.suitability.families, null);
      assert.equal(adapted.suitability.professionals, null);
    } else {
      assert.ok(Number.isInteger(adapted.suitability.students));
      assert.ok(Number.isInteger(adapted.suitability.families));
      assert.ok(Number.isInteger(adapted.suitability.professionals));
    }

    console.log(
      `  ✓ ${target.name.padEnd(13)} | HTTP 200 HIT (${String(rep.elapsedMs).padStart(5)} ms) | Genel: ${String(adapted.scores.overall_livability ?? 'null').padStart(4)} | Maliyet: ${String(adapted.scores.cost_affordability ?? 'null').padStart(4)} | Ulaşım: ${String(adapted.scores.transportation ?? 'null').padStart(4)} | Afet: ${String(adapted.scores.disaster_resilience).padStart(2)} | PGA: ${adapted.disaster_risk.pga_value_g}g | Kaynak: ${adapted.data_sources.length}`
    );
  }

  // 5. Real 0 vs Missing (null) Edge-Case Verification (Akyaka Cost = 0 vs Orhaniye Transport = null)
  const akyakaSug = await fetchJson(`${API_BASE}/places/suggest?q=Akyaka%20Ula`);
  const akyakaRep = await fetchJson(`${API_BASE}/places/${akyakaSug.body.results[0].id}/report`);
  const akyakaAdapted = adaptPlaceReport(akyakaRep.body);
  assert.strictEqual(akyakaAdapted.scores.cost_affordability, 0, 'Akyaka maliyet puanı gerçek 0 (number) olmalı');
  assert.strictEqual(normalizeScoreValue(akyakaAdapted.scores.cost_affordability), 0, 'normalizeScoreValue(0) === 0 korunmalı');
  assert.ok(Number.isInteger(akyakaAdapted.scores.social_life), 'Akyaka sosyal yaşam puanı sayısal olmalı');
  assert.ok(Number.isInteger(akyakaAdapted.scores.safety), 'Akyaka güvenlik puanı sayısal olmalı');

  const orhaniyeSug = await fetchJson(`${API_BASE}/places/suggest?q=Orhaniye%20Mente%C5%9Fe`);
  const orhaniyeRep = await fetchJson(`${API_BASE}/places/${orhaniyeSug.body.results[0].id}/report`);
  const orhaniyeAdapted = adaptPlaceReport(orhaniyeRep.body);
  assert.strictEqual(orhaniyeAdapted.scores.transportation, null, 'Orhaniye doğrulanmamış ulaşım puanı null kalmalı');
  assert.strictEqual(normalizeScoreValue(orhaniyeAdapted.scores.transportation), null, 'normalizeScoreValue(null) === null korunmalı');
  console.log('\n[5/6] Gerçek 0 puan (Akyaka Maliyet = 0/100) ile Eksik Veri (Orhaniye Ulaşım = null -> "Veri bekleniyor") ayrımı kesin olarak doğrulandı.');

  // 6. Pilot Endpoint (/api/v1/neighborhoods/{slug}/report) Fallback & Cache Check
  const pilotRep1 = await fetchJson(`${API_BASE}/neighborhoods/kotekli/report`);
  assert.equal(pilotRep1.status, 200);
  const pilotRep2 = await fetchJson(`${API_BASE}/neighborhoods/kotekli/report`);
  assert.equal(pilotRep2.status, 200);
  assert.equal(pilotRep2.headers.get('x-cache'), 'HIT');
  assert.equal(pilotRep2.body.disaster_risk.pga_value_g, 0.351);
  console.log(`[6/6] Pilot veri uç noktası (/api/v1/neighborhoods/kotekli/report) ve X-Cache: HIT (${pilotRep2.elapsedMs} ms) doğrulandı.`);

  console.log('\n=== TÜM ISSUE #33 KONTROLLERİ EKSİKSİZ GEÇTİ ===');
}

runComprehensiveIssue33Checks().catch((err) => {
  console.error('Doğrulama hatası:', err);
  process.exit(1);
});
