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

Yeni araştırmada Tavily Search ile kira, yerel haberler, toplu taşıma, sosyal yaşam
ve deprem kaynakları için beş `basic` sorgusu yapılır (her biri en fazla üç sonuç).
HTTPS kaynaklar alınır; tekrarlanan URL'ler birleştirilir, farklı sorgu özetleri
korunur. Tavily'nin şirket dizini sonuçları kanıt olarak alınmaz. Her kaynak
özeti en fazla 5.000 karakterdir. Varsayılan basic arama maliyeti, cache kaçıran
bir rapor için beş Tavily kredisidir; otomatik advanced yükseltme kapalıdır.
Ardından `google-genai` ile Gemini bu kaynak özetlerini Türkçe JSON raporuna
çevirir; Gemini Google Search çağırmaz. Çıktının tamamlanması, yerel Pydantic
şeması (Gemini isteğinde de zorunlu) ve her alıntının belirtilen kaynak metninde birebir bulunması kontrol
edilir. Eşleşmeyen bulgular elenir; hiç bulgu kalmazsa rapor kaydedilmez.
Bulgu elendiğinde serbest özet de kullanılmaz; yalnız kalan bulgu sayısını
belirten özet hazırlanır. Kabul edilen alıntılar rapor verisinde saklanır.
Eksik kategoriler boş kalır. Birebir alıntı kontrolü iddianın doğru yorumlandığını
kanıtlamaz; tam sayfa olgusal inceleme yerine geçmez. Aday durumu raporda belirtilir.

Başarısız veya yarım yanıt başarı diye kaydedilmez; eski cache satırı korunur.
Bir API sürecinde aynı mahalle için eşzamanlı seçimler tek üretimi paylaşır;
aynı anda en fazla iki yeni mahalle hazırlanır. Süre aşımı/servis/kota sorunu
kullanıcıya hata olarak döner; gizli tekrar döngüsü veya model değişimi yoktur.
Üretim için çok worker kullanılırsa süreçler arası iş kilidi/iş kuyruğu ayrıca
gereklidir. Normal çalışma tek Uvicorn worker'dır.

`TAVILY_API_KEY`, `GEMINI_API_KEY` ve `GEMINI_REPORT_MODEL` yalnız sunucuda
ayarlanır. Varsayılan model `gemini-3.5-flash-lite`; farklı desteklenen Gemini
modeli ortam değişkeniyle seçilebilir. Tavily sorguları ayrı ayrı 20 sn,
Gemini isteği 90 sn ile sınırlıdır. Arama veya model hatasında gizli fallback,
tekrar döngüsü veya sahte rapor yoktur. Cache TTL `REPORT_CACHE_TTL_SECONDS`
ile yönetilir. Önceden hazırlanmış cache kayıtları sağlayıcı değişiminde silinmez.
Frontend yalnız `VITE_API_BASE_URL` bilir; anahtarlar tarayıcıya verilmez.

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

7 Kasım 2026 Tavily + Gemini canlı kontrolü: Bostanlı / Karşıyaka / İzmir
ilk okumada `404`, gerçek üretimde `201 MISS` (12,5 sn), tekrar okumada aynı
raporla `200 HIT` verdi. `gemini-3.5-flash-lite` kullanıldı; kira için bir,
ulaşım için iki, sosyal yaşam için iki kaynak eşleşmeli bulgu saklandı.
Haber/güvenlik ve deprem kategorileri yeterli destek olmadığından boş kaldı.

Çıktı şeması API isteğinde zorunlu hâle getirildikten sonraki son sunucu
kontrolünde Bostanlı raporu `201 MISS` ile 48,66 sn'de üretildi; dört bulgunun
alıntısı rapor verisinde saklandı. Tekrar GET `200 HIT` ve birebir aynı JSON'u
verdi. Bu süreler tekil gözlemlerdir; arama/model yoğunluğuna göre değişebilir.
Backend testlerinin tamamı: 85 başarılı.

## Tam rapor ve puan ön değerlendirmesi (şema v2)

Kaynak özeti tam rapor değildir. Yeni raporda Tavily kaynak araştırması ve
alıntı eşleştirmesinden sonra ikinci Gemini adımı çalışır: en az üç paragraflık
anlatım, artılar/eksiler, beş kategori için gerekçe ve kaynak bulgu kimlikleri,
öğrenci/aile/çalışan yorumları üretilir. Ön puanlar modelin proje yorumudur;
ölçülmüş istatistik olarak sunulmaz. Kanıt olmayan puan ve farklı kategoriye
bağlanan bulgu kimliği reddedilir. Yeterli veri bulunmayan kategori null kalır.
Tekil asayiş haberinden genel güvenlik, PGA noktasından bina güvenliği puanı
üretilmesi istenmez.

Genel ağırlıklar maliyet 32, sosyal yaşam 28, haber/güvenlik 20, deprem 10,
ulaşım 10'dur. Profil ağırlıkları frontend'deki proje senaryolarıyla aynıdır.
Genel ve profil ön puanları yalnız mevcut kategori puanlarının ağırlıkları
yeniden oranlanarak hesaplanır; puanlanan başlık sayısı ekranda açıkça gösterilir.
Bunlar tüm boyutları kapsayan karşılaştırmalı bir ölçüm değildir.

GET, yalnız `report_version: 2` olan geçerli tam raporu döndürür. Eski kaynak
özetinde 404 döner; frontend POST ile tam raporu hazırlar. Mevcut geçerli kaynak
özeti bu yükseltmede yeniden web araması yapılmadan kullanılır. Başarıda v2
cache'e yazılır; hatada kaynak özeti korunur. Sonraki GET/POST üretim çağırmaz.
Arama sonuçları ve profil listeleri de cache'deki ön puanları kullanır.

Kayıtlı on mahallenin tam raporlarını kullanıcı açmadan hazırlamak için:

```powershell
cd backend
python scripts/prepare_place_reports.py
```

Komut iki paralel Gemini işiyle çalışır; geçerli tam raporları atlar. Başarısız
kayıtlar korunur, gizli sağlayıcı/anahtar değişimi yapılmaz. API başlangıcı LLM
çağırmaz. Ana sayfada kayıtlı mahalleler yine otomatik listelenmez.

Canlı v2 kontrolü (7 Kasım): on kayıtlı mahallenin tam raporu yerel kalıcı
cache'e hazırlandı; ikinci CLI çalışması hepsi için HIT verdi. Muğla dışından
Suadiye / Kadıköy / İstanbul ilk GET 404, Tavily + Gemini tam üretim 201 MISS
(24,71 sn), tekrar GET aynı JSON ile 200 HIT verdi. Suadiye örneğinde beş
başlığın ikisi için ön puan üretildi; yetersiz kategoriler sıfırla doldurulmadı.
Kötekli'de üç kategori ön puanı, üç paragraf rapor, artılar/eksiler ve üç profil
yorumu tarayıcıda kontrol edildi. Kayıtlı kaynaklardan hazırlanan raporlar yeni
Tavily araştırması yapılmış gibi etiketlenmez.
