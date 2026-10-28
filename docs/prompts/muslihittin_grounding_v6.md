# MahallEN — Muslihittin, Menteşe, Muğla statik pilot araştırması

## PROMPT
ÖNEMLİ DÜZELTME: Önceki aramada yanlış mahalleler ve şehirlerarası hatlar geldi. Yalnızca Muslihittin Mahallesi, Menteşe, Muğla için araştır. Emirbeyazıt olayını Muslihittin olayı sayma. 48-1, 48-2, 48-5 gibi şehirlerarası hatlar mahallenin içinden geçtiğine dair kanıt yoksa listelenmesin. Gerçek mahalle içi/yerel belediye hattı ve yerel sosyal yaşam için mahalle adıyla ayrı aramalar yap. Güncel olay bulunamazsa açıkça bulunamadı yaz; geçmiş olayın yılını değiştirme. Google Search aracını kullanarak Muslihittin Mahallesi, Menteşe, Muğla için 28 Ekim 2026 referans tarihli kaynaklı araştırma yap. Aynı adlı diğer şehir/ilçelerdeki yerleri karıştırma. URL kopyalama; aracın normal atıflarını kullan, gerçek URL'ler grounding metadata'dan alınacak. Kişi ismi, baş harf, telefon, ilan sahibinin iletişim bilgisi verme. Kaynakta olmayan bilgi üretme; yeterli örnek yoksa daha az yaz. Scraping veya erişim engeli aşma. Toplam en fazla 900 kelime. Yalnızca aşağıdaki dört bölüm olsun; puan veya genel güvenlik hükmü üretme.

KİRA:
Son 90 günden, farklı konutlara ait, uzun dönem aylık konut kiraları için mümkünse 1+0, 1+1, 2+1 ve 3+1 tiplerinden toplam 4-6 örnek bul. Günlük, haftalık, turistik/sezonluk veya devren işyeri ilanını konut kirası sayma. Her örnekte aşağıdaki alanları kullan; tarih ve kontrat türü kaynakta yoksa bilinmiyor yaz. İlan grubunu tüm mahallenin ortalaması sayma:
* KONUT_TİPİ | eşyalı/eşyasız/bilinmiyor | FİYAT TL/ay veya bilinmiyor | ilan tarihi: YYYY-MM-DD veya bilinmiyor | uzun dönem/sezonluk/bilinmiyor | yayıncı

GÜVENLİK:
Son 12 aydan en fazla 3 farklı yerel güvenlik veya kamu altyapısı olayı. Suç/şiddet, trafik ve altyapı ayrımını belirt. Tekil haberden suç oranı çıkarma. Olay tarihi ve yayın tarihi farklıysa olay tarihini kullan. Kişisel tanımlayıcıları ve grafik ayrıntıları çıkar:
* YYYY-MM-DD veya bilinmiyor | suç/şiddet/trafik/altyapı/duyuru | kısa tarafsız özet | yayıncı

ULAŞIM:
Yalnızca resmî MUTTAŞ ve belediye kaynaklarıyla mahalleden geçen en fazla 3 hattı araştır. Hat kodu, nereleri bağladığı ve kullanıcıya yararı olsun. Güncel sefer sıklığı/son sefer doğrulanamıyorsa bilinmiyor yaz. Moovit ve otobussaatleri gibi üçüncü tarafları resmî kaynak sayma. Eski duyuruyu güncel tarife diye kullanma:
* HAT_KODU | başlangıç ve duraklar / mahalle bağlantısı | ne işe yarar | sıklık ve son sefer veya bilinmiyor | resmî yayıncı

SOSYAL YAŞAM:
OSM'yi tamamlamak için bu mahallede veya açıkça belirtilmiş yakın çevresinde 5-7 gerçek isimli mekân/tesis örneği: restoran, fast food, kafe, bar, pub, canlı müzik, gece kulübü, park, market. Eksik türü uydurma. İşletmenin kendi sayfası veya açıkça konum desteği sunan dizin/kurumsal kayıt tercih et. İnternette listelenmesi bugün açık olduğunu kanıtlamaz; faaliyet durumunu bilinmiyor bırak. Koordinat tahmin etme. Başka mahalledeyse bunu açıkça yaz:
* İSİM | restaurant/fast_food/cafe/bar/pub/nightclub/live_music/park/supermarket | açık adres veya mahalle desteği | güncel faaliyet: bilinmiyor | yayıncı
