# MahallEN — veri kaynakları

## Güncel statik teslim — beş mahalle, 28 Ekim 2026

`data/manifest.json` beş pilotun sürümlenmiş dosyalarını ve SHA-256 değerlerini içerir. Canonical kayıtlar `data/neighborhoods/{kotekli,emirbeyazit,muslihittin,orhaniye,akyaka}.json` altındadır. [Veri sözlüğü ve düzenleme yönergesi](../data/README.md).

Kötekli v4; Emirbeyazıt, Orhaniye ve Akyaka v5; Muslihittin yanlış mahalle eşleşmeleri düzeltildikten sonraki v6 araştırmasını kullanır. Her kayıtta gerçek arama kaynağı, destek metinleri ve erişim zamanı korunur. Başka mahalleye ait ilanlar, eski haberler ve yerel erişimi göstermeyen şehirlerarası hatlar dışlanır. Tarihi/kontrat türü bilinmeyen kiralar aday olarak kalır, güncel karşılaştırma için uygun sayılmaz.

Sosyal yaşamda OSM ana kaynaktır; web örnekleri ayrı tutulur. Orhaniye Overpass yanıtı alınmıştır. Emirbeyazıt, Muslihittin ve Akyaka'da denenen servisler yanıt vermediği için `unavailable` korunur; bu mahallelerde sosyal yaşam web kaynaklı örneklerle doldurulmuştur. Hizmet yokluğu sonucu çıkarılmaz. Kötekli'nin ham OSM görüntüsü bir kerelik yerel teknik örnektir.

Araştırma PGA değerleri Kötekli 0,351 g; Emirbeyazıt, Muslihittin ve Orhaniye 0,334 g; Akyaka 0,391 g. Yakın mahalleler aynı en yakın grid noktasına düşebilir; bu veri resmî AFAD TDTH veya bina güvenliği değerlendirmesi değildir.

Bu teslim #7'nin **ilk statik veri sürümüdür**, tüm iddiaların insan tarafından doğrulandığı veya veri toplamanın nihai olarak bittiği anlamına gelmez. Yeni JSON kayıtları ve düzeltmeler sonradan eklenebilir. Ön izleme halen Kötekli'yi gösterir; diğer dört dosyanın kullanıcı arayüzüne bağlanması bu veri teslimiyle otomatik yapılmaz.

## İlk Kötekli denemelerinin kaynak kaydı

Tarih: 28 Ekim 2026. Pilot: Kötekli, Menteşe, Muğla. Bu çalışma kaynak toplama prototipidir; tamamlanmış MVP veya resmî risk değerlendirmesi değildir.

| Kategori | Verinin geldiği yer | Nasıl kullanılıyor? |
| --- | --- | --- |
| Kira ve maliyet | Gemini 2.5 Flash + Google Search; ilan/piyasa kaynakları | Kısa aday bulgu, gerçek arama sorguları, kaynak URL'leri ve desteklenen metin segmentleri kaydedilir. İlan fiyatı mahalle ortalaması sayılmaz. |
| Güvenlik ve haberler | Gemini 2.5 Flash + Google Search; kamu/yerel haber kaynakları | Haberler kaynaklarıyla saklanır. Haber sayısından suç oranı/puan üretilmez. Kişisel tanımlayıcı içeren model bulgusu incelemeye ayrılır. |
| Ulaşım | Gemini 2.5 Flash + Google Search; ilgili şehrin resmî belediye/ulaşım işletmesi | Resmî yayıncı filtresi uygulanır. Bu ilk adayda Moovit kaynaklı bulgu dışlanır. Güncel tablo olmadan sıklık ve son sefer üretilmez. |
| Sosyal yaşam ve günlük olanaklar | OpenStreetMap; hedef toplama servisi Overpass veya uygun veri özeti | OSM kimliği, konum, etiket, kaynak bağlantısı ve örnekleme kapsamı saklanır. İlk teknik örnek yerel OSM anlık görüntüsünden de hazırlanabilir. |
| Deprem tehlikesi — araştırma örneği | TÜBİTAK Aperta 274290, **Jeodezik Deprem Tehlike Haritası**, v1 (16.02.2025) | Dosya checksum'u kontrol edilip en yakın grid noktası ve mesafesi döndürülür. **Resmî AFAD TDTH ürünü değildir.** |

## Prompt ve sonuç dosyaları

- Gerçek kısa prompt: [kotekli_grounding_v3.md](prompts/kotekli_grounding_v3.md).
- Gönderilen promptun kopyası, ham model metni, sorgular, kaynaklar ve grounding metadata: `data/research/kotekli_2026-10-28_v3/`.
- Birleştirilmiş inceleme adayı: `data/pilot/kotekli.v0.1.json`.
- Doğrudan veri sonuçları: `data/pilot/kotekli_direct_sample.json`.

v1 bütün kategorileri yanlışlıkla Gemini'ye vermiş; v2'de uzun yönlendirme URL'si tekrarı oluşmuştur. İkisi de token sınırında kesildiği için veri seti olarak reddedilmiştir. v3 yalnızca üç kararlaştırılan kategoriyi araştırır ve URL'leri model metnine kopyalatmaz; API'nin gerçek `grounding_metadata` alanını saklar.

Grounding, web aramasının kullanıldığını gösterir. Bir bulgunun son cümlesine kaynak eklenmiş olması, bütün bulgunun doğrulandığı anlamına gelmez. Desteklenen metin segmentleri korunur ve tüm bulgular insan incelemesine adaydır. Moovit bulgusu ve kişisel tanımlayıcı içeren haber, birleştirilmiş örnekten dışlanır.

## Sosyal yaşam kapsamı ve servis durumu

Koordinat OSM/Nominatim'in döndürdüğü Kötekli temsil noktasıdır. Çevresindeki 1.000 metre **mahalle sınırı değildir**. OSM noktaları kendi koordinatıyla, alanlar yaklaşık nesne orta noktasıyla filtrelenir. Sayılar eksiksiz/tekilleştirilmiş işletme envanteri değil, kayıtlı OSM nesneleridir. Yer kaydı olmaması, gerçekte o hizmetin olmadığı anlamına gelmez.

Overpass kamu sunucuları testte HTTP 502/504 veya zaman aşımı döndürmüştür. Bu durum sıfır mekân olarak kaydedilmez. Tek seferlik teknik kontrolde yerelde saklanan küçük OSM harita görüntüsü `--osm-snapshot` ile çevrimdışı işlenir. OSM düzenleme API'si uygulamanın sürekli okuma servisi olarak kullanılmaz. Üretim toplaması için çalışan Overpass veya uygun veri sağlayıcısı/veri özeti gerekir. Ham önbellek `data/cache/` altında Git'in dışındadır.

Atıf: © OpenStreetMap contributors; ODbL-1.0. [Lisans](https://www.openstreetmap.org/copyright), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [API kullanım politikası](https://operations.osmfoundation.org/policies/api/).

## Deprem araştırma verisi

[Aperta kayıt](https://aperta.ulakbim.gov.tr/records/274290) ve [yayıncı metadata API'si](https://aperta.ulakbim.gov.tr/api/records/274290), 201.920 satırlık CSV'nin `lon,lat,PGA` alanlarını ve CC-BY-SA-4.0 lisansını sunar. Eşlik eden `PGA_0.10.png` görselinde birim **g**, aşılma olasılığı **50 yılda %10** olarak belirtilmiştir. CSV'nin MD5 değeri yayıncıdaki değerle karşılaştırılır.

Atıf: Aktuğ, Bahadır; Şentürk, Murat Doruk; Özsaraç, Vedat; KILIÇ, Nazan (2025), *Jeodezik Deprem Tehlike Haritası*, v1, Aperta 274290, CC-BY-SA-4.0. Bu prototipte uygulanan işlem: en yakın yayımlanmış grid noktasını seçme; enterpolasyon yok. Resmî AFAD TDTH çıktısı olarak yeniden adlandırılmaz.

En yakın nokta mesafesi sonuçta görünür; 5 km'den uzak noktaya değer verilmez. Bu sınır bir prototip kapsama kontrolüdür, bilimsel doğruluk güvencesi değildir. Mahalle geneli, bina riski, yerel zemin veya afet güvenliği puanı türetilmez. Kaynakların atıf ve lisansları kategori bazında korunur; ham dosyalar yerel önbellekte tutulur.

## Tekrar çalıştırma

Gemini denemesi model kotası kullanır; normal uygulama okumaları bunu tetiklemez:

```powershell
python -m pip install -r backend/requirements-grounding.txt
python backend/scripts/try_grounding.py --model gemini-2.5-flash --output data/research/yeni-deneme
```

API anahtarı yalnızca Git'in dışladığı `backend/.env` içinde kalır. Aynı çıktı klasörü kullanılırsa script yeni Gemini isteği göndermez.

Kaydedilmiş girdilerle tekrar birleştirme, yeni Gemini isteği kullanmaz:

```powershell
python backend/scripts/collect_direct_sample.py --osm-snapshot data/cache/kotekli_osm_map_sample.json
python backend/scripts/build_pilot_sample.py
```

Bu dosyalar #7'nin ilk kaynaklı örneği ve #9'un bağlantı denemesidir. Eski demo veritabanı otomatik değiştirilmez; frontend/backend sözleşmesine bağlama ve kalıcı rapor cache'i ayrı iş paketidir.

## Deneme özeti

Toplam üç Gemini üretim isteği gönderildi: v1 ve v2 reddedildi, v3 tamamlandı. v3'te 5 arama sorgusu, 10 kaynak ve 6 metin-kaynak desteği döndü. Birleştirilmiş adayda 2 kira, 1 haber ve 1 resmî ulaşım bulgusu bırakıldı; kişisel tanımlayıcı içeren haber ve üçüncü taraf ulaşım bulgusu çıkarıldı.

OSM temsil noktasının 1.000 metre çevresindeki teknik görüntüde 37 uygun OSM nesnesi bulundu: 29 kafe, 1 restoran, 2 park, 3 süpermarket ve 2 küçük market. Bunlar gerçek işletme sayımı veya mahalle sınırları içindeki toplamlar değildir.

Deprem araştırma gridinde seçilen en yakın nokta, temsil noktasına yaklaşık 1,054 km uzaklıktadır; ham değeri 0,351 g'dir. Bu sayı yukarıda belirtilen araştırma modelinin nokta değeridir; resmî AFAD değeri, mahalle geneli veya bina güvenliği sonucu değildir.

Yerel kontrol: 39 backend testi geçti; testler dış servislere istek göndermez. Tek Starlette/httpx deprecation uyarısı var. Ham kaynaklar ve erişim/işleme tarihleri sonuç dosyalarında korunur. Canlı Overpass erişim sorunu ve gerçek veri/puan doğrulaması açık işlerdir.
