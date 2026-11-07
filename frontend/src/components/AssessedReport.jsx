import React, { useState } from 'react';
import { Activity, ArrowUpRight, Bus, GraduationCap, MapPin, RefreshCw, ShieldCheck, Users, Wallet, Briefcase, X } from 'lucide-react';
import ScoreCard from './ScoreCard';

const categories = [
  { key: 'rent_cost', score: 'cost_affordability', title: 'Maliyet', Icon: Wallet },
  { key: 'social_life', score: 'social_life', title: 'Sosyal yaşam', Icon: Users },
  { key: 'safety_news', score: 'safety', title: 'Haberler', Icon: ShieldCheck },
  { key: 'earthquake_hazard', score: 'disaster_resilience', title: 'Deprem verisi', Icon: Activity },
  { key: 'transportation', score: 'transportation', title: 'Ulaşım', Icon: Bus },
];
const currency = value => value == null ? 'Karşılaştırma yok' : `${Number(value).toLocaleString('tr-TR')} TL`;

function Sources({ item }) {
  const unique = [...new Map((item.sources || []).map(source => [source.url, source])).values()];
  return <div className="reading-source-links">{unique.slice(0, 2).map(source =>
    <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.url).hostname} <ArrowUpRight size={12} /></a>)}
    {unique.length > 2 && <details><summary>{unique.length - 2} kaynak daha</summary>{unique.slice(2).map(source =>
      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.url).hostname} ↗</a>)}</details>}
  </div>;
}

export default function AssessedReport({ report, onRefreshAi, refreshing }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const assessment = report.assessment;
  const calculation = assessment.calculation || {};
  const counts = calculation.counts || {};
  const evidence = report.evidence_report;
  const narrative = report.ai_report || {};
  const paragraphs = (narrative.executive_summary || '').split(/\n+/).filter(Boolean);
  const selected = categories.find(category => category.key === activeCategory);
  const findings = evidence.categories.find(category => category.id === activeCategory)?.items || [];
  const rationale = key => assessment.categories.find(category => category.category === key)?.rationale;
  const date = new Date(`${evidence.reference_date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortFacts = {
    rent_cost: calculation.monthly_rent != null ? `1+1 ilan medyanı · ${currency(calculation.monthly_rent)}` : 'Karşılaştırılabilir aylık ilan eksik',
    social_life: counts.venues ? `${counts.venues} kaynaklı mekân kaydı` : 'Sosyal olanakların kaynaklarını incele',
    safety_news: counts.news ? `${counts.news} haber kaydı · suç oranı değildir` : 'Karşılaştırma için haber verisi eksik',
    earthquake_hazard: 'PGA karşılaştırması · bina güvenliği değildir',
    transportation: counts.routes ? `${counts.routes} resmî hat kaydı` : 'Hat ve erişim kaynaklarını incele',
  };
  function openCategory(key) {
    setActiveCategory(key);
    setShowAllFindings(false);
    requestAnimationFrame(() => document.getElementById('category-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  return <div className="report-dashboard-wrapper reading-report" data-testid="report-dashboard">
    <div id="rapor-detay" className="report-banner-card">
      <div className="report-banner-main">
        <span className="report-pill-badge"><MapPin size={14} />{report.district}, {report.city}</span>
        <h2 id="report-title">{report.name}</h2>
        <p>{date} tarihli kaynaklarla mahalle değerlendirmesi</p>
      </div>
      <div className="report-banner-stats">
        <div className="banner-stat-box">
          <span className="banner-stat-label">Genel değerlendirme</span>
          <strong className="banner-stat-number" data-testid="overall-score">{report.scores.overall_livability ?? '—'}<small>/100</small></strong>
        </div>
        <div className="banner-stat-divider" aria-hidden="true" />
        <dl className="banner-meta-list">
          <div><dt>1+1 ilan medyanı</dt><dd>{currency(calculation.monthly_rent)}</dd></div>
          <div><dt>İlan örneği</dt><dd>{calculation.rent_sample_count || 'Yeterli örnek yok'}</dd></div>
          <div><dt>Değerlendirme kapsamı</dt><dd>{assessment.coverage}/5 başlık</dd></div>
        </dl>
      </div>
    </div>

    <div className="score-cards-grid" aria-label="Mahalle kategori puanları">
      {categories.map(({ key, score, title, Icon }) => <ScoreCard key={key} title={title} score={report.scores[score]}
        subtitle={shortFacts[key]} icon={Icon} testId={`card-${score}`}>
        <button type="button" className="reading-detail-button" onClick={() => openCategory(key)}
          aria-expanded={activeCategory === key} aria-controls="category-evidence">Detayları incele <ArrowUpRight size={14} /></button>
      </ScoreCard>)}
    </div>

    {selected && <section id="category-evidence" className="report-synthesis-card reading-category-panel" aria-label={`${selected.title} ayrıntıları`}>
      <div className="synthesis-header"><div><span className="eyebrow">YAKINDAN BAK</span><h3>{selected.title}</h3></div>
        <button className="reading-close" type="button" aria-label="Kategori ayrıntılarını kapat" onClick={() => setActiveCategory(null)}><X size={20} /></button></div>
      {findings.length ? (showAllFindings ? findings : findings.slice(0, 4)).map((item, index) => <article className="reading-finding" key={index}>
        <p>{item.text}</p>{item.date && <time dateTime={item.date}>{item.date}</time>}<Sources item={item} />
        {item.note && <details className="reading-item-note"><summary>Bu kaydın kapsamı</summary><p>{item.note}</p></details>}
      </article>) : <p>Bu başlık için yeterli kaynaklı bilgi bulunmuyor.</p>}
      {findings.length > 4 && <button type="button" className="reading-detail-button" onClick={() => setShowAllFindings(!showAllFindings)}>
        {showAllFindings ? 'Daha az göster' : `${findings.length} bulgunun tamamını göster`}</button>}
      <details className="method-details"><summary>Bu kategori puanı nasıl hesaplandı?</summary><p>{rationale(activeCategory)}</p></details>
    </section>}

    <section className="report-synthesis-card reading-narrative" aria-label="Mahalle değerlendirmesi">
      <div className="synthesis-header"><div><span className="eyebrow">MAHALLEYE BİR BAKIŞ</span><h3>{report.name}’de yaşam</h3></div>
        {onRefreshAi && <button type="button" className="refresh-report-btn" disabled={refreshing} onClick={onRefreshAi}>
          <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} /><span>{refreshing ? 'Yükleniyor…' : 'Yeniden yükle'}</span></button>}
      </div>
      <div className="synthesis-summary">{paragraphs.slice(0, 1).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
      {paragraphs.length > 1 && <details className="reading-full-report"><summary>Değerlendirmenin tamamını oku</summary>
        <div className="synthesis-summary">{paragraphs.slice(1).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></details>}
      <div className="pros-cons-grid">
        <div className="pros-box"><h4>Öne çıkanlar</h4><ul>{(narrative.pros || []).slice(0, 3).map((text, i) => <li key={i}>{text}</li>)}</ul></div>
        <div className="cons-box"><h4>Dikkat etmen gerekenler</h4><ul>{(narrative.cons || []).slice(0, 3).map((text, i) => <li key={i}>{text}</li>)}</ul></div>
      </div>
    </section>

    <section className="reading-profiles" aria-label="Yaşam profiline göre değerlendirme">
      <h3>Senin hayatına nasıl uyar?</h3>
      <div className="suitability-cards-grid">
        {[['students', 'Öğrenci', GraduationCap, 'student_verdict', 'Kira, ulaşım ve sosyal yaşam öncelikli.'],
          ['families', 'Aile', Users, 'family_verdict', 'Günlük ihtiyaçlar ve yaşam koşulları öncelikli.'],
          ['professionals', 'Çalışan', Briefcase, 'professional_verdict', 'Ulaşım ve konut maliyeti öncelikli.']].map(([key, label, Icon, verdict, note]) =>
          <article className="suitability-card" key={key}><div className="suitability-head"><div className="suitability-title"><Icon size={18} /><h4>{label}</h4></div>
            <strong className="suitability-score">{report.suitability[key] == null ? '—' : `${report.suitability[key]}/100`}</strong></div>
            <p>{note}</p><details className="reading-profile-note"><summary>Profil yorumunu oku</summary><p>{narrative[verdict]}</p></details>
          </article>)}
      </div>
    </section>

    <details className="methodology-footer-card reading-methodology"><summary>Kaynaklar, kapsam ve puanlama</summary>
      <p>{assessment.methodology}</p>
      <p>Kaynak dönemi: {date}. Haber göstergesi suç oranı, PGA göstergesi bina dayanıklılığı değildir. Eksik kategoriler sıfır sayılmaz.</p>
      {categories.map(category => <details className="method-details" key={category.key}><summary>{category.title}</summary>
        <p>{rationale(category.key)}</p><button className="reading-detail-button" type="button" onClick={() => openCategory(category.key)}>Bulguları ve kaynakları incele <ArrowUpRight size={14} /></button></details>)}
      {evidence.limitations?.map((limitation, i) => <p key={i}>{limitation}</p>)}
    </details>
    <p className="reading-disclaimer">Puanlar kaynaklı proje göstergeleridir. Ev seçerken kaynağın tarihini ve evin kendi koşullarını birlikte değerlendir.</p>
  </div>;
}
