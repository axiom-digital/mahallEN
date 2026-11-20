# Odaklı kategori araştırması

## PROMPT
Google Search kullan. Referans tarihi 28 Ekim 2026. Yalnızca Muğla'daki belirtilen mahalleleri araştır. URL kopyalama, normal araç atıflarını kullan. Kaynakta yoksa bilinmiyor yaz. İsim/baş harf/plaka/telefon ve grafik olay ayrıntısı yazma. Sayı tamamlamak için kayıt üretme, puan verme. Bugünü ilan veya olay tarihi olarak atama. Her maddeyi kaynakla ilişkilendir.
ULAŞIM:
Her mahalle için yalnızca MUTTAŞ/belediye resmî sayfalarında mahalle/durak bağlantısı gösterilen en fazla 4 yerel hat. Şehirlerarası hattı sadece ilçeye geldiği için mahalle hattı sayma. Resmî güzergâh listesindeki mahalle/durak desteğini aktar. Güncel tarife belgesi olmadan saat, son sefer veya sıklık yazma. Kaynak yayın tarihi bilinmiyorsa belirt.
* HAT_KODU | başlangıç/bitiş | mahalle veya durak bağlantısının kaynaktaki desteği | kullanıcıya faydası | güncel sıklık ve son sefer: bilinmiyor veya kaynakta gösterilen bilgi | resmî yayıncı

Beş mahalleyi ayrı ayrı araştır:
KOTEKLI: Kötekli, Menteşe, Muğla
EMIRBEYAZIT: Emirbeyazıt, Menteşe, Muğla
MUSLIHITTIN: Muslihittin, Menteşe, Muğla
ORHANIYE: Orhaniye, Menteşe, Muğla
AKYAKA: Akyaka, Ula, Muğla
Çıktıyı tam olarak bu ASCII başlıklarla ayır: KOTEKLI:, EMIRBEYAZIT:, MUSLIHITTIN:, ORHANIYE:, AKYAKA:. Her başlığın altında sadece o mahalleye ait maddeler olsun. Toplam en fazla 1600 kelime.
