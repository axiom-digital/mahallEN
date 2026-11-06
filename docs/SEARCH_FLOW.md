# Arama → seçilen mahalle → kayıtlı veya yeni rapor

Mevcut ana sayfanın görseli, arama kutusu, renkleri ve rapor kartları korunur.
Açılışta sabit mahalle kartları, hızlı pilot önerileri, mahalle sayısı veya
otomatik Kötekli raporu gösterilmez. İki karakterden sonra 250 ms beklemeyle
ilçe/şehir içeren öneriler açılır; klavyede aşağı/yukarı, Enter ve Escape çalışır.
Öneriler rapor oluşturmadan 32.254 isimlik yerel dizinden gelir.

## API

- `GET /api/v1/places/suggest?q=...`: yerel isim önerileri; dış servis veya LLM çağrısı yok.
- `GET /api/v1/places/search?q=...`: açık arama; yerel dizinde yoksa tek Nominatim sorgusu. Türkiye dışı ve mahalle/köy dışı sonuçlar elenir.
- `GET /api/v1/places/{id}/report`: kayıtlı geçerli rapor varsa `200`, `X-Cache: HIT`; yoksa `404`. Bu okuma LLM çağırmaz.
- `POST /api/v1/places/{id}/report`: kullanıcı seçiminden sonra cache yoksa kaynak araştırması ve rapor sentezi. Başarıda kalıcı SQLite/PostgreSQL cache'ine yazar, `201 MISS`. Tekrar POST veya GET aynı raporu `200 HIT` ile döndürür.

İsim önerisi, tek başına hazır rapor veya doğrulanmış mahalle verisi sayılmaz.
Yer kimliği il + ilçe + mahalle birleşimidir; farklı şehirlerde aynı ad cache'i
paylaşmaz. Konumlar `resolved_places`, raporlar mevcut `report_caches` tablosunda
`place:<kimlik>` anahtarıyla saklanır. Gerekli tablolar API başlangıcında oluşturulur.

## Kayıtlı veri ve yeni araştırma

`data/pilot_neighborhoods.json` içindeki 10 kaynaklı veri özeti ilk başlangıçta
kalıcı cache'e hazırlanır; bunlar LLM tarafından yeni üretilmiş rapor diye
sunulmaz. Başlangıç dış servis/LLM çağırmaz ve önceki üretilmiş raporu ezmez.
Diğer mahalleler yalnız kullanıcı seçtiğinde hazırlanır.

Yeni araştırmada `google-genai` SDK'sı ile Google Search kaynakları toplanır,
ardından aynı araştırma JSON raporuna dönüştürülür. Yanıtın tamamlandığı,
arama/kaynak metadata'sı ve her bulgunun gerçek destek segmenti + kaynak
kimlikleri kontrol edilir. Eksik kategoriler boş kalır. Bu, tam sayfa olgusal
inceleme yerine geçmez; arama destekli aday durumu kullanıcıya belirtilir.

Başarısız veya yarım yanıt başarı diye kaydedilmez; eski cache satırı korunur.
Bir API sürecinde aynı mahalle için eşzamanlı seçimler tek üretimi paylaşır;
aynı anda en fazla iki yeni mahalle hazırlanır. Süre aşımı/servis/kota sorunu
kullanıcıya hata olarak döner; gizli tekrar döngüsü veya model değişimi yoktur.
Üretim için çok worker kullanılırsa süreçler arası iş kilidi/iş kuyruğu ayrıca
gereklidir. Normal çalışma tek Uvicorn worker'dır.

`GEMINI_API_KEY`, `GEMINI_RESEARCH_MODEL` ve `GEMINI_REPORT_MODEL` sunucuda
ayarlanır. Son iki alanın varsayılanı `gemini-2.5-flash`. Araştırma ve rapor
çağrıları ayrı ayrı 90 sn sınırındadır; tamamlanmamış çıktılar elenir. Cache TTL
`REPORT_CACHE_TTL_SECONDS` ile yönetilir. Frontend yalnız `VITE_API_BASE_URL`
bilir; anahtarlar tarayıcıya verilmez. Docker imajı veri özetini ve isim dizinini
içerir; `google-genai` temel backend bağımlılığına eklendi.

## Kontroller

```powershell
python -X utf8 -m pytest -q backend/tests/test_places.py backend/tests/test_api.py backend/tests/test_caching.py backend/tests/test_issue32_dataset.py backend/tests/test_static_dataset.py
cd frontend
npm run build
```

6 Kasım 2026 canlı kontrolü: kayıtlı 10 mahallenin dışından ilk rapor örneği olarak Bornova/Erzene
seçildi. İlk okuma `404`, gerçek Gemini araştırması ve sentezi `201 MISS`, tekrar
okuma `200 HIT` döndü. 12 bulgu dört kategoride saklandı; yeterli kaynak bulunmayan
deprem kategorisi boş kaldı. Tarayıcıda eski tasarımın korunduğu, açılışta pilot
listesi olmadığı, `Erze` yazınca `Erzene / Bornova / İzmir` önerisi ve klavyeyle
seçimden sonra kayıtlı raporun açıldığı kontrol edildi.
