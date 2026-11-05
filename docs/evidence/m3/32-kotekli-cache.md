# M3 Evidence — Kötekli Report Cache (#32)

- **Test date:** 5 November 2026
- **Tested commit:** `32e60a2` (`32-kotekli-report-cache`)
- **Endpoint:** `GET /api/v1/neighborhoods/kotekli/report`
- **Environment:** Local Uvicorn server with a fresh SQLite database and report caching enabled.

| Request | HTTP status | `X-Cache` | `X-Cache-Hits` | Elapsed time |
| --- | --- | --- | ---: | ---: |
| First request | `200 OK` | `MISS` | 0 | 20.434 ms |
| Second request | `200 OK` | `HIT` | 1 | 3.582 ms |

The first request built the report from the saved Kötekli pilot data. The second request served the cached report and incremented the hit counter. These timings describe one local test run. Live Gemini generation and pre-generating reports before the first request were outside the scope of this test.

## Terminal output (excerpt)

```text
HTTP/1.1 200 OK
x-cache: MISS
x-cache-hits: 0
Süre: 0.020434s

HTTP/1.1 200 OK
x-cache: HIT
x-cache-hits: 1
Süre: 0.003582s
```

## Reproduce

From the repository root, run the backend with its dependencies installed:

```bash
cd backend
run_dir=$(mktemp -d)
DATABASE_URL="sqlite:///$run_dir/kotekli.db" REPORT_CACHE_ENABLED=true \
  python -m uvicorn app.main:app --host 127.0.0.1 --port 18332
```

In a second terminal, send two identical requests:

```bash
for i in 1 2; do
  curl -fsS -D - -o /dev/null -w 'Süre: %{time_total}s\n' \
    http://127.0.0.1:18332/api/v1/neighborhoods/kotekli/report
done
```

## Authorized Gemini refresh

Tested on 5 November 2026 on `32-kotekli-report-cache` using FastAPI's HTTP test client, isolated SQLite, and a simulated Gemini SDK response. The request passed through the application's Gemini integration, including prompt serialization and response validation.

| Scenario | HTTP status | Cache result |
| --- | --- | --- |
| Normal request on an empty cache | 200 | `MISS`, hits 0. Returned the local Kötekli pilot report. |
| Refresh without the operator token | 403 | No Gemini call. |
| Authorized refresh with valid Gemini narrative | 200 | `MISS`, hits 0. Stored the new report. |
| Normal request after refresh | 200 | `HIT`, hits 1. Returned the same report as the refresh. |
| Authorized refresh with a provider timeout or invalid output | 502 | Returned an error. The cached report was preserved. |
| Normal request after the failure | 200 | `HIT`, hits 2. Returned the last valid Gemini report unchanged. |

The test inspected the serialized prompt for the pilot reference date (`2026-10-28`), saved source records and links, existing scores, and unknown values. The refreshed response preserved all structured report fields, including scores, source links, and missing values. The app also kept the pilot date in the narrative heading. The test covered a timeout and a malformed model response in separate runs.

From `backend/`, run the automated scenarios with the development dependencies installed:

```bash
python -m pytest -q tests/test_api.py tests/test_caching.py
```

**Live verification pending.** No Gemini key or model was configured for this run. To verify against Gemini, start the API with report caching enabled and set `GEMINI_API_KEY`, `GEMINI_MODEL`, and a server-side `AI_REFRESH_TOKEN` of at least 32 characters. Send an authorized `GET /api/v1/neighborhoods/kotekli/report?refresh_ai=true` with that token in the `X-AI-Refresh-Token` header. Then send a normal GET to the same report without the query parameter and check that it returns `HIT` with the same narrative.

## Canlı Gemini doğrulaması

5 Kasım 2026 · `32-kotekli-report-cache` · `988e57f`

Backend, yerel Gemini ayarları ve boş bir geçici SQLite veritabanıyla yeniden başlatıldı. Yetkili yenileme gerçek Gemini entegrasyonundan geçti. İlk ölçüm yerel Uvicorn sunucusuna yapılan HTTP isteklerinden alındı. Tanılama tekrarı ayrı bir geçici SQLite veritabanıyla FastAPI TestClient üzerinden yapıldı ve gerçek Gemini'yi çağırdı.

| Deneme | İstek | HTTP durumu | Önbellek | Süre |
| --- | --- | ---: | --- | ---: |
| Yerel HTTP | Yetkili `refresh_ai=true` | 502 | Başlık yok | 24.109,028 ms |
| Yerel HTTP | Sonraki normal istek | 200 | `MISS`, sayaç 0 | 20,546 ms |
| Tanılama | Yetkili `refresh_ai=true` | 502 | Başlık yok | 4.064,206 ms |
| Tanılama | Sonraki normal istek | 200 | `MISS`, sayaç 0 | 16,195 ms |

API'nin hata mesajı: `Gemini could not generate a valid Kötekli report. The cache was not changed.` Tanılama tekrarında Gemini istemcisi `ServiceUnavailable` hatası verdi. İlk denemenin sağlayıcı hata türü belirlenmedi. Her iki denemede de sonraki normal istek yerel pilot raporunu üretti.

Başarılı canlı Gemini metni, bu metnin `HIT` ile geri dönmesi ve yenilenen yanıtta puanların, kaynak bağlantılarının ve 28 Ekim 2026 pilot tarihinin korunması canlı ortamda henüz doğrulanmadı.

### Doğrudan Gemini kısa istek tanılaması

Aynı yerel `.env` ayarlarıyla, MahallEN rotası kullanılmadan Gemini SDK üzerinden `gemini-3.8-flash` modeline tek kelimelik yanıt isteyen kısa bir metin gönderildi. İlk `ServiceUnavailable` hatasından sonra 12 saniye beklendi ve aynı istek bir kez tekrarlandı.

| Deneme | Sonuç | Süre |
| --- | --- | ---: |
| İlk kısa istek | `ServiceUnavailable` | 5.129,516 ms |
| Tekrar | `ServiceUnavailable` | 2.732,874 ms |

Kısa doğrudan istekte de hata sürdüğü için bu tanılamada yetkili Kötekli yenilemesi ve ardından normal rapor isteği gönderilmedi. Canlı Gemini doğrulaması açık.

### Alternatif Gemini modeli · 6 Kasım 2026

Aynı API anahtarıyla alınan model listesinde `generateContent` destekleyen alternatif metin modelleri vardı. Kararlı Flash seçenekleri arasından `gemini-3.7-flash` seçildi. MahallEN rotasına uğramadan, tek kelimelik yanıt isteyen kısa istek **3.994,671 ms** sonra `ServiceUnavailable` hatası verdi.

Bu sonuç nedeniyle yerel `GEMINI_MODEL` ayarı değiştirilmedi ve Kötekli yenilemesi yeniden denenmedi. Canlı Gemini `200 → 200 HIT` doğrulaması açık.

### Tam Kötekli isteği · SDK ve REST karşılaştırması · 6 Kasım 2026

Yerel model `gemini-3.8-flash`. İki yol da aynı pilot dosyasından üretilen Kötekli girdisini, aynı sistem talimatını, JSON yanıt biçimini ve 2.048 çıktı token'ı sınırını kullandı. SDK çağrısı uygulamadaki mevcut taşıma yolunu kullandı. REST çağrısı doğrudan Gemini `v1beta` `generateContent` uç noktasına gönderildi. Her iki yol da metin dönebilseydi aynı uygulama doğrulamasından geçecekti.

| Yol | Zaman aşımı ayarı | Sonuç | Süre | Aşama |
| --- | ---: | --- | ---: | --- |
| SDK | 25 sn | `DeadlineExceeded` | 23.517,240 ms | Sağlayıcı çağrısı |
| REST | 25 sn | `ReadTimeout`, HTTP yanıtı alınmadı | 25.228,111 ms | HTTP yanıtı beklenirken |
| REST | 60 sn | HTTP `503` | 13.679,477 ms | Sağlayıcı HTTP yanıtı |

Üç çağrı da rapor doğrulamasına ulaşmadan sonlandı. İlk REST çağrısı istemcinin bekleme sınırına takıldı. Daha uzun sınırla yapılan ayrı REST çağrısında süre dolmadan `503` alındı. Bu gözlemler yalnızca SDK'ya özgü bir sorunu veya sürenin artırılmasıyla çözüleceğini göstermiyor. Sağlayıcı tarafındaki kesin neden belirlenmedi. Başarılı canlı rapor ve önbellek doğrulaması açık.

### Kısaltılmış Kötekli girdisi · 6 Kasım 2026

Gemini'ye gönderilen JSON, 28 Ekim 2026 pilot tarihini, mevcut beş kategori puanını ve toplam dokuz kısa gözlemi içeriyordu. Her kategoriye en fazla iki gözlem ve her gözleme bir kaynak adı verildi. JSON 1.496 bayttı. Tam kaynak bağlantıları ve ham gözlem kayıtları Kötekli API raporunda kaldı. Gemini çıktısı `executive_summary`, `pros` ve `cons` alanlarıyla sınırlı.

Backend mevcut yerel ayarlarla, aynı geçici SQLite veritabanı korunarak yeniden başlatıldı. `gemini-3.8-flash` ile tek yetkili canlı yenileme yapıldı.

| İstek | HTTP durumu | Önbellek | Süre |
| --- | ---: | --- | ---: |
| Yetkili `refresh_ai=true` | 502 | Önceki kayıt değişmedi | 25.249,282 ms |
| Sonraki normal istek | 200 | `HIT`, sayaç 1. Önceki pilot metni döndü. | 14,552 ms |

Güvenli tanılama kaydı sağlayıcı çağrısı aşamasında `DeadlineExceeded` ve SDK sağlayıcı kodu `504` gösterdi. Rapor doğrulamasına geçilmedi. Başarısız yenilemeden hemen önce ve sonra SQLite satırı karşılaştırıldı. Rapor, sürüm, saklama zamanı, son kullanma zamanı ve isabet sayacı aynıydı. Gemini çağrısı tekrarlanmadı.

39 API ve önbellek testi geçti. Sahte sağlayıcıyla başarılı yenileme, tam kaynakların ve ham gözlemlerin korunması, yeni metnin `HIT` ile dönmesi ve hatada son geçerli raporun korunması doğrulandı. Canlı Gemini metniyle `200 → 200 HIT` doğrulaması açık.
