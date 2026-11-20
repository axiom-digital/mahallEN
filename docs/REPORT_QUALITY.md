# Kaynaklı genel mahalle raporu — v2

28 Ekim 2026. Aktif görünüm `data/reports/index.json` içindeki beş v2 kaydı kullanır. `data/neighborhoods/` ve eski Kötekli ön izleme dosyaları önceki teslimlerin kaynak arşividir; yeni arayüzün puan kaynağı değildir.

## Ortak akış

Mahalle/kategori odaklı Search → kaynak/metin desteği → tarih, ilçe, mevsimlik koşul ve çelişki filtreleri → olumlu/olumsuz/bilinmeyen bulgular → beş kayıt için aynı rapor şeması → çevrimdışı ön yüz paketi. Mahalleye özel sayısal puan veya yol çalışması istisnası yoktur. Yol/altyapı haberleri ve kaynaklı kategori bulguları ortak kuralla ulaşım bildirimlerine bağlanır.

Yol çalışmasının bitiş hedefi gerçekleşmiş tarih sayılmaz. Bir yatırımın planlanması bugünkü hizmet kalitesinin iyileştiği anlamına gelmez. İşletme ofisi adresi otobüs bağlantısı kanıtı değildir. Tekil veya tarihsiz yorumlar mahalle geneline yayılamaz. Geçmiş kaynaklar güncel bulgu olarak değerlendirilmez.

## Raporun kullanıcıya sunduğu

- Bütçe veya kişisel gelir girişi zorunlu değildir; mahalle, konut tipi ve eşya filtresi vardır.
- Her konut tipinin kaynakta tarih belirtilmiş son 90 günlük örnekleri ayrı tutulur. Tipler birbiriyle ortalanmaz. Tarihi belirsiz fiyatlar ayrı işaretlenir; sezonluk fiyat gelir karşılaştırmasına katılmaz. Araştırmalarda mahalle çelişkisi bulunan örnekler de hesap dışında kalır.
- Resmî 2026 net asgari ücret ve KYK lisans tutarıyla genel kira yükü karşılaştırılır. İki kişinin eşit kira paylaşımı yalnızca örnek senaryodur; kişinin gerçek gelirini varsaymaz. Aidat, faturalar ve diğer yaşam giderleri bilinmediğinde sıfır sayılmaz.
- Ulaşımda resmî hat sayfasından doğrulanabilen başlık, yön/gün bazında yayımlanmış kalkış listesi, yayıncı güncellemesi ve okuma tarihi saklanır. Kalkış saati kullanıcının durağından geçiş saati değildir. Geçici güzergâh ve yol bildirimleri ayrıca gösterilir.
- Sosyal seçenekler ve ulaşım için açıklanmış proje ölçütleriyle ön puan gösterilir; sayım ölçülmüş kalite gibi sunulmaz. Tek türdeki işletme veya aynı olayın haber sayısı puanı çoğaltmaz. Menü ve fiyat bilgisi doğrulanmadan tam puan eklenmez. Ulaşımda tarifeler, hedefler, gece/hafta sonu seferleri ve son 90 gündeki yol/güzergâh bildirimleri incelenir.
- Güvenlik için kullanıcı talebiyle haber temelli, düşük güvenli bir ön gösterge eklendi; suç oranı veya kişisel risk tahmini değildir. 50 nötr başlangıçtan en güçlü iki tarihli asayiş olayının ağırlığı düşülür; ikinci olay en fazla 5 puan etkiler. Can kaybı 20, silah/yaralama/darp 10, hırsızlık/gasp 8; 180 günden eski olay yarı etkilidir. Asayiş kaydı yoksa 50 verilmez, puan boş kalır. Beş puanın tamamı varsa 32/10/28/20/10 ağırlıkları uygulanır. Kayıt sayısı veya tekrar haberler cezayı çoğaltmaz. Hesabın tek uygulaması `frontend/src/categoryEvaluation.mjs`, açıklaması `ScoreExplanation.jsx` dosyasındadır.
- Deprem karşılaştırması araştırma gridiyle sınırlıdır; resmî AFAD TDTH veya bina sağlamlığı sonucu değildir.

## Güncelleme

Canlı çağrılar yalnızca açık CLI komutuyla yapılır; sayfayı açmak kota tüketmez. Başarılı kategori işleri tekrar kullanılabilir. Günlük kota tükendiğinde yalnızca açıkça yapılandırılmış kullanılabilir proje anahtarına geçilir; dakikalık sınır, 503 ve yetki hatası anahtar döndürmez. Desteklenmeyen model bu anahtar için atlanır, model otomatik değiştirilmez. Tüm kullanılabilir kotalar biterse kuyruk durur. Aynı projedeki anahtarlar ek kota sağlamaz. Windows'ta saat dilimi verisi yoksa günlük blok süresi ihtiyatlı 24 saattir.

Çevrimdışı üretim:

```powershell
python backend/scripts/build_assessments.py
python backend/scripts/build_quality_reports.py
cd frontend
npm run build
node scripts/test-report.mjs
```

Kaynak okuma/araştırma ve yeni sağlayıcı çağrısı ayrı adımlardır. `data/cache/` ve `backend/.env` Git dışındadır. Kaynak tarihleri ve ham cevaplar arşivlenir. Kaynak atfı, her iddianın bağımsız doğrulama onayı değildir.

## Açık veri sınırları

Emirbeyazıt örneklerinde ilan tarihleri yetersizdir. Bazı web mekânları OSM'de bulunamadığı için koordinatsızdır; pin uydurulmaz. Menülerin bir kısmında yayın tarihi yoktur. Merkezde bazı OSM verileri örtüşen kayıtların yeniden kullanımıdır; kısmi kapsam arayüzde belirtilir. Tarife ve bildirimlerin fiziksel sahadaki uygulanışı canlı izlenmez. Ön değerlendirmede incelenmemiş ölçütler için puan eklenmez; bunlar hizmetin yokluğu veya kötülüğü olarak yorumlanmaz.

Ham deprem CSV önbelleği bulunmayan yeni checkout için, checksum doğrulanmış kaynaktan türetilen lisanslı PGA frekans tablosu `data/reference/hazard_distribution.json` içinde saklanır. Böylece rapor yeniden üretimi canlı sağlayıcı veya büyük yerel CSV gerektirmez. Eşleştirilmiş OSM mekân koordinatlarının kaynaklı özeti de `data/verified/venue_coordinates.json` içinde korunur.
# Kullanıcıya önce sonuç gösterimi

İlk ekranda genel açıklamalar yerine konut tipine ait tarihli kira aralığı, gelir karşılığı, tarihli ulaşım bildirimi ve mekân isimleri gösterilir. Varsayılan 1+1 referansı açıkça belirtilir; farklı konut tipine geçildiğinde özet ve fiyatlar birlikte değişir. Yeterli tarihli ilan olmayan mahallede fiyat türetilmez. Ayrıntılı araştırma bulguları açılır bölümlerde, ham kaynaklar ayrı pencerede kalır. Yayıncının iletişim adresi üzerinden mahalleye bağlanan haberler dışlanır.

## Araştırma kontrolü ve genişletme

v12–v15 aramalarının çıktıları otomatik olarak doğru sayılmaz. Muğla Orhaniye'ye taşınan İnegöl haberi, eski gezi rehberi menü fiyatları, yayıncı adresine dayanan haberler ve güvenlikle ilgisiz dolgu kayıtları aktif pakete alınmaz. Aynı tarihli benzer olaylar birleştirilir. Kötekli mekân taraması ve beş mahalle için gündem taraması genişletildi; Muslihittin ayrıca araştırıldı. Ham çıktıların `accepted_for_review` alanı yalnızca arama/şema kontrolüdür, olgusal onay değildir.

1-62 resmî sayfasındaki Kısmet Sitesi yol çalışması uyarısı doğrudan okundu. Sayfanın sonundaki modal uyarılarını da ayrıştıran düzeltme eklendi. Uyarının görüldüğü tarih `observedAt` olarak saklanır; olay/yayın tarihi diye uydurulmaz. Diğer tarihli haberlerin bugün hâlâ sürdüğü varsayılmaz.

## Kısa ana sayfa ve kategori pencereleri

Beş kategori aynı ana görünümde yer alır; her başlık, kart veya detay düğmesi yalnızca ilgili kategoriyi pencere içinde açar. Harita, ilanlar, hatlar, haberler ve yöntem ayrıntıları ana sayfayı uzatmaz. Açılan pencereler kategorinin kendi puanını ve içeriğini taşır. Mobil ve masaüstünde kategori karışmaması, kapanma, iç kaydırma ve haritanın açılması kontrol edildi.

`transport_reviews.json` dosyasındaki 3 Kasım 2026 teslim hedefi ve MSKÜ C kapısı araç erişim kısıtı yayıncı sayfaları doğrudan okunarak eklendi. Kısmi açılış tüm projenin tamamlanması sayılmaz. Güncel ulaşım koşulları gruplanır; aynı çökme olayı birden çok kart olmaz, eski duyurular açılır geçmiş bölümüne taşınır. Resmî site/durak erişim engeli ulaşım ön puanını en fazla 45, önemli hedefteki giriş kısıtı 35 ile sınırlar. Bu eşikler proje tasarım kararıdır; ölçülmüş ulaşım performansı değildir.
