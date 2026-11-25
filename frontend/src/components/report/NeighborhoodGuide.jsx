import React from 'react';
import { comparePath, navigate, reportPath } from '../../navigation.mjs';
import { connections, prettyDate, safetyStories } from './reportReading.mjs';
import './neighborhoodGuide.css';

export function DestinationList({ routes, limit }) {
  const stops = connections(routes);
  const visible = limit ? stops.slice(0, limit) : stops;
  if (!visible.length) return <p>{routes.length ? 'Hat kayıtları var. Durak sırası için aşağıdaki güzergâh açıklamalarını incele.' : 'Bu mahalle için kaynakta doğrulanmış bir hat güzergâhı bulunamadı.'}</p>;
  return <ul className="guide-stops">{visible.map(stop => <li key={stop.name}>
    <span>{stop.name}</span><small>{stop.lines.join(' · ')}</small>
  </li>)}</ul>;
}

function TopicLink({ children, onClick }) {
  return <button className="guide-link" type="button" onClick={onClick}>{children} <span aria-hidden="true">↗</span></button>;
}

export default function NeighborhoodGuide({ report, date, openCategory, handleShareLink, copiedLink, onReloadReport, refreshing }) {
  const { assessment, evidence_report: evidence } = report;
  const briefing = assessment.briefing || {};
  const news = evidence.categories.find(c => c.id === 'safety_news')?.items || [];
  const safety = safetyStories(news);
  const latest = safety[0];
  const routes = briefing.routes || [];
  const score = key => assessment.categories.find(c => c.category === key)?.score;
  const rent = (briefing.rent_types || []).filter(g => g.median != null).sort((a,b) => b.sample_count-a.sample_count)[0];
  const venue = briefing.venues?.[0];
  const hazard = briefing.hazard?.value != null;
  const topics = [
    ['rent_cost','🏠','Ev tutmak ne kadar?',rent ? rent.rooms + ' için ' + rent.sample_count + ' karşılaştırılabilir ilanın ortanca kirası ' + Number(rent.median).toLocaleString('tr-TR') + ' TL. Aidat ve faturaları ayrıca hesaba kat.' : briefing.daily_life?.rent_cost || 'Güncel bir kira aralığı çıkaracak kadar karşılaştırılabilir ilan bulunamadı.', 'İlanlar ve bütçem'],
    ['social_life','☕','Yakında neler var?',venue ? venue.name + ' (' + venue.kind + ') çevrede kayda geçmiş. Haritadan evine göre konumunu ve diğer seçenekleri görebilirsin.' : 'Bu raporda konumu doğrulanmış bir mekân örneği bulunmuyor.', 'Mekânları incele'],
    ['earthquake_hazard','🌍','Deprem bilgisi evim için ne anlatır?',hazard ? 'Bu çalışma, bölgede yerin ne kadar kuvvetli sarsılabileceğini tahmin ediyor. Aynı sokaktaki binalar farklı dayanabilir. Ev için binaya özel inceleme raporunu sor.' : 'Bu konum için karşılaştırılabilir bir sarsıntı ölçüsü bulunamadı. Evi değerlendirirken binaya özel inceleme raporunu sor.', 'Ölçüm ve kaynağı'],
  ];
  return <div className="neighborhood-guide">
    <header className="guide-hero">
      <div><p className="guide-loc">📍 {report.district} / {report.city}</p>
        <h1>{report.name}</h1><p className="guide-date">Mahalle rehberi · {date}</p>
        <div className="guide-actions no-print">
          <button onClick={() => navigate(comparePath(report.slug), { returnTo: reportPath(report.slug) })}>⚖️ Karşılaştır</button>
          <button onClick={handleShareLink}>🔗 {copiedLink ? 'Kopyalandı' : 'Paylaş'}</button>
          <button onClick={() => window.print()}>🖨️ Yazdır</button>
          {onReloadReport && <button onClick={onReloadReport} disabled={refreshing}>↻ Yenile</button>}
        </div></div>
      <div className="guide-meter"><span>Genel yaşam puanı</span><strong>{assessment.overall_score ?? '—'}<small>/100</small></strong>
        <p>{assessment.coverage}/5 başlıkta puan hesaplandı.</p></div>
    </header>
    <div className="guide-lead">
      <article className="guide-panel guide-safety"><div className="guide-icon" aria-hidden="true">🛡️</div>
        <h2>Mahallede güvenlik</h2>
        <p className="guide-sub">{score('safety_news') != null ? 'Haberlerden hesaplanan gösterge: ' + score('safety_news') + '/100' : 'Güvenlik göstergesi için veri sınırlı'}</p>
        {latest ? <blockquote><time>{prettyDate(latest.date)}</time><p>{latest.text}</p></blockquote> : <p>{news.length ? 'Tarihli yerel haberler var. İncelenen başlıklarda güvenlikle doğrudan ilişkili bir olay ayırt edilemedi.' : 'Son bir yıl için tarihli yerel güvenlik haberi doğrulanamadı.'}</p>}
        <p>{score('safety_news') != null
          ? 'Puan, son bir yıldaki haberlerde geçen olayların ağırlığına ve tarihine göre hesaplanıyor. Örneğin yakın tarihli bir yaralanma haberi puanı aşağı çekebilir.'
          : 'Eldeki haberler kişisel güvenliğini değerlendirmeye yetmiyor.'} Haber sayısından bir sokağın suç oranı çıkarılamaz.</p>
        <TopicLink onClick={() => openCategory('safety_news')}>Olayları ve kaynakları oku</TopicLink>
      </article>
      <article className="guide-panel guide-transit"><div className="guide-icon" aria-hidden="true">🚌</div>
        <h2>Buradan nereye gidilir?</h2>
        <p>{routes.length ? 'Mahalle ve yakın çevresinde kayda geçen güzergâhlar aşağıda. Solda gidilen yer, sağda oradan geçen hat var.' : 'Ulaşım araştırmasının sonucunu aşağıda görebilirsin.'}</p>
        <DestinationList routes={routes} limit={5}/>
        <TopicLink onClick={() => openCategory('transportation')}>Tüm güzergâhlar ve saatler</TopicLink>
      </article>
    </div>
    <div className="guide-more">{topics.map(([key,emoji,title,description,action]) => <article key={key} className="guide-panel">
      <div className="guide-icon" aria-hidden="true">{emoji}</div><h2>{title}</h2><p>{description}</p>
      <TopicLink onClick={() => openCategory(key)}>{action}</TopicLink>
    </article>)}</div>
  </div>;
}
