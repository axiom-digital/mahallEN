# MahallEN — 27 Ekim 2026 çalışma yol haritası

Bu belge bir çalışma sırası önerisidir; M2 teslim dokümanları veya tamamlanma onayı değildir. Durumlar 27 Ekim 2026'da [proje panosundan](https://github.com/orgs/axiom-digital/projects/1) okundu. Done işler tamamlanmış kabul edildi. Bu çalışma GitHub issue durumlarını değiştirmez.

## Mevcut pano

| Durum | İşler |
| --- | --- |
| Done (5) | #1 M0 raporu, #2 repo/pano kurulumu, #4 anket dağıtımı, #18 çekirdek iskelet, #3 M1 son ekip incelemesi |
| In Progress (2) | #5 UI taslakları (Şükrü), #10 frontend ve grafikler (Şükrü, Irmak) |
| Todo (11) | #6 M2 belgeleri; #7 veri seti; #9 LLM entegrasyonu; #11 backend/cache; #19–#23 M2 alt işleri; #24 uygulama doğrulaması; #25 haftalık durum güncellemesi |
| Backlog (1) | #8 anket analizi ve ağırlıklar (Osman) |
| Review/Test (0) | Henüz öğe yok |

Atamalar güncel panoya göredir: #7 Ferdi, #9 Osman ve Ferdi, #11 Şükrü, #24 Irmak, #25 Osman. M1 raporundaki eski atamalardan farklı olan yerlerde güncel pano esas alınır.

## Önce mevcut iskeleti güvenli hale getir

Bu kod düzeltmesi mevcut iskeletin bakımıdır. Yeni veri seti, anket analizi, cache veya M2 baseline dokümanlarını implement etmez.

- CORS izin listesi, kapalı debug, şifresiz yerel SQLite seçeneği ve zorunlu Docker veritabanı parolası.
- Loopback portları, non-root Docker kullanıcısı, reload kapalı imaj ve secret dosyalarını dışlayan build context.
- Normal okumaların LLM çağırmaması; operatör sırrı ve süreç başına 60 saniye aralığıyla korunan isteğe bağlı canlı yenileme.
- Model yanıtının şema, boyut ve düz metin kontrolü; hatalarda demo yanıtı.
- Import sırasında bağlantı kurmayan veritabanı başlangıcı ve her test için ayrı veritabanı.
- Türkçe/literal arama, parametre sınırları, eski frontend isteklerini iptal etme ve boş sonuç durumu.
- Güvenlik güncellemeleri ve açık demo veri etiketi. Gerçek veri ve kanıt üretimi #7/#8 altında kalır.

Çıkan test/derleme kayıtları, Irmak'ın [#24](https://github.com/axiom-digital/mahallEN/issues/24) doğrulamasında kullanabileceği yerel kanıttır. Ekip incelemesi tamamlanmadan issue tamamlandı sayılmaz.

### Yerel doğrulama kaydı — 27 Ekim 2026

| Kontrol | Sonuç |
| --- | --- |
| Backend, Python 3.12, `python -m pytest -q -p no:cacheprovider` | 30 test geçti. Starlette/httpx test istemcisi için 1 deprecation uyarısı var. |
| `npm run build` | Vite 6.4.5 ile başarılı. |
| `npm audit` | Bilinen açık: 0. |
| `pip-audit` ile kurulu backend/test bağımlılıkları | Bilinen açık bulunmadı. Paket yöneticisinin kendi sürümü uygulama bağımlılığı olarak sayılmadı. |
| Tarayıcı kontrolü, geçici SQLite + yerel Vite | İlk rapor, `KÖTEKLİ` araması, boş sonuçta raporun temizlenmesi, aramayı temizleyerek listenin dönmesi, Akyaka seçimi ve normal rapor yenileme geçti. |
| Docker/Compose | YAML ve güvenlik ayarları statik olarak kontrol edildi. Docker CLI mevcut olmadığından imaj build ve canlı PostgreSQL denenmedi. |
| Gerçek Gemini | Çağrı yapılmadı. Yetki, hız sınırı, yanlış şema/HTML/büyük yanıt ve sağlayıcı hatası testleri taklit sağlayıcıyla çalıştı. |

Bu kayıt iskelet bakımının kanıtıdır; #7, #8, #9, #10, #11 veya M2 onayının tamamlandığı anlamına gelmez. Güvenlik taramaları tarama anındaki bilinen paket açıklarını kapsar.

## Bugünkü M2 çalışma sırası

| Sıra | İş | Sorumlu | Somut çıktı / geçiş koşulu |
| --- | --- | --- | --- |
| 1 | [#24 Mevcut uygulamayı doğrula](https://github.com/axiom-digital/mahallEN/issues/24) | Irmak | Çalışan demo özellikleri, eksik paketler ve test/derleme kanıtları listesi; seed verileri gerçek veri sayılmaz. |
| 2 | [#8 Anket girdisini netleştir](https://github.com/axiom-digital/mahallEN/issues/8) | Osman | Gerçek yanıt sayısı, analiz durumu ve ağırlık kararının dayanağı. Yanıtlar hazır değilse bağımlılık açıkça kaydedilir; sonuç uydurulmaz. Backlog'dan taşımayı ekip kararlaştırır. |
| 3 | [#19 Kapsam ve öncelikli backlog](https://github.com/axiom-digital/mahallEN/issues/19) | Tüm ekip | Pilot mahalleler, MVP kabul ölçütleri, Must/Should sırası ve #7/#9/#10/#11'in açık kalan işlerini içeren liste. |
| 4 | [#20 Kalan iş tahminleri ve release planı](https://github.com/axiom-digital/mahallEN/issues/20) | Tüm ekip | Ekipçe onaylanan eforlar, bağımlılıklar, sahipler ve M2–M5 takvimi. Başlangıç sırası: veri/anket girdileri → sözleşme/prompt → backend/cache → UI entegrasyonu → kabul testi. |
| 5 | [#21 Ekip anlaşması, RACI ve iletişim](https://github.com/axiom-digital/mahallEN/issues/21) | Osman | Cross-functional çalışma korunarak iş bazında sorumlu, onaylayan, yedek ve haftalık iletişim düzeni. |
| 6 | [#22 Risk, varsayım ve Definition of Done](https://github.com/axiom-digital/mahallEN/issues/22) | Osman | M1 risklerinin güncel durumu; veri/LLM bağımlılıkları; kod incelemesi, test, kaynak doğrulama ve kanıt koşulları. Operatör yenileme koruması, kalıcı cache yerine sayılmaz. |
| 7 | [#23 Baseline inceleme ve yayımlama hazırlığı](https://github.com/axiom-digital/mahallEN/issues/23) | Osman | #19–#22 çıktılarının tutarlılık kontrolü, ekip onayı, backlog export ve pano görüntüsü. Gerçek ekip onayı ayrıca alınır. |
| 8 | [#25 Haftalık güncelleme](https://github.com/axiom-digital/mahallEN/issues/25) | Osman | 26 Ekim–1 Kasım dönemi için gerçekleşen/planlanan işler, sapmalar ve riskler. Onaylı alt çıktılar tamamlanınca #6 M2 paketi kontrol edilir. |

## Ayrı iş paketlerinde kalacak implementasyon

| İş | Planlanacak kapsam | Tamamlanma kanıtı |
| --- | --- | --- |
| [#7 Statik Muğla JSON veri seti](https://github.com/axiom-digital/mahallEN/issues/7) | Gerçek kaynak URL'leri, erişim tarihleri, veri sözlüğü ve eksik değer politikası | Veri dosyası + kaynak günlüğü + örnek kayıt incelemesi |
| [#9 LLM prompt ve API entegrasyonu](https://github.com/axiom-digital/mahallEN/issues/9) | Desteklenen SDK/model seçimi, tarafsız prompt, kaynak bağlantıları ve kontrollü API denemesi | Prompt sürümü + kaynaklarla karşılaştırılmış örnek rapor |
| [#11 Backend ve cache](https://github.com/axiom-digital/mahallEN/issues/11) | Doğrulanmış veri sözleşmesi, üretilen raporu saklama, geçerlilik/yenileme politikası | Yeni üretim ve cache okuması testleri; model çağrı sayısı ve süre kanıtı |
| [#5 / #10 UI ve grafikler](https://github.com/axiom-digital/mahallEN/issues/10) | Taslakların tamamlanması, veri sözleşmesine entegrasyon ve rapor sunumu | Taslak linki + PR + kullanıcı akışı görüntüleri |

Bu işlerin bugün tamamlanacağı varsayılmaz. #20 altında kalan efor ve bağımlılıklara göre takvime yerleştirilir. Bu yol haritası tamamlanmış bir M2 teslimi olarak sunulmamalıdır.
