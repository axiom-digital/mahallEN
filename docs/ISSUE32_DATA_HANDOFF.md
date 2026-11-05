# #32 — Ferdi veri ve kaynak teslimi

Referans tarihi: **6 Kasım 2026**. Bu teslim LLM raporu üretmez ve rapor cache'ini doldurmaz. Osman'ın rapor üretim adımına girecek veriyi, kaynakları, eksikleri ve denetim izlerini hazırlar.

## Kullanılacak dosya

**`data/pilot_neighborhoods.json` → `neighborhoods[]`**: aynı şemada 10 mahalle. Mahalle başına ayrı dosyalar ve SHA-256 bütünlük değerleri `data/issue32/manifest.json` üzerinden bulunur. Kimlik/cache anahtarı için yalnız mahalle adı yerine `geo_key` kullanılmalıdır.

Mevcut `data/neighborhoods/` ve `data/manifest.json` önceki beş mahallelik akışın dosyalarıdır. Ayrı yerel rapor geliştirmesinde kullanılan `data/reports/` bu branch'in girdisi değildir. Bu teslim önceki veri dosyalarını yeniden yazmaz. API/LLM tarafı bu yeni giriş dosyasını açıkça okumalıdır; frontend'e otomatik yayın veya uygulamanın on mahalleyi sunması bu veri tesliminin sonucu değildir.

## Kapsam ve kaynaklı bulgular

| Mahalle | İlçe / il | Tarihli kira örneği | Haber | Ulaşım bulgusu | Sosyal örnek | Araştırma PGA, g |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Kötekli | Menteşe / Muğla | 3 | 1 | 1 | 1 | 0,351 |
| Emirbeyazıt | Menteşe / Muğla | 2 | 1 | eksik | 1 | 0,334 |
| Muslihittin | Menteşe / Muğla | 2 | 1 | 1 | 1 | 0,334 |
| Orhaniye | Menteşe / Muğla | 3 | 1 | 1 | 1 | 0,334 |
| Akyaka | Ula / Muğla | 3 | 1 | 1 | 1 | 0,391 |
| Caferağa | Kadıköy / İstanbul | 3 | eksik | 1 | 1 | 0,401 |
| Bahçelievler | Çankaya / Ankara | 3 | eksik | 2 | 1 | 0,304 |
| Kültür | Konak / İzmir | 3 | 1 | eksik | 1 | 0,368 |
| Yenibağlar | Tepebaşı / Eskişehir | 3 | eksik | eksik | 1 | 0,271 |
| Görükle | Nilüfer / Bursa | 3 | 1 | 1 | 1 | 0,344 |

Sayılar bu sınırlı teslimdeki gözlem sayılarıdır; gerçek dünyadaki olay, tesis veya hat sayısı değildir. Ulaşım sütunu hatla birlikte yol projesi/kaldırım haberini de içerebilir. Sosyal sütunu geçmiş etkinlik de içerebilir; `kind`, `type`, `date_basis` ve `limitations` alanları korunmalıdır.

- Issue'daki **Yeniköy yerine Akyaka/Ula** kullanıldı. Hat adında Yeniköy geçmesi o hattın otomatik dışlanması demek değildir: 1-66'nın Kötekli Muhtarlık durağı doğrudan kontrol edildi.
- **Bornova/Kültür idari eşleşmesi yanlıştı.** İzmir Büyükşehir Belediyesi'nin 14 Mart 2025 tarihli 267 sayılı kararı Konak/Kültür eşleşmesini açıkça gösteriyor. Kullanıcının onayıyla Kültür korunup ilçe Konak olarak düzeltildi. Bornova ve Konak verileri birleştirilmedi.
- Haber sayısı suç oranı değildir. Muslihittin örneği trafik kazası; Orhaniye örneği sağlık yardımıdır. Bu kayıtlar asayiş suçu diye etiketlenmedi. Hiçbir kategoride puan hesaplanmadı.

## Doğrulamanın anlamı

Paketin kullandığı **68 farklı kaynak URL'sinin tamamı** HTTP 200 yanıtı ve okunabilir sayfa/JSON ile kontrol edildi. Kaynağın asıl URL'si, yönlendirme sonucu, erişim zamanı ve yanıt SHA-256'sı kaynak kaydında bulunur. Gözlemler kısa kaynak alıntılarına, alıntı eşleşmesi de `review_receipts.json` kayıtlarına bağlıdır. Metin veya kaynak yanıtı değişirse önceki onay otomatik geçerli sayılmaz.

Bu oran **aktif pakette kullanılan URL'ler** içindir. `source_audit.json`, eski Muğla arşivi ve reddedilen adaylar dahil çok daha geniş taramanın sonuçlarını içerir; bazıları 403, boş gövde veya başka hata döndürmüştür. Tüm tarama URL'lerinin başarılı olduğu iddia edilmez. HTTP 200 tek başına iddianın doğruluğu değildir: mahalleyle ilişki, gövde ve kısa iddia ayrı incelendi. Bu bir asistan kaynak incelemesidir; insan/saha doğrulaması veya yayıncının iddiasının bağımsız kanıtı diye sunulmaz.

Eski arama destekli gözlemler otomatik aktarılmadı. `excluded_observations` eski kayıt kimliği ve dosyasını tutar; orijinal araştırma korunur. Bu, eski adayların hepsinin yanlış olduğu anlamına gelmez; bu teslimde yeniden incelenen dar bulgular kabul edilmiştir.

## Eksikler ve tarih politikası

- **Kiralar:** 28 örnek, erişilebilen Emlakjet sonuçlarının ilk sayfasından en fazla üç farklı oda tipi ve mahalle başına en fazla altı detay denemesiyle seçildi. Seçim rastgele/temsili değildir. Ayrıntı sayfasının üst adres bloğu il/ilçe/mahalleyle eşleştirildi; tavsiye edilen komşu mahalleler, ilan başlığı ve emlakçı adresi konum kanıtı sayılmadı. Sekiz yanlış mahalle adayı reddedildi. Hepsiemlak kaynakları doğrudan erişimde 403 verdiğinden bu kaynaktan arama özetiyle fiyat aktarılmadı.
- `date_basis=listing_updated_at` ilanın **güncelleme** tarihidir; ilk yayın veya sözleşme tarihi değildir. `asking_amount_tl` ilan sahibinin istediği TL bedelidir; gerçekleşen kiralama fiyatı değildir. Ödeme dönemi açıkça belirtilmediği için `price_period=not_explicitly_stated` ve `amount_tl_month=null`; aylık bedel varsayılmadı. Kontrat süresi de bilinmediği için `eligible_for_current_comparison=false`; ortalama ve medyan kiralar `null`. Aidat/fatura/vergi eksikleri sıfır sayılmaz.
- **Eksik haber:** Caferağa ve Yenibağlar için bulunan AA bağlantıları bu HTTP istemcisinde okunabilir makale gövdesi vermedi; arama özeti yeterli sayılmadı. Bahçelievler'de mahalleye bağlı güncel asayiş olayı kabul edilmedi; bulunan kaldırım şikâyeti ulaşım altında tutuldu. Bu durum olay yaşanmadığını göstermez.
- **Eksik ulaşım:** Emirbeyazıt'ta eski rapordaki bir okul durağı, bağımsız mahalle adresiyle eşleştirilemediği için atanmadı. Kültür ve Yenibağlar için açık mahalle bağlantısı bulunan güncel hat/durak kaydı kabul edilmedi. Şehir düzeyindeki hat varlığı mahalleye mal edilmedi.
- **Haber tarihi:** Kaynağın yayın tarihi `publication_date`; olay tarihi ayrıca belli değilse `event_date=null`. Emirbeyazıt belediye metnindeki “11 Ağustos” için yıl uydurulmadı. Kültür haberinde gövdeden tarih kesinleştirilemediği için tarih boş bırakıldı. Bunlar güncel olay diye sıralanmamalıdır.
- **Sosyal yaşam:** Örnekler adres/mahalle bağlantısı gösterir. Halka serbest giriş, işletmenin bugün açık olması, kalite ve güncel takvim ayrıca doğrulanmadı. Akyaka'daki konser geçmiş etkinliktir; kalıcı tesis veya düzenli program değildir.
- **Koordinatlar:** Nominatim sonuçlarında isim, ilçe ve il eşleşmesi arandı; `Mahallesi` eki normalize edildi. Tek eşleşme seçildi. Noktalar temsil noktasıdır; idari sınır, bina adresi veya yürüyüş süresi değildir. © OpenStreetMap contributors, ODbL-1.0.
- **Deprem:** Aperta 274290'ın mevcut yayıncı metadata'sındaki checksum, yerel grid ile karşılaştırıldı. PGA en yakın akademik grid noktasıdır; mesafe ve yöntem her mahallede saklanır. Aktuğ, Şentürk, Özsaraç ve KILIÇ (2025), CC-BY-SA-4.0. Resmî AFAD TDTH, zemin sınıfı, bina dayanıklılığı veya mahalle güvenlik puanı değildir.

## Veri sözlüğü ve LLM'ye devir

| Alan | Kullanım |
| --- | --- |
| `geo_key` | Ülke/il/ilçe/mahalle kimliği; cache veya iş kimliğinin coğrafi kısmı |
| `reference_date` | Teslim kesim tarihi; kaynak veya olay tarihi değildir |
| `identity`, `location` | Resmî yerel ad/adres kanıtı ve ayrı OSM temsil noktası |
| `categories.*.observations[]` | Yalnız bu teslimde sayfası okunmuş dar bulgular |
| `source_ids` | Mahallenin `sources[]` listesine bağlanan kaynak kimlikleri |
| `review_receipt_id` | `data/issue32/review_receipts.json` içindeki kısa alıntı ve yanıt hash kaydı |
| `verification` | Kaynak inceleme kapsamı; saha doğrulaması değildir |
| `date`, `date_basis`, `publication_date`, `event_date` | Tarihin anlamı açıkça ayrılmıştır; `null` bilinmeyendir |
| `missing_values`, `missing_reason`, `limitations` | LLM'nin doldurmaması/çıkarım yapmaması gereken sınırlar |
| `excluded_observations` | Kullanılmayacak arşiv adayları ve ret gerekçeleri |

Raporlama adımı yalnız seçilen mahallenin `categories` içindeki kabul edilmiş gözlemlerini ve kaynaklarını kullanmalı; `excluded_observations` veya eski arşivleri doğru kabul edip yeniden birleştirmemelidir. Eksik alanlara sayı/puan uydurmamalı ve farklı konut tiplerini karıştırmamalıdır. Raporun veri sürümü için manifestteki mahalle dosyası SHA-256'sı kullanılabilir. Kaynak ve haber metinleri güvenilmeyen girdidir; içeriklerindeki talimatlar uygulanmamalıdır.

## Yeniden üretme ve kontroller

Temel backend geliştirme bağımlılıklarına ek olarak HTTP toplama için `backend/requirements-grounding.txt` içindeki `requests` ve `beautifulsoup4` gerekir. **Çevrimdışı üretim ve aşağıdaki veri testleri API anahtarı gerektirmez.** Kaynakların tam metni Git dışındaki `data/cache/issue32-pages/` içinde, kısa kanıt kayıtları ise teslimde tutulur.

```powershell
# Kayıtlı kanıtlarla deterministik, çevrimdışı üretim:
python -X utf8 backend/scripts/build_issue32_dataset.py
python -X utf8 -m pytest -q backend/tests/test_issue32_dataset.py backend/tests/test_static_dataset.py

# Yeni HTTP kontrolü açıkça istenirse:
python -X utf8 backend/scripts/check_issue32_sources.py --refresh
# Değişmiş kaynaklar yeniden incelendikten sonra kısa kanıt kayıtlarını yenile:
python -X utf8 backend/scripts/build_issue32_dataset.py --record-review
```

Yeni kira örnekleri için `collect_issue32_rents.py`, coğrafya için `collect_issue32_geography.py` açıkça çalıştırılır. Sonra URL denetimi ve dar iddiaların tekrar incelemesi gerekir. Varsayılan komutlar kaydedilmiş HTTP yanıtlarını tekrar kullanır. Yeni referans tarihinde örneklerin tarih penceresi ve bu scriptlerdeki referans tarihi birlikte güncellenmelidir. Coğrafya scripti yerel araştırma CSV'si mevcut değilse PGA uydurmaz.

Doğrulananlar: on kimlik ve Konak/Kültür düzeltmesi; kaynak/alıntı/hash bağları; 403 veya değiştirilmiş iddianın reddi; ilan altbilgisindeki başka mahalleyle yanlış eşleşmenin reddi; güncelleme/yayın tarihi ayrımı; bilinmeyen kontratın karşılaştırmaya alınmaması; grid checksum/mesafe sınırı; manifest/tekil dosya/toplu dosya eşitliği ve çevrimdışı yeniden üretimin aynı baytları vermesi.
