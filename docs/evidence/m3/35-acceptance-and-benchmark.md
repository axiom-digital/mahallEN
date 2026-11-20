# M3 Evidence — #35: Search -> Report -> Source -> Comparison Acceptance Test, 5-Category Scoring & Response-Time Benchmark

- **Issue / Task:** `#35 — [Acceptance Test] Verify Search -> Report -> Source -> Comparison flow and response times`
- **Owners:** Irmak + Ferdi
- **Milestone:** `M3 — Integration, Verification, and Presentation`
- **Branch:** `test_search_report_flow`
- **Verification Date:** 2026-04-20

---

## 1. Executive Summary & Acceptance Decision

This report documents the end-to-end verification of the MahallEN platform's `Search -> Report -> Source -> Comparison` user journey, the **5-category deterministic rule scoring engine (`rules-v2`, `score_summary_version: 5`)**, **OpenStreetMap 0.6 Map API (`ODbL-1.0`) multi-city geography and transit enrichment**, **social-life diversity & monoculture penalty modeling**, and **separate response-time benchmarks for cached report reads (`200 HIT`) versus live new report generation (`201 MISS`)**.

| Criterion Group | Status | Summary Evidence |
|---|---|---|
| **Cached (Pre-generated) Report Open Latency (`GET /api/v1/places/{id}/report`)** | **PASSED** | 10 pilots × 3 rounds (`30` reads): **`min = 9.50 ms`**, **`p50 = 12.97 ms`**, **`mean = 12.89 ms`**, **`p95 = 16.12 ms`**, **`max = 21.42 ms`** (`X-Cache: HIT`). |
| **Live New Report Generation Latency (`POST /api/v1/places/{id}/report`)** | **PASSED** | Cold Tavily + Gemini (`gemini-3.5-flash-lite`) generation for `Bostanlı (Karşıyaka / İzmir)`: **`201 Created` (`X-Cache: MISS`) = `53862.88 ms` (`53.86 s`)**; immediate cached reopen **`200 OK` (`X-Cache: HIT`) = `8.26 ms` (`6520.93x` speedup)**. |
| **Side-by-Side Comparison Flow (`/karsilastir`)** | **PASSED** | 4 distinct neighborhood pairs (parallel `suggest` + `2× report HIT`): **`min = 42.16 ms`**, **`p50 = 45.92 ms`**, **`mean = 47.24 ms`**, **`p95 = 53.94 ms`**, **`max = 54.95 ms`**. |
| **5-Category Deterministic Scoring (`rules-v2`) & Sample Confidence Badges** | **PASSED** | All 5 categories (`rent_cost`, `social_life`, `safety_news`, `earthquake_hazard`, `transportation`) produce deterministic `0..100` integer scores whenever evidence exists, accompanied by sample counts and confidence badges (`Yüksek güven`, `Orta güven`, `Sınırlı örneklem`). |
| **Social Life Diversity & Monoculture Penalty Analysis** | **PASSED** | Replaces raw venue-count inflation with 6-group depth, subtype diversity, Shannon entropy balance, and a `-14` monoculture penalty when `>= 75%` of venues are concentrated in food/cafe/nightlife with limited public/cultural spaces (`Kötekli: 53/100` with monoculture warning vs `Caferağa: 96/100` across 16 balanced subtypes). |
| **Source Verifiability & Schema Integrity** | **PASSED** | **`1275` unique `http/https` source URLs** across the 10 pilots, `0` broken/empty URLs, `0` schema errors, and 100% SHA-256 verification on protected files in `data/manifest.json`. |
| **Automated Test & Build Suite** | **PASSED** | Backend `pytest`: **`144 passed` (`5.96 s`)**; Frontend `test-scoring.mjs`, `test-navigation.mjs`, `test-issue33-flow.mjs`, `test-issue35-acceptance.mjs` (**`16/16 checks passed`**), and `vite build` (**`2.65 s`**) completed with zero errors. |

---

## 2. Test Environment & Isolation

- **Operating System:** Windows (`PowerShell`)
- **Backend Server:** FastAPI / Uvicorn (`http://127.0.0.1:18035`, `GEMINI_REPORT_MODEL=gemini-3.5-flash-lite`, `REPORT_CACHE_ENABLED=true`, `REPORT_CACHE_TTL_SECONDS=2592000`)
- **Frontend Server:** Vite / React 19 (`http://127.0.0.1:5185`, `VITE_API_BASE_URL=http://127.0.0.1:18035/api/v1`)
- **Database Isolation:** Executed against an isolated SQLite database (`issue35_bench.db`) outside the Git working tree.
- **Protected Data Files (`data/manifest.json`):** SHA-256 checksums for `data/pilot_neighborhoods.json`, `data/issue32/*`, and `data/scoring_research/reports.json` remained untouched; enriched multi-city records are stored in `data/scoring_research/multicity_enriched.json`.

---

## 3. Architectural Upgrades: 5-Category Scoring (`rules-v2`), OSM 0.6 Geography Engine & Diversity Modeling

### 3.1. Deterministic 5-Category Scoring (`backend/app/services/rule_scoring.py`, `report_quality.py`)
1. **Rent Cost (`rent_cost`):**
   - When at least `3` dated `1+1` listings are available, the strict `1+1` median rent is used (`rent_mode: "strict_1plus1"`).
   - When fewer than `3` dated `1+1` listings exist, listings across all room configurations (`1+0`, `1+1`, `2+1`, `3+1`, `4+1`) are normalized to `1+1` equivalents using `ROOM_FACTORS` (`2+1 -> 0.78`, `3+1 -> 0.62`, `1+0 -> 1.18`, etc.) and combined with market rent benchmarks (`rent_benchmarks`) (`rent_mode: "multi_room_normalized"`).
   - For real-estate portal summary pages (`emlakjet.com`, `hepsiemlak.com`, `sahibinden.com`) containing multiple listing rows, the deterministic `_extract_portal_rents()` parser in `research_facts.py` extracts up to `7` price-room pairs per page rather than latching onto a single outlier luxury listing.
2. **Social Life (`social_life`) — Diversity & Monoculture Model:**
   - Venues are classified into 6 functional groups: `yeme_icme` (dining), `kafe_tatli` (cafes/dessert), `gece_hayati` (pubs/nightlife), `kultur_sanat` (culture/arts), `park_spor` (parks/sports), and `gunluk_yasam` (daily amenities).
   - Score components:
     - **6-group depth (`0..48` pts):** Diminishing-returns depth across each group (`yeme_icme`, `kafe_tatli`, `park_spor`, `gunluk_yasam` up to `9` pts each; `kultur_sanat` and `gece_hayati` up to `6` pts each).
     - **Cuisine/style diversity (`0..8` pts)** and **subtype diversity (`0..18` pts, `min(18, unique_subtypes * 1.5)`)**.
     - **Shannon entropy balance (`0..16` pts):** Measures how evenly venues are distributed across the 6 groups.
     - **Public space & cultural depth (`0..10` pts):** Based on `park_spor + kultur_sanat`.
     - **Monoculture concentration penalty (`-14` or `-10` pts):** Automatically applied when **`>= 75%`** (or `>= 68%`) of venues are clustered strictly in dining/cafe/nightlife while `park_spor + kultur_sanat <= 4`, surfacing an explicit warning banner in the UI.
     - **Missing culture/arts penalty (`-6` pts):** Applied when a neighborhood has `>= 15` venues but `kultur_sanat == 0`.
3. **Local News & Agenda (`safety_news`):**
   - Computes a deterministic `0..100` score from dated local news articles weighted by topic (`incident/crime`, `traffic/accident`, `infrastructure`, `municipal/cultural`).
4. **Earthquake Hazard (`earthquake_hazard`):**
   - Deterministically derived from AFAD TDTH `PGA (475-year return period, g)` peak ground acceleration (`round((0.43 - pga) * 320)`).
5. **Transportation (`transportation`):**
   - Evaluates both transit line count and higher-capacity rail/ferry modes (`metro`, `tram`, `ferry`, `commuter rail`, `İZBAN`, `M4`, `T1`, `T3` -> `+20` bonus) via `route_indicator = min(78, round(sqrt(len(routes)) * 18) + rail_bonus)`.

### 3.2. OpenStreetMap 0.6 Map API Primary Geography & Transit Engine (`backend/app/services/place_geography.py`)
- To avoid public Overpass and Photon mirror timeouts, the official **OpenStreetMap 0.6 Map XML API (`https://api.openstreetmap.org/api/0.6/map?bbox=...`, ODbL-1.0)** is integrated as the primary geography provider (`_osm_map_data`), alongside a fail-fast circuit breaker (`consecutive_errors >= 2`, `timeout=4`) on `_photon_venues`.
- A single `bbox` request (`0.6–1.4 s`) deterministically extracts both coordinate-mapped venues (`<node>` and `<way>`, up to `150` type-balanced venues) and transit lines (`<relation type="route">`: `subway`, `light_rail`, `tram`, `ferry`, `train`, `bus`, up to `25` routes).

---

## 4. Response-Time Benchmark Results (Cached Open vs. Live Generation Separated)

### 4.1. Batch Pre-generation / Warmup Benchmark (`backend/scripts/prepare_place_reports.py --workers 1`)

| Run | Scope | Outcome | Total Duration (`ms`) | Notes |
|---|---|---|---:|---|
| **Run 1 (Cold DB)** | 10 Pilot Neighborhoods | `8 PREPARED`, `2 FAILED (ResearchUnavailable)` | `129323.13 ms` | `Kültür` and `Yenibağlar` encountered transient upstream errors on first pass; no corrupt cache row was written. |
| **Run 2 (Retry Missing)** | 10 Pilot Neighborhoods | `8 HIT`, `2 PREPARED` (`Kültür`, `Yenibağlar`) | `15734.40 ms` | Only the 2 missing neighborhoods were generated; the existing 8 returned immediate `HIT`s. |
| **Run 3 (All Warm)** | 10 Pilot Neighborhoods | `10/10 HIT` (`exit 0`) | `873.43 ms` | All 10 pilots verified from cache (`~87 ms / place` including CLI startup overhead). |

### 4.2. Search, Autocomplete & Metadata Pre-Check (`GET /places/{id}`) Latencies

| Endpoint / Flow | Sample / Query Count | HTTP Status | `min (ms)` | `p50 (ms)` | `mean (ms)` | `p95 (ms)` | `max (ms)` |
|---|---:|---|---:|---:|---:|---:|---:|
| `GET /api/v1/health` | 2 checks | `200 OK` (`sqlite`) | `28.91` | `29.43` | `29.43` | `29.90` | `29.95` |
| `GET /api/v1/places/suggest` (Warm) | 5 queries (`Köt`, `caferaga kadikoy`, `erze`, `bostanli`, `gorukle`) | `200 OK` | `11.10` | `14.79` | `14.66` | `18.65` | `19.23` |
| `GET /api/v1/places/suggest` (Cold First Pass) | 5 queries | `200 OK` | `10.31` | `12.53` | `54.93` | `181.82` | `223.22` |
| `GET /api/v1/places/search?q=Kötekli Menteşe` | 1 full search | `200 OK` | `13.40` | `13.40` | `13.40` | `13.40` | `13.40` |
| `GET /api/v1/places/{id}` (`Kötekli` — cached) | 1 metadata read | `200 OK` (`report_available: true`) | `5.18` | `5.18` | `5.18` | `5.18` | `5.18` |
| `GET /api/v1/places/{id}` (`Erzene` — uncached) | 2 repeat reads | `200 OK` (`report_available: false`) | `2.49` | `2.49` | `2.49` | `2.49` | `2.49` |

> [!NOTE]
> Repeated `GET /api/v1/places/{id}` requests on an uncached place (`Erzene`) consistently return `report_available: false` in `2.49 ms` and **never trigger background LLM/Tavily generation**.

### 4.3. Cached Report Open Latency (`GET /api/v1/places/{id}/report` -> `200 HIT`)

Measured across **3 consecutive rounds over all 10 pilot neighborhoods (`30` HTTP GET requests)**:

| Measurement Set | Request Count | Cache Header | `min (ms)` | `p50 (ms)` | `mean (ms)` | `p95 (ms)` | `max (ms)` |
|---|---:|---|---:|---:|---:|---:|---:|
| **Overall (`3 Rounds × 10 Pilots`)** | `30` | `X-Cache: HIT` | **`9.50`** | **`12.97`** | **`12.89`** | **`16.12`** | **`21.42`** |
| **Round 1 (`10 Pilots Initial Open`)** | `10` | `X-Cache: HIT` | `9.50` | `12.45` | `13.31` | `19.03` | `21.42` |
| **Legacy `GET /api/v1/neighborhoods/kotekli/report`** | `3` | `X-Cache: HIT` | `5.81` | `5.93` | `5.92` | `6.02` | `6.03` |

### 4.4. Side-by-Side Comparison Flow Latency (`4` Neighborhood Pairs)

Each comparison benchmark mirrors the frontend comparison flow by executing parallel `suggest` resolution plus parallel `GET /api/v1/places/{id}/report` (`200 HIT`) fetches for both neighborhoods:

| Comparison Pair | Left Place Latency (`ms`) | Right Place Latency (`ms`) | Total Parallel Flow Latency (`ms`) |
|---|---:|---:|---:|
| **Kötekli vs Emirbeyazıt** (`Intra-Muğla`) | `36.78` | `54.61` | **`54.95`** |
| **Kötekli vs Akyaka** (`Menteşe vs Ula`) | `43.61` | `36.74` | **`43.62`** |
| **Kötekli vs Caferağa** (`Muğla vs İstanbul`) | `37.13` | `47.97` | **`48.23`** |
| **Kötekli vs Görükle** (`Muğla vs Bursa`) | `35.63` | `41.93` | **`42.16`** |
| **Summary Statistics (`4 Pairs`)** | — | — | **`min = 42.16` · `p50 = 45.92` · `mean = 47.24` · `p95 = 53.94` · `max = 54.95`** |

### 4.5. Live New Report Generation Latency (`POST /api/v1/places/{id}/report` -> `201 MISS`) & Fault Resilience

Cold report generation, job status phase transitions, and cache integrity after upstream `503` failures were benchmarked on non-pilot neighborhoods:

| Neighborhood (`placeId`) | Step / Scenario | HTTP & `X-Cache` | Duration (`ms`) | Observed Phases (`status` / `phase`) & Evidence |
|---|---|---|---:|---|
| **Bostanlı — Karşıyaka / İzmir** (`82171aa4bb0aa0a85ca5fecd7c1fc0db`) | 1. Pre-check (`GET /report`) | `404 Not Found` (`MISS`) | `4.04 ms` | `GET /report` does not trigger generation when uncached; returns `404`. |
| **Bostanlı — Karşıyaka / İzmir** | 2. Live Generation Attempt 1 (`POST /report`) | `503 Service Unavailable` | `44493.91 ms` | Observed `checking -> research -> extraction`; subsequent `GET /report` remained `404` (`cachePreservedAfterFailure: true`). |
| **Bostanlı — Karşıyaka / İzmir** | 3. Live Generation Success (`POST /report`) | **`201 Created` (`X-Cache: MISS`)** | **`53862.88 ms` (`53.86 s`)** | `checking (49 ms) -> research (1060 ms) -> extraction (10188 ms) -> writing (43501 ms)`; `research_metrics: {source_count: 45, extracted_count: 16, accepted_count: 12}`. |
| **Bostanlı — Karşıyaka / İzmir** | 4. Immediate Cached Reopen (`GET /report`) | **`200 OK` (`X-Cache: HIT`, `Hits: 1`)** | **`8.26 ms`** | **`6520.93x` faster** than cold generation (`53862.88 ms -> 8.26 ms`). |
| **Bostanlı — Karşıyaka / İzmir** | 5. Repeat `POST /report` (Idempotency) | `200 OK` (`X-Cache: HIT`) | `8.30 ms` | Reused cached report without re-invoking LLM. |
| **Bostanlı — Karşıyaka / İzmir** | 6. Multi-Listing + OSM 0.6 Enriched Reopen (`GET /report`) | `200 OK` (`X-Cache: HIT`) | `18.78 ms` | Overall **47** (`5/5`), Rent **0** (`7 listings · Medium confidence`, `44,460 TL` 1+1 eq across `37k–57k` + `83k`), Social **79** (`127 venues`, 11 subtypes, 6/6 groups), News **75** (`2 articles`), Earthquake **17** (`0.37 g`), Transit **78** (`24 lines`). |
| **Suadiye — Kadıköy / İstanbul** (`75518d534aa8c0ddd5fb33e759c28430`) | Transient Upstream `503` Resilience Test | `503 Service Unavailable` | `39320.44 ms` | Subsequent `GET /report` remained `404` (`cachePreservedAfterFailure: true`); verified zero partial/corrupt cache writes. |

---

## 5. 10 Pilot Neighborhoods + Bostanlı: 5-Category Scores, Confidence Badges, Diversity & Latencies

| # | Neighborhood (`District / City`) | Overall (`Categories`) | Rent Cost (`Samples · Confidence · Median`) | Social Life (`Samples · Diversity Note`) | Local News (`Samples · Confidence`) | Earthquake (`PGA`) | Transit (`Routes · Confidence`) | Unique Source URLs | `GET /report` 3 Rounds (`ms`) |
|---:|---|---:|---|---|---|---|---|---:|---|
| 1 | **Kötekli** (`Menteşe / Muğla`) | **35** (`5/5`) | **18** (`3 listings · Medium · 23,000 TL` strict 1+1) | **53** (`40 venues · High` · **80% dining/cafe/nightlife monoculture penalty**, `park/sport: 1, culture: 2`) | **44** (`8 articles · High`) | **23** (`0.351 g`) | **35** (`3 routes · Medium`) | `119` | `[21.42, 11.90, 13.16]` (median **`13.16`**) |
| 2 | **Emirbeyazıt** (`Menteşe / Muğla`) | **43** (`5/5`) | **0** (`19 listings · High · 28,080 TL` normalized) | **83** (`133 venues · High` · 6/6 balanced groups) | **53** (`5 articles · Medium`) | **29** (`0.334 g`) | **60** (`7 routes · High`) | `175` | `[16.10, 15.50, 16.14]` (median **`16.10`**) |
| 3 | **Muslihittin** (`Menteşe / Muğla`) | **48** (`5/5`) | **5** (`11 listings · High · 26,650 TL` normalized) | **87** (`105 venues · High` · 6/6 balanced groups) | **61** (`6 articles · Medium`) | **29** (`0.334 g`) | **68** (`3 routes · Medium`) | `127` | `[14.91, 13.27, 13.59]` (median **`13.59`**) |
| 4 | **Orhaniye** (`Menteşe / Muğla`) | **40** (`4/5`) | **0** (`8 listings · High · 32,500 TL` normalized) | **84** (`139 venues · High` · 6/6 balanced groups) | **50** (`3 articles · Limited sample`) | **29** (`0.334 g`) | **`null`** (`0 routes · No data`) | `169` | `[14.60, 15.89, 15.23]` (median **`15.23`**) |
| 5 | **Akyaka** (`Ula / Muğla`) | **39** (`5/5`) | **0** (`9 listings · High · 31,200 TL` normalized) | **71** (`85 venues · High` · 0 culture/arts warning) | **70** (`3 articles · Limited sample`) | **11** (`0.391 g`) | **43** (`3 routes · Medium`) | `117` | `[11.76, 12.91, 14.29]` (median **`12.91`**) |
| 6 | **Caferağa** (`Kadıköy / İstanbul`) | **50** (`5/5`) | **0** (`25 listings · High · 55,000 TL` normalized) | **96** (`151 venues · High` · **16 subtypes, `park/sport: 8, culture: 7`**) | **75** (`4 articles · Medium`) | **8** (`0.401 g`) | **78** (`22 routes · High`, M4, T3, Ferries, İETT) | `188` | `[13.13, 13.03, 13.28]` (median **`13.13`**) |
| 7 | **Bahçelievler** (`Çankaya / Ankara`) | **46** (`5/5`) | **0** (`10 listings · High · 32,175 TL` normalized) | **75** (`63 venues · High` · 6 balanced groups) | **75** (`4 articles · Medium`) | **41** (`0.304 g`) | **62** (`7 routes · High`, EGO lines) | `85` | `[10.52, 10.35, 10.56]` (median **`10.52`**) |
| 8 | **Kültür** (`Konak / İzmir`) | **40** (`5/5`) | **0** (`6 listings · Medium · 42,500 TL` normalized) | **58** (`94 venues · High` · **91% dining/cafe/nightlife monoculture penalty**) | **75** (`4 articles · Medium`) | **17** (`0.368 g`) | **75** (`6 routes · High`, İZDENİZ Ferry, ESHOT) | `110` | `[10.31, 11.36, 11.07]` (median **`11.07`**) |
| 9 | **Yenibağlar** (`Tepebaşı / Eskişehir`) | **58** (`5/5`) | **41** (`8 listings · High · 16,478 TL` normalized) | **70** (`91 venues · High` · 6 balanced groups) | **68** (`4 articles · Medium`) | **56** (`0.271 g`) | **65** (`3 routes · Medium`, ESTRAM T1/T3) | `107` | `[10.80, 10.84, 9.93]` (median **`10.80`**) |
| 10 | **Görükle** (`Nilüfer / Bursa`) | **56** (`5/5`) | **54** (`6 listings · Medium · 13,380 TL` normalized) | **71** (`65 venues · High` · 0 culture/arts warning) | **46** (`4 articles · Medium`) | **25** (`0.344 g`) | **72** (`3 routes · Medium`, BURULAŞ) | `78` | `[9.50, 9.60, 11.64]` (median **`9.60`**) |
| 11 | **Bostanlı** *(Live Generated — `Karşıyaka / İzmir`)* | **47** (`5/5`) | **0** (`7 listings · Medium · 44,460 TL` normalized: `37k–57k` + `83k`) | **79** (`127 venues · High` · 11 subtypes, 6/6 groups) | **75** (`2 articles · Limited sample`) | **17** (`0.370 g`) | **78** (`24 routes · High`, T1 Tram, İZBAN, Ferry, ESHOT) | `54` | `POST 201 MISS: 53862.88` -> `GET 200 HIT: 8.26 / 18.78` |

---

## 6. Acceptance Test Case Matrix (`TC-01..TC-20` & `UI-01..UI-07`)

### 6.1. API & Data Integrity Test Cases (`TC-01..TC-20`)

| ID | Scenario Description | Expected | Observed Evidence | Status |
|---|---|---|---|---|
| **TC-01** | `GET /api/v1/health` health check | `200 OK`, `status: "ok"` | `200 OK` (`database: "sqlite"`, `28.91 ms`) | **PASSED** |
| **TC-02** | `GET /api/v1/places/suggest` Turkish character & partial query autocomplete | Top-5 includes exact pilot match | `Köt -> Kötekli`, `caferaga kadikoy -> Caferağa`, `bostanli -> Bostanlı` (`p50 = 14.79 ms`) | **PASSED** |
| **TC-03** | `GET /api/v1/places/search` valid query | `200 OK`, ranked results list | `q=Kötekli Menteşe` -> `200 OK` (`13.40 ms`) | **PASSED** |
| **TC-04** | `GET /api/v1/places/search` empty or generic query rejection | `400` or `422` | `q="" -> 422`, `q="  " -> 400`, `q="Mahallesi" -> 400` | **PASSED** |
| **TC-05** | `GET /api/v1/places/{id}` metadata for cached report | `report_available: true`, non-null `overall_score` | `Kötekli`: `report_available: true`, `overall_score: 35` (`5.18 ms`) | **PASSED** |
| **TC-06** | `GET /api/v1/places/{id}` side-effect free on uncached place | `report_available: false`, no LLM triggered | `Erzene`: two consecutive `GET` calls both returned `report_available: false` (`2.49 ms`) | **PASSED** |
| **TC-07** | `GET /api/v1/places/{id}/report` returns `404` when uncached | `404 Not Found`, `X-Cache: MISS` | `Bostanlı` (pre-generation) and `Suadiye`: `404 Not Found` (`2.55–4.04 ms`) | **PASSED** |
| **TC-08** | `GET /api/v1/places/{id}/report` cached read across all 10 pilots | `200 OK`, `X-Cache: HIT`, `< 50 ms` | 30/30 requests returned `200 OK` (`X-Cache: HIT`, `p50 = 12.97 ms`, `max = 21.42 ms`) | **PASSED** |
| **TC-09** | `score_summary_version: 5` and deterministic scores across all 5 categories | Integer score `0..100` for every category with evidence | `49/50` pilot categories scored (`Orhaniye` transit is `null` due to `0` transit routes) | **PASSED** |
| **TC-10** | Sample counts and confidence badges (`sample_count`, `confidence_label`) | Accurate sample count and confidence tier per category | `Yüksek güven`, `Orta güven`, `Sınırlı örneklem`, and `Veri yok` verified across all 10 pilots | **PASSED** |
| **TC-11** | Multi-room normalized rent + market rent benchmarks (`rent_benchmarks`) | Normalizes all room types to 1+1 equivalent when `< 3` strict 1+1 exist | Verified on `Caferağa (25 listings)`, `Emirbeyazıt (19 listings)`, `Bahçelievler (10 listings)`, `Bostanlı (7 listings)` | **PASSED** |
| **TC-12** | Multi-listing portal extraction (`_extract_portal_rents`) | Extracts multiple price-room pairs from a single portal summary snippet | Extracted `37,000 TL (2+1)` and `40,000 TL (3+1)` alongside existing listings for `Bostanlı` (7 total listings) | **PASSED** |
| **TC-13** | Social life diversity & monoculture penalty (`social_diversity`) | `-14` penalty + warning when `>= 75%` dining/cafe/nightlife and low park/culture | `Kötekli (80% -> 53/100)` and `Kültür (91% -> 58/100)` flagged; `Caferağa (96/100)` rewarded for 16 balanced subtypes | **PASSED** |
| **TC-14** | OSM 0.6 Map API (`_osm_map_data`) coordinate venues & transit routes | Coordinate-mapped venues + `<relation type="route">` transit lines | `Caferağa: 151 venues, 22 routes`; `Bostanlı: 127 venues, 24 routes`; `Kültür: 94 venues, 6 routes` | **PASSED** |
| **TC-15** | Verifiability of source links (`sources` & `detailed_evidence`) | Every source URL starts with `http://` or `https://` | `1275` unique valid URLs across the 10 pilots, `0` invalid URLs | **PASSED** |
| **TC-16** | `with_score_summary` idempotency (zero evidence loss on repeat reads) | Consecutive `GET /report` reads preserve `detailed_evidence` and scores | Identical scores, sample counts, and evidence arrays across 3 rounds × 10 pilots (`30` reads) | **PASSED** |
| **TC-17** | Side-by-side comparison (`ComparisonView` / `buildComparisonModel`) | 5-category scores, deltas, winners, and sample badges for 2 places | Verified across 4 pairs (`42.16–54.95 ms`) with accurate category winners and sample badges | **PASSED** |
| **TC-18** | Live new report generation (`POST /api/v1/places/{id}/report`) | `201 Created`, `X-Cache: MISS`, phase tracking, followed by `GET 200 HIT` | `Bostanlı`: `201 MISS` (`53862.88 ms`) -> `GET 200 HIT` (`8.26 ms`, `6520.93x` speedup) | **PASSED** |
| **TC-19** | Cache preservation after live generation `503` failure | `GET /report` remains `404` after failed `POST` | `Bostanlı` (Attempt 1) and `Suadiye` returned `404` after `503` (`cachePreservedAfterFailure: true`) | **PASSED** |
| **TC-20** | SHA-256 integrity of protected data files (`data/manifest.json`) | Zero checksum mismatches across protected files | `pilot_neighborhoods.json`, `issue32/*`, `scoring_research/reports.json` all verified `OK` | **PASSED** |

### 6.2. Browser E2E Verification Matrix (`UI-01..UI-07`)

Verified against the live frontend (`http://127.0.0.1:5185`) in a real browser session (host-verified via `BROWSER_HOST_FACTS`: `visited_origins: http://127.0.0.1:5185`, `blocked_origins: none`):

| ID | UI Check | Verified Routes | Observed Evidence | Status |
|---|---|---|---|---|
| **UI-01** | Home page search & autocomplete (`SearchBar`) | `/` -> `/mahalle/<id>` | Selecting an autocomplete suggestion navigates directly to the neighborhood report | **PASSED** |
| **UI-02** | 5 category cards displaying numeric scores (`XX/100`) & confidence badges (`.answer-confidence`) | `/mahalle/e16d2a441a64d97c788c95692e29cfc1` (`Kötekli`), `/mahalle/371ae22fba5e19084679a751055b7bef` (`Caferağa`), `/mahalle/82171aa4bb0aa0a85ca5fecd7c1fc0db` (`Bostanlı`) | All 5 cards render integer scores and sample/confidence pills (`3 ilan · Orta güven`, `40 mekân · Yüksek güven`, etc.) | **PASSED** |
| **UI-03** | Social life diversity / monoculture warning box (`.reading-diversity-box`) on card & dialog | `Kötekli`, `Caferağa`, `Görükle`, `Bostanlı` | `Kötekli` displays the `80%` monoculture concentration warning and 6-group breakdown chips (`Yeme-içme 13`, `Kafe & tatlı 12`, `Pub & gece 7`, `Kültür & sanat 2`, `Park & spor 1`, `Günlük yaşam 5`) | **PASSED** |
| **UI-04** | Leaflet OSM interactive venue map (`VenueMap.jsx`) & category filters in Social Life dialog | `Kötekli`, `Caferağa`, `Bostanlı` | Coordinate markers render on the OSM map; dialog-close `_leaflet_pos` animation race fixed via `zoomAnimation: false` + `instance.stop()` | **PASSED** |
| **UI-05** | Multi-room tabs (`1+1`, `2+1`, `3+1`) & `Piyasa Kira Endeksi` in Rent Cost dialog | `Caferağa`, `Bahçelievler`, `Bostanlı` | `Bostanlı` renders all 7 listings (`37,000 TL – 57,000 TL` and `83,000 TL`) grouped by room tabs with clickable source links | **PASSED** |
| **UI-06** | Side-by-side comparison view (`/karsilastir`) & sample badges (`.comp-cat-sample`) | `/karsilastir?left=e16d2a441a64d97c788c95692e29cfc1&right=371ae22fba5e19084679a751055b7bef` | `Kötekli (35) vs Caferağa (50)` displays score bars, delta tags, and sample/confidence badges across all 5 categories | **PASSED** |
| **UI-07** | Responsive layout (Desktop `1280×800` & Mobile `390×844`) & network cleanliness | All tested routes | Zero horizontal overflow (`scrollWidth <= clientWidth`), `0` HTTP `>= 400` responses | **PASSED** |

---

## 7. Reproducible Verification Commands

```powershell
# 1. Backend unit and integration test suite (144 tests)
Set-Location backend
python -X utf8 -m pytest -q -p no:cacheprovider

# 2. Frontend scoring, navigation, and production build checks
Set-Location ..
node frontend/scripts/test-scoring.mjs
node frontend/scripts/test-navigation.mjs
npm --prefix frontend run build

# 3. End-to-end #33 and #35 acceptance & benchmark scripts (with backend running on port 18035)
$env:API_BASE_URL = "http://127.0.0.1:18035/api/v1"
node frontend/scripts/test-issue33-flow.mjs
node frontend/scripts/test-issue35-acceptance.mjs --rounds=3
```
