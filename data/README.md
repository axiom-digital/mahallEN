# Muğla pilotu — düzenlenebilir statik veri seti v1

Kapsam: Kötekli, Emirbeyazıt, Muslihittin, Orhaniye (Menteşe); Akyaka (Ula). Bu ilk statik teslim gerçek kaynak izleri içerir. Olgusal kaynak kontrolü tamamlanmış bir envanter veya resmî güvenlik/afet ölçümü değildir.

## Dosyalar

- `manifest.json`: beş kayıt yolu, kapsam, veri sayıları ve SHA-256 bütünlük değerleri.
- `neighborhoods/*.json`: aynı şemadaki beş mahalle kaydı; asıl düzenlenebilir statik veri seti.
- `pilot/*_direct_sample.json`: OSM/Nominatim ve deprem araştırma sorgusu sonuçları.
- `pilot/kotekli.ui.v0.2.json`: Kötekli ön izleme girdisi; canonical beş mahalle kaydından ayrı eski görünüm.
- `research/*/result.json`: kullanılan Gemini çağrıları, sorgular, kaynaklar, destek segmentleri ve zamanları. v1/v2 Kötekli denemeleri reddedilmiş araştırma arşividir.

## Veri sözlüğü

| Alan | Tür / birim | Anlam |
| --- | --- | --- |
| `schema_version`, `id`, `name`, `district`, `city` | string | Şema sürümü ve mahalle kimliği |
| `reference_date` | YYYY-MM-DD | Araştırma referans tarihi; kaynak yayın tarihi değildir |
| `factual_review_status` | string | Kaynak iddialarının inceleme durumu |
| `location.lat`, `.lon` | number, WGS84 derece | Temsil noktası, mahalle sınırı/bina adresi değil |
| `categories.rent_cost.observations[]` | object[] | Konut tipi `rooms`, TL/ay `amount_tl_month`, eşya bilgisi `furnished`, ilan tarihi `date`, kontrat türü `lease_term` |
| `eligible_for_current_comparison` | boolean | Tarih ve uzun dönem koşulu gösterilen kira adayı; olgusal doğruluk onayı değildir |
| `categories.safety_news.observations[]` | object[] | Tarihli olay özeti ve `event_type`; trafik ve suç aynı ölçüm sayılmaz |
| `categories.transportation.observations[]` | object[] | Hat kodu ve resmî yayıncıya bağlı kaynak adayı; güncel saatler doğrulanmadıkça null |
| `categories.social_life.observations[]` | object[] | Web tamamlaması: isim, tür, açık konum betimi, konum kapsamı ve kaynak |
| `categories.social_life.osm` | object | OSM erişim durumu, ayrı ham kayıtlar, etiketler, kapsam ve lisans |
| `categories.earthquake_hazard` | object | PGA (`value`, g), en yakın grid mesafesi (km), dosya checksum'u, atıf, lisans ve olasılık tanımı |
| `sources[]` | object[] | Kaynak kimliği, yayıncı, HTTPS bağlantı ve `retrieved_at` erişim zamanı |
| `observations[].source_ids` | string[] | Bu dosyanın kaynak listesine bağlanan kimlikler |
| `grounding_supports[]` | object[] | Metadata'nın desteklediği metin segmenti; bütün bulgunun doğrulanması anlamına gelmez |
| `excluded_observations[]` | object[] | Kaynak/tarih/konum filtresiyle dışlanan adaylar ve nedenleri |
| `provenance` | object | Ham girdilerin dosya yolları, sağlayıcı modeli ve çağrı zamanları |

## Eksik değer ve düzenleme politikası

`null` bilinmeyen değerdir: sıfır kira, sıfır risk veya sıfır mesafe anlamına gelmez. OSM hatası `unavailable` durumudur, hizmetin olmadığı anlamına gelmez. Tarihsiz kira başka konut tipiyle veya başka mahalle fiyatıyla doldurulmaz. Web mekânlarına koordinat tahmin edilmez; dizinde bulunmaları bugün açık olduklarını göstermez. Kategori puanları canonical veri setinde null tutulur; puanlama ayrı katmandır.

Dosyalar normal JSON'dur; yeni kayıt eklenebilir, yanlış alan düzeltilebilir. Düzeltmede kaynak ve erişim zamanı da güncellenmelidir. Uygulama bunları her istekle yeniden üretmez. `backend/scripts/build_static_dataset.py` **açıkça çalıştırılırsa** ham girdilerden yeniden üretip mevcut dosyaların üzerine yazar; elle yapılan değişikliği korumak için ham girdiyi de düzelt veya yeniden üretmeden önce Git'te kaydet. Elle düzenlemeden sonra manifest checksum'u da yenilenmelidir.

Çevrimdışı yeniden üretme: `python backend/scripts/build_static_dataset.py`. Test: `.venv/Scripts/python -m pytest -q backend/tests/test_static_dataset.py`.

Kaynaklar: OSM © contributors / ODbL-1.0; deprem verisi Aktuğ, Şentürk, Özsaraç ve KILIÇ (2025), Aperta 274290, CC-BY-SA-4.0. PGA, resmî AFAD TDTH veya bina dayanıklılığı sonucu değildir. Ayrıntılar: [kaynak kaydı](../docs/DATA_SOURCES.md).
