"""Common evidence criteria, including adverse conditions, for every pilot."""
from build_static_dataset import ROOT

CRITERIA = {
 'rent_cost': 'Aylık kira ve kontrat koşulu; sezonluk/yıl boyu ayrımı; kaynaklı aidat/depozito/ek gider; düşük gelirli ve öğrenci için maliyet baskısı. İlan sayısı ucuzluk değildir. Güncel referans gelirleri yalnızca resmî kaynakla doğrula. Fiyat, tür ve tarih kaynaksızsa bilinmiyor de.',
 'transportation': 'Yerel bağlantı, yayımlanan sefer sıklığı/son sefer, devam eden yol/altyapı çalışması, yol çökmesi/kapanma, geçici güzergâh, durak taşınması/iptal, aktarma ve erişim sorunu. Hat varlığı hizmet kalitesi değildir. Kötekli için 1-62 yol çalışması ve altyapı etkilerini özellikle kontrol et ama aynı ölçütleri beş mahallede de araştır.',
 'social_life': 'Yemek çeşitliliği (döner/dürüm/burger/pizza, ev yemeği/esnaf, farklı mutfaklar), kaynaklı menü fiyatı ve ekonomik seçenekler; kafe dışındaki aktiviteler (canlı müzik, sinema, tiyatro, kültür, park, spor), gece hayatı türleri; kaynaklı gürültü/işletme kapanması/erişim sorunu. Dönercilerin sayısı mutfak çeşitliliği değildir. Menüyü okumadan mutfak türü üretme, çalışma saatini bugün açık diye sunma.',
 'safety_news': 'Suç/şiddet, trafik, gece aydınlatması, yaya koşulları ve kamu altyapısı sorunları ile kaynaklı iyileştirmeler. Trafik ve sağlık olayını suç sayma. Haber sayısını suç oranı sayma; habere rastlanmamasını güvenlik kanıtı sayma.'
}

BASE = '''Google Search ile 28 Ekim 2026 itibarıyla Muğla'daki KOTEKLI (Kötekli, Menteşe), EMIRBEYAZIT (Emirbeyazıt, Menteşe), MUSLIHITTIN (Muslihittin, Menteşe), ORHANIYE (Orhaniye, Menteşe; Marmaris'teki Orhaniye DEĞİL), AKYAKA (Akyaka, Ula) için tek bir kategori araştır. Kişi adı, plaka, telefon verme. Puan üretme. URL kopyalama; aracın normal atıflarını kullan.

Her mahallede olumlu VE olumsuz kanıt ara. Olumsuzluk bulamadığında varmış gibi üretme: önemli bilinmeyeni unknown olarak belirt. Tamamlanma kanıtı yok diye bir çalışmayı devam ediyor sayma; eski duyurunun bugünkü durumunu doğrulayamıyorsan bunu yaz. Hedef bitiş tarihi gerçekleşmiş tarih değildir. Her olumlu/olumsuz bulgunun mahalle ve tarih desteği olmalı. Resmî kaynaklar öncelikli, yerel haber/dizin ayrı etiketlensin. Net konum desteği olmayan bölgesel iddiayı mahalleye atama.

Ölçütler: {criteria}

Her mahalle için en fazla 5 madde. Her madde tek satır, şu biçimde:
* SLUG | positive/negative/unknown | ölçüt adı | YYYY-MM-DD veya bilinmiyor | en fazla 35 kelimelik somut bulgu ve kullanıcıya etkisi | yayıncı

Slug yalnızca yukarıdaki ASCII isimlerden biri olsun. Unknown bulgular kaynak olmadan yalnızca eksik ölçümü tarif edebilir; positive/negative mutlaka kaynak atfıyla desteklenmeli. Toplam en fazla 1300 Türkçe kelime.
'''
if __name__ == '__main__':
    target = ROOT / 'docs/prompts/assessment'
    target.mkdir(exist_ok=True)
    for category, criteria in CRITERIA.items():
        (target / f'{category}_v10.md').write_text('# Ortak kategori değerlendirmesi\n\n## PROMPT\n'+BASE.format(criteria=criteria),encoding='utf8')
