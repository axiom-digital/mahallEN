# Odaklı kategori araştırması

## PROMPT
Google Search kullan. Referans tarihi 28 Ekim 2026. Yalnızca Muğla'daki belirtilen mahalleleri araştır. URL kopyalama, normal araç atıflarını kullan. Kaynakta yoksa bilinmiyor yaz. İsim/baş harf/plaka/telefon ve grafik olay ayrıntısı yazma. Sayı tamamlamak için kayıt üretme, puan verme. Bugünü ilan veya olay tarihi olarak atama. Her maddeyi kaynakla ilişkilendir.
GÜVENLİK:
Her mahalle için son 12 aydan en fazla 4 farklı yerel olay/duyuru. Trafik, sağlık, altyapı, suç/şiddet, belediye duyurusunu ayrı tür olarak yaz. Baygın bulunma sağlık, trafik kazası trafik olarak sınıflansın. Haber sayısından suç oranı/puan çıkarma. Mahalle bağlantısı açık değilse ekleme. Aynı olayı tekrar etme. Olay tarihi ve yayın tarihini karıştırma; olay tarihi belirsizse bilinmiyor yaz. Kısa, tarafsız, kişisel tanımlayıcısız özet.
* YYYY-MM-DD veya bilinmiyor | olay türü | mahalle bağlantısı olan kısa olay özeti | yayıncı

Beş mahalleyi ayrı ayrı araştır:
KOTEKLI: Kötekli, Menteşe, Muğla
EMIRBEYAZIT: Emirbeyazıt, Menteşe, Muğla
MUSLIHITTIN: Muslihittin, Menteşe, Muğla
ORHANIYE: Orhaniye, Menteşe, Muğla
AKYAKA: Akyaka, Ula, Muğla
Çıktıyı tam olarak bu ASCII başlıklarla ayır: KOTEKLI:, EMIRBEYAZIT:, MUSLIHITTIN:, ORHANIYE:, AKYAKA:. Her başlığın altında sadece o mahalleye ait maddeler olsun. Toplam en fazla 1600 kelime.
