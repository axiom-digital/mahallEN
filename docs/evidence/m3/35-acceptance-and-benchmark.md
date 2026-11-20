# M3 Kanıtı — #35: Arama -> Rapor -> Kaynak -> Karşılaştırma Kabul Testi, 5-Kategori Puanlama ve Yanıt Süresi Benchmarkı

- **Görev / Issue:** `#35 — [Kabul Testi] Arama -> Rapor -> Kaynak -> Karşılaştırma akışını ve yanıt sürelerini doğrula`
- **Sahipler:** Irmak + Ferdi
- **Milestone:** `M3 — Entegrasyon, Doğrulama ve Sunum`
- **Dal (Branch):** `test_search_report_flow`
- **Doğrulama Tarihi:** 2026-04-20

---

## 1. Yönetici Özeti ve Kabul Kararı

Bu çalışmada MahallEN platformunun uçtan uca `Arama -> Rapor -> Kaynak -> Karşılaştırma` kullanıcı akışı, **5 kategorili deterministik kural puanlama motoru (`rules-v2`, `score_summary_version: 5`)**, **OpenStreetMap 0.6 Map API (`ODbL-1.0`) tabanlı çok-şehirli coğrafi/ulaşım zenginleştirmesi**, **sosyal yaşam çeşitlilik & tek-tiplik (monokültür) analizi** ve **hazır rapor açılışı (`200 HIT`) ile canlı yeni rapor üretimi (`201 MISS`) yanıt süreleri** gerçek çalışma ortamında uçtan uca doğrulanmıştır.

| Kriter Grubu | Durum | Özet Kanıt |
|---|---|---|
| **Hazır (Ön-üretilmiş) Rapor Açılış Süresi (`GET /api/v1/places/{id}/report`)** | **GEÇTİ** | 10 pilot × 3 tur (`30` okuma): **`min = 9.50 ms`**, **`p50 = 12.97 ms`**, **`mean = 12.89 ms`**, **`p95 = 16.12 ms`**, **`max = 21.42 ms`** (`X-Cache: HIT`). |
| **Canlı Yeni Rapor Üretim Süresi (`POST /api/v1/places/{id}/report`)** | **GEÇTİ** | `Bostanlı (Karşıyaka / İzmir)` için sıfırdan Tavily + Gemini (`gemini-3.5-flash-lite`) üretimi: **`201 Created` (`X-Cache: MISS`) = `53862.88 ms` (`53.86 sn`)**; hemen ardından önbellekten tekrar açılış **`200 OK` (`X-Cache: HIT`) = `8.26 ms` (`6520.93x` hızlanma)**. |
| **Yan Yana Karşılaştırma Akışı (`/karsilastir`)** | **GEÇTİ** | 4 farklı mahalle çifti (paralel `suggest` + `2× report HIT`): **`min = 42.16 ms`**, **`p50 = 45.92 ms`**, **`mean = 47.24 ms`**, **`p95 = 53.94 ms`**, **`max = 54.95 ms`**. |
| **5 Kategori Deterministik Puanlama (`rules-v2`) ve Örneklem Güven Rozetleri** | **GEÇTİ** | `rent_cost`, `social_life`, `safety_news`, `earthquake_hazard`, `transportation` kategorilerinin tamamı kanıt varsa `0..100` arası deterministik puanlanır; her kartta örneklem sayısı ve güven rozeti (`Yüksek güven`, `Orta güven`, `Sınırlı örneklem`) gösterilir. |
| **Sosyal Yaşam Çeşitlilik & Tek-Tiplik (Monokültür) Analizi** | **GEÇTİ** | Salt mekân adedi yerine 6 ana grup derinliği, alt-tür çeşitliliği, Shannon entropi dengesi ve `%75+` yeme-içme/kafe/gece yoğunlaşması cezası (`-14` puan) uygulanır (`Kötekli: 53/100` tek-tip uyarılı vs `Caferağa: 96/100` dengeli 16 alt-tür). |
| **Kaynak Doğrulanabilirliği ve Şema Bütünlüğü** | **GEÇTİ** | 10 pilotta toplam **`1275` tekil `http/https` kaynak bağlantısı**, `0` kırık/boş URL, `0` şema hatası (`data/manifest.json` SHA-256 doğrulaması eksiksiz). |
| **Otomatik Test & Derleme Paketi** | **GEÇTİ** | Backend `pytest`: **`144 passed` (`5.96 sn`)**, Frontend `test-scoring.mjs`, `test-navigation.mjs`, `test-issue33-flow.mjs`, `test-issue35-acceptance.mjs` (**`16/16 check passed`**) ve `vite build` (**`2.65 sn`**) hatasız tamamlandı. |

---

## 2. Test Ortamı ve İzolasyon

- **İşletim Sistemi:** Windows (`PowerShell`)
- **Backend Sunucusu:** FastAPI / Uvicorn (`http://127.0.0.1:18035`, `GEMINI_REPORT_MODEL=gemini-3.5-flash-lite`, `REPORT_CACHE_ENABLED=true`, `REPORT_CACHE_TTL_SECONDS=2592000`)
- **Frontend Sunucusu:** Vite / React 19 (`http://127.0.0.1:5185`, `VITE_API_BASE_URL=http://127.0.0.1:18035/api/v1`)
- **Veritabanı İzolasyonu:** Çalışma ağacını (worktree) kirletmemek için izole SQLite veritabanı (`issue35_bench.db`) kullanılmıştır.
- **Korunan Veri Dosyaları (`data/manifest.json`):** `data/pilot_neighborhoods.json`, `data/issue32/*` ve `data/scoring_research/reports.json` dosyalarının SHA-256 özetleri korunmuş; çok-şehirli zenginleştirilmiş veriler ayrı `data/scoring_research/multicity_enriched.json` dosyasında tutulmuştur.

---

## 3. Mimari İyileştirmeler: 5-Kategori Puanlama (`rules-v2`), OSM 0.6 Coğrafi Motor ve Çeşitlilik Analizi

### 3.1. 5 Kategorinin Tamamında Deterministik Puanlama (`backend/app/services/rule_scoring.py`, `report_quality.py`)
1. **Maliyet (`rent_cost`):**
   - En az `3` adet tarihli `1+1` ilan bulunduğunda doğrudan `1+1` medyan kira kullanılır (`rent_mode: "strict_1plus1"`).
   - Tarihli `1+1` ilan sayısı `< 3` olduğunda, tüm oda tiplerindeki (`1+0`, `1+1`, `2+1`, `3+1`, `4+1`) ilanlar `ROOM_FACTORS` katsayılarıyla (`2+1 -> 0.78`, `3+1 -> 0.62`, `1+0 -> 1.18` vb.) `1+1` eşdeğerine normalize edilir ve varsa bölgesel kira endeksi (`rent_benchmarks`) ile birleştirilir (`rent_mode: "multi_room_normalized"`).
   - Emlak portalı özet sayfalarında (`emlakjet.com`, `hepsiemlak.com`, `sahibinden.com`) birden fazla ilan satırı geçtiğinde `research_facts.py` içindeki deterministik `_extract_portal_rents()` ayrıştırıcısı tek bir lüks/uç ilana takılmak yerine sayfadaki tüm kira+oda çiftlerini (`7` ilana kadar) çıkarır.
2. **Sosyal Yaşam (`social_life`) — Çeşitlilik ve Tek-Tiplik (Monokültür) Modeli:**
   - Mekânlar 6 ana gruba ayrılır: `yeme_icme`, `kafe_tatli`, `gece_hayati`, `kultur_sanat`, `park_spor`, `gunluk_yasam`.
   - Puan bileşenleri:
     - **6 grup derinliği (`0..48` puan):** Her gruptaki azalan getirili derinlik (`yeme_icme`, `kafe_tatli`, `park_spor`, `gunluk_yasam` maks `9`'ar puan; `kultur_sanat` ve `gece_hayati` maks `6`'şar puan).
     - **Mutfak/stil çeşitliliği (`0..8` puan)** ve **alt-tür (`subtype`) çeşitliliği (`0..18` puan, `min(18, unique_subtypes * 1.5)`)**.
     - **Shannon entropi dağılım dengesi (`0..16` puan):** Mekânların 6 gruba ne kadar dengeli dağıldığını ölçer.
     - **Kamusal alan & kültür derinliği (`0..10` puan):** `park_spor + kultur_sanat` toplamına göre verilir.
     - **Tek-tip yoğunlaşma (monokültür) cezası (`-14` veya `-10` puan):** Mekânların **`>= %75`'i** (veya `>= %68`'i) yalnızca yeme-içme/kafe/pub üçlüsüne sıkışmışsa ve `park_spor + kultur_sanat <= 4` ise otomatik ceza uygulanır ve arayüzde açık uyarı gösterilir.
     - **Kültür/sanat eksikliği cezası (`-6` puan):** `>= 15` mekân olup `kultur_sanat == 0` olan mahallelerde uygulanır.
3. **Yerel Gündem (`safety_news`):**
   - Tarihli yerel haber kayıtlarının konu ağırlıklarına (`asayiş`, `kaza`, `altyapı`, `belediye/kültür`) göre `0..100` arası deterministik puan üretilir.
4. **Deprem Verisi (`earthquake_hazard`):**
   - AFAD TDTH `PGA (475 yıl, g)` yer ivmesi değerinden deterministik olarak hesaplanır (`round((0.43 - pga) * 320)`).
5. **Ulaşım (`transportation`):**
   - `route_indicator = min(78, round(sqrt(len(routes)) * 18) + rail_bonus)` formülüyle hat sayısını ve raylı/deniz ulaşımı (`metro`, `tramvay`, `vapur`, `banliyö`, `İZBAN`, `M4`, `T1`, `T3` -> `+20` bonus) birlikte değerlendirir.

### 3.2. OpenStreetMap 0.6 Map API Birincil Coğrafi ve Ulaşım Motoru (`backend/app/services/place_geography.py`)
- Genel Overpass ve Photon sunucularında yaşanan zaman aşımlarını aşmak için resmi **OpenStreetMap 0.6 Map XML API (`https://api.openstreetmap.org/api/0.6/map?bbox=...`, ODbL-1.0)** birincil kaynak olarak entegre edilmiştir (`_osm_map_data`).
- Tek bir `bbox` sorgusundan (`0.6–1.4 sn`) hem koordinatlı sosyal yaşam mekânları (`<node>` ve `<way>`, tür-dengeli `150` mekâna kadar) hem de mahalleden geçen toplu taşıma hatları (`<relation type="route">`: `subway`, `light_rail`, `tram`, `ferry`, `train`, `bus`, `25` hatta kadar) deterministik olarak çıkarılır.

---

## 4. Yanıt Süresi Benchmark Sonuçları (Hazır Rapor vs Canlı Yeni Üretim Ayrı)

### 4.1. Ön-Üretim / Batch Hazırlama Süresi (`backend/scripts/prepare_place_reports.py --workers 1`)

| Çalıştırma | Kapsam | Sonuç | Toplam Süre (`ms`) | Not |
|---|---|---|---:|---|
| **Tur 1 (Soğuk DB)** | 10 Pilot Mahalle | `8 PREPARED`, `2 FAILED (ResearchUnavailable)` | `129323.13 ms` | `Kültür` ve `Yenibağlar` ilk turda geçici sağlayıcı hatası aldı, önbelleğe bozuk veri yazılmadı. |
| **Tur 2 (Eksik Tamamlama)** | 10 Pilot Mahalle | `8 HIT`, `2 PREPARED` (`Kültür`, `Yenibağlar`) | `15734.40 ms` | Yalnızca eksik 2 mahalle üretildi, diğer 8 mahalle doğrudan `HIT` döndü. |
| **Tur 3 (Tamamı Hazır)** | 10 Pilot Mahalle | `10/10 HIT` (`exit 0`) | `873.43 ms` | Tüm pilotlar önbellekten doğrulandı (`~87 ms / mahalle` CLI yükü dahil). |

### 4.2. Arama, Otomatik Tamamlama ve Ön-Kontrol (`GET /places/{id}`) Süreleri

| Endpoint / Akış | Örnek / Sorgu Sayısı | HTTP Durumu | `min (ms)` | `p50 (ms)` | `mean (ms)` | `p95 (ms)` | `max (ms)` |
|---|---:|---|---:|---:|---:|---:|---:|
| `GET /api/v1/health` | 2 kontrol | `200 OK` (`sqlite`) | `28.91` | `29.43` | `29.43` | `29.90` | `29.95` |
| `GET /api/v1/places/suggest` (Sıcak) | 5 sorgu (`Köt`, `caferaga kadikoy`, `erze`, `bostanli`, `gorukle`) | `200 OK` | `11.10` | `14.79` | `14.66` | `18.65` | `19.23` |
| `GET /api/v1/places/suggest` (İlk/Soğuk) | 5 sorgu | `200 OK` | `10.31` | `12.53` | `54.93` | `181.82` | `223.22` |
| `GET /api/v1/places/search?q=Kötekli Menteşe` | 1 tam arama | `200 OK` | `13.40` | `13.40` | `13.40` | `13.40` | `13.40` |
| `GET /api/v1/places/{id}` (`Kötekli` — hazır) | 1 metadata okuma | `200 OK` (`report_available: true`) | `5.18` | `5.18` | `5.18` | `5.18` | `5.18` |
| `GET /api/v1/places/{id}` (`Erzene` — raporsuz) | 2 tekrar okuma | `200 OK` (`report_available: false`) | `2.49` | `2.49` | `2.49` | `2.49` | `2.49` |

> [!NOTE]
> `GET /api/v1/places/{id}` çağrısının raporsuz bir mahalle (`Erzene`) için tekrar çağrıldığında dahi `report_available: false` döndürdüğü ve arka planda **LLM/Tavily üretimi tetiklemediği** doğrulanmıştır.

### 4.3. Hazır Rapor Açılış Süresi (`GET /api/v1/places/{id}/report` -> `200 HIT`)

10 pilot mahallenin tamamı üzerinde **3 ardışık tur (`30` HTTP GET isteği)** koşturulmuştur:

| Ölçüm Kümesi | İstek Sayısı | Önbellek Başlığı | `min (ms)` | `p50 (ms)` | `mean (ms)` | `p95 (ms)` | `max (ms)` |
|---|---:|---|---:|---:|---:|---:|---:|
| **Genel (`3 Tur × 10 Pilot`)** | `30` | `X-Cache: HIT` | **`9.50`** | **`12.97`** | **`12.89`** | **`16.12`** | **`21.42`** |
| **1. Tur (`10 Pilot İlk Açılış`)** | `10` | `X-Cache: HIT` | `9.50` | `12.45` | `13.31` | `19.03` | `21.42` |
| **Legacy `GET /api/v1/neighborhoods/kotekli/report`** | `3` | `X-Cache: HIT` | `5.81` | `5.93` | `5.92` | `6.02` | `6.03` |

### 4.4. Yan Yana Karşılaştırma Akışı Süresi (`4` Mahalle Çifti)

Her karşılaştırma senaryosu, kullanıcı akışında olduğu gibi iki mahallenin paralel `suggest` çözümlemesini ve iki raporun paralel `GET /api/v1/places/{id}/report` (`200 HIT`) okumasını içerir:

| Karşılaştırma Çifti | Sol Mahalle Süresi (`ms`) | Sağ Mahalle Süresi (`ms`) | Toplam Paralel Akış Süresi (`ms`) |
|---|---:|---:|---:|
| **Kötekli vs Emirbeyazıt** (`Muğla içi`) | `36.78` | `54.61` | **`54.95`** |
| **Kötekli vs Akyaka** (`Menteşe vs Ula`) | `43.61` | `36.74` | **`43.62`** |
| **Kötekli vs Caferağa** (`Muğla vs İstanbul`) | `37.13` | `47.97` | **`48.23`** |
| **Kötekli vs Görükle** (`Muğla vs Bursa`) | `35.63` | `41.93` | **`42.16`** |
| **Özet İstatistik (`4 Çift`)** | — | — | **`min = 42.16` · `p50 = 45.92` · `mean = 47.24` · `p95 = 53.94` · `max = 54.95`** |

### 4.5. Canlı Yeni Rapor Üretim Süresi (`POST /api/v1/places/{id}/report` -> `201 MISS`) ve Hata Dayanıklılığı

Pilot listesinde yer almayan mahalleler üzerinde sıfırdan canlı rapor üretimi, aşama (`phase`) geçişleri ve geçici sağlayıcı hatası (`503`) sonrası önbellek bütünlüğü ayrı ayrı ölçülmüştür:

| Mahalle (`placeId`) | Adım / Senaryo | HTTP & `X-Cache` | Süre (`ms`) | Gözlenen Aşamalar (`status` / `phase`) ve Kanıt |
|---|---|---|---:|---|
| **Bostanlı — Karşıyaka / İzmir** (`82171aa4bb0aa0a85ca5fecd7c1fc0db`) | 1. Ön-kontrol (`GET /report`) | `404 Not Found` (`MISS`) | `4.04 ms` | Rapor yokken `GET /report` üretim tetiklemez, `404` döner. |
| **Bostanlı — Karşıyaka / İzmir** | 2. Canlı Üretim Deneme 1 (`POST /report`) | `503 Service Unavailable` | `44493.91 ms` | `checking -> research -> extraction` aşamaları izlendi; hata sonrası `GET /report` tekrar `404` döndü (`cachePreservedAfterFailure: true`). |
| **Bostanlı — Karşıyaka / İzmir** | 3. Canlı Üretim Başarılı (`POST /report`) | **`201 Created` (`X-Cache: MISS`)** | **`53862.88 ms` (`53.86 sn`)** | `checking (49 ms) -> research (1060 ms) -> extraction (10188 ms) -> writing (43501 ms)`; `research_metrics: {source_count: 45, extracted_count: 16, accepted_count: 12}`. |
| **Bostanlı — Karşıyaka / İzmir** | 4. Üretim Sonrası Tekrar Açılış (`GET /report`) | **`200 OK` (`X-Cache: HIT`, `Hits: 1`)** | **`8.26 ms`** | Canlı üretime kıyasla **`6520.93x` hızlanma** (`53862.88 ms -> 8.26 ms`). |
| **Bostanlı — Karşıyaka / İzmir** | 5. Tekrar `POST /report` (İdempotensi) | `200 OK` (`X-Cache: HIT`) | `8.30 ms` | Mevcut önbellek raporu korundu, LLM tekrar çalıştırılmadı. |
| **Bostanlı — Karşıyaka / İzmir** | 6. Çoklu İlan + OSM 0.6 Zenginleştirilmiş Açılış (`GET /report`) | `200 OK` (`X-Cache: HIT`) | `18.78 ms` | Genel **47** (`5/5`), Maliyet **0** (`7 ilan · Orta güven`, `44.460 TL` 1+1 eşdeğeri: `37k–57k` + `83k`), Sosyal **79** (`127 mekân`, 11 tür, 6/6 grup), Gündem **75** (`2 haber`), Deprem **17** (`0.37 g`), Ulaşım **78** (`24 hat`). |
| **Suadiye — Kadıköy / İstanbul** (`75518d534aa8c0ddd5fb33e759c28430`) | Geçici Sağlayıcı Hatası (`503`) Dayanıklılık Testi | `503 Service Unavailable` | `39320.44 ms` | Deneme sonrası `GET /report` -> `404` kaldı (`cachePreservedAfterFailure: true`); veritabanına yarım/bozuk rapor yazılmadığı kanıtlandı. |

---

## 5. 10 Pilot Mahalle + Bostanlı: 5-Kategori Puanları, Örneklem Güven Rozetleri, Çeşitlilik ve Yanıt Süreleri

| # | Mahalle (`İlçe / İl`) | Genel (`Kategori`) | Maliyet (`Örneklem · Güven · Medyan`) | Sosyal Yaşam (`Örneklem · Çeşitlilik Notu`) | Yerel Gündem (`Örneklem · Güven`) | Deprem (`PGA`) | Ulaşım (`Hat · Güven`) | Tekil Kaynak URL | `GET /report` 3 Tur (`ms`) |
|---:|---|---:|---|---|---|---|---|---:|---|
| 1 | **Kötekli** (`Menteşe / Muğla`) | **35** (`5/5`) | **18** (`3 ilan · Orta güven · 23.000 TL` strict 1+1) | **53** (`40 mekân · Yüksek güven` · **%80 yeme-içme/kafe/gece tek-tip uyarısı**, `park/spor: 1, kültür: 2`) | **44** (`8 haber · Yüksek güven`) | **23** (`0.351 g`) | **35** (`3 hat · Orta güven`) | `119` | `[21.42, 11.90, 13.16]` (medyan **`13.16`**) |
| 2 | **Emirbeyazıt** (`Menteşe / Muğla`) | **43** (`5/5`) | **0** (`19 ilan · Yüksek güven · 28.080 TL` normalize) | **83** (`133 mekân · Yüksek güven` · 6/6 grup dengeli) | **53** (`5 haber · Orta güven`) | **29** (`0.334 g`) | **60** (`7 hat · Yüksek güven`) | `175` | `[16.10, 15.50, 16.14]` (medyan **`16.10`**) |
| 3 | **Muslihittin** (`Menteşe / Muğla`) | **48** (`5/5`) | **5** (`11 ilan · Yüksek güven · 26.650 TL` normalize) | **87** (`105 mekân · Yüksek güven` · 6/6 grup dengeli) | **61** (`6 haber · Orta güven`) | **29** (`0.334 g`) | **68** (`3 hat · Orta güven`) | `127` | `[14.91, 13.27, 13.59]` (medyan **`13.59`**) |
| 4 | **Orhaniye** (`Menteşe / Muğla`) | **40** (`4/5`) | **0** (`8 ilan · Yüksek güven · 32.500 TL` normalize) | **84** (`139 mekân · Yüksek güven` · 6/6 grup dengeli) | **50** (`3 haber · Sınırlı örneklem`) | **29** (`0.334 g`) | **`null`** (`0 hat · Veri yok`) | `169` | `[14.60, 15.89, 15.23]` (medyan **`15.23`**) |
| 5 | **Akyaka** (`Ula / Muğla`) | **39** (`5/5`) | **0** (`9 ilan · Yüksek güven · 31.200 TL` normalize) | **71** (`85 mekân · Yüksek güven` · kültür/sanat kaydı yok uyarısı) | **70** (`3 haber · Sınırlı örneklem`) | **11** (`0.391 g`) | **43** (`3 hat · Orta güven`) | `117` | `[11.76, 12.91, 14.29]` (medyan **`12.91`**) |
| 6 | **Caferağa** (`Kadıköy / İstanbul`) | **50** (`5/5`) | **0** (`25 ilan · Yüksek güven · 55.000 TL` normalize) | **96** (`151 mekân · Yüksek güven` · **16 farklı tür, `park/spor: 8, kültür: 7`**) | **75** (`4 haber · Orta güven`) | **8** (`0.401 g`) | **78** (`22 hat · Yüksek güven`, M4, T3, Şehir Hatları, İETT) | `188` | `[13.13, 13.03, 13.28]` (medyan **`13.13`**) |
| 7 | **Bahçelievler** (`Çankaya / Ankara`) | **46** (`5/5`) | **0** (`10 ilan · Yüksek güven · 32.175 TL` normalize) | **75** (`63 mekân · Yüksek güven` · 6 grup dengeli) | **75** (`4 haber · Orta güven`) | **41** (`0.304 g`) | **62** (`7 hat · Yüksek güven`, EGO hatları) | `85` | `[10.52, 10.35, 10.56]` (medyan **`10.52`**) |
| 8 | **Kültür** (`Konak / İzmir`) | **40** (`5/5`) | **0** (`6 ilan · Orta güven · 42.500 TL` normalize) | **58** (`94 mekân · Yüksek güven` · **%91 yeme-içme/kafe/gece tek-tip uyarısı**) | **75** (`4 haber · Orta güven`) | **17** (`0.368 g`) | **75** (`6 hat · Yüksek güven`, İZDENİZ Vapur, ESHOT) | `110` | `[10.31, 11.36, 11.07]` (medyan **`11.07`**) |
| 9 | **Yenibağlar** (`Tepebaşı / Eskişehir`) | **58** (`5/5`) | **41** (`8 ilan · Yüksek güven · 16.478 TL` normalize) | **70** (`91 mekân · Yüksek güven` · 6 grup dengeli) | **68** (`4 haber · Orta güven`) | **56** (`0.271 g`) | **65** (`3 hat · Orta güven`, ESTRAM T1/T3) | `107` | `[10.80, 10.84, 9.93]` (medyan **`10.80`**) |
| 10 | **Görükle** (`Nilüfer / Bursa`) | **56** (`5/5`) | **54** (`6 ilan · Orta güven · 13.380 TL` normalize) | **71** (`65 mekân · Yüksek güven` · kültür/sanat=0 uyarısı) | **46** (`4 haber · Orta güven`) | **25** (`0.344 g`) | **72** (`3 hat · Orta güven`, BURULAŞ) | `78` | `[9.50, 9.60, 11.64]` (medyan **`9.60`**) |
| 11 | **Bostanlı** *(Canlı Üretim — `Karşıyaka / İzmir`)* | **47** (`5/5`) | **0** (`7 ilan · Orta güven · 44.460 TL` normalize: `37k–57k` + `83k`) | **79** (`127 mekân · Yüksek güven` · 11 farklı tür, 6/6 grup) | **75** (`2 haber · Sınırlı örneklem`) | **17** (`0.370 g`) | **78** (`24 hat · Yüksek güven`, T1 Tramvay, İZBAN, Vapur, ESHOT) | `54` | `POST 201 MISS: 53862.88` -> `GET 200 HIT: 8.26 / 18.78` |

---

## 6. Kabul Test Senaryoları Doğrulama Matrisi (`TC-01..TC-20` & `UI-01..UI-07`)

### 6.1. API ve Veri Bütünlüğü Senaryoları (`TC-01..TC-20`)

| Kod | Senaryo Tanımı | Beklenen | Gözlenen Kanıt | Durum |
|---|---|---|---|---|
| **TC-01** | `GET /api/v1/health` sağlık kontrolü | `200 OK`, `status: "ok"` | `200 OK` (`database: "sqlite"`, `28.91 ms`) | **GEÇTİ** |
| **TC-02** | `GET /api/v1/places/suggest` Türkçe karakter & kısmi arama | İlk 5 içinde doğru pilot eşleşmesi | `Köt -> Kötekli`, `caferaga kadikoy -> Caferağa`, `bostanli -> Bostanlı` (`p50 = 14.79 ms`) | **GEÇTİ** |
| **TC-03** | `GET /api/v1/places/search` geçerli sorgu | `200 OK`, sıralı sonuç listesi | `q=Kötekli Menteşe` -> `200 OK` (`13.40 ms`) | **GEÇTİ** |
| **TC-04** | `GET /api/v1/places/search` boş veya jenerik sorgu reddi | `400` veya `422` | `q="" -> 422`, `q="  " -> 400`, `q="Mahallesi" -> 400` | **GEÇTİ** |
| **TC-05** | `GET /api/v1/places/{id}` hazır rapor için metadata | `report_available: true`, `overall_score` dolu | `Kötekli`: `report_available: true`, `overall_score: 35` (`5.18 ms`) | **GEÇTİ** |
| **TC-06** | `GET /api/v1/places/{id}` raporsuz mahallede yan etkisizlik | `report_available: false`, LLM tetiklenmez | `Erzene`: ardışık iki `GET` çağrısında da `report_available: false` (`2.49 ms`) | **GEÇTİ** |
| **TC-07** | `GET /api/v1/places/{id}/report` raporsuz mahallede `404` | `404 Not Found`, `X-Cache: MISS` | `Bostanlı` (üretim öncesi) ve `Suadiye`: `404 Not Found` (`2.55–4.04 ms`) | **GEÇTİ** |
| **TC-08** | 10 pilotun tamamında `GET /api/v1/places/{id}/report` önbellek okuması | `200 OK`, `X-Cache: HIT`, `< 50 ms` | 30/30 istek `200 OK` (`X-Cache: HIT`, `p50 = 12.97 ms`, `max = 21.42 ms`) | **GEÇTİ** |
| **TC-09** | `score_summary_version: 5` ve 5 kategoride deterministik puan | Kanıtı olan tüm kategorilerde `0..100` tam sayı puan | 10 pilotta `49/50` kategori sayısal puanlı (yalnızca `Orhaniye` ulaşım `0 hat` nedeniyle `null`) | **GEÇTİ** |
| **TC-10** | Örneklem sayısı ve güven rozetleri (`sample_count`, `confidence_label`) | Her kategoride doğru örneklem ve güven etiketi | `Yüksek güven`, `Orta güven`, `Sınırlı örneklem` ve `Veri yok` rozetleri 10 pilotta doğrulandı | **GEÇTİ** |
| **TC-11** | Oda-normalize kira + kira endeksi (`rent_benchmarks`) | `< 3` strict 1+1 olduğunda tüm odalar 1+1 eşdeğerine normalize edilir | `Caferağa (25 ilan)`, `Emirbeyazıt (19 ilan)`, `Bahçelievler (10 ilan)`, `Bostanlı (7 ilan)` doğrulandı | **GEÇTİ** |
| **TC-12** | Portal çoklu ilan ayrıştırma (`_extract_portal_rents`) | Tek özet sayfasından birden çok kira+oda çifti çıkarımı | `Bostanlı` Emlakjet sayfasından `37.000 TL (2+1)` ve `40.000 TL (3+1)` dahil 7 ilan çıkarıldı | **GEÇTİ** |
| **TC-13** | Sosyal yaşam çeşitlilik ve tek-tiplik cezası (`social_diversity`) | `%75+` yeme-içme/kafe/gece ve düşük park/kültürde `-14` ceza + uyarı | `Kötekli (%80 -> 53/100)` ve `Kültür (%91 -> 58/100)` tek-tip uyarısı; `Caferağa (96/100)` 16 tür | **GEÇTİ** |
| **TC-14** | OSM 0.6 Map API (`_osm_map_data`) koordinatlı mekân ve ulaşım hattı çıkarımı | Koordinatlı mekânlar + `<relation type="route">` toplu taşıma hatları | `Caferağa: 151 mekân, 22 hat`; `Bostanlı: 127 mekân, 24 hat`; `Kültür: 94 mekân, 6 hat` | **GEÇTİ** |
| **TC-15** | Kaynak bağlantılarının (`sources` & `detailed_evidence`) doğrulanabilirliği | Tüm kaynak URL'leri geçerli `http://` veya `https://` | 10 pilotta toplam `1275` tekil URL, `0` geçersiz URL | **GEÇTİ** |
| **TC-16** | `with_score_summary` idempotensi (tekrar okumada veri kaybı olmaması) | Ardışık `GET /report` çağrılarında `detailed_evidence` ve puanlar sabit kalır | 3 tur × 10 pilot (`30` okuma) boyunca tüm puanlar, örneklem sayıları ve kanıt dizileri birebir aynı kaldı | **GEÇTİ** |
| **TC-17** | Yan yana karşılaştırma (`ComparisonView` / `buildComparisonModel`) | İki mahallenin 5 kategori puanı, farkları ve örneklem rozetleri | 4 mahalle çiftinde (`42.16–54.95 ms`) tüm kategori kazananları ve örneklem rozetleri doğrulandı | **GEÇTİ** |
| **TC-18** | Canlı yeni rapor üretimi (`POST /api/v1/places/{id}/report`) | `201 Created`, `X-Cache: MISS`, aşama takibi, ardından `GET 200 HIT` | `Bostanlı`: `201 MISS` (`53862.88 ms`) -> `GET 200 HIT` (`8.26 ms`, `6520.93x` hızlanma) | **GEÇTİ** |
| **TC-19** | Canlı üretimde `503` hatası sonrası önbellek koruması | Başarısız `POST` sonrası `GET /report` `404` kalmalı | `Bostanlı` (Deneme 1) ve `Suadiye` `503` sonrası `GET /report` -> `404` (`cachePreservedAfterFailure: true`) | **GEÇTİ** |
| **TC-20** | Korunan veri dosyalarının (`data/manifest.json`) SHA-256 bütünlüğü | Hiçbir korunan dosyada hash değişimi olmaması | `pilot_neighborhoods.json`, `issue32/*`, `scoring_research/reports.json` SHA-256 doğrulaması geçti | **GEÇTİ** |

### 6.2. Tarayıcı (Browser E2E) Doğrulama Matrisi (`UI-01..UI-07`)

Canlı arayüz (`http://127.0.0.1:5185`) üzerinde gerçek tarayıcı oturumuyla (`BROWSER_HOST_FACTS` onaylı: `visited_origins: http://127.0.0.1:5185`, `blocked_origins: none`) aşağıdaki kontroller doğrulanmıştır:

| Kod | Arayüz Kontrolü | Doğrulanan Rotalar | Gözlenen Kanıt | Durum |
|---|---|---|---|---|
| **UI-01** | Ana sayfa arama ve otomatik tamamlama (`SearchBar`) | `/` -> `/mahalle/<id>` | Arama önerisi seçimiyle doğrudan mahalle raporuna geçiş çalıştı | **GEÇTİ** |
| **UI-02** | 5 kategori kartında puan (`XX/100`) ve güven rozeti (`.answer-confidence`) | `/mahalle/e16d2a441a64d97c788c95692e29cfc1` (`Kötekli`), `/mahalle/371ae22fba5e19084679a751055b7bef` (`Caferağa`), `/mahalle/82171aa4bb0aa0a85ca5fecd7c1fc0db` (`Bostanlı`) | 5/5 kartta sayısal puan ve `3 ilan · Orta güven`, `40 mekân · Yüksek güven` vb. rozetler görüntülendi | **GEÇTİ** |
| **UI-03** | Sosyal yaşam kartı ve modalında çeşitlilik / tek-tiplik kutusu (`.reading-diversity-box`) | `Kötekli`, `Caferağa`, `Görükle`, `Bostanlı` | `Kötekli`'de `%80` tek-tip yoğunlaşma uyarısı + 6 grup dağılım çipleri (`Yeme-içme 13`, `Kafe & tatlı 12`, `Pub & gece 7`, `Kültür & sanat 2`, `Park & spor 1`, `Günlük yaşam 5`) görüntülendi | **GEÇTİ** |
| **UI-04** | Sosyal yaşam modalında Leaflet OSM haritası (`VenueMap.jsx`) ve kategori filtreleri | `Kötekli`, `Caferağa`, `Bostanlı` | Koordinatlı mekân işaretçileri (marker) harita üzerinde render edildi; modal kapatmada animasyon kaynaklı `_leaflet_pos` hatası `zoomAnimation: false` + `instance.stop()` ile giderildi | **GEÇTİ** |
| **UI-05** | Maliyet modalında çoklu oda sekmeleri (`1+1`, `2+1`, `3+1`) ve `Piyasa Kira Endeksi` | `Caferağa`, `Bahçelievler`, `Bostanlı` | `Bostanlı`'da 7 ilan (`37.000 TL – 57.000 TL` ve `83.000 TL`) oda sekmeleriyle ve kaynak linkleriyle listelendi | **GEÇTİ** |
| **UI-06** | Yan yana karşılaştırma ekranı (`/karsilastir`) ve örneklem rozetleri (`.comp-cat-sample`) | `/karsilastir?left=e16d2a441a64d97c788c95692e29cfc1&right=371ae22fba5e19084679a751055b7bef` | `Kötekli (35) vs Caferağa (50)` ekranında 5 kategorinin tamamında puan barları, fark etiketleri ve örneklem/güven rozetleri görüntülendi | **GEÇTİ** |
| **UI-07** | Duyarlı tasarım (Responsive Desktop `1280×800` & Mobile `390×844`) ve Ağ Temizliği | Tüm test edilen rotalar | Yatay taşma yok (`scrollWidth <= clientWidth`), `0` adet HTTP `>= 400` ağ hatası | **GEÇTİ** |

---

## 7. Tekrar Çalıştırılabilir Doğrulama Komutları

```powershell
# 1. Backend birim ve entegrasyon testleri (144 test)
Set-Location backend
python -X utf8 -m pytest -q -p no:cacheprovider

# 2. Frontend puanlama, navigasyon ve üretim derlemesi
Set-Location ..
node frontend/scripts/test-scoring.mjs
node frontend/scripts/test-navigation.mjs
npm --prefix frontend run build

# 3. Uçtan uca #33 ve #35 kabul & benchmark betikleri (Backend 18035 portunda çalışırken)
$env:API_BASE_URL = "http://127.0.0.1:18035/api/v1"
node frontend/scripts/test-issue33-flow.mjs
node frontend/scripts/test-issue35-acceptance.mjs --rounds=3
```
