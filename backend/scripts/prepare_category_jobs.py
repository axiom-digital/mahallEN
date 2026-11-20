"""Prepare focused category searches and a resumable explicit request plan."""
import json
from pathlib import Path
from build_static_dataset import ROOT, PILOTS
from prepare_quality_prompts import TEMPLATE

COMMON = '''Google Search kullan. Referans tarihi 28 Ekim 2026. Yalnızca Muğla'daki belirtilen mahalleleri araştır. URL kopyalama, normal araç atıflarını kullan. Kaynakta yoksa bilinmiyor yaz. İsim/baş harf/plaka/telefon ve grafik olay ayrıntısı yazma. Sayı tamamlamak için kayıt üretme, puan verme. Bugünü ilan veya olay tarihi olarak atama. Her maddeyi kaynakla ilişkilendir.
'''
INSTRUCTIONS = {
'transportation': '''ULAŞIM:
Her mahalle için yalnızca MUTTAŞ/belediye resmî sayfalarında mahalle/durak bağlantısı gösterilen en fazla 4 yerel hat. Şehirlerarası hattı sadece ilçeye geldiği için mahalle hattı sayma. Resmî güzergâh listesindeki mahalle/durak desteğini aktar. Güncel tarife belgesi olmadan saat, son sefer veya sıklık yazma. Kaynak yayın tarihi bilinmiyorsa belirt.
* HAT_KODU | başlangıç/bitiş | mahalle veya durak bağlantısının kaynaktaki desteği | kullanıcıya faydası | güncel sıklık ve son sefer: bilinmiyor veya kaynakta gösterilen bilgi | resmî yayıncı
''',
'social_life': '''SOSYAL YAŞAM:
Her mahallede tür çeşitliliği olan 8-10 isimli işletme/tesis örneği: restoran, fast food, kafe, bar/pub/canlı müzik/gece kulübü, market, park, kültür. İşletmenin kendisi veya adresi açık harita/dizin kaydı öncelikli. Gece kulübü yoksa uydurma; barla karıştırma. Aynı marka/şube tekrar etmesin. Kampı restoran, pazar yerini süpermarket sayma. Başka mahalledeyse o mahalleyi ve yakın çevre kapsamını açıkça yaz. Kaynakta geçen adresi aynen koru, koordinat tahmin etme. İnternette listelenmesi güncel faaliyetin kanıtı değildir.
* AD | restaurant/fast_food/cafe/bar/pub/nightclub/live_music/supermarket/marketplace/park/community_centre/camp_site | açık adres ve mahalle | faaliyet: bilinmiyor | yayıncı
''',
'safety_news': '''GÜVENLİK:
Her mahalle için son 12 aydan en fazla 4 farklı yerel olay/duyuru. Trafik, sağlık, altyapı, suç/şiddet, belediye duyurusunu ayrı tür olarak yaz. Baygın bulunma sağlık, trafik kazası trafik olarak sınıflansın. Haber sayısından suç oranı/puan çıkarma. Mahalle bağlantısı açık değilse ekleme. Aynı olayı tekrar etme. Olay tarihi ve yayın tarihini karıştırma; olay tarihi belirsizse bilinmiyor yaz. Kısa, tarafsız, kişisel tanımlayıcısız özet.
* YYYY-MM-DD veya bilinmiyor | olay türü | mahalle bağlantısı olan kısa olay özeti | yayıncı
'''}

if __name__ == '__main__':
    jobs = []
    directory = ROOT / 'docs/prompts/focused'
    directory.mkdir(exist_ok=True)
    for slug, name, district, _ in PILOTS:
        rental = TEMPLATE.split('KİRA:\n', 1)[1].split('\nGÜVENLİK:', 1)[0]
        prompt = '# Odaklı kira araştırması\n\n## PROMPT\n' + COMMON + f'Yalnızca {name}, {district}, Muğla.\nKİRA:\n' + rental.format(name=name, district=district)
        path = directory / f'{slug}_rent_v8.md'
        path.write_text(prompt, encoding='utf8')
        jobs.append({'id': f'{slug}_rent_v8', 'neighborhood': slug, 'category': 'rent_cost', 'prompt': path.relative_to(ROOT).as_posix()})
    for category, instruction in INSTRUCTIONS.items():
        places = '\n'.join(f'{slug.upper()}: {name}, {district}, Muğla' for slug, name, district, _ in PILOTS)
        prompt = '# Odaklı kategori araştırması\n\n## PROMPT\n' + COMMON + instruction + '\nBeş mahalleyi ayrı ayrı araştır:\n' + places + '\nÇıktıyı tam olarak bu ASCII başlıklarla ayır: KOTEKLI:, EMIRBEYAZIT:, MUSLIHITTIN:, ORHANIYE:, AKYAKA:. Her başlığın altında sadece o mahalleye ait maddeler olsun. Toplam en fazla 1600 kelime.\n'
        path = directory / f'all_{category}_v8.md'
        path.write_text(prompt, encoding='utf8')
        jobs.append({'id': f'all_{category}_v8', 'neighborhood': 'all-pilots', 'category': category, 'prompt': path.relative_to(ROOT).as_posix()})
    (ROOT / 'data/research/focused_jobs.json').write_text(json.dumps(jobs, indent=2), encoding='utf8')
