# Ayrıntılı araştırma ve proje puanlama girdileri

Bu beş kayıt, çalışma alanında daha önce hazırlanmış `data/reports/index.json`
(v2, kaynak referansı 28 Ekim 2026) paketinden alınmıştır. Yedi bulguluk Issue
#32 özetinin bu ayrıntılı verinin yerine geçmesi hatası düzeltilmiştir.
Yalnız skor/rapor girdileri taşınmıştır; eski arayüz veya yerel anahtarlar taşınmaz.
Her kayıt kaynak bağlantıları, okuma tarihi ve kaynak desteğini korur. Bunlar
araştırma kayıtlarıdır; her iddianın bağımsız saha doğrulaması değildir.

`rule_scoring.py`, mevcut `categoryEvaluation.mjs` ölçütlerinin Python karşılığıdır.
Türkçe büyük İ/i eşleştirmesi Python'da doğru uygulandığından Emirbeyazıt'ın
"Şehir İçi" bağlantısı da sayılır. Diğer ölçütler aynı kalır.

- Kira: yalnız son 90 gün, tarihli ve karşılaştırmaya uygun 1+1 aylık ilan medyanı;
  resmî net asgari ücret referansına oran; açıklanmış 0/.2/.3/.5/.75/1 eşikleri.
- Ulaşım: resmî hatlar, dört hedef türü, tarife yayılımı ve aralığı, gece/hafta
  sonu, tarihli yol/güzergâh kayıtları. Kaynakta görülen erişim kısıtları tavan getirir.
- Sosyal: altı olanak türü, adlardan sınırlı yemek çeşitliliği ipucu,
  kültür/spor/etkinlik ve doğrulanmış menü bilgisi. Sayım kalite ölçümü değildir.
- Haber: 50 başlangıçtan en güçlü iki tarihli olayın ağırlığı çıkarılır; olay
  yoksa 50 verilmez. Suç oranı veya kişisel güvenlik ölçümü değildir.
- PGA: yayıncının grid dağılımındaki ters orta yüzdelik. Bina dayanıklılığı,
  resmî AFAD TDTH veya bütün mahalleye ait risk puanı değildir.

`hazard_distribution.json`, Aktuğ, Şentürk, Özsaraç ve Kılıç'ın Jeodezik Deprem
Tehlike Haritası verisinden türetilen frekans tablosudur. CC-BY-SA-4.0; kaynak:
https://aperta.ulakbim.gov.tr/records/274290 . Yazar, lisans ve checksum dosyada
korunur. `income_2026.json` yayıncı bağlantılarıyla referans senaryolarını içerir.
28.075,50 TL net asgari ücret tutarı 7 Kasım 2026'da resmî ÇSGB tablosunda
kontrol edildi: https://www.csgb.gov.tr/poco-pages/asgari-ucret .

Genel/profil ön puanları mevcut kategorilerin ağırlıkları yeniden ölçeklenerek
hesaplanır; eksik başlıklar ve kullanılan kapsam ayrıca gösterilir. Hiç kategori
puanı yoksa toplam üretilmez. Tam kategori kapsamı olmadan sonuç kısmi ön puandır. Gemini'nin
şemasında puan alanı yoktur; model yalnız kodla hesaplanan girdilere dayanarak
rapor metni yazar. Eski model puanları report_version 3 ile geçersiz kılınır.
