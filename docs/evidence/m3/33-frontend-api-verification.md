# M3 Evidence — Frontend, Search, Report, Sources & Missing-Data Verification (#33)

- **Proje:** MahallEN — Team Axiom (SE3003)
- **İlgili Görev:** #33 — Irmak + Ferdi: Arama, mahalle seçimi, rapor sayfası, kaynaklar ve eksik veri gösterimini güncel API ile kontrol edin
- **Tarih:** 18 Kasım 2026
- **Taban Dal:** `main` (`3ae6144` — #32 PR #39 ve #34 PR #40 birleştirilmiş hâli)
- **Çalışma Dalı:** `issue-33-frontend-api-verification`

---

## 1. #33 Kapsamında Tespit Edilip Düzeltilen Uyumsuzluklar (Ayrı Commit'ler)

1. **`53830a0` — `fix(frontend): map hazard PGA, rent range, and source URLs in placeAdapter (#33)`**
   - [`frontend/src/services/placeAdapter.mjs`](../../../frontend/src/services/placeAdapter.mjs) içinde daha önce sabit `null` bırakılan `disaster_risk.pga_value_g` alanı `assessment.briefing.hazard.value` (veya `earthquake_hazard` kategori bulgusu) ile eşlendi.
   - `rent_analysis.rent_range_tl` alanı `assessment.briefing.rent_types` içindeki karşılaştırılabilir konut grubunun `min–max` aralığından üretildi.
   - `data_sources` listesi hem güncel kategori bulgularını (`items`) hem de `safety_news` altındaki arşiv kayıtlarını (`historical_items`) tekilleştirerek içerecek şekilde genişletildi ve [`frontend/scripts/test-scoring.mjs`](../../../frontend/scripts/test-scoring.mjs) içine adaptör birim testleri eklendi.

2. **`e66ffe0` — `fix(frontend): align ComparisonView with place report API and ScoreCard keys (#33)`**
   - [`frontend/src/components/ComparisonView.jsx`](../../../frontend/src/components/ComparisonView.jsx) içinde `CATEGORY_DEFINITIONS` okunurken `cat.scoreKey` tanımsız (`undefined`) olduğu için tüm kategori puanlarının `"Veri yetersiz"` görünmesine yol açan alan adı uyumsuzluğu giderildi ([`frontend/src/scoring.mjs`](../../../frontend/src/scoring.mjs) içine `key`, `scoreKey` ve `evidenceKey` eklendi).
   - Karşılaştırma ekranının seçilen mahalle için önce güncel `/api/v1/places/suggest` + `GET /api/v1/places/{id}/report` (`adaptPlaceReport` ile) uç noktasını kontrol etmesi, hazır rapor yoksa ücretli `POST` çağrısı başlatmadan `/api/v1/neighborhoods/{slug}/report` verisine düşmesi sağlandı.
   - Her karşılaştırma kartına doğrudan ilgili mahallenin tam rapor sayfasına (`/mahalle/<32-karakter-id>`) geçiş bağlantısı eklendi.

3. **`2d929de` — `fix(frontend): preserve null scores in search ranking and guide search navigation (#33)`**
   - [`frontend/src/App.jsx`](../../../frontend/src/App.jsx) içindeki `rankedNeighborhoods` sıralamasında `Number(null) || 0` nedeniyle eksik (`null`) puanlı mahallelerin gerçek `0` puanlı mahallelerle aynı sayılması düzeltildi; `normalizeScoreValue` ile `null` değerler her zaman sayısal (`0–100`) puanların arkasına sıralanır.
   - Açılışta henüz arama yapılmamışken gizli (`hidden`) olan `#mahalleler` ve `#sana-gore` bölümlerine üst menüden tıklandığında arama kutusuna (`#neighborhood-search`) odaklanma eklendi.

---

## 2. Güncel API ile Uçtan Uca Kontrol Sonuçları

### 2.1. Arama ve Otomatik Tamamlama (`GET /api/v1/places/suggest` & `GET /api/v1/places/search`)
- **Yerel Öneri Dizini (`suggest`):** 32.254 mahallelik yerel dizinden (`data/place_directory/`) 2+ karakterde dış ağ veya LLM çağrısı yapmadan öneri döndüğü, Türkçe karakter/aksan duyarsız eşleşmenin (`caferaga kadikoy` → `Caferağa / Kadıköy / İstanbul`, `erze` → `Erzene / Bornova / İzmir`) çalıştığı doğrulandı.
- **Açık Arama (`search`):** Boş sorgunun (`q=""` veya `q="  "`) katalog döndürmeyip `422`/`400` ile reddedildiği; geocoder erişilemez olduğunda bile kayıtlı 10 pilot mahallenin yerel veritabanından döndüğü doğrulandı.

### 2.2. Mahalle Seçimi ve Rapor Sayfası (`/mahalle/<32-karakter-id>`)
- Öneri listesinden veya arama sonuç kartından bir mahalle seçildiğinde `openReportPage` fonksiyonunun önceki arama durumunu (`history.state.search`) koruyarak `/mahalle/<32-karakter-id>` rotasına (`ReportPage.jsx`) geçtiği doğrulandı (`test-navigation.mjs` — 2/2 geçti).
- `GET /api/v1/places/{id}` çağrısının rapor üretimi tetiklemeden yalnızca mahalle metadatasını (`name`, `district`, `city`, `report_available`, `overall_score`) döndürdüğü doğrulandı.
- Hazır (`report_version: 3`, `rules-v1`) raporlarda ilk `GET /api/v1/places/{id}/report` çağrısının `200 OK` ve `X-Cache: HIT` ile döndüğü doğrulandı.

### 2.3. Kaynaklar ve Eksik Veri (`null` vs `0`) Gösterimi (10 Pilot Mahalle Tablosu)

Kural tabanlı puanlama (`rule_scoring.py` + `place_assessment.with_score_summary`) ve `placeAdapter.mjs` üzerinden 10 pilot mahallenin tamamı güncel API ile kontrol edilmiştir:

| Mahalle (İlçe / İl) | `place_id` | `X-Cache` | Genel Ön Puan | Kapsam | Maliyet (`rent_cost`) | Sosyal Yaşam (`social_life`) | Yerel Gündem (`safety_news`) | Deprem (`earthquake_hazard`) | Ulaşım (`transportation`) | PGA (g) | Kaynak URL Sayısı |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Kötekli** (Menteşe / Muğla) | `e16d2a441a64d97c788c95692e29cfc1` | `HIT` | **22** | 3/5 | 18 | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 23 | 35 | 0,351 | 119 |
| **Emirbeyazıt** (Menteşe / Muğla) | `af2e7244802ec22662b80ddc508942b2` | `HIT` | `null` | 2/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 29 | 60 | 0,334 | 175 |
| **Muslihittin** (Menteşe / Muğla) | `74b765d3a2b8ca1ffad1c122957334b7` | `HIT` | **25** | 3/5 | 11 | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 29 | 68 | 0,334 | 127 |
| **Orhaniye** (Menteşe / Muğla) | `ca80ececdd7cd23933102744c9df8645` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 29 | `null` | 0,334 | 169 |
| **Akyaka** (Ula / Muğla) | `a1a01e2a71eb0d95566eca6dad588f7f` | `HIT` | **10** | 3/5 | **0** *(gerçek 0)* | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 11 | 43 | 0,391 | 117 |
| **Caferağa** (Kadıköy / İstanbul) | `371ae22fba5e19084679a751055b7bef` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 8 | `null` | 0,401 | 8 |
| **Bahçelievler** (Çankaya / Ankara) | `77a34242e84d0eafd270e4db5eb9707b` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 41 | `null` | 0,304 | 9 |
| **Kültür** (Konak / İzmir) | `1c19bb707c810576a0bb2b205cb9503d` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 17 | `null` | 0,368 | 7 |
| **Yenibağlar** (Tepebaşı / Eskişehir) | `23e292f0648cc37bc2b6f222cc69bb66` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 56 | `null` | 0,271 | 6 |
| **Görükle** (Nilüfer / Bursa) | `bc1a7077060fbc9a66501464d2ca7f40` | `HIT` | `null` | 1/5 | `null` | `null` *(Mekân rehberi)* | `null` *(Haber derlemesi)* | 25 | `null` | 0,344 | 8 |

#### Eksik Veri Politikası Doğrulama Bulguları
- **Gerçek `0` ile Eksik Veri (`null`) Ayrımı:** Tabloda görüldüğü üzere **Akyaka**'da 1+1 kira medyanı gelir eşiğinin üzerinde olduğu için `rent_cost` **gerçek `0` (`0/100`)** olarak hesaplanmış ve grafikte/kartta `0/100` olarak gösterilmiştir. Buna karşılık ödeme dönemi veya karşılaştırılabilir 1+1 örneği bulunmayan **Emirbeyazıt, Orhaniye, Caferağa, Bahçelievler, Kültür, Yenibağlar ve Görükle**'de `rent_cost` **`null`** kalmış ve arayüzde `0` yerine `"Karşılaştırma bekliyor"` / `"Yeterli veri yok"` olarak gösterilmiştir.
- **Bilgi Amaçlı Kategoriler (`social_life` & `safety_news`):** Arama örnek sayısı mahalledeki toplam işletme sayısını, tekil haberler ise suç oranını ölçmediği için bu iki kategori sayısal puana çevrilmemekte (`score: null`, `scoring_status: "informational"`), ancak içlerindeki tüm kaynaklı mekânlar (harita/liste) ve tarihli haberler kategori pencerelerinde kaynak linkleriyle eksiksiz açılmaktadır.
- **Genel ve Profil Ön Puanı Koşulu:** Kira (`rent_cost`) ve ulaşım (`transportation`) karşılaştırmalarının her ikisi birden mevcut olmadığında (`Emirbeyazıt` veya yalnız PGA verisi bulunan mahalleler), tek başına deprem grid değerinden yanıltıcı genel puan veya profil uygunluk puanı üretilmemekte (`overall_score: null`), ekranda `"Kira ve ulaşım karşılaştırması tamamlanmadan genel puan hesaplanmaz."` açıklaması gösterilmektedir.

---

## 3. Otomatik Test ve Derleme Kanıtları (18 Kasım 2026)

| Kontrol | Komut | Sonuç |
| :--- | :--- | :--- |
| **Backend Test Paketi** | `python -m pytest -q -p no:cacheprovider` (`backend/`) | **136 passed** (8.98s) |
| **Frontend Puanlama & Adaptör Testi** | `node frontend/scripts/test-scoring.mjs` | **GEÇTİ** |
| **Frontend Rota & Geçmiş Testi** | `node frontend/scripts/test-navigation.mjs` | **2/2 GEÇTİ** |
| **Frontend Üretim Derlemesi** | `npm --prefix frontend run build` | **GEÇTİ** (`vite v6.4.5`, `1581 modules transformed`) |

### Canlı HTTP Sunucusu (`http://127.0.0.1:8000/api/v1`) Üzerinde Otomatik Akış Testi (`node frontend/scripts/test-issue33-flow.mjs`)

```text
=== Issue #33 Kapsamlı API & Frontend Doğrulama Testi Başlıyor ===

[1/6] Sistem sağlık kontrolü (/api/v1/health): 200 OK (35.56 ms)
[2/6] Arama & Otomatik Tamamlama (/places/suggest & /places/search): Türkçe karakter, ulusal dizin ve boş sorgu korumaları doğrulandı.
[3/6] Arama sonuç sıralaması ve eksik puan (null vs 0) ayrımı doğrulandı.

[4/6] 10 Pilot Mahalle Rapor Sayfası (/places/{id}/report), Kaynak ve Eksik Veri Kontrolü:
  ✓ Kötekli       | HTTP 200 HIT (10.89 ms) | Genel:   22 | Maliyet:   18 | Ulaşım:   35 | Afet: 23 | PGA: 0.351g | Kaynak: 119
  ✓ Emirbeyazıt   | HTTP 200 HIT (13.22 ms) | Genel: null | Maliyet: null | Ulaşım:   60 | Afet: 29 | PGA: 0.334g | Kaynak: 175
  ✓ Muslihittin   | HTTP 200 HIT (11.25 ms) | Genel:   25 | Maliyet:   11 | Ulaşım:   68 | Afet: 29 | PGA: 0.334g | Kaynak: 127
  ✓ Orhaniye      | HTTP 200 HIT (12.62 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet: 29 | PGA: 0.334g | Kaynak: 169
  ✓ Akyaka        | HTTP 200 HIT (10.96 ms) | Genel:   10 | Maliyet:    0 | Ulaşım:   43 | Afet: 11 | PGA: 0.391g | Kaynak: 117
  ✓ Caferağa      | HTTP 200 HIT ( 5.78 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet:  8 | PGA: 0.401g | Kaynak: 8
  ✓ Bahçelievler  | HTTP 200 HIT ( 7.61 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet: 41 | PGA: 0.304g | Kaynak: 9
  ✓ Kültür        | HTTP 200 HIT ( 6.68 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet: 17 | PGA: 0.368g | Kaynak: 7
  ✓ Yenibağlar    | HTTP 200 HIT (  6.8 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet: 56 | PGA: 0.271g | Kaynak: 6
  ✓ Görükle       | HTTP 200 HIT ( 6.86 ms) | Genel: null | Maliyet: null | Ulaşım: null | Afet: 25 | PGA: 0.344g | Kaynak: 8

[5/6] Gerçek 0 puan (Akyaka Maliyet = 0/100) ile Eksik Veri (null -> "Yeterli veri yok") ayrımı kesin olarak doğrulandı.
[6/6] Pilot veri uç noktası (/api/v1/neighborhoods/kotekli/report) ve X-Cache: HIT (7.33 ms) doğrulandı.

=== TÜM ISSUE #33 KONTROLLERİ EKSİKSİZ GEÇTİ ===
```
