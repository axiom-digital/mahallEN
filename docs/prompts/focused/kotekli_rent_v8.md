# Odaklı kira araştırması

## PROMPT
Google Search kullan. Referans tarihi 28 Ekim 2026. Yalnızca Muğla'daki belirtilen mahalleleri araştır. URL kopyalama, normal araç atıflarını kullan. Kaynakta yoksa bilinmiyor yaz. İsim/baş harf/plaka/telefon ve grafik olay ayrıntısı yazma. Sayı tamamlamak için kayıt üretme, puan verme. Bugünü ilan veya olay tarihi olarak atama. Her maddeyi kaynakla ilişkilendir.
Yalnızca Kötekli, Menteşe, Muğla.
KİRA:
Son 90 günden kaynakta ilan tarihi açıkça görünen, farklı konutlara ait en fazla 8 aylık kiralık konut örneği ara. 1+0, 1+1, 2+1 ve 3+1 çeşitliliğini araştır. Aynı konutu farklı sitede yeniden sayma. Günlük/haftalık/sezonluk kirayı konut aylığına çevirme. Tarih bulamazsan bilinmiyor yaz, BUGÜNÜ ilan tarihi olarak atama. Eşya ve uzun dönem koşulunu kaynaksız doldurma. Özellikle Kötekli mahalle ilan listeleri ve doğrudan ilan sayfalarını Search ile araştır; scraping/engel aşma yok. Komşu mahalleye ait ilanı ekleme. Kaynakta tarih yoksa en fazla 4 tarih-belirsiz örnek göster, bunu güncel piyasa ortalaması sayma.
* KONUT_TİPİ | eşyalı/eşyasız/bilinmiyor | FİYAT TL/ay | ilan tarihi: YYYY-MM-DD veya bilinmiyor | uzun dönem/sezonluk/bilinmiyor | Kötekli Mahallesi | yayıncı
