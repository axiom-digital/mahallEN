# İl, ilçe ve mahalle bazında ortak araştırma akışı

## İş sözleşmesi

`backend/scripts/research_spec.py` ülke, il, ilçe, mahalle, kategori, referans tarihi,
model ve prompt sürümünden iş kimliği üretir. Pilot mahalle listesi veya Muğla'ya
özgü yayıncı/hat istisnası kullanmaz. Yerel kurumların kaynakları hedef konumdan aranır.
Desteklenen kategoriler asayiş, ulaşım, sosyal yaşam ve kiradır. Deprem için resmî/coğrafi
veri entegrasyonu gerekir; bu arama akışı bina güvenliği sonucu üretmez.

`try_two_stage_gemini.py`: 2.5 Flash + Search araştırması → 3.5 Flash-Lite yapılandırılmış
aday → ortak kayıt kontrolleri. Araştırma başarılı, sentez başarısızsa sonraki açık
çalıştırma araştırmayı yeniden çağırmadan devam eder. Hatalarda otomatik model/anahtar
değişimi yoktur. Raporlamada 500/502/503/504 için en fazla 3 deneme yapılır; iki tekrar
öncesi yaklaşık 10 ve 20 saniye, küçük rastgele ek süreyle beklenir. 429/kota ve yetki
hataları tekrar edilmez. Başarısız servis işi `deferred` kaydedilir. Sonraki açık
çalıştırma kaldığı araştırmadan devam eder. Denemeler anahtarları gizlenmiş ayrıntılı
hata mesajlarıyla `attempts.jsonl` içinde saklanır. Aynı işin eşzamanlı çalışması kilit
dosyasıyla engellenir. SDK tekrarları kapalıdır; iki ayrı tekrar mekanizması üst üste binmez.

```powershell
python backend/scripts/try_two_stage_gemini.py --province Muğla --district Menteşe --neighborhood Kötekli --topic safety --as-of 2026-10-29 --plan-only
```

`--plan-only` kaldırıldığında en fazla dört yeni API denemesi yapılır (bir Search,
en fazla üç rapor denemesi). Önbellekte araştırma varsa yeni Search yapılmaz. Başarılı sonuçlar
aynı işte yeniden kullanılır. Eski kimliksiz deney klasörleri otomatik devralınmaz.

## Çoklu yerleşim için kuyruk

Hedef dosyası bir JSON dizisidir; her satır country (isteğe bağlı), province, district,
neighborhood taşır. İlçe ve mahalle envanteri ileride güvenilir idari kaynaktan
beslenmelidir; modelden tüm yerleşimleri uydurması istenmez.

```powershell
python backend/scripts/run_research_jobs.py --targets data/cache/targets.json --topics safety transport social rent --as-of 2026-10-29 --max-jobs 2
```

Varsayılan yalnız plandır. `--execute` ile en fazla belirtilen iş sayısı çalışır;
ilk hatada kalan işler başlatılmaz. Tekrar hedef satırları ortak kimlikle birleşir.
Ücretsiz kotayı tüm ilçeler ve mahallelere ölçeklemek zamanlama gerektirir; bu kod
sınırsız kota sağlamaz. Üretimde kategoriye göre yenileme aralıkları, iş öncelikleri,
ülke/idari kimlik envanteri ve kalıcı kuyruk servisinin ayrıca bağlanması gerekir.

## Ortak kontroller ve sınırlar

- Aynı adlı mahalleler il/ilçe ile ayrılır. Cache bu üçlüye, tarihe, kategoriye ve sürüme bağlıdır.
- Geçersiz/gelecek/pencere dışı tarihler ve bilinmeyen kaynak kimlikleri elenir.
- Olay tarihi eksikse yayın tarihi yalnız yayın tarihi olarak korunur; olay tarihi uydurulmaz.
- Son 90 gün, geçmiş ve tarihsiz kayıtlar ayrı işaretlenir.
- Konum kanıtında il, ilçe, mahalle adlarının tamamı aranır. Eksik kanıt inceleme için ayrılır.
- Birebir aynı başlık+tarih tekrarları elenir. Anlamsal olay birleştirmesi hâlâ kaynak incelemesi ister.
- Tam metni okuma, alıntı ile iddia eşleştirme ve idari sınır/koordinat doğrulama henüz
  otomatik olgusal onay değildir. Modelin yazdığı konum kanıtını metinde isim arayarak
  kontrol etmek kaynağın doğruluğunu ispatlamaz.

Çıktılar `data/cache/research-jobs/<iş-kimliği>/` altında: araştırma, ham yanıtlar,
promptlar, aday, kabul/red gerekçeleri ve rapor. Mevcut frontend veri paketine otomatik
yayın yapılmaz. Kötekli arayüzü mevcut deneyin görüntüsüdür; tüm Türkiye entegrasyonu
tamamlanmış değildir.

Yerel kontrol: `python -m unittest discover -s backend/tests -p test_research_spec.py -v`

## Tam sayfa incelemesi ve servis kesintisinde gösterim

`review_source_pages.py` herhangi bir iş sözleşmesinin kaynaklarını tam sayfa olarak
okur. HTML `article/main` gövdesi dışındaki menü/altbilgiyi konum kanıtı olarak almaz.
Yayın tarihini sayfa metadata'sından okur; olay tarihine dönüştürmez. Başarısız,
aralık dışı veya hedef il/ilçe/mahalle bağlantısı olmayan sayfaları ayırır. Aynı hedefe
ait önceki araştırma kayıtları `--extra-research` ile ayrıca verilebilir.

Normal modda 3.5 Flash-Lite özetleri için birebir alıntı eşleşmesi de aranır.
`--sources-only` hiçbir model çağrısı yapmadan incelenmiş kaynak başlıklarını dışa
aktarır; `sources_ready_synthesis_deferred` durumu UI'da açıkça gösterilir. Bu başlıklar
AI özeti veya resmî doğrulanmış olay kaydı olarak sunulmaz. Servis kesintisi kaynak
haberlerinin görüntülenmesini engellemez. Bileşen hedef adı/tarih/filtreleri veri
sözleşmesinden alır; belirli bir mahalle için özel koşul içermez.

```powershell
python backend/scripts/review_source_pages.py --job data/cache/research-jobs/IS_KIMLIGI --output data/cache/source-review/IS_KIMLIGI --export frontend/src/data/safety-research.json --sources-only
```
