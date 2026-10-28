# MahallEN — kullanıcıya anlamlı kapsam ve deneme puanları, v4

Kullanıcı onayı: OSM'nin eksik sosyal yaşam/yeme-içme/gece hayatı bilgileri Gemini Google Search ile tamamlanabilir. Kira, güvenlik ve ulaşım aynı yöntemle araştırılır. Deprem verisi bu çağrıdan alınmaz. Puanlar kalibre edilmemiş model ön değerlendirmesidir; resmî suç/risk istatistiği değildir.

## PROMPT

Google Search kullanarak Kötekli Mahallesi, Menteşe, Muğla için 28 Ekim 2026 referans tarihli, kaynaklı bir araştırma yap. Çıktıyı aşağıdaki beş bölüme ayır. URL yazma veya kopyalama: kaynakları aracın normal atıflarıyla ilişkilendir, URL'leri API metadata'sından alacağız. Markdown tablosu ve uzun giriş yazma. Kişisel isim/baş harf/telefon verme. Bilgi yoksa uydurma.

KİRA:
Son 90 günden 1+1, 2+1 ve mümkünse 3+1 için karşılaştırılabilir, farklı konutlara ait 6-9 ilan örneği hedefle. Daha az bulursan bulunanı yaz; sayıyı doldurmak için ilan üretme veya aynı konutu tekrar sayma. Her satırı şöyle kısa yaz:
* 2+1 | eşyalı/eşyasız/bilinmiyor | 27000 TL/ay veya bilinmiyor | ilan tarihi: YYYY-MM-DD veya bilinmiyor | uzun dönem/sezonluk/bilinmiyor | yayıncı adı.
Uzun dönemle günlük/turistik konutu karıştırma. Bir ilan grubunu bütün mahallenin ortalaması, medyanı veya trendi sayma. Kaynakta gösterilmeyen eşya, tarih ve kontrat koşulunu tahmin etme. Scraping veya erişim engeli aşma.

GÜVENLİK:
Son 12 aydan en fazla 4 farklı, kaynaklı olay veya kamusal güvenlik/altyapı duyurusu. Olay tarihi ve yayıncıyı belirt; kopya haberleri tekilleştir. Suç/şiddet haberi ile yol/aydınlatma/altyapı olayını ayır. Haberlerden resmî suç oranı veya tüm mahalleye yönelik kesin güvenlik hükmü çıkarma. Mağdurların kişisel tanımlayıcılarını yazma.

ULAŞIM:
Yalnızca resmî belediye ve MUTTAŞ sayfalarını araştır. En fazla 5 ilgili hattı, hat kodu + hangi noktaları bağladığı + Kötekli sakinlerine ne yaradığı biçiminde belirt. Kampüs, tıp fakültesi, merkez ve otogar bağlantılarını ayır. Hafta içi/hafta sonu, güncel sefer aralığı veya son sefer doğrulanıyorsa açıkça yaz, yoksa bilinmiyor de. Eski duyuruyu bugünkü saat olarak sunma. Moovit veya benzeri kaynakları resmî bilgi yerine kullanma.

SOSYAL YAŞAM:
Kötekli'de veya açıkça belirtilmiş yakın çevresinde 6-8 farklı, adı görülen işletme/tesisi hedefle: restoran, fast-food, kafe, bar, pub, canlı müzik mekânı, gece kulübü. Mevcut olmayan türü varmış gibi üretme. İşletmenin kendi sayfası veya açıkça destekleyen harita/kurumsal kayıt öncelikli. Her satır:
* İSİM | TÜR (restaurant/fast_food/cafe/bar/pub/nightclub/live_music) | konum/mahalle desteği veya belirsiz | güncel faaliyet durumu doğrulandı/bilinmiyor | yayıncı adı.
İsmi aynı olan farklı işletmeleri veya geçmişte kapanmış olabilecek yerleri karıştırma. İnternette bir kaydın bulunması, işletmenin bugün açık olduğunun kanıtı değildir. Koordinat uydurma.

DEĞERLENDİRME:
Bu üniversite prototipi için, yukarıdaki bulgulara dayanarak DÖRT kategoriye 0-100 arasında kalibre edilmemiş bir ön değerlendirme puanı öner. 100 daha olumlu görünüm demektir. Sıfır kaynakla kesin puan verme: yetersizse score null olur. Eksik bilgi düşük güven olarak açıklanmalı; kesin suç veya ulaşım kalitesi ölçümüymüş gibi sunulmamalı. Kira puanında yalnızca bu örnekler ve 30000 TL/ay ÖRNEK konut bütçesi referans alınır; piyasa geneline ilişkin iddia üretme. Sosyal yaşamda çeşitliliği değerlendir; 30 kafeyi otomatik üstün mahalle sayma.
En sonda tek küçük JSON kod bloğu ver (yalnızca değerlendirmeler, en fazla 2000 karakter):
{"rent_cost":{"score":65,"confidence":"low veya medium","headline":"kullanıcı için anlamı","reason":"hangi bulgu neden","missing":"eksik veri"},"safety_news":{"score":55,"confidence":"low veya medium","headline":"anlamı","reason":"neden","missing":"eksik"},"transportation":{"score":70,"confidence":"low veya medium","headline":"anlamı","reason":"neden","missing":"eksik"},"social_life":{"score":70,"confidence":"low veya medium","headline":"anlamı","reason":"neden","missing":"eksik"}}
Şemadaki sayılar yalnızca biçim örneğidir, bunları kopyalama. Ön puanlar resmî endeks veya doğrulanmış sonuç değildir. Genel puanı ve deprem puanını sen hesaplama. Toplam yanıt en fazla 1200 Türkçe kelime olsun.
