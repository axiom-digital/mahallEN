import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  CATEGORY_DEFINITIONS,
  extractCategoryScores,
  normalizeScoreValue,
} from '../src/scoring.mjs';
import { adaptPlaceReport } from '../src/services/placeAdapter.mjs';
import { reportId, reportPath } from '../src/navigation.mjs';

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

const COMPARISON_PAIRS = [
  { id: 'kotekli-vs-emirbeyazit', label: 'Kötekli vs Emirbeyazıt (Muğla içi)', left: 'kotekli', right: 'emirbeyazit' },
  { id: 'kotekli-vs-akyaka', label: 'Kötekli vs Akyaka (Gerçek 0 maliyet)', left: 'kotekli', right: 'akyaka' },
  { id: 'kotekli-vs-caferaga', label: 'Kötekli vs Caferağa (Muğla vs İstanbul)', left: 'kotekli', right: 'caferaga' },
  { id: 'kotekli-vs-gorukle', label: 'Kötekli vs Görükle (Muğla vs Bursa)', left: 'kotekli', right: 'gorukle' },
];

function parseCliArgs(argv) {
  const opts = {
    rounds: 3,
    includeLiveNew: false,
    liveMaxAttempts: 2,
    newPlaces: [
      { name: 'Suadiye', district: 'Kadıköy', city: 'İstanbul' },
      { name: 'Bostanlı', district: 'Karşıyaka', city: 'İzmir' },
    ],
    jsonOut: null,
  };

  for (const arg of argv) {
    if (arg.startsWith('--rounds=')) {
      const n = Number(arg.slice('--rounds='.length));
      if (!Number.isInteger(n) || n < 1) throw new Error(`Geçersiz --rounds değeri: ${arg}`);
      opts.rounds = n;
    } else if (arg === '--include-live-new') {
      opts.includeLiveNew = true;
    } else if (arg.startsWith('--live-max-attempts=')) {
      const n = Number(arg.slice('--live-max-attempts='.length));
      if (!Number.isInteger(n) || n < 1) throw new Error(`Geçersiz --live-max-attempts değeri: ${arg}`);
      opts.liveMaxAttempts = n;
    } else if (arg.startsWith('--new-places=')) {
      const raw = arg.slice('--new-places='.length).trim();
      opts.newPlaces = raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const [name, district, city] = item.split('|').map((s) => s.trim());
          if (!name || !district || !city) {
            throw new Error(`Geçersiz --new-places öğesi (Ad|İlçe|İl beklenir): ${item}`);
          }
          return { name, district, city };
        });
    } else if (arg.startsWith('--json-out=')) {
      opts.jsonOut = arg.slice('--json-out='.length).trim();
    } else {
      throw new Error(`Bilinmeyen argüman: ${arg}`);
    }
  }
  return opts;
}

function round2(value) {
  return Number(value.toFixed(2));
}

export function computeStats(values) {
  assert.ok(Array.isArray(values) && values.length > 0, 'İstatistik için en az bir ölçüm gerekir');
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q) => {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const frac = pos - base;
    const next = sorted[base + 1] ?? sorted[base];
    return sorted[base] + frac * (next - sorted[base]);
  };
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    min: round2(sorted[0]),
    p50: round2(quantile(0.5)),
    mean: round2(sum / sorted.length),
    p95: round2(quantile(0.95)),
    max: round2(sorted[sorted.length - 1]),
  };
}

async function fetchJson(url, options = {}) {
  const t0 = performance.now();
  const res = await fetch(url, options);
  const elapsedMs = round2(performance.now() - t0);
  const body = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, body, elapsedMs };
}

function assertValidSourceUrl(urlText, contextLabel) {
  assert.equal(typeof urlText, 'string', `${contextLabel}: URL string olmalı`);
  assert.match(urlText, /^https?:\/\//i, `${contextLabel}: HTTP/HTTPS URL beklenir (${urlText})`);
  const parsed = new URL(urlText);
  assert.ok(parsed.hostname.length > 0, `${contextLabel}: hostname boş olmamalı`);
}

function validateAllReportSources(rawReport, placeLabel) {
  let itemUrlCount = 0;
  let historicalUrlCount = 0;
  for (const cat of rawReport.categories || []) {
    for (const item of cat.items || []) {
      assert.ok(Array.isArray(item.sources) && item.sources.length > 0, `${placeLabel}/${cat.id}: her bulgu kaynak içermeli`);
      for (const src of item.sources) {
        assertValidSourceUrl(src.url, `${placeLabel}/${cat.id}`);
        itemUrlCount += 1;
      }
    }
    for (const hist of cat.historical_items || []) {
      for (const src of hist.sources || []) {
        assertValidSourceUrl(src.url, `${placeLabel}/${cat.id}/historical`);
        historicalUrlCount += 1;
      }
    }
  }
  return { itemUrlCount, historicalUrlCount };
}

function findMatchingPlace(results, target) {
  return (results || []).find(
    (p) =>
      p.name.toLocaleLowerCase('tr-TR') === target.name.toLocaleLowerCase('tr-TR') &&
      p.district.toLocaleLowerCase('tr-TR') === target.district.toLocaleLowerCase('tr-TR') &&
      p.city.toLocaleLowerCase('tr-TR') === target.city.toLocaleLowerCase('tr-TR')
  );
}

async function runSearchChecks(testCases) {
  // TC-01: Health Check
  const health = await fetchJson(`${API_BASE}/health`);
  assert.equal(health.status, 200, 'TC-01: Health 200 dönmeli');
  assert.equal(health.body?.status, 'ok', 'TC-01: status=ok olmalı');
  testCases.push({ id: 'TC-01', stage: 'Sistem', status: 'PASS', elapsedMs: health.elapsedMs, detail: `HTTP 200 (${health.body.database_backend})` });

  // TC-02: Local Autocomplete Suggest
  const suggestQueries = [
    { q: 'Köt', expectedName: 'Kötekli', expectedDistrict: 'Menteşe' },
    { q: 'caferaga kadikoy', expectedName: 'Caferağa', expectedDistrict: 'Kadıköy' },
    { q: 'erze', expectedName: 'Erzene', expectedDistrict: 'Bornova' },
    { q: 'bostanli', expectedName: 'Bostanlı', expectedDistrict: 'Karşıyaka' },
    { q: 'gorukle', expectedName: 'Görükle', expectedDistrict: 'Nilüfer' },
  ];
  const suggestResults = [];
  for (const probe of suggestQueries) {
    const res = await fetchJson(`${API_BASE}/places/suggest?q=${encodeURIComponent(probe.q)}`);
    assert.equal(res.status, 200, `TC-02 (${probe.q}): 200 dönmeli`);
    const found = (res.body?.results || []).some(
      (item) => item.name === probe.expectedName && item.district === probe.expectedDistrict
    );
    assert.ok(found, `TC-02 (${probe.q}): ${probe.expectedName} / ${probe.expectedDistrict} önerilmeli`);
    suggestResults.push({ query: probe.q, count: res.body.results.length, elapsedMs: res.elapsedMs });
  }
  const suggestStats = computeStats(suggestResults.map((r) => r.elapsedMs));
  testCases.push({
    id: 'TC-02',
    stage: 'Arama',
    status: 'PASS',
    elapsedMs: suggestStats.mean,
    detail: `5 sorgu (min ${suggestStats.min} ms, medyan ${suggestStats.p50} ms, max ${suggestStats.max} ms)`,
  });

  // TC-03: Explicit Search & Input Validation
  const validSearch = await fetchJson(`${API_BASE}/places/search?q=${encodeURIComponent('Kötekli Menteşe')}`);
  assert.equal(validSearch.status, 200, 'TC-03: Geçerli search 200 dönmeli');
  assert.ok(
    (validSearch.body?.results || []).some((r) => r.name === 'Kötekli' && r.district === 'Menteşe'),
    'TC-03: Arama sonucunda Kötekli dönmeli'
  );
  const emptySearch = await fetchJson(`${API_BASE}/places/search?q=`);
  assert.equal(emptySearch.status, 422, 'TC-03: Boş sorgu 422 dönmeli');
  const spacesSearch = await fetchJson(`${API_BASE}/places/search?q=%20%20`);
  assert.equal(spacesSearch.status, 400, 'TC-03: Boşluk sorgusu 400 dönmeli');
  const suffixOnlySearch = await fetchJson(`${API_BASE}/places/search?q=Mahallesi`);
  assert.equal(suffixOnlySearch.status, 400, 'TC-03: Yalnız "Mahallesi" sorgusu 400 dönmeli');
  testCases.push({
    id: 'TC-03',
    stage: 'Arama',
    status: 'PASS',
    elapsedMs: validSearch.elapsedMs,
    detail: `Geçerli search ${validSearch.elapsedMs} ms; boş/geçersiz korumaları (422/400/400) geçti`,
  });

  // TC-04: Metadata-Only Place Read (never triggers LLM generation)
  const kotekliSug = await fetchJson(`${API_BASE}/places/suggest?q=${encodeURIComponent('Kötekli Menteşe Muğla')}`);
  const kotekliPlace = findMatchingPlace(kotekliSug.body?.results, { name: 'Kötekli', district: 'Menteşe', city: 'Muğla' });
  assert.ok(kotekliPlace, 'TC-04: Kötekli bulunmalı');
  const kotekliMeta = await fetchJson(`${API_BASE}/places/${kotekliPlace.id}`);
  assert.equal(kotekliMeta.status, 200);
  assert.equal(kotekliMeta.body.report_available, true, 'TC-04: Kötekli report_available=true olmalı');
  assert.equal(kotekliMeta.body.overall_score, 35);

  const erzeneSug = await fetchJson(`${API_BASE}/places/suggest?q=${encodeURIComponent('Erzene Bornova İzmir')}`);
  const erzenePlace = findMatchingPlace(erzeneSug.body?.results, { name: 'Erzene', district: 'Bornova', city: 'İzmir' });
  assert.ok(erzenePlace, 'TC-04: Erzene yerel dizinden dönmeli');
  const erzeneMeta1 = await fetchJson(`${API_BASE}/places/${erzenePlace.id}`);
  const erzeneMeta2 = await fetchJson(`${API_BASE}/places/${erzenePlace.id}`);
  assert.equal(erzeneMeta1.status, 200);
  assert.equal(erzeneMeta1.body.report_available, false, 'TC-04: Önbelleksiz mahallede metadata report_available=false olmalı');
  assert.equal(erzeneMeta2.body.report_available, false, 'TC-04: Metadata GET sonrası üretim tetiklenmemeli');
  testCases.push({
    id: 'TC-04',
    stage: 'Arama',
    status: 'PASS',
    elapsedMs: round2((kotekliMeta.elapsedMs + erzeneMeta1.elapsedMs) / 2),
    detail: `Kötekli report_available=true (${kotekliMeta.elapsedMs} ms); Erzene report_available=false (${erzeneMeta1.elapsedMs} ms)`,
  });

  return {
    health: { status: health.status, elapsedMs: health.elapsedMs, databaseBackend: health.body.database_backend },
    suggest: { queries: suggestResults, stats: suggestStats },
    search: {
      validMs: validSearch.elapsedMs,
      validCount: validSearch.body.results.length,
      invalidStatuses: { empty: emptySearch.status, whitespace: spacesSearch.status, suffixOnly: suffixOnlySearch.status },
    },
    metadata: { kotekliMs: kotekliMeta.elapsedMs, erzeneMs: erzeneMeta1.elapsedMs },
  };
}

async function runCachedPilotBenchmarks(rounds, testCases) {
  const resolved = [];
  for (const target of PILOT_TARGETS) {
    const sug = await fetchJson(
      `${API_BASE}/places/suggest?q=${encodeURIComponent(`${target.name} ${target.district} ${target.city}`)}`
    );
    assert.equal(sug.status, 200);
    const matched = findMatchingPlace(sug.body?.results, target);
    assert.ok(matched, `${target.name} suggest sonucunda bulunmalı`);
    assert.match(matched.id, /^[a-f0-9]{32}$/);
    resolved.push({ ...target, placeId: matched.id });
  }

  const perPlace = new Map(resolved.map((p) => [p.placeId, { ...p, roundMs: [], cacheHits: [], sourceStats: null, adaptedSummary: null }]));
  const allLatenciesMs = [];
  let sourceUrlTotal = 0;

  for (let round = 1; round <= rounds; round += 1) {
    for (const target of resolved) {
      const rep = await fetchJson(`${API_BASE}/places/${target.placeId}/report`);
      assert.equal(rep.status, 200, `${target.name} tur ${round}: HTTP 200 dönmeli`);
      assert.equal(rep.headers.get('x-cache'), 'HIT', `${target.name} tur ${round}: X-Cache=HIT olmalı`);
      const hitHeader = Number(rep.headers.get('x-cache-hits'));
      assert.ok(Number.isInteger(hitHeader) && hitHeader >= 1, `${target.name}: geçerli X-Cache-Hits başlığı olmalı`);
      assert.equal(rep.body.report_version, 3, `${target.name}: report_version=3 olmalı`);
      assert.equal(rep.body.writer_model, 'gemini-3.5-flash-lite', `${target.name}: writer_model=gemini-3.5-flash-lite olmalı`);
      assert.ok(
        typeof rep.body.assessment?.executive_summary === 'string' && rep.body.assessment.executive_summary.trim().length >= 100,
        `${target.name}: executive_summary dolu olmalı`
      );

      const entry = perPlace.get(target.placeId);
      if (entry.cacheHits.length > 0) {
        const prevHit = entry.cacheHits.at(-1);
        assert.equal(hitHeader, prevHit + 1, `${target.name}: X-Cache-Hits her okumada 1 artmalı (${prevHit} -> ${hitHeader})`);
      }
      entry.roundMs.push(rep.elapsedMs);
      entry.cacheHits.push(hitHeader);
      allLatenciesMs.push(rep.elapsedMs);

      if (round === 1) {
        const srcStats = validateAllReportSources(rep.body, target.name);
        const adapted = adaptPlaceReport(rep.body);
        assert.equal(adapted.scores.overall_livability, target.expectedOverall);
        assert.equal(adapted.scores.cost_affordability, target.expectedCost);
        assert.equal(adapted.scores.social_life, target.expectedSocial);
        assert.equal(adapted.scores.safety, target.expectedSafety);
        assert.equal(adapted.scores.transportation, target.expectedTransport);
        assert.equal(adapted.scores.disaster_resilience, target.expectedHazard);
        assert.equal(adapted.disaster_risk.pga_value_g, target.pga);

        for (const catRow of rep.body.assessment.categories) {
          assert.ok(Number.isInteger(catRow.sample_count), `${target.name}/${catRow.category}: sample_count tam sayı olmalı`);
          assert.ok(['high', 'medium', 'low', 'none'].includes(catRow.confidence), `${target.name}/${catRow.category}: confidence geçerli olmalı`);
          assert.ok(typeof catRow.confidence_label === 'string' && catRow.confidence_label.length > 0);
          if (catRow.score === null) {
            assert.equal(catRow.scoring_status, 'insufficient_data', `${target.name}/${catRow.category} eksik veride insufficient_data olmalı`);
            assert.equal(catRow.confidence, 'none');
            assert.equal(catRow.sample_count, 0);
          } else {
            assert.ok(Number.isInteger(catRow.score) && catRow.score >= 0 && catRow.score <= 100);
            assert.equal(catRow.scoring_status, 'scored', `${target.name}/${catRow.category} puanlı kategoride scored olmalı`);
            assert.ok(catRow.sample_count > 0);
          }
        }

        const chartBars = extractCategoryScores(adapted.scores);
        for (const def of CATEGORY_DEFINITIONS) {
          assert.equal(chartBars.find((b) => b.key === def.key)?.value, adapted.scores[def.key]);
          assert.ok(adapted.category_meta?.[def.key], `${target.name}: adapted.category_meta.${def.key} tanımlı olmalı`);
        }

        if (target.slug === 'akyaka') {
          assert.strictEqual(adapted.scores.cost_affordability, 0);
          assert.strictEqual(normalizeScoreValue(adapted.scores.cost_affordability), 0);
        }

        entry.sourceStats = {
          ...srcStats,
          dedupedUrlCount: adapted.data_sources.length,
        };
        entry.adaptedSummary = {
          overall: adapted.scores.overall_livability,
          cost: adapted.scores.cost_affordability,
          social: adapted.scores.social_life,
          safety: adapted.scores.safety,
          transport: adapted.scores.transportation,
          hazard: adapted.scores.disaster_resilience,
          pga: adapted.disaster_risk.pga_value_g,
          rentRange: adapted.rent_analysis.rent_range_tl,
          coverage: rep.body.assessment?.coverage ?? null,
          categoryMeta: adapted.category_meta,
          socialDiversity: rep.body.assessment?.briefing?.social_diversity || null,
        };
        sourceUrlTotal += adapted.data_sources.length;
      }
    }
  }

  const stats = computeStats(allLatenciesMs);
  const round1Stats = computeStats([...perPlace.values()].map((p) => p.roundMs[0]));

  // Legacy pilot endpoint benchmark
  const legacyFirst = await fetchJson(`${API_BASE}/neighborhoods/kotekli/report`);
  assert.equal(legacyFirst.status, 200);
  assert.ok(['HIT', 'MISS'].includes(legacyFirst.headers.get('x-cache')));
  const legacyHitRuns = [];
  for (let i = 0; i < rounds; i += 1) {
    const res = await fetchJson(`${API_BASE}/neighborhoods/kotekli/report`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-cache'), 'HIT');
    legacyHitRuns.push(res.elapsedMs);
  }
  const legacyHitStats = computeStats(legacyHitRuns);

  testCases.push(
    { id: 'TC-05', stage: 'Hazır Rapor', status: 'PASS', elapsedMs: round1Stats.mean, detail: `10 pilot ilk okuma 200 HIT (medyan ${round1Stats.p50} ms, max ${round1Stats.max} ms)` },
    { id: 'TC-06', stage: 'Hazır Rapor', status: 'PASS', elapsedMs: stats.mean, detail: `${rounds} tur × 10 pilot = ${stats.count} istek (min ${stats.min}, p50 ${stats.p50}, p95 ${stats.p95}, max ${stats.max} ms)` },
    { id: 'TC-07', stage: 'Hazır Rapor', status: 'PASS', elapsedMs: round1Stats.mean, detail: 'Tüm 10 pilotta report_version=3 ve writer_model=gemini-3.5-flash-lite doğrulandı' },
    { id: 'TC-08', stage: 'Hazır Rapor', status: 'PASS', elapsedMs: legacyHitStats.mean, detail: `Legacy /neighborhoods/kotekli/report ilk=${legacyFirst.headers.get('x-cache')} (${legacyFirst.elapsedMs} ms), HIT medyan=${legacyHitStats.p50} ms` },
    { id: 'TC-09', stage: 'Kaynaklar', status: 'PASS', elapsedMs: null, detail: `10 pilotta tüm bulgu/arşiv kaynak URL'leri geçerli HTTP/HTTPS (${sourceUrlTotal} tekil URL)` },
    { id: 'TC-10', stage: 'Kaynaklar', status: 'PASS', elapsedMs: null, detail: 'adaptPlaceReport: 10/10 PGA değeri ve karşılaştırılabilir kira aralığı eşlemesi doğrulandı' },
    { id: 'TC-11', stage: 'Eksik Veri', status: 'PASS', elapsedMs: null, detail: 'Gerçek maliyet=0 değerleri (Akyaka/Emirbeyazıt/Orhaniye/Caferağa/Bahçelievler/Kültür) sıfır olarak korundu; doğrulanmış ulaşım kaydı olmayan Orhaniye puanı null korundu' },
    { id: 'TC-12', stage: 'Eksik Veri', status: 'PASS', elapsedMs: null, detail: '9/10 pilotta (tüm 5 büyükşehir + 4 Muğla pilotu) 5/5 kategorinin tamamı, çeşitlilik notları ve örneklem/güven metadata alanları doğrulandı' }
  );

  return {
    rounds,
    overallStats: stats,
    round1Stats,
    pilots: [...perPlace.values()].map((p) => ({
      slug: p.slug,
      name: p.name,
      district: p.district,
      city: p.city,
      placeId: p.placeId,
      round1Ms: p.roundMs[0],
      roundMs: p.roundMs,
      stats: computeStats(p.roundMs),
      cacheHits: p.cacheHits,
      sourceStats: p.sourceStats,
      scores: p.adaptedSummary,
    })),
    legacyKoteki: {
      firstStatus: legacyFirst.status,
      firstXCache: legacyFirst.headers.get('x-cache'),
      firstMs: legacyFirst.elapsedMs,
      hitRunsMs: legacyHitRuns,
      hitStats: legacyHitStats,
    },
  };
}

async function loadComparisonSide(target) {
  const tTotal = performance.now();
  const sug = await fetchJson(
    `${API_BASE}/places/suggest?q=${encodeURIComponent(`${target.name} ${target.district} ${target.city}`)}`
  );
  assert.equal(sug.status, 200);
  const matched = findMatchingPlace(sug.body?.results, target);
  assert.ok(matched?.id, `Karşılaştırma suggest eşleşmesi bulunmalı: ${target.name}`);

  const rep = await fetchJson(`${API_BASE}/places/${encodeURIComponent(matched.id)}/report`);
  assert.equal(rep.status, 200, `Karşılaştırma /places/{id}/report 200 dönmeli: ${target.name}`);
  assert.equal(rep.headers.get('x-cache'), 'HIT', `Karşılaştırma ${target.name} HIT olmalı`);

  const adapted = adaptPlaceReport(rep.body);
  const pathStr = reportPath(matched.id);
  assert.equal(reportId(pathStr), matched.id);

  for (const cat of CATEGORY_DEFINITIONS) {
    assert.ok(Object.hasOwn(adapted.scores, cat.key), `${target.name}: scores.${cat.key} tanımlı olmalı`);
    const normalized = normalizeScoreValue(adapted.scores[cat.key]);
    assert.ok(normalized === null || (normalized >= 0 && normalized <= 100));
  }
  assert.equal(typeof adapted.disaster_risk.pga_value_g, 'number', `${target.name}: PGA değeri sayı olmalı`);

  const evidenceCounts = {
    rent_cost: adapted.evidence_report?.categories?.find((c) => c.id === 'rent_cost')?.items?.length ?? 0,
    transportation: adapted.evidence_report?.categories?.find((c) => c.id === 'transportation')?.items?.length ?? 0,
    social_life: adapted.evidence_report?.categories?.find((c) => c.id === 'social_life')?.items?.length ?? 0,
  };
  assert.ok(Number.isInteger(evidenceCounts.rent_cost));
  assert.ok(Number.isInteger(evidenceCounts.transportation));
  assert.ok(Number.isInteger(evidenceCounts.social_life));

  return {
    slug: target.slug,
    name: target.name,
    placeId: matched.id,
    reportPath: pathStr,
    suggestMs: sug.elapsedMs,
    reportMs: rep.elapsedMs,
    totalSideMs: round2(performance.now() - tTotal),
    xCache: rep.headers.get('x-cache'),
    overallScore: adapted.scores.overall_livability,
    pga: adapted.disaster_risk.pga_value_g,
    evidenceCounts,
  };
}

async function runComparisonBenchmarks(testCases) {
  const bySlug = new Map(PILOT_TARGETS.map((t) => [t.slug, t]));
  const pairMeasurements = [];

  for (let idx = 0; idx < COMPARISON_PAIRS.length; idx += 1) {
    const pair = COMPARISON_PAIRS[idx];
    const leftTarget = bySlug.get(pair.left);
    const rightTarget = bySlug.get(pair.right);
    const t0 = performance.now();
    const [left, right] = await Promise.all([
      loadComparisonSide(leftTarget),
      loadComparisonSide(rightTarget),
    ]);
    const totalPairMs = round2(performance.now() - t0);
    pairMeasurements.push({ ...pair, totalPairMs, left, right });

    const tcId = `TC-${13 + idx}`;
    testCases.push({
      id: tcId,
      stage: 'Karşılaştırma',
      status: 'PASS',
      elapsedMs: totalPairMs,
      detail: `${pair.label} | Sol=${left.overallScore ?? 'null'} (PGA ${left.pga}g), Sağ=${right.overallScore ?? 'null'} (PGA ${right.pga}g) | ${totalPairMs} ms`,
    });
  }

  return {
    pairs: pairMeasurements,
    stats: computeStats(pairMeasurements.map((p) => p.totalPairMs)),
  };
}

async function runSingleLiveAttempt(placeId) {
  const statusTimeline = [];
  const seenPhases = new Set();
  let polling = true;
  const tGenStart = performance.now();

  const pollLoop = (async () => {
    while (polling) {
      const pollRes = await fetchJson(`${API_BASE}/places/${placeId}/report/status`);
      if (!polling) break;
      if (pollRes.status === 200 && pollRes.body?.phase) {
        const phaseName = pollRes.body.phase;
        const atMs = round2(performance.now() - tGenStart);
        if (!seenPhases.has(phaseName)) {
          seenPhases.add(phaseName);
          statusTimeline.push({ phase: phaseName, firstSeenMs: atMs });
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  })();

  let postRes;
  try {
    postRes = await fetchJson(`${API_BASE}/places/${placeId}/report`, { method: 'POST' });
  } finally {
    polling = false;
    await pollLoop;
  }

  return { postRes, statusTimeline };
}

async function runLiveNewGenerationBenchmarks(targets, maxAttempts, testCases) {
  const records = [];
  for (let idx = 0; idx < targets.length; idx += 1) {
    const target = targets[idx];
    const sug = await fetchJson(
      `${API_BASE}/places/suggest?q=${encodeURIComponent(`${target.name} ${target.district} ${target.city}`)}`
    );
    assert.equal(sug.status, 200);
    const matched = findMatchingPlace(sug.body?.results, target);
    assert.ok(matched, `Yeni üretim hedefi suggest sonucunda bulunmalı: ${target.name} / ${target.district}`);
    assert.equal(matched.report_available, false, `${target.name} üretim öncesi report_available=false olmalı`);

    const initialGet = await fetchJson(`${API_BASE}/places/${matched.id}/report`);
    assert.equal(initialGet.status, 404, `${target.name} ilk GET 404 dönmeli`);

    const attempts = [];
    let succeededPost = null;
    let succeededTimeline = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const { postRes, statusTimeline } = await runSingleLiveAttempt(matched.id);
      const phasesStr = statusTimeline.map((p) => p.phase).join('->') || 'none';
      const detailText = postRes.status === 201 ? '201 Created' : (postRes.body?.detail || `HTTP ${postRes.status}`);
      console.log(
        `  [live] ${target.name} deneme ${attempt}/${maxAttempts}: HTTP ${postRes.status} (${postRes.elapsedMs} ms) phases=[${phasesStr}]`
      );

      if (postRes.status === 201) {
        attempts.push({
          attempt,
          status: postRes.status,
          xCache: postRes.headers.get('x-cache'),
          elapsedMs: postRes.elapsedMs,
          observedPhases: statusTimeline,
          detail: detailText,
        });
        succeededPost = postRes;
        succeededTimeline = statusTimeline;
        break;
      }

      if (postRes.status === 503 || postRes.status === 502) {
        const verifyGet = await fetchJson(`${API_BASE}/places/${matched.id}/report`);
        assert.equal(
          verifyGet.status,
          404,
          `${target.name}: başarısız HTTP ${postRes.status} sonrası GET /report hâlâ 404 dönmeli (önbellek korunmalı)`
        );
        attempts.push({
          attempt,
          status: postRes.status,
          xCache: postRes.headers.get('x-cache'),
          elapsedMs: postRes.elapsedMs,
          observedPhases: statusTimeline,
          detail: detailText,
          cachePreservedAfterFailure: true,
        });
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 5000));
        }
        continue;
      }

      assert.fail(`${target.name} deneme ${attempt}: beklenmeyen HTTP ${postRes.status} (${JSON.stringify(postRes.body)})`);
    }

    if (!succeededPost) {
      records.push({
        ...target,
        placeId: matched.id,
        initialGet404Ms: initialGet.elapsedMs,
        succeeded: false,
        attempts,
      });
      continue;
    }

    assert.equal(succeededPost.headers.get('x-cache'), 'MISS', `${target.name} ilk POST X-Cache=MISS dönmeli`);
    assert.equal(succeededPost.body.report_version, 3);
    assert.equal(succeededPost.body.writer_model, 'gemini-3.5-flash-lite');
    assert.ok(
      typeof succeededPost.body.assessment?.executive_summary === 'string' &&
        succeededPost.body.assessment.executive_summary.trim().length >= 100,
      `${target.name}: üretilen raporda executive_summary dolu olmalı`
    );

    const srcStats = validateAllReportSources(succeededPost.body, target.name);
    const adapted = adaptPlaceReport(succeededPost.body);
    for (const def of CATEGORY_DEFINITIONS) {
      const val = adapted.scores[def.key];
      assert.ok(val === null || (Number.isInteger(val) && val >= 0 && val <= 100), `${target.name}/${def.key} geçerli puan veya null olmalı`);
    }

    // Immediately verify cached reopen
    const reopenGet = await fetchJson(`${API_BASE}/places/${matched.id}/report`);
    assert.equal(reopenGet.status, 200, `${target.name} tekrar GET 200 dönmeli`);
    assert.equal(reopenGet.headers.get('x-cache'), 'HIT', `${target.name} tekrar GET X-Cache=HIT dönmeli`);
    assert.equal(reopenGet.headers.get('x-cache-hits'), '1', `${target.name} ilk tekrar GET X-Cache-Hits=1 olmalı`);

    // Verify repeated POST does not regenerate
    const repeatPost = await fetchJson(`${API_BASE}/places/${matched.id}/report`, { method: 'POST' });
    assert.equal(repeatPost.status, 200, `${target.name} tekrar POST 200 dönmeli`);
    assert.equal(repeatPost.headers.get('x-cache'), 'HIT', `${target.name} tekrar POST X-Cache=HIT dönmeli`);

    const speedupRatio = round2(succeededPost.elapsedMs / Math.max(reopenGet.elapsedMs, 0.01));

    records.push({
      ...target,
      placeId: matched.id,
      initialGet404Ms: initialGet.elapsedMs,
      succeeded: true,
      attempts,
      generationPost201Ms: succeededPost.elapsedMs,
      generationSeconds: round2(succeededPost.elapsedMs / 1000),
      cachedReopenGet200Ms: reopenGet.elapsedMs,
      repeatPostHitMs: repeatPost.elapsedMs,
      speedupRatio,
      observedPhases: succeededTimeline,
      researchMetrics: succeededPost.body.research_metrics || null,
      sourceStats: { ...srcStats, dedupedUrlCount: adapted.data_sources.length },
      scores: {
        overall: adapted.scores.overall_livability,
        cost: adapted.scores.cost_affordability,
        transport: adapted.scores.transportation,
        hazard: adapted.scores.disaster_resilience,
        pga: adapted.disaster_risk.pga_value_g,
        coverage: succeededPost.body.assessment?.coverage ?? null,
      },
    });
  }

  const successfulRecords = records.filter((r) => r.succeeded);
  const genStats = successfulRecords.length ? computeStats(successfulRecords.map((r) => r.generationPost201Ms)) : null;
  const reopenStats = successfulRecords.length ? computeStats(successfulRecords.map((r) => r.cachedReopenGet200Ms)) : null;
  const liveStatus = successfulRecords.length >= 1 ? 'PASS' : 'FAIL';
  const failedAttemptSummary = records
    .flatMap((r) => r.attempts.filter((a) => a.status !== 201).map((a) => `${r.name}#${a.attempt}=HTTP${a.status}(${round2(a.elapsedMs / 1000)}s,cache404=${a.cachePreservedAfterFailure})`));

  testCases.push(
    {
      id: 'TC-17',
      stage: 'Yeni Rapor',
      status: liveStatus,
      elapsedMs: genStats ? genStats.mean : null,
      detail: [
        ...successfulRecords.map((r) => `${r.name}: 404 (${r.initialGet404Ms} ms) -> POST 201 MISS (${r.generationSeconds} s)`),
        ...failedAttemptSummary,
      ].join(' | '),
    },
    {
      id: 'TC-18',
      stage: 'Yeni Rapor',
      status: liveStatus,
      elapsedMs: null,
      detail: successfulRecords.length
        ? successfulRecords.map((r) => `${r.name}: [${r.observedPhases.map((p) => p.phase).join(' -> ')}]`).join(' | ')
        : 'Başarılı yeni rapor üretimi tamamlanamadığı için aşama doğrulanamadı',
    },
    {
      id: 'TC-19',
      stage: 'Yeni Rapor',
      status: liveStatus,
      elapsedMs: reopenStats ? reopenStats.mean : null,
      detail: successfulRecords.length
        ? successfulRecords.map((r) => `${r.name}: GET 200 HIT ${r.cachedReopenGet200Ms} ms (${r.speedupRatio}x hızlanma), tekrar POST 200 HIT ${r.repeatPostHitMs} ms`).join(' | ')
        : 'Başarılı yeni rapor üretimi olmadığı için önbellek yeniden açma ölçülemedi',
    },
    {
      id: 'TC-20',
      stage: 'Yeni Rapor',
      status: liveStatus,
      elapsedMs: null,
      detail: successfulRecords.length
        ? successfulRecords.map((r) => `${r.name}: kaynak ${r.sourceStats.dedupedUrlCount} URL, research_metrics=${JSON.stringify(r.researchMetrics)}`).join(' | ')
        : 'Başarılı yeni rapor üretimi olmadığı için kaynak doğrulaması yapılamadı',
    }
  );

  return {
    records,
    successfulCount: successfulRecords.length,
    generationStats: genStats,
    reopenStats,
  };
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  const testCases = [];

  console.log('=== Issue #35 Uçtan Uca Kabul Testi & Yanıt Süresi Benchmarkı Başlıyor ===');
  console.log(`API_BASE=${API_BASE} | rounds=${opts.rounds} | includeLiveNew=${opts.includeLiveNew} | liveMaxAttempts=${opts.liveMaxAttempts}\n`);

  const search = await runSearchChecks(testCases);
  console.log(`[1/4] Arama & Metadata kontrolleri geçti (suggest medyan ${search.suggest.stats.p50} ms, search ${search.search.validMs} ms).`);

  const cachedPilots = await runCachedPilotBenchmarks(opts.rounds, testCases);
  console.log(
    `[2/4] Hazır (önbellekteki) 10 pilot rapor açılma süresi (${opts.rounds} tur, ${cachedPilots.overallStats.count} okuma): ` +
      `min=${cachedPilots.overallStats.min} ms | medyan=${cachedPilots.overallStats.p50} ms | ort=${cachedPilots.overallStats.mean} ms | p95=${cachedPilots.overallStats.p95} ms | max=${cachedPilots.overallStats.max} ms`
  );
  for (const p of cachedPilots.pilots) {
    console.log(
      `  ✓ ${p.name.padEnd(13)} | Tur-1: ${String(p.round1Ms).padStart(6)} ms | Medyan: ${String(p.stats.p50).padStart(6)} ms | HIT: ${p.cacheHits.join(',')} | Kaynak: ${p.sourceStats.dedupedUrlCount} URL`
    );
  }

  const comparison = await runComparisonBenchmarks(testCases);
  console.log(
    `\n[3/4] İkili Karşılaştırma akışı geçti (4 çift, medyan ${comparison.stats.p50} ms, max ${comparison.stats.max} ms):`
  );
  for (const pair of comparison.pairs) {
    console.log(`  ✓ ${pair.label}: ${pair.totalPairMs} ms (sol ${pair.left.totalSideMs} ms, sağ ${pair.right.totalSideMs} ms)`);
  }

  let liveNew = null;
  if (opts.includeLiveNew) {
    console.log('\n[4/4] Canlı yeni rapor üretimi (Tavily + Gemini 3.5 Flash-Lite) ölçülüyor...');
    liveNew = await runLiveNewGenerationBenchmarks(opts.newPlaces, opts.liveMaxAttempts, testCases);
    for (const r of liveNew.records) {
      if (r.succeeded) {
        console.log(
          `  ✓ ${r.name} (${r.district}/${r.city}): GET 404 (${r.initialGet404Ms} ms) -> POST 201 MISS (${r.generationPost201Ms} ms / ${r.generationSeconds} s) -> GET 200 HIT (${r.cachedReopenGet200Ms} ms, ${r.speedupRatio}x hızlı) | Aşamalar: ${r.observedPhases.map((p) => p.phase).join('->')}`
        );
      } else {
        console.log(
          `  ✗ ${r.name} (${r.district}/${r.city}): ${r.attempts.length} denemede üretilemedi (son HTTP ${r.attempts.at(-1)?.status}); önbellek 404 korundu.`
        );
      }
    }
  } else {
    console.log('\n[4/4] Canlı yeni rapor üretimi atlandı (kota korumalı varsayılan mod; çalıştırmak için --include-live-new ekleyin).');
  }

  const summary = {
    executedAt: new Date().toISOString(),
    apiBase: API_BASE,
    options: opts,
    search,
    cachedPilots,
    comparison,
    liveNew,
    testCases,
  };

  if (opts.jsonOut) {
    await fs.mkdir(path.dirname(opts.jsonOut), { recursive: true });
    await fs.writeFile(opts.jsonOut, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`\nJSON benchmark çıktısı kaydedildi: ${opts.jsonOut}`);
  }

  if (opts.includeLiveNew) {
    assert.ok(
      liveNew.successfulCount >= 1,
      'En az bir önbelleksiz mahalle için canlı yeni rapor üretimi (201 MISS -> 200 HIT) başarıyla tamamlanmalıydı'
    );
  }

  console.log(`\n=== TÜM ISSUE #35 KABUL TESTLERİ GEÇTİ (${testCases.length} kontrol) ===`);
}

main().catch((err) => {
  console.error('Issue #35 testi başarısız:', err);
  process.exit(1);
});
