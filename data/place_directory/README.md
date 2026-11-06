# Mahalle adı öneri dizini

Kaynak: [mumeyyizbuyuk/turkiye-data](https://github.com/mumeyyizbuyuk/turkiye-data),
`a0a453c75134e4a690d6c453cc7e8b514aa1d2c1` commit'i; 6 Kasım 2026'da indirildi.
Orijinal MIT lisansı bu klasördeki `LICENSE` dosyasıdır.

32.254 mahalle adı, ilçe ve il bağı için yerel arama dizinidir. Yalnızca isim ve
idari ad bağlantıları önerilerde kullanılır. Dosyalardaki nüfus, posta kodu veya
diğer alanlar rapora taşınmaz. Dizin bağımsız resmî güncellik onayı değildir;
güncel ad/sınır değişiklikleri kaynak kontrolü gerektirebilir.

Orijinal `neighborhoods.json.gz`, `districts.json`, `provinces.json` dosyaları
değiştirilmeden saklandı. Öneriler için ağ veya LLM çağrısı yapılmaz. Dizin
sonuçları hazır rapor oldukları anlamına gelmez; kullanıcı seçtiğinde kalıcı
rapor cache'i kontrol edilir. Dizin dışındaki açık aramalar Nominatim'e
başvurabilir; Nominatim arama kutusuna her harf yazıldığında çağrılmaz.
