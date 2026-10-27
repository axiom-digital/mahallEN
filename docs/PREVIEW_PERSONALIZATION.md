# Konut tercihi ve puan ön izlemesi

Kira puanı artık sayfa açılışında 30.000 TL bütçe ve 2+1 varsayımıyla üretilmez. Kullanıcı raporun başında konut tipi ve evin toplam aylık kira bütçesini seçer. 1+0, 1+1, 2+0, 2+1, 3+1 seçenekleri vardır; yalnızca aynı konut tipinin kayıtları karşılaştırılır. Tercihler bu ön izlemede tarayıcı belleğindedir, sunucuya gönderilmez.

Seçilen konut tipinde örnek yoksa kira puanı `null` kalır. Başka konut tipinden fiyat, sıfır kira veya varsayılan değer kullanılmaz. Genel puan tüm kategoriler mevcut olduğunda gösterilir; eksik kirayı dışarıda bırakıp daha yüksek görünebilecek bir toplam sunulmaz.

Ulaşım ve sosyal yaşamdaki 70 değerleri, kaydedilmiş v4 Gemini cevabının taslak yorumlarıdır. Bunlar ölçüt bazlı sayısal bir modelden gelmemiştir. Ekranda taslak olarak etiketlenir, bulunan ve ölçülmeyen noktalar ayrı gösterilir. Yalnızca farklı sayılar göstermek için yeni puanlar üretilmedi. Nihai puanlama için ölçütler, ağırlıklar, eksik veri politikası ve gerçek ölçümler ayrıca belirlenmelidir. Bu değişiklik yeni Gemini isteği yapmaz.

Yerel kontroller: `cd frontend`, `node scripts/test-scoring.mjs`, `npm run build`.
