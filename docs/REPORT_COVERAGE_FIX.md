# Arama kapsamı ve mahalle değerlendirmesi — 8 Kasım 2026

Bahçelievler / Yenişehir / Mersin raporundaki üç işletme, aramanın bulduğu
örneklerdi. Önceki sosyal yaşam kuralı bu örneklerin türlerinden 20/100
üretiyordu. Bu sayı mahallenin toplam işletme sayısını veya yaşam kalitesini
ölçmediği için bu dönüşüm kaldırıldı. Tekil haberlerden güvenlik puanı
üreten dönüşüm de kaldırıldı. Sosyal yaşam ve yerel gündem kaynaklı rehberdir.

Tavily artık kafe, restoran, market/fırın, spor ve park/kültür için beş ayrı
arama yapar; her biri en çok on sonuç ister. Türkiye bağlamı eklenir. Mekân
bulgusunda mahalle, ilçe ve şehir eşleşmesi aranır; farklı şehirdeki aynı
isimli mahalle kabul edilmez. İki büyük şehrin ulaşım siteleriyle sınırlı
eski alan adı filtresi kaldırılmıştır; Mersin ulaşım kaynağı da tanınır.
Haber sorgusu suç sözcükleriyle yönlendirilmez. Bir yıldan eski veya tarihi
doğrulanmamış haberler ana kart yerine kaynakları korunan arşivde gösterilir.

Mekân listesi bir sayım değildir. Daha fazla arama sonucu daha yüksek sosyal
yaşam puanı oluşturmaz. Kira ve ulaşım karşılaştırmaları birlikte yoksa
PGA değerinden tek başına genel mahalle puanı çıkarılmaz. Mevcut sayısal
kurallar doğrulanmış hizmet kalitesi veya bina dayanıklılığı ölçümü değildir.

Canlı kontrol Tavily + `gemini-3.5-flash-lite` ile yapıldı: yeni taramada 79
kaynak, 12 mekân örneği elde edildi. Önceki kaynaklı gözlemler orijinal tarih
ve koşullarıyla korunduğunda yerel önbellekte 14 örnek vardır. Önbellek ve
anahtarlar Git'e eklenmez. Kira ve ulaşımın sayısal karşılaştırma kapsamı
bu mahallede hâlâ yetersizdir; bu sınır ekranda açıklanır.

Regresyonlar: örnek sayısı kalite puanına çevrilmez; tekrar haber güvenlik
puanı üretmez; eski/tarihsiz haberler kaybolmadan arşivlenir; yetersiz
karşılaştırmada genel puan verilmez; model kaynak ISO tarihini değiştiremez.
