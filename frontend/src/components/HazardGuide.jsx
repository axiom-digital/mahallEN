import React from 'react';
import { Layers3 } from 'lucide-react';

export default function HazardGuide({hazard, SourceLink}) {
  return <section id="hazard" className="r-hazard"><div className="r-section-heading"><div><span className="r-eyebrow">DEPREM TEHLİKESİ</span><h2>Ev seçerken binanın kendisini de sorgula</h2></div><Layers3 size={27}/></div>
    <div className="r-hazard-layout"><div className="r-hazard-number"><strong>{hazard.score}<small>/100</small></strong><span>Bölgesel sarsıntı karşılaştırması</span><div className="r-hazard-scale"><i style={{left:`${hazard.score}%`}}/></div><div><span>Daha yüksek tehlike</span><span>Daha düşük tehlike</span></div></div>
      <div><p><strong>{hazard.score<40?'Araştırmadaki karşılaştırmada bu bölgenin sarsıntı tehlikesi daha yüksek tarafta kalıyor.':'Puan, bölgedeki sarsıntı tehlikesinin araştırma içindeki karşılaştırmasını gösteriyor.'}</strong> Bu nedenle evin kirası ve konumu kadar bina hakkında bilgi almak da önemli.</p>
        <p>Bu puan, baktığın evin sağlam veya güvensiz olduğunu söylemez. Aynı mahalledeki iki binanın yapısı ve zemini farklı olabilir.</p>
        <ul className="r-insight-points"><li>Binanın yapı ve zemin incelemesi var mı?</li><li>Deprem performansına ilişkin uzman raporu var mı?</li><li>Taşıyıcı sisteme sonradan müdahale edilmiş mi?</li></ul>
        <details className="r-hazard-method"><summary>Veriyi ve hesaplamayı incele</summary><p>Kaynak {hazard.sourceYear} tarihli jeodezik araştırma modelidir; resmî AFAD TDTH ürünü değildir. PGA: {hazard.value?.toLocaleString('tr-TR')} g; {hazard.probability}. Referans noktasına en yakın grid noktası yaklaşık {hazard.gridDistance.toLocaleString('tr-TR',{maximumFractionDigits:2})} km uzaktadır.</p><p>{hazard.gridRows.toLocaleString('tr-TR')} grid noktası arasındaki ters yüzdelik sıradan {hazard.score}/100 elde edilir. Yüksek puan, modelde daha düşük sarsıntı tehlikesi demektir. Depremin tarihini veya büyüklüğünü tahmin etmez.</p><SourceLink url={hazard.url}>{hazard.title}</SourceLink><small>{hazard.authors.join('; ')} · CC-BY-SA-4.0. Puan bu veriden türetilmiştir.</small></details>
      </div></div>
  </section>;
}
