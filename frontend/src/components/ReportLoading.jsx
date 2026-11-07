import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, FileText, MapPin, Radar, Search, Sparkles } from 'lucide-react';

const stages = [
  { id: 'checking', title: 'Rapor kontrol ediliyor', text: 'Önce hazırlanmış raporuna bakıyoruz.', Icon: MapPin },
  { id: 'research', title: 'Mahallenin izini sürüyoruz', text: 'Konut, ulaşım ve günlük yaşam kaynakları araştırılıyor.', Icon: Search },
  { id: 'extraction', title: 'Bilgiler bir araya geliyor', text: 'Kaynaklardaki ilanlar, hatlar ve mekânlar ayrıştırılıyor.', Icon: Radar },
  { id: 'writing', title: 'Mahallene bir bakış hazırlanıyor', text: 'Gemini 3.5 Flash-Lite bulguları okunabilir bir rapora dönüştürüyor.', Icon: FileText },
];

export default function ReportLoading({ place, phase = 'checking' }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const index = phase === 'ready' ? 3 : Math.max(0, stages.findIndex(stage => stage.id === phase));
  const current = stages[index];
  return <section className="report-journey" data-testid="report-loading" aria-busy="true" aria-label="Mahalle raporu hazırlanıyor">
    <div className="journey-map" aria-hidden="true">
      <svg viewBox="0 0 600 500" fill="none"><g className="journey-streets">
        <path d="M-30 120 190 150 350 55 640 75M-20 280 150 260 310 350 630 300M-10 430 210 400 370 450 620 400M110-30 150 260 90 550M320-20 310 350 250 530M490-20 440 190 510 540" />
        <path d="m0 210 170-15 115 60 170-65 170 15M0 355l180-15 160 65 280-45M220 0l20 170-60 170 50 170M395 0l-30 180 60 150-20 190" />
      </g><path className="journey-route" d="M150 260 240 255 310 295 440 245 430 180" />
        <circle className="journey-radius radius-outer" cx="310" cy="245" r="155" />
        <circle className="journey-radius radius-inner" cx="310" cy="245" r="105" />
        {[[150,260],[240,255],[440,245],[430,180]].map(([x,y], i) => <circle key={i} className="journey-node" cx={x} cy={y} r="5" style={{ animationDelay: `${i * .4}s` }} />)}
      </svg>
      <span className="journey-pin"><MapPin size={30} strokeWidth={1.5} /></span>
      <span className="journey-map-caption"><span /> MAHALLENİ KEŞFEDİYORUZ</span>
      <span className="journey-coordinate">N ↗</span>
    </div>
    <div className="journey-content">
      <div className="journey-topline"><span><Sparkles size={13} /> YENİ BİR YER, YENİ BİR HİKÂYE</span><span>{elapsed}s</span></div>
      <p className="journey-location">{[place?.district, place?.city].filter(Boolean).join(' / ') || 'Mahalle araştırması'}</p>
      <h2 id="report-title">{place?.name || 'Mahallen'}<span>yakından bakıyoruz.</span></h2>
      <div className="journey-live" role="status" aria-live="polite" aria-atomic="true"><h3>{current.title}</h3><p>{current.text}</p></div>
      <ol className="journey-stages" aria-label="Rapor hazırlama aşamaları">{stages.map(({ id, title, Icon }, i) => <li key={id} className={i < index ? 'is-done' : i === index ? 'is-active' : ''} aria-current={i === index ? 'step' : undefined}>
        <span className="journey-stage-icon">{i < index ? <Check size={15} /> : <Icon size={15} />}</span><span>{title}</span>{i === index && <span className="journey-active-dot" />}
      </li>)}</ol>
      <p className="journey-footnote">{elapsed >= 45 ? 'Araştırma sürüyor. Kaynakların yanıt süresine göre biraz daha bekleyebiliriz.' : 'İlk keşif biraz zaman alır. Hazırlandığında sonraki ziyaretinde raporun seni bekler.'}<ArrowUpRight size={17} /></p>
    </div>
  </section>;
}
