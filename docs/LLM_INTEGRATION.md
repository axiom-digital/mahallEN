# #9 — Prompt tasarımı ve Gemini Search API entegrasyonu

Teslim kapsamı: **sürümlenmiş araştırma promptları, açıkça çağrılan Gemini API istemcisi, kaynak metadata'sı ve kabul/red akışı.** Kalıcı rapor API'sine veri taşıma ve cache yönetimi #11'dir. Ön izleme bir kullanıcı görüntülemesi için Gemini çağırmaz.

## Çalışan akış

1. Mahalle/ilçe belirten prompt hazırlanır. Kira, güvenlik, ulaşım ve eksik sosyal yaşam bilgileri Search ile araştırılır. OSM ve deprem araştırma gridi ayrı kaynaklardır.
2. `backend/scripts/grounding_client.py` modern `google-genai` SDK'sıyla `gemini-2.5-flash` ve `google_search` aracı kullanır. 90 saniye timeout, tek deneme, kontrollü çıktı sınırı vardır. Import sırasında ağ çağrısı yapılmaz.
3. `try_grounding.py` anahtarı sadece `backend/.env` içinden okur; CLI argümanına/ön yüz paketine taşımaz. Mahalle, model, prompt ve çıktı dizini açıkça seçilir. Aynı çıktı dizini tekrar kullanılırsa yeni istek gönderilmez.
4. `STOP`, gerçek arama sorguları, kaynaklar, destek segmentleri ve metin sınırı kontrol edilir. Eksik metadata, kesilmiş çıktı veya metne kopyalanmış uzun yönlendirme URL'leri veri setine kabul edilmez. Sağlayıcı hatası anahtarı yazdırmadan kaydedilir; otomatik yeniden deneme yapılmaz.
5. Araştırma adayı ayrı dosyalara kaydedilir. `build_static_dataset.py` destek bağlantısı olmayan, yanlış mahalleye ait, eski veya resmî ulaşım kaynağı olmayan bulguları filtreler. Destek metinleri korunur; kaynak varlığı olgusal doğruluk onayı sayılmaz.

## Canlı kanıt

- Beş pilot için tamamlanmış Search cevapları ve tam prompt kopyaları `data/research/` içinde. Muslihittin v5 yanlış/ilgisiz sonuçlar verdiğinden v6 ile yeniden araştırıldı.
- Yeniden kullanılabilir istemci ayrıldıktan sonraki canlı test: `data/research/integration_smoke_2026-10-28/result.json`. Sonuç `STOP`, 2 arama sorgusu, 5 kaynak ve 8 destek segmentiyle kabul edildi. Bu test rota kaynağı bulunmasını doğrular; bugünkü sefer tarifesi veya tüm olgular için onay değildir.
- Sürümlenmiş promptlar `docs/prompts/` içinde; kullanılan promptun birebir kopyası her araştırma klasöründe de saklanır.
- Puanların ağırlıkları arama modeline bırakılmaz. Genel ön izleme, ekibin #8 kararındaki %32 kira, %28 sosyal yaşam, %20 güvenlik, %10 deprem ve %10 ulaşımı kullanır. Öğrenci/aile/çalışan profillerinin ayrı dağılımları halen prototip varsayımıdır; anket bu ayrımları sağlamaz.

## Çalıştırma

Araştırma SDK'sının bağımlılıkları M1 backend'inden ayrı tutulur. Proje kökünde:

```powershell
py -3.12 -m venv .venv-grounding
.\.venv-grounding\Scripts\python -m pip install -r backend/requirements-grounding.txt
# backend/.env içindeki GEMINI_API_KEY kullanılır; dosya Git dışında kalır.
.\.venv-grounding\Scripts\python backend/scripts/try_grounding.py --model gemini-2.5-flash --neighborhood akyaka --prompt docs/prompts/akyaka_grounding_v5.md --output data/research/yeni-akyaka-denemesi --max-output-tokens 4096
```

Son komut canlı model/arama kotası kullanır. Statik dosyaları okumak, frontend derlemek ve birleştirici çalıştırmak kota kullanmaz. Normal API GET'leri ve demo refresh yolu canlı üretim başlatmaz. Eski M1 demo rapor servisi bu ayrı araştırma modülünün yerine geçirilmiş değildir.

## Kontrol sonucu

50 backend testi geçti. İstemci testleri gerçek sağlayıcıya gitmeden Search aracını, timeout'u, tek denemeyi ve girdi sınırlarını kontrol eder. Beş mahalle kaydının bütünlüğü, kaynak referansları, tarih pencereleri ve eksik değer davranışı test edilir. Frontend üretim derlemesi ve puanlama testleri geçti. Canlı çağrı kanıtı yukarıdaki arşivdedir.

#7 statik veri ve #9 prompt/API bağlantısı ayrı teslimlerdir. Kaynak incelemesi/güncellemeler, tamamlanmış kullanıcı arayüzü (#10), canlı rapor/cache (#11), ölçüt normalizasyonu ve doğrulama (#24) bu iki görevin bittiği ifadesiyle tamamlanmış sayılmaz.
