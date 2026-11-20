# MahallEN — Emirbeyazıt, Menteşe, Muğla kaynak yenileme v7

## PROMPT
Google Search ile yalnızca Emirbeyazıt Mahallesi, Menteşe, Muğla için 28 Ekim 2026 itibarıyla araştırma yap. Aynı isimli diğer ilçe/şehirleri ve komşu mahalleleri karıştırma. Önceki araştırmada tarihleri olmayan kiralar ve ilgisiz hatlar geldi; bu kez kaynaktaki bilgiyi açıkça ayır. Sayıyı tamamlamak için veri üretme. Kişi adı/baş harf/plaka/telefon verme. Grafik olay ayrıntıları yazma. URL kopyalama; kaynakları normal araç atıflarıyla ilişkilendir. Sonuçları sadece aşağıdaki dört bölümde madde madde yaz. Puan üretme. En fazla 1500 kelime.

KİRA:
Son 90 günden kaynakta ilan tarihi açıkça görünen, farklı konutlara ait en fazla 8 aylık kiralık konut örneği ara. 1+0, 1+1, 2+1 ve 3+1 çeşitliliğini araştır. Aynı konutu farklı sitede yeniden sayma. Günlük/haftalık/sezonluk kirayı konut aylığına çevirme. Tarih bulamazsan bilinmiyor yaz, BUGÜNÜ ilan tarihi olarak atama. Eşya ve uzun dönem koşulunu kaynaksız doldurma. Özellikle Emirbeyazıt mahalle ilan listeleri ve doğrudan ilan sayfalarını Search ile araştır; scraping/engel aşma yok. Komşu mahalleye ait ilanı ekleme. Kaynakta tarih yoksa en fazla 4 tarih-belirsiz örnek göster, bunu güncel piyasa ortalaması sayma.
* KONUT_TİPİ | eşyalı/eşyasız/bilinmiyor | FİYAT TL/ay | ilan tarihi: YYYY-MM-DD veya bilinmiyor | uzun dönem/sezonluk/bilinmiyor | Emirbeyazıt Mahallesi | yayıncı

GÜVENLİK:
Son 12 aydan bu mahalleye açıkça bağlanan en fazla 4 farklı olay/kamusal duyuru ara. Suç/şiddet, trafik, sağlık, altyapı ve belediye duyurusunu ayır. Olay tarihi bilinmiyorsa bunu belirt; yayın tarihini olay tarihi diye sunma. Suç oranı ve kesin güvenlik hükmü çıkarma. Aynı olayı farklı haberlerle çoğaltma.
* YYYY-MM-DD veya bilinmiyor | suç/şiddet/trafik/sağlık/altyapı/duyuru | kısa tarafsız olay özeti ve mahalle bağlantısı | yayıncı

ULAŞIM:
Yalnızca MUTTAŞ/ilgili belediyenin resmî kaynağında Emirbeyazıt mahallesine hizmet ettiği açıkça gösterilen en fazla 4 yerel hattı bul. Şehirlerarası hattı sadece ilçede olduğu için mahalle hattı sayma. Her hat için mahallenin adı geçen durak/güzergâh desteğini yaz; destek yoksa hattı ekleme. Kampüs, merkez, hastane, otogar gibi kullanıcıya faydasını belirt. Güncel sefer sıklığı ve son seferi kaynak doğrulamadıkça bilinmiyor yaz. Eski duyuru saatlerini kullanma.
* HAT_KODU | başlangıç ve bitiş / duraklar | mahalle bağlantısının kaynaktaki kanıtı | kullanıcıya faydası | güncel sıklık/son sefer veya bilinmiyor | resmî yayıncı

SOSYAL YAŞAM:
Emirbeyazıt içinde adı/adresi desteklenen 10-12 farklı gerçek mekân araştır: restoran/fast-food, kafe, market, park, kültür, bar/pub/canlı müzik/gece kulübü. Arama çeşitliliği olsun; eksik türü uydurma. Yakın ama başka mahalledeki yeri içerideymiş gibi yazma. Sadece yakın çevredeyse o mahalle adını açıkça yaz. Yer adlarını ve türlerini dikkatli kontrol et; kamp alanını restoran, pazar yerini süpermarket sayma. İşletmenin kendi sayfası veya adresi açık dizin/harita tercih et. İnternette bulunması güncel faaliyeti garanti etmez; açık olma durumunu bilinmiyor bırak. Koordinat tahmin etme.
* AD | restaurant/fast_food/cafe/bar/pub/nightclub/live_music/supermarket/marketplace/park/community_centre/camp_site | açık adres ve mahalle | faaliyet: bilinmiyor | yayıncı
