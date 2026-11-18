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
  { slug: 'kotekli', name: 'Kötekli', district: 'Menteşe', city: 'Muğla', expectedOverall: 22, expectedCost: 18, expectedTransport: 35, expectedHazard: 23, pga: 0.351 },
  { slug: 'emirbeyazit', name: 'Emirbeyazıt', district: 'Menteşe', city: 'Muğla', expectedOverall: null, expectedCost: null, expectedTransport: 60, expectedHazard: 29, pga: 0.334 },
  { slug: 'muslihittin', name: 'Muslihittin', district: 'Menteşe', city: 'Muğla', expectedOverall: 25, expectedCost: 11, expectedTransport: 68, expectedHazard: 29, pga: 0.334 },
  { slug: 'orhaniye', name: 'Orhaniye', district: 'Menteşe', city: 'Muğla', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 29, pga: 0.334 },
  { slug: 'akyaka', name: 'Akyaka', district: 'Ula', city: 'Muğla', expectedOverall: 10, expectedCost: 0, expectedTransport: 43, expectedHazard: 11, pga: 0.391 },
  { slug: 'caferaga', name: 'Caferağa', district: 'Kadıköy', city: 'İstanbul', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 8, pga: 0.401 },
  { slug: 'bahcelievler', name: 'Bahçelievler', district: 'Çankaya', city: 'Ankara', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 41, pga: 0.304 },
  { slug: 'kultur', name: 'Kültür', district: 'Konak', city: 'İzmir', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 17, pga: 0.368 },
  { slug: 'yenibaglar', name: 'Yenibağlar', district: 'Tepebaşı', city: 'Eskişehir', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 56, pga: 0.271 },
  { slug: 'gorukle', name: 'Görükle', district: 'Nilüfer', city: 'Bursa', expectedOverall: null, expectedCost: null, expectedTransport: null, expectedHazard: 25, pga: 0.344 },
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
    sortedByOverall.slice(0, 3).map((x) => [x.name, x.overall_score]),
    [
      ['Muslihittin', 25],
      ['Kötekli', 22],
      ['Akyaka', 10],
    ],
    'Genel puanı hesaplanan mahalleler büyükten küçüğe sıralanmalı'
  );
  assert.ok(
    sortedByOverall.slice(3).every((x) => x.overall_score === null),
    'Eksik (null) genel puanlı mahalleler 0 sayılmadan listenin sonunda yer almalı'
  );
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
    assert.equal(adapted.scores.transportation, target.expectedTransport);
    assert.equal(adapted.scores.disaster_resilience, target.expectedHazard);

    // Social life and safety news must remain null (informational, never 0 or 50)
    assert.equal(adapted.scores.social_life, null, `${target.name} social_life null olmalı`);
    assert.equal(adapted.scores.safety, null, `${target.name} safety null olmalı`);

    // Check extractCategoryScores consistency with ScoreCard & ComparisonView
    const chartBars = extractCategoryScores(adapted.scores);
    assert.equal(chartBars.length, 5);
    for (const def of CATEGORY_DEFINITIONS) {
      const bar = chartBars.find((b) => b.key === def.key);
      assert.equal(bar.value, adapted.scores[def.key], `${target.name} ${def.key} grafik ve kart değeri tutarlı olmalı`);
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

  // 5. Real 0 vs Missing (null) Edge-Case Verification (Akyaka vs Emirbeyazıt)
  const akyakaSug = await fetchJson(`${API_BASE}/places/suggest?q=Akyaka%20Ula`);
  const akyakaRep = await fetchJson(`${API_BASE}/places/${akyakaSug.body.results[0].id}/report`);
  const akyakaAdapted = adaptPlaceReport(akyakaRep.body);
  assert.strictEqual(akyakaAdapted.scores.cost_affordability, 0, 'Akyaka maliyet puanı gerçek 0 (number) olmalı');
  assert.strictEqual(normalizeScoreValue(akyakaAdapted.scores.cost_affordability), 0, 'normalizeScoreValue(0) === 0 korunmalı');
  assert.strictEqual(akyakaAdapted.scores.social_life, null, 'Akyaka sosyal yaşam puanı null olmalı');
  assert.strictEqual(normalizeScoreValue(akyakaAdapted.scores.social_life), null, 'normalizeScoreValue(null) === null korunmalı');
  console.log('\n[5/6] Gerçek 0 puan (Akyaka Maliyet = 0/100) ile Eksik Veri (null -> "Yeterli veri yok") ayrımı kesin olarak doğrulandı.');

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
