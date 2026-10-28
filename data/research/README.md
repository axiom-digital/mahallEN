# MahallEN araştırma çıktıları

Bu klasör canlı sağlayıcı denemelerinin kaynak izlerini içerir. Model çıktısı, resmî ölçüm veya ekipçe doğrulanmış veri seti değildir.

- `kotekli_2026-10-28/`: **eski v1 denemesi, veri setine alınmayacak.** Beş başlık yanlışlıkla grounding'e verilmiş ve çıktı `MAX_TOKENS` ile kesilmiştir. Teknik olarak Search aracının çalıştığını gösterir; kategori kaynak planına uymaz.
- `kotekli_2026-10-28_v2/`: **reddedilmiş v2 denemesi.** Model yönlendirme URL'sini tekrarlamış, JSON tamamlanmamış ve token sınırına ulaşmıştır.
- `kotekli_2026-10-28_v3/`: tamamlanan kısa araştırma denemesi. Yalnızca kira, haber ve ulaşım kapsanır; kaynak URL'leri API metadata'sından alınır. Çıktı insan incelemesine adaydır, otomatik doğrulanmış veri sayılmaz.

Anahtarlar yalnızca Git'in dışladığı `backend/.env` dosyasında tutulur. `prompt.txt`, gönderilen gerçek promptun kopyasıdır. Normal API okumaları bu denemeyi çalıştırmaz; script açıkça çağrılmalıdır. Aynı çıktı klasörüyle tekrar çağrı yapılarak kota tüketilmesi engellenir.
