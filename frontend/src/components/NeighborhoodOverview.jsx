import React from 'react';
import { ArrowRight, ArrowUpRight, BusFront, Coffee, Info, Layers3, ShieldCheck, Wallet } from 'lucide-react';

const money = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);
const rating = score => score==null?'Henüz puanlanmadı':score>=75?'Güçlü':score>=55?'Orta–iyi':score>=35?'Gelişmesi gerekiyor':'Zayıf';

function Score({value, label}) {
  if(value==null)return <div className="r-category-unscored">{label||'Puan için bilgi tamamlanmalı'}</div>;
  return <div className={`r-category-score ${value!=null && value<35?'low':''}`}><strong>{value??'—'}<small>/100</small></strong><span>{label||rating(value)}</span></div>;
}

export function NeighborhoodIntro({ report, summary, scores, insights, subtitle, onMethod, onDetail }) {
  return <section className="r-hero">
    <div><div className="r-breadcrumb">Muğla / {report.district} · Mahalle rehberi</div>
      <h1>{report.name}’de yaşamak</h1><h2>{subtitle}</h2><p className="r-lead">{insights.lead}</p>
      <div className="r-hero-facts"><span><Wallet size={16}/><b>{summary.room}:</b> {summary.rent.median?`${money(summary.rent.median)} TL / ay`:'Tarihli fiyat teyidi gerekiyor'}</span>{summary.percent!=null&&<span>Asgari ücretin %{summary.percent}’i yalnızca kira</span>}</div><div className="r-score-strip">{[['rent','Kira'],['transport','Ulaşım'],['social','Sosyal yaşam'],['safety','Güvenlik'],['hazard','Deprem']].map(([k,label])=><a href={`#${k}`} onClick={e=>{e.preventDefault();onDetail(k);}} key={k}>{label}<strong>{scores[k]??'—'}<small>/100</small></strong></a>)}</div>
      <div className="r-hero-links"><a className="r-primary" href="#overview">Puanları ve nedenlerini gör<ArrowRight size={16} /></a><button className="r-link" onClick={()=>onDetail('social')}>Mekânlar ve harita<ArrowUpRight size={16} /></button></div>
    </div>
    <aside className="r-verdict"><span className="r-eyebrow">MAHALLEN ÖN DEĞERLENDİRMESİ</span>
      <div className="r-overall-score"><strong>{scores.overall??'—'}</strong><span>/100</span></div>
      <h3>{scores.overall==null?`Genel puan için ${scores.rent==null?'kira':scores.transport==null?'ulaşım':scores.safety==null?'güvenlik':'veri'} bilgisi tamamlanmalı`:scores.overall<40?'Maliyet ve günlük koşullar zorlayıcı':scores.overall<60?'Artıları var, önemli eksileri de var':'Birçok günlük ihtiyaca seçenek var'}</h3>
      <p>Beş başlık birlikte değerlendirildi.</p><small className="r-score-scope">Güvenlik ön puanı haberlerden türetilir; veri güveni düşüktür.</small>
      <button className="r-score-method" onClick={onMethod}>Puan neden böyle?<ArrowRight size={14}/></button>
    </aside>
  </section>;
}

export function NeighborhoodOverview({ report, summary, scores, insights, onSource, onMethod, onDetail }) {
  const cards = [
    { id:'rent', icon:Wallet, question:'Kira ve yaşam maliyeti', title:insights.rentTitle, text:insights.rentText, value:scores.rent, points:summary.rent.median?[`İki kişi eşit paylaşırsan kişi başı ${money(summary.rent.median/2)} TL kira düşer.`,`Aidat, faturalar ve yemek bu tutarın üzerine eklenir.`]:[], action:'İlanları ve oda tiplerini karşılaştır', scope:'Ekonomiklik: yüksek puan daha hafif kira yükü' },
    { id:'transport', icon:BusFront, question:'Ulaşım', title:insights.transportTitle, text:insights.transportText, value:scores.transport, points:insights.transportPoints, action:'Hatları, saatleri ve duyuruları gör', scope:'Tarife ve son 90 gündeki bildirimlere göre' },
    { id:'social', icon:Coffee, question:'Sosyal yaşam', title:insights.socialTitle, text:insights.socialText, value:scores.social, points:insights.socialPoints, action:'Bütün mekânları ve haritayı aç', scope:'Sosyal seçenekler; güncel menü fiyatları puana eklenmedi' },
    { id:'safety', icon:ShieldCheck, question:'Güvenlik ve çevre', title:insights.safetyTitle, text:insights.safetyText, value:scores.safety, points:insights.safetyExamples, action:`${report.news.length} yerel gelişmenin tamamını incele`, scope:'Haber temelli ön puan · veri güveni düşük · suç oranı değil' },
    { id:'hazard', icon:Layers3, question:'Deprem tehlikesi', title:'Ev kadar binanın kendisine de bak', text:'Bu bölgedeki sarsıntı tehlikesi, kullanılan araştırma modelinde dikkate alınması gereken düzeyde. Ev seçerken binanın zeminini, yapımını ve inceleme durumunu da sorgula.', value:scores.hazard, points:['Yüksek puan daha düşük modellenmiş sarsıntı tehlikesi demek.','Bu puan binanın depreme dayanıklılığını ölçmüyor.'], action:'Deprem puanının dayanağını gör', scope:'2025 araştırma modeli · resmî AFAD haritası değil' },
  ];
  return <section id="overview" className="r-section r-overview"><div className="r-section-heading"><div><span className="r-eyebrow">PUAN, GEREKÇE, GÜNLÜK HAYAT</span><h2>Burada yaşamak nasıl?</h2></div><button className="r-link" onClick={onMethod}>Puanlama yöntemi<Info size={15} /></button></div>
    <div className="r-answer-grid">{cards.map(({id,icon:Icon,question,title,text,value,points,action,scope})=><article key={id} className={`r-answer r-answer-${id}`} onClick={e=>{if(!e.target.closest('button,a'))onDetail(id);}}>
      <div className="r-answer-question"><Icon size={20}/><button className="r-category-heading" onClick={()=>onDetail(id)}>{question}</button><button className="r-source-button" onClick={()=>onSource(id)} aria-label={`${question} kaynakları`}><Info size={16}/></button></div>
      <Score value={value} label={id==='safety'?'Haber temelli ön puan':undefined}/><h3><button className="r-category-heading" onClick={()=>onDetail(id)}>{title}</button></h3><p>{text}</p>
      {id==='social'&&<p className="r-overview-examples">{points.slice(0,2).join(' ')}</p>}
      {id==='transport'&&<p className="r-overview-examples">{(report.transportAlerts||[]).find(a=>a.kind==='project')?.summary}</p>}
      {id==='safety'&&<ul className="r-insight-points">{insights.safetyExamples.slice(0,2).map((p,i)=><li key={i}>{p}</li>)}</ul>}
      <div className="r-answer-meta">{scope}</div><button className="r-detail" onClick={()=>onDetail(id)}>Detayları gör<ArrowRight size={15}/></button>
    </article>)}</div>
    <p className="r-caption">Puanlar MahallEN’in açıklanan ölçütlerle yaptığı ön değerlendirmedir. Mekânlar bulunan örneklerdir; mahalledeki bütün işletmelerin sayımı değildir. Yol bildirimleri yayımlandıkları tarihteki durumu anlatır.</p>
  </section>;
}
