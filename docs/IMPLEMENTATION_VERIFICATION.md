# MahallEN — Uygulama Doğrulama ve Kanıt Raporu (Issue #24)

- **Proje:** MahallEN — Team Axiom (SE3003)
- **İlgili Görev:** [#24 — Verify current implementation and record evidence](https://github.com/axiom-digital/mahallEN/issues/24)
- **Doğrulayan:** Irmak Köse
- **Tarih:** 29 Ekim 2026
- **İncelenen Ana Dal Durumu:** `main` (`f2a8739` — PR #26, #27, #28, #29 ve #30 birleştirilmiş hâli)

Bu belge, proje panosundaki **#7**, **#8**, **#9**, **#10** ve **#11** numaralı görevlerin mevcut kod tabanındaki durumunu; çalışan özellikleri (**What Works**), somut dosya/test kanıtlarını (**Evidence Links**) ve kalan açık işleri (**Remaining Tasks**) şeffaf biçimde kayıt altına alır.

---

## 1. Genel Doğrulama Özeti Tablosu

| Görev (Issue) | İlgili PR / Merge Commit | Mevcut Durum | Doğrulama Sonucu ve Özet |
| :--- | :--- | :--- | :--- |
| **[#7 — Create static JSON dataset for Mugla](https://github.com/axiom-digital/mahallEN/issues/7)** | [PR #27](https://github.com/axiom-digital/mahallEN/pull/27) (`f87190e` / `69ac388`) | İlk statik sürüm tamamlandı; canlı DB entegrasyonu açık | 5 pilot mahalle (`kotekli`, `emirbeyazit`, `muslihittin`, `orhaniye`, `akyaka`) için kaynak bağlantılı JSON dosyaları, SHA-256 manifesti ve eksik değer politikası doğrulandı (`test_static_dataset.py` — 4/4 geçti). |
| **[#8 — Analyze survey results & weights](https://github.com/axiom-digital/mahallEN/issues/8)** | [PR #26](https://github.com/axiom-digital/mahallEN/pull/26) (`3a8b6a8` / `549c33a`) | Analiz ve ağırlık kararı tamamlandı; backend formül entegrasyonu açık | 25 yanıtlık anket analizi ve ekip ağırlık kararı (%32 Maliyet, %28 Sosyal Yaşam, %20 Güvenlik/Haberler, %10 Afet, %10 Ulaşım) belgelendi ve `frontend/src/scoring.mjs` içinde doğrulandı (`test-scoring.mjs` geçti). |
| **[#9 — Design LLM prompt & API integration](https://github.com/axiom-digital/mahallEN/issues/9)** | [PR #28](https://github.com/axiom-digital/mahallEN/pull/28) (`29695f1` / `634560d`) | Araştırma istemcisi ve sürümlü promptlar tamamlandı; canlı API sentezi ayrı | `google-genai` SDK (`gemini-2.5-flash` + `google_search`) araştırma istemcisi, sürümlenmiş promptlar ve kaynak doğrulama kuralları doğrulandı (`test_grounding_client.py` — 12/12 geçti). |
| **[#10 — Develop frontend UI & score charts](https://github.com/axiom-digital/mahallEN/issues/10)** | [PR #30](https://github.com/axiom-digital/mahallEN/pull/30) (`f2a8739` / `cc08f3b`) | İlk çalışan şablon arayüzü ve yatay puan grafikleri tamamlandı | “Yaşayacağın yeri önce tanı” girişi, krem/koyu yeşil/kiremit paleti, arama/ilçe/profil filtreleri, rapor ekranı ve 5 kategorili yatay çubuk grafikler (`ScoreBarChart`) ile eksik verinin `0` sayılmaması doğrulandı (`vite build` ve `test-scoring.mjs` geçti). |
| **[#11 — Build backend API & caching system](https://github.com/axiom-digital/mahallEN/issues/11)** | [PR #29](https://github.com/axiom-digital/mahallEN/pull/29) (`01f21f4` / `9b94f08`) | Kalıcı `ReportCache` ve `X-Cache` mekanizması tamamlandı; statik veri aktarımı açık | `ReportCache` SQLAlchemy modeli, TTL ve hit sayacı destekli `cache_service.py`, `X-Cache: HIT/MISS` başlıkları ve operatör korumalı `DELETE /api/v1/neighborhoods/{slug}/cache` uç noktası doğrulandı (`test_caching.py` — 10/10 geçti). |

---

## 2. Görev Bazlı İnceleme (What Works / Evidence / Remaining Tasks)

### 2.1. Issue #7 — Create static JSON dataset for Mugla (PR #27 · `f87190e`)

- **Çalışan Özellikler (What Works):**
  - Muğla pilot kapsamındaki 5 mahalle (`kotekli`, `emirbeyazit`, `muslihittin`, `orhaniye`, `akyaka`) için tek tip şemada (`schema_version: "1.0.0"`) kaynak bağlantılı statik JSON kayıtları oluşturuldu.
  - Her kayıt için SHA-256 bütünlük özeti, gözlem sayıları, OSM durumu ve PGA değeri `data/manifest.json` içinde tutuluyor.
  - Eksik değer politikası (`missing_value_policy`) uygulanıyor: bilinmeyen değerler `0` veya başka mahalleden kopyalanmış veri yerine `null` ve açıklamasıyla saklanıyor; tarihsiz veya 90 günden eski kira ilanları `eligible_for_current_comparison: false` अथवा `excluded_observations` altında ayrılıyor.
- **Kanıt Linkleri (Evidence Links):**
  - Veri manifesti ve sözlüğü: [`data/manifest.json`](../data/manifest.json), [`data/README.md`](../data/README.md), [`docs/DATA_SOURCES.md`](../docs/DATA_SOURCES.md)
  - Mahalle veri dosyaları: [`data/neighborhoods/kotekli.json`](../data/neighborhoods/kotekli.json), [`data/neighborhoods/emirbeyazit.json`](../data/neighborhoods/emirbeyazit.json), [`data/neighborhoods/muslihittin.json`](../data/neighborhoods/muslihittin.json), [`data/neighborhoods/orhaniye.json`](../data/neighborhoods/orhaniye.json), [`data/neighborhoods/akyaka.json`](../data/neighborhoods/akyaka.json)
  - Üretim ve doğrulama scriptleri/testleri: [`backend/scripts/build_static_dataset.py`](../backend/scripts/build_static_dataset.py), [`backend/tests/test_static_dataset.py`](../backend/tests/test_static_dataset.py), [`backend/tests/test_data_collection.py`](../backend/tests/test_data_collection.py)
- **Kalan İşler (Remaining Tasks):**
  - Canlı FastAPI veritabanı başlangıcı ([`backend/app/services/seed_service.py`](../backend/app/services/seed_service.py)) halen M1 örnek (illustrative seed) verilerini yüklüyor; `data/neighborhoods/*.json` içindeki statik kayıtların doğrudan backend veritabanı/API katmanına aktarılması henüz tamamlanmadı.
  - `emirbeyazit`, `muslihittin` ve `akyaka` kayıtlarında Overpass API zaman aşımı nedeniyle `osm_status: "unavailable"` durumundadır (yalnızca `kotekli` ve `orhaniye` için OSM anlık görüntüsü mevcuttur).
  - Deprem PGA değerleri TÜBİTAK Aperta 274290 araştırma veri setinden alınmıştır; resmî AFAD TDTH entegrasyonu veya bina bazlı dayanıklılık ölçümü değildir.
  - Arama destekli kira, haber ve ulaşım bulgularının olgusal kaynak kontrolü (`factual_review_status: "source_check_pending"`) insan incelemesi beklemektedir.

---

### 2.2. Issue #8 — Analyze survey results & weights (PR #26 · `3a8b6a8`)

- **Çalışan Özellikler (What Works):**
  - 25 katılımcılı öğrenci doğrulama anketinin 4 soruluk dağılımı, bilgi boşlukları ve kullanım niyeti (%80 olumlu) analiz edilerek belgelendi.
  - Ekip kararıyla genel yaşanabilirlik ağırlıkları **%32 Maliyet (`cost_affordability`)**, **%28 Sosyal Yaşam (`social_life`)**, **%20 Güvenlik/Haberler (`safety`)**, **%10 Afet (`disaster_resilience`)** ve **%10 Ulaşım (`transportation`)** olarak belirlendi:
    $$L = 0.32 \times C + 0.28 \times M + 0.20 \times S + 0.10 \times D + 0.10 \times T$$
  - Bu ağırlıklar ve eksik kategori verisinin ağırlıklı ortalamayı yapay olarak şişirmemesi kuralı [`frontend/src/scoring.mjs`](../frontend/src/scoring.mjs) (`agreedWeights`, `profiles`, `weightedScore`) içinde kodlandı ve birim testlerle doğrulandı.
- **Kanıt Linkleri (Evidence Links):**
  - Anket analizi ve kanıt ekran görüntüsü: [`docs/survey/survey-analysis.md`](survey/survey-analysis.md), [`docs/survey/survey-results.png`](survey/survey-results.png)
  - Puanlama modülü ve testleri: [`frontend/src/scoring.mjs`](../frontend/src/scoring.mjs), [`frontend/scripts/test-scoring.mjs`](../frontend/scripts/test-scoring.mjs), [`backend/tests/test_preview_scoring.py`](../backend/tests/test_preview_scoring.py)
- **Kalan İşler (Remaining Tasks):**
  - Backend puanlama servisi ([`backend/app/services/scoring_service.py`](../backend/app/services/scoring_service.py)) halen 4 kategori üzerinden eşit %25 ağırlık (`SCORE_WEIGHTS`) kullanmaktadır.
  - Backend rapor şemasında ([`backend/app/schemas/neighborhood.py`](../backend/app/schemas/neighborhood.py)) henüz bağımsız bir sayısal `social_life` skoru üretilmemektedir; `#8` ağırlık formülünün backend servisine tam entegrasyonu açık iştir.

---

### 2.3. Issue #9 — Design LLM prompt & API integration (PR #28 · `29695f1`)

- **Çalışan Özellikler (What Works):**
  - Desteklenen `google-genai` SDK ve `gemini-2.5-flash` modeli üzerinden Google Search grounding (`tools=[{"google_search": {}}]`) kullanan istemci ([`backend/scripts/grounding_client.py`](../backend/scripts/grounding_client.py)) ve komut satırı aracı ([`backend/scripts/try_grounding.py`](../backend/scripts/try_grounding.py)) geliştirildi.
  - 5 mahalle için sürümlenmiş araştırma promptları (`docs/prompts/*_grounding_v*.md`) ve rapor sentez promptu (`docs/prompts/report_synthesis_v1.md`) hazırlandı.
  - Çıktı doğrulama, kaynak URL kontrolü, zaman aşımı ve hata yakalama kuralları 12 birim testiyle (`backend/tests/test_grounding_client.py`) doğrulandı; ayrıca kaydedilmiş duman testi (`data/research/integration_smoke_2026-10-28/result.json`) ve mahalle araştırma çıktıları (`data/research/*/result.json`) arşivlendi.
  - Normal API okumalarında ücretli Gemini çağrısı yapılmaması, canlı yenilemenin (`?refresh_ai=true`) en az 32 karakterlik `X-AI-Refresh-Token` ve 60 saniyelik bekleme süresiyle korunması [`backend/tests/test_api.py`](../backend/tests/test_api.py) ile doğrulandı.
- **Kanıt Linkleri (Evidence Links):**
  - Entegrasyon dokümanı ve promptlar: [`docs/LLM_INTEGRATION.md`](LLM_INTEGRATION.md), [`docs/prompts/`](prompts/)
  - İstemci kodu ve testler: [`backend/scripts/grounding_client.py`](../backend/scripts/grounding_client.py), [`backend/scripts/try_grounding.py`](../backend/scripts/try_grounding.py), [`backend/tests/test_grounding_client.py`](../backend/tests/test_grounding_client.py)
  - Araştırma arşivi: [`data/research/README.md`](../data/research/README.md), [`data/research/integration_smoke_2026-10-28/result.json`](../data/research/integration_smoke_2026-10-28/result.json)
- **Kalan İşler (Remaining Tasks):**
  - `grounding_client.py` kontrollü çevrimdışı araştırma scripti olarak çalışmaktadır; canlı FastAPI rapor uç noktasındaki ([`backend/app/services/ai_service.py`](../backend/app/services/ai_service.py)) M1 demo sentez katmanının doğrudan `#7` statik veri seti ve `#9` kaynaklı sentez çıktılarıyla birleştirilmesi ayrı bir entegrasyon adımıdır.

---

### 2.4. Issue #10 — Develop frontend UI & score charts (PR #30 · `f2a8739`)

- **Çalışan Özellikler (What Works):**
  - Ekipçe seçilen yeni arayüz şablonu; `/assets/mugla-temsili.png` fotoğraflı giriş alanı, **“Yaşayacağın yeri önce tanı.”** başlığı, hızlı mahalle önerileri ve mahalle kart görselleriyle (`frontend/public/assets/`) React uygulamasına uyarlandı.
  - Krem (`#f7f5ed`), yumuşak krem (`#eeeee3`), koyu yeşil (`#183e32`), zeytin (`#496a44`, `#dce6bd`) ve kiremit (`#ac4b2c`) renk paleti tüm bileşenlere uygulandı; mor renk kullanımı tamamen kaldırıldı.
  - Mahalle arama (`q`), ilçe filtreleme (`Tüm mahalleler`, `Menteşe`, `Ula`), yaşam profili seçimi (`Genel bakış`, `Öğrenciyim`, `Ailemle yaşıyorum`, `Çalışıyorum`) ve mahalle sıralama paneli mevcut backend API uç noktalarıyla (`GET /api/v1/neighborhoods` ve `GET /api/v1/neighborhoods/{slug}/report`) dinamik olarak çalışıyor.
  - Rapor ekranında genel puan belirgin biçimde gösteriliyor; **Maliyet**, **Sosyal yaşam**, **Güvenlik / haberler**, **Afet** ve **Ulaşım** kategorileri 0–100 ölçeğinde yatay çubuk grafiklerle (`ScoreBarChart`) sunuluyor.
  - Eksik veri politikası gereği `normalizeScoreValue` ve `extractCategoryScores` fonksiyonları `null`/`undefined` değerleri kesinlikle `0` puana dönüştürmüyor; backend'de henüz sayısal karşılığı bulunmayan kategori çubukları `"Veri bekleniyor"` (`—`) olarak işaretleniyor.
  - Masaüstü, tablet ve mobil (`<=760px`, `<=430px`) kırılımları ile **Yükleniyor**, **Boş sonuç** (arama eşleşmediğinde raporun temizlenmesi ve sıfırlama aksiyonu) ve **Hata** (tekrar dene butonu) durumları hazırlandı.
- **Kanıt Linkleri (Evidence Links):**
  - Arayüz bileşenleri ve stiller: [`frontend/src/App.jsx`](../frontend/src/App.jsx), [`frontend/src/components/ReportDashboard.jsx`](../frontend/src/components/ReportDashboard.jsx), [`frontend/src/components/ScoreCard.jsx`](../frontend/src/components/ScoreCard.jsx), [`frontend/src/index.css`](../frontend/src/index.css), [`frontend/index.html`](../frontend/index.html)
  - Puan normalizasyonu ve birim testleri: [`frontend/src/scoring.mjs`](../frontend/src/scoring.mjs), [`frontend/scripts/test-scoring.mjs`](../frontend/scripts/test-scoring.mjs)
- **Kalan İşler (Remaining Tasks):**
  - Backend `/api/v1/neighborhoods/{slug}/report` yanıtındaki `scores` nesnesi henüz sayısal `social_life` alanı döndürmediği için yatay çubuk grafikte `Sosyal yaşam` satırı `"Veri bekleniyor"` (`—`) durumunu göstermektedir; backend'e bu skor eklendiğinde grafik otomatik olarak çubuk dolgusunu çizecektir.
  - Mahalle karşılaştırma ekranının canlı backend verileriyle kapsamı ve kaynaklı Kötekli ön izleme bileşeninin (`NeighborhoodPreview.jsx`) ana rapor akışıyla birleştirilmesi sonraki adımlarda netleştirilecektir.

---

### 2.5. Issue #11 — Build backend API & caching system (PR #29 · `01f21f4`)

- **Çalışan Özellikler (What Works):**
  - SQLAlchemy tabanlı kalıcı [`ReportCache`](../backend/app/models/report_cache.py) tablosu (`neighborhood_slug`, `report_json`, `model_version`, `hit_count`, `created_at`, `expires_at`) oluşturuldu.
  - [`backend/app/services/cache_service.py`](../backend/app/services/cache_service.py) içinde TTL kontrolü, süresi dolan kayıtların otomatik silinmesi, `hit_count` artırımı (`get_cached_report`), önbellek yazma/güncelleme (`set_cached_report`) ve tekil mahalle önbelleği temizleme (`invalidate_cached_report`) işlevleri tamamlandı.
  - `GET /api/v1/neighborhoods/{slug}/report` uç noktası ilk okumada `X-Cache: MISS` (`X-Cache-Hits: 0`), sonraki okumalarda `X-Cache: HIT` (`X-Cache-Hits: 1, 2, ...`) başlıklarını döndürüyor; CORS `expose_headers` listesinde bu başlıklar açık.
  - Operatör token korumalı (`X-AI-Refresh-Token`) `DELETE /api/v1/neighborhoods/{slug}/cache` uç noktası önbelleği geçersiz kılıyor.
- **Kanıt Linkleri (Evidence Links):**
  - Model, servis ve API rotası: [`backend/app/models/report_cache.py`](../backend/app/models/report_cache.py), [`backend/app/services/cache_service.py`](../backend/app/services/cache_service.py), [`backend/app/api/routes/neighborhoods.py`](../backend/app/api/routes/neighborhoods.py), [`backend/app/core/config.py`](../backend/app/core/config.py)
  - Otomatik önbellek testleri: [`backend/tests/test_caching.py`](../backend/tests/test_caching.py)
- **Kalan İşler (Remaining Tasks):**
  - Önbelleklenen rapor yükü şu anda `seed_service.py` ve `ai_service.py` tarafından üretilen M1 demo verisidir; `#7` statik JSON veri setinin ve `#8` ağırlıklarının canlı rapor/cache şemasına bağlanması açık iştir.
  - Canlı AI yenileme hız sınırlayıcısı (`ai_refresh_lock` / 60 sn) süreç içi (`per-process`) bellekte tutulmaktadır; çoklu worker dağıtımı öncesinde paylaşımlı (shared) hız sınırlayıcı gereklidir.

---

## 3. Yerel Doğrulama ve Kanıt Kaydı (29 Ekim 2026)

Aşağıdaki kontroller **hiçbir ücretli dış API (Gemini vb.) çağrısı yapılmadan** yerel ortamda çalıştırılmış ve doğrulanmıştır:

| Kontrol Kalemi | Çalıştırılan Komut | Sonuç | Kanıt Özeti |
| :--- | :--- | :--- | :--- |
| **Backend Tüm Test Paketi** | `python -m pytest -v -p no:cacheprovider` | **GEÇTİ (55/55)** | `test_api.py` (24), `test_caching.py` (10), `test_grounding_client.py` (12), `test_static_dataset.py` (4), `test_preview_scoring.py` (3), `test_data_collection.py` (2) — 3.30 sn içinde 0 hata ile geçti. |
| **Statik Veri Seti & SHA-256 Bütünlüğü** | `python -m pytest -q backend/tests/test_static_dataset.py` | **GEÇTİ (4/4)** | `data/manifest.json` içindeki 5 mahalle dosyasının varlığı, SHA-256 eşleşmesi, kaynak URL'leri, 90 gün kira filtresi ve eksik değer (`null`) politikası doğrulandı. |
| **Frontend Puanlama & Eksik Veri Testi** | `node frontend/scripts/test-scoring.mjs` | **GEÇTİ** | `#8` ağırlıkları (`%32/%28/%20/%10/%10`), bütçe sınırları, deprem yönü ve `#10` kategori normalizasyonu (`null` değerin `0` sayılmaması) doğrulandı. |
| **Frontend Üretim Derlemesi (Build)** | `npm --prefix frontend run build` | **GEÇTİ** | `sync-preview-data.mjs` + `vite build` (v6.4.5): `1568 modules transformed`, `dist/index.html`, CSS ve JS paketleri hatasız üretildi. |
| **Çalışma Zamanı API, Arama, Profil & Cache HIT/MISS Kanıtı** | FastAPI `TestClient` (`sqlite://` izole bellek içi DB) | **GEÇTİ** | `GET /api/v1/health` (`200 OK`), Türkçe arama `q=KÖTEKLİ` (`["kotekli"]`), boş arama (`[]`), öğrenci profil sıralaması (`kotekli: 96` -> `akyaka: 65`) ve `X-Cache: MISS -> HIT -> DELETE -> MISS` döngüsü doğrulandı. |

### Çalışma Zamanı API ve Cache Doğrulama Çıktısı

```json
{
  "health_status": 200,
  "health_body": {
    "status": "ok",
    "project": "MahallEN - AI-Powered Neighborhood Livability Report",
    "team": "Axiom (SE3003)",
    "database_backend": "sqlite",
    "llm_provider": "Demo synthesis (sample data)",
    "data_mode": "demo",
    "pilot_region": "Muğla (Menteşe & Ula)"
  },
  "all_slugs": ["muslihittin", "emirbeyazit", "orhaniye", "kotekli", "akyaka"],
  "search_kotekli": ["kotekli"],
  "search_empty": [],
  "student_order": [
    ["kotekli", 96],
    ["muslihittin", 83],
    ["orhaniye", 81],
    ["emirbeyazit", 78],
    ["akyaka", 65]
  ],
  "report_1_cache": {
    "X-Cache": "MISS",
    "X-Cache-Hits": "0"
  },
  "report_2_cache": {
    "X-Cache": "HIT",
    "X-Cache-Hits": "1"
  },
  "cache_delete": {
    "slug": "kotekli",
    "cache_invalidated": true
  },
  "report_3_after_delete": {
    "X-Cache": "MISS",
    "X-Cache-Hits": "0"
  },
  "kotekli_scores": {
    "overall_livability": 74,
    "safety": 72,
    "transportation": 90,
    "cost_affordability": 62,
    "disaster_resilience": 74
  }
}
```
