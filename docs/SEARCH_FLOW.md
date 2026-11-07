> Güncel akış: mahalle seçimi `/mahalle/<id>` rapor sayfasını açar.
> Kategori kuralları `rules-v1`, türetilmiş genel/profil özeti `score_summary_version: 2`.
> Mevcut kategori ağırlıklarından ön puan hesaplanır; eksikler ve kapsam açıkça gösterilir.
> Aşağıdaki önceki sürüm notları tarihsel kayıttır; en son bölüm geçerli davranışı açıklar.

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
ve deprem kaynakları için on `basic` sorgusu yapılır (her biri en fazla beş sonuç).
HTTPS kaynaklar alınır; tekrarlanan URL'ler birleştirilir, farklı sorgu özetleri
korunur. Tavily'nin şirket dizini sonuçları kanıt olarak alınmaz. Her kaynak
metni, özet ve varsa raw içerikten en fazla 8.000 karakter olarak alınır.
Kira iki, otobüs/vapur/metro üç, sosyal olanaklar üç ayrı sorguyla araştırılır; otomatik
advanced yükseltme kapalıdır. Yeni araştırma on Tavily arama isteği kullanır.
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
ayarlanır. Seçili model `gemini-3.5-flash-lite`; kaynak çıkarımı ve rapor metni aynı
modelle üretilir. Otomatik model veya sağlayıcı değişimi yapılmaz. Tavily sorguları ayrı ayrı 25 sn,
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

Komut varsayılan olarak tek Gemini işiyle çalışır; geçerli tam raporları atlar.
`--workers 2` açıkça seçilebilir; `--rewrite-text` metin ve okuma detaylarını yeniler. Başarısız
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

## Puanlama düzeltmesi — v3 / rules-v1

Modelin yetersiz veriye rağmen nötr 50 üretmesi kabul edilmez. Model yanıt
şemasında artık puan alanı yoktur; eklerse Pydantic reddeder. Puanları
`rule_scoring.py` mevcut `categoryEvaluation.mjs` proje ölçütleriyle hesaplar.
Beş kategori tamamlanmadan genel/profil puanı hesaplanmaz; eksik kategorilerin
ağırlıkları kaldırılıp yanıltıcı toplam yapılmaz. Kira medyanı yalnız uygun,
tarihli, son 90 günlük 1+1 örneklerdir; 0 gerçek bir sonuç olabilir.

Çalışma alanındaki daha kapsamlı beş Muğla araştırması `data/scoring_research/`
altına kaynakları ve tarihleriyle taşındı. Özet paketin bu verinin yerine
kullanılması hatası giderildi. Diğer mahallelerde yalnız kaynakta açıkça bulunan
ve kurala uygun girdiler kullanılır; yetersizlikte 50 konulmaz. Bu durum her
mahallede tüm kategorilerin hazır olduğu anlamına gelmez.

Cache şeması 3 olduğundan eski model-puanlı v2 kayıtları tam rapor HIT sayılmaz.
Kaynak verisi korunarak v3'e yükseltilir. Hazırlama CLI'sı on kaydı v3 olarak
hazırladı. Kötekli canlı API ve tarayıcı kontrolünde 200 HIT: maliyet 18,
ulaşım 35, sosyal 73, haber göstergesi 25, ters PGA grid yüzdeliği 23; genel
37. Raporun kaynak referans tarihi 28 Ekim 2026 olarak açıkça gösterilir.
Bunlar eski kayıtlar ve açıklanmış proje ölçütleriyle hesaplanmış göstergelerdir;
güncel saha ölçümü, suç oranı veya bina dayanıklılığı değildir.

95 backend testi geçti. Regresyonlar: modelin puan alanı eklemesinin reddi,
boş veride 50 üretilmemesi, aynı olayın tekrar sayılmaması, kaynak dışı aylık
kira varsayılmaması, uzak PGA noktasının elenmesi, gerçek 0'ın korunması ve
bilinen Kötekli girdileriyle hesapların tekrarlanabilirliği.


## Güncel rapor akışı ve okuma ekranı — 7 Kasım 2026

Kullanıcının seçtiği akış **Tavily Search → Gemini `gemini-3.5-flash-lite`**.
Tavily kaynak arar; Flash-Lite hem kaynak çıkarımını hem Türkçe raporu yazar.
Alternatif yazıcı ayarı ve otomatik model fallback'i yoktur. Puanlar mevcut
`rules-v1` kurallarıyla hesaplanır. Yukarıdaki v2 bölümü tarihsel kayıttır;
model puanı ve kısmi toplam yaklaşımı kullanılmaz.

Cache geçerliliği şema sürümü yanında `writer_model` eşleşmesini de gerektirir.
Başka yazıcıyla oluşturulmuş kayıt GET HIT sayılmaz; kaynakları korunarak
seçili yazıcıyla yeniden hazırlanır. Üretim başarısızsa eski satır ezilmez.

`place_briefing.py` puanlamayla aynı girdilerden oda tiplerine göre kira örnekleri,
resmî hatlar, mekânlar ve tarihli bildirimler hazırlar. Ekranda oda tipi filtresi,
türüne göre mekân listesi ve yalnız koordinatı bulunan kayıtların Leaflet
haritası vardır. Harita konumu bilinmeyen mekânlara koordinat uydurmaz.
Okuma tarihi ile yayın tarihi ayrı alanlardır. Kaynak referans tarihi görünür.

Yazıcıya yinelenen yönlendirme URL'leri yerine sınırlı, okunabilir kaynak
metinleri ve çeşitli mekân örnekleri gönderilir; gerçek kaynak bağlantıları
raporda saklanır. Metin kontrolü örneklerden mahalle geneline atlama, ilan
medyanını ortalama diye sunma ve belirli tarihsiz devam iddialarını reddeder.
Bu kontroller tam olgusal incelemenin yerine geçmez.

Doğrulama: 105 backend testi ve frontend üretim derlemesi başarılı. Masaüstü
ve dar ekranda kira filtresi, mekân filtresi ve gerçek harita işaretleri
kontrol edildi. Yerel cache'deki 14 kayıt Flash-Lite yazıcı kimliğiyle üretildi;
Cihangir GET aynı JSON ile 200 HIT verdi. Bu yerel cache verisi Git'e eklenmez.


## İlk keşif ve kapsamlı araştırma düzeltmesi — 8 Kasım 2026

Mahalle seçimiyle birlikte hareketli keşif haritası ve mahalleye özel bekleme
ekranı açılır. Yüzde veya süreye bağlı sahte aşamalar gösterilmez. Sunucunun
`GET /places/{id}/report/status` yanıtı kontrol → araştırma → kaynak çıkarımı →
rapor yazımı aşamalarını bildirir. Frontend yalnız üretim sırasında bu durumu
izler; bitişte, hata veya mahalle değişiminde izleme durur. Status sorguları
raporun cache sayacını artırmaz. Gerçek cache HIT bekletilmeden açılır.

Bebek incelemesinde kaynaklı metnin sonradan dar regex'lerle tekrar çözülmesi,
ilan/haber tarihlerinin atılması ve resmî hatların kaybolması bulundu. Yeni
`research_facts.py` modeli ilan tutarı/oda tipi/ödeme dönemi, yayın tarihi,
mekân adı/türü/adresi ve resmî hat kodlarını yapılandırılmış olarak taşır.
Hedef mahalle ve kaynak eşleşmesi kontrol edilir. Fiyat ve oda tipi aynı ilan
alıntısında bulunmalı; önerilen diğer mahalle ilanları karıştırılmaz. Fiyat
satırından önce tarih bulunması artık fiyat eşlemesini bozmaz. Aylık dönem
açık değilse ilan yine gösterilir, aylık karşılaştırma puanına katılmaz.

Flash-Lite kaynakları beş kategoriye ayrılmış bağlamlarda işler (aynı anda en
fazla iki çıkarım isteği), ardından yine Flash-Lite metni yazar. Her kategoriye
ayrı bulgu bütçesi ayrılır. Alıntılarda yalnız Unicode/boşluk/tipografik tırnak
normalizasyonu uygulanır; değişen sayı veya kaynak kimliği kabul edilmez.
`research_version: 2` öncesindeki dinamik cache kayıtları yeni araştırmaya
alınır; yalnız eski metni yeniden yazmak yeterli sayılmaz. Hata eski kaydı silmez.

Hareket tarifesi eksikliği sıfır ulaşım hizmeti gibi puanlanmaz. Kaynaklı ilan,
hat, mekân ve bölgesel rapor notları puandan bağımsız görünür. Genel puan
hesaplanamıyorsa bulgu kapsamı ve sayısal karşılaştırma kapsamı ayrı etiketlenir;
bulgu sayısı puan yerine konulmaz. Profil metinleri doğrudan okunabilir.

Metin denetimi yayın tarihini olay tarihine dönüştürmeyi, istenen kira bedelini
gerçekleşmiş kira gibi anlatmayı ve belediye kitapçığı varlığını eksi saymayı
reddeder. Yalnız bu metin denetimi hatasında aynı modele en fazla bir düzeltme
isteği yapılır; tekrar başarısızsa sonuç kaydedilmez. Geçici Gemini 500/502/503/504 hatasında aynı model için en fazla bir kısa
tekrar yapılır. Kota hatası otomatik tekrarlanmaz; model değiştirilmez. Bu sınırlı editoryal kontrol olgusal doğruluk garantisi değildir.

Bebek canlı akışında Tavily'den 36 kaynak geldi; beş kategoride kaynaklı bulgular,
altı tekil ilan kaydı, on mekân ve iki resmî hat kaydı ekrana taşındı. Kaynakta
uygun 1+1 aylık kıyas ve yakın PGA noktası bulunmadığından bu puanlar uydurulmadı.

Son kontroller: 121 backend testi ve frontend üretim derlemesi geçti. Etiler
için gerçek API akışında araştırma → çıkarım → yazım aşamaları gözlendi;
yeni rapor 26,3 saniyede 201 MISS, sonraki GET aynı JSON ile 200 HIT verdi.
Masaüstü ve 390 px mobil yükleme görünümü kontrol edildi; yatay taşma yoktu.


## Mevcut son davranış — kısa görünüm ve doğrulanmış ek veri

Araştırma sürümü **3**. Önceki dinamik sürümler tamamlanmış yeni rapor sayılmaz.
Ana raporda bir giriş, konut örnek aralığı ve beş kısa kategori vardır. Uzun
kaynak/ilan/mekân/tarife listeleri kategori pencerelerine taşındı; Escape ve
kapatma çalışır. Profil yorumları sekmelidir. Aynı bulgular ikinci bir kart
ızgarasında tekrar basılmaz. Genel puan yalnız beş kategori tamamlanırsa görünür.

Yeni mahallede isim/ilçe/şehir ile tekil Nominatim eşleşmesi alınır. Eşleşme
olmazsa konum uydurulmaz. Checksum'u yayıncının canlı API'siyle doğrulanmış
CC-BY-SA-4.0 PGA gridi `data/geography/` altında lisans bilgisiyle paketlendi.
En yakın nokta 5 km içinde ise mevcut karşılaştırma kuralı kullanılabilir.
Bebek'in doğrulanmış temsil noktasındaki araştırma değeri .388 g; uzaklık
1.3937 km. Bu ölçüm AFAD veya bina dayanıklılığı değerlendirmesi değildir.

İETT kaynaklı ilk üç hattın gerçek resmî sayfasındaki hareket saati endpoint'i
okunur; yönler, hafta içi/cumartesi/pazar sütunları karıştırılmaz. 22 hattında
İstinye Dereiçi kalkışlı hafta içi 05:50–22:55 ve 79 yayımlanmış hareket görüldü.
Bu saatler Bebek durağından geçiş saati değildir. 22B'deki boş hafta içi sütunu
hafta sonu değerleriyle doldurulmaz. Her iki hattın kaynakları ve tabloları
kategori penceresinde açılabilir.

İsteğe bağlı OSM mekân toplaması bir ad/id ile eşleşen idarî alanı kullanır;
yarıçap mahalle sınırı diye sunulmaz. Kısa süre içinde kaynak yanıtlamazsa web
mekânları korunur ve sıfır mekân sonucu çıkarılmaz. Koordinat olmayan listede
boş harita gösterilmez. Bu ek toplama için ikinci bir LLM veya sağlayıcı yoktur;
araştırma ve yazım modeli hâlâ Gemini 3.5 Flash-Lite, web araması Tavily'dir.

Cache servisinde aynı yüklenmiş JSON nesnesinin iç alanları değiştirildiğinde
SQLAlchemy'nin güncellemeyi atlaması düzeltildi. Yenileme açıkça dirty olarak
işaretlenir; ayrı oturumdan tekrar okuma regresyonu eklenmiştir. Yayın tarihi
ile olay tarihi ayrımı ayrıca çıktı normalizasyonu ve doğrulamayla korunur.

Bebek yerel raporunda beş tekil ilan, on mekân, iki resmî hat ve yakın grid
verisi var. Dört kategori puanı hesaplanıyor. 1+1 aylık karşılaştırma girdisi
bulunmadığından maliyet/genel puanı uydurulmadı; gerçek 3+1 örnekler görünür.

Son doğrulama: 130 backend testi ve frontend üretim derlemesi başarılı.
Masaüstü/mobil kategori penceresi, 3+1 → 4+1 filtresi, gerçek İETT saatleri
ve Escape ile kapanma kontrol edildi. Bebek cache okuması araştırma sürümü 3
ve Flash-Lite kimliğiyle yapılıyor; bu veri Git dışındaki yerel cache
içindedir. Dağıtımda yeni dinamik kayıtlar aynı akışla üretilir.


## Ayrı rapor sayfası ve görünür puanlar — 8 Kasım 2026

Ana sayfada öneriden veya sonuç kartından mahalle seçimi artık aşağı kaydırmaz:
`/mahalle/<32-karakter-id>` adresine gider. Araştırma yükleme ekranı ve tam rapor
bu sayfada bulunur. Ana sayfadaki eski rapor bölümü ve özet penceresi kaldırıldı.
Sayfanın doğrudan açılması/yenilenmesi ve tarayıcı geri/ileri çalışır; aramaya
dönüşte önceki arama ve filtre durumu korunur. Ayrıntı kategorileri mevcut
pencerelerini kullanır. Ana görsel ve arama sayfasının tasarımı korunur.

`GET /places/{id}` yalnız mahalle metadatasını verir, araştırma başlatmaz.
Rapor sayfası kimliği URL'den alır; cache GET, gerekirse POST ve gerçek aşama
izlemesi bu sayfaya taşındı. Aramaya dönülürse eski frontend isteği/izlemesi
iptal edilir. Sunucuda başlamış araştırma başarılı olursa cache'e tamamlanabilir.
Vite geliştirme/preview SPA fallback'i derin URL'leri karşılar; farklı bir
statik üretim sunucusunda bilinmeyen frontend rotaları index.html'e yönlendirilmelidir.

Genel puanın bütün kategoriler tamamlanana kadar gizlenmesi kaldırıldı.
`with_score_summary` mevcut kategori puanlarının ağırlıklı ortalamasını alır;
**yalnız mevcut kategorilerin ağırlık toplamı** paydadır. Eksik kategorilere
0 veya 50 atanmaz. Hiç sayısal kategori yoksa genel puan da yoktur. Eksikli
sonuç **Genel ön puan** etiketi, X/5 kategori ve eksik başlıklarıyla gösterilir;
tam kapsamlı sonuçla eşdeğer olduğu iddia edilmez. Kategori kuralları değişmedi.

Örnek: Bebek'in mevcut maliyet dışındaki puanları sosyal 40, haber 40, deprem
12, ulaşım 40. Kullanılan ağırlık toplamı %68; `(40×28 + 40×20 + 12×10 +
40×10) / 68` yuvarlanınca 36 verir. Kapsam 4/5'tir, maliyet hesaba katılmaz.
Öğrenci/aile/çalışan ön puanları aynı kapsam ilkesiyle kendi ağırlıklarını kullanır.

Bu türetilmiş özet hem rapor cache GET/POST okumasında hem arama metadatasında
aynı fonksiyonla hazırlanır; yalnız toplamın değişmesi yeniden Tavily/Gemini
çağrısı gerektirmez ve kaynak/kategori puanları değiştirilmez. Ham cache'de
eski toplamın null olması yeni rapor sayfasında toplamı gizlemez.

Doğrulama: 132 backend testi, iki Node gezinme testi ve frontend üretim
derlemesi geçti. Tarayıcıda öneriden seçim, sonuç kartından seçim, yenileme,
geri/ileri, aramaya dönüş, 390 px mobil taşma ve 1280 px masaüstü puan görünümü
kontrol edildi. Bebek yeni adreste 36/100 genel ön puan ve beş kategoriyle açıldı.
