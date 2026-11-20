# Genel rapor ve filtreler — v2

Kullanıcı bütçesi veya kişisel gelir sorulmaz. Beş mahalle raporu doğrudan açılır; konut tipi ve eşya filtresi isteğe bağlıdır. Filtre değişiklikleri mevcut kayıtlar üzerinde yerel çalışır, model çağrısı yapmaz.

Farklı konut tipleri aynı ortancada birleştirilmez. Her tip için tarihli, sezonluk olmayan ve mahalle bilgisi çelişmeyen örneklerden referans çıkarılır. Tarihi veya konumu belirsiz örnekler incelenebilir ama gelir karşılaştırmasına katılmaz.

2026 net asgari ücret ve KYK lisans tutarıyla genel fiyat oranları verilir. İki kişilik eşit kira paylaşımı örnek senaryodur; kişisel gelir varsayılmaz. Beş kategorinin açıklanmış proje ölçütleriyle ön puanları gösterilir. Güvenlik, haber temelli ve düşük güvenli bir göstergedir; suç oranı değildir. Bütün puanlar varsa toplamda 32/10/28/20/10 ağırlıkları uygulanır. Varsayılan 1+1 referansı görünür; konut tipi değişimi kira ve toplam puanı günceller. Filtreler ve ayrıntılar kategoriye özel pencerelerdedir.

Ayrıntılar: [rapor kalitesi](REPORT_QUALITY.md). Yerel kontroller: `cd frontend`, `node scripts/test-report.mjs`, `npm run build`.
