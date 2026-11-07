import React from 'react';
import AssessedReport from './AssessedReport';
import {
  ShieldCheck,
  Bus,
  Wallet,
  Activity,
  GraduationCap,
  Users,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Newspaper,
  MessageSquareQuote,
  Database,
  RefreshCw,
  MapPin,
  Info,
} from 'lucide-react';
import ScoreCard, {
  ScoreBarChart,
  extractCategoryScores,
  normalizeScoreValue,
} from './ScoreCard';

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Belirtilmedi';
  if (value == null) return 'Belirtilmedi';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Belirtilmedi';
  return `${num.toLocaleString('tr-TR')} TL`;
}

function getSentimentLabel(sentiment) {
  if (sentiment === 'positive') return { text: 'Olumlu', className: 'sentiment-positive' };
  if (sentiment === 'negative') return { text: 'Dikkat', className: 'sentiment-negative' };
  return { text: 'Bilgi', className: 'sentiment-neutral' };
}

function buildDynamicChartSummary(name, scores) {
  const categories = extractCategoryScores(scores);
  const available = categories.filter((c) => c.value !== null);
  const missing = categories.filter((c) => c.value === null);

  if (!available.length) {
    return `${name} için sayısal kategori puanları henüz mevcut değil.`;
  }

  const sorted = [...available].sort((a, b) => b.value - a.value);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  let summary = `${name} raporunda ${highest.label.toLocaleLowerCase('tr-TR')} (${highest.value}/100) öne çıkarken, ${lowest.label.toLocaleLowerCase('tr-TR')} (${lowest.value}/100) kendi önceliklerinle birlikte değerlendirilmeli.`;
  if (missing.length > 0) {
    const missingNames = missing.map((m) => m.label.toLocaleLowerCase('tr-TR')).join(', ');
    summary += ` Backend verisinde henüz sayısal puanı bulunmayan başlıklar (${missingNames}) sıfır puan olarak sayılmaz.`;
  }
  return summary;
}

export default function ReportDashboard({
  report,
  neighborhoods = [],
  selectedSlug = '',
  onSelectNeighborhood,
  onOpenDialog,
  onRefreshAi,
  refreshing = false,
  loading = false,
  error = null,
  onRetry,
  onResetSearch,
}) {
  if (loading) {
    return (
      <div className="report-state-card" role="status" aria-live="polite" data-testid="report-loading">
        <div className="loading-spinner" aria-hidden="true" />
        <h3>Mahalle raporu ve puan grafikleri yükleniyor…</h3>
        <p>Kayıtlı rapor getiriliyor. İlk kez seçilen mahallelerde kaynak araştırması ve rapor hazırlığı birkaç dakika sürebilir.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-state-card is-error" role="alert" data-testid="report-error">
        <AlertTriangle size={28} aria-hidden="true" />
        <h3>Rapor verisi alınamadı</h3>
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="button dark" onClick={onRetry}>
            Tekrar dene <span aria-hidden="true">↻</span>
          </button>
        )}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="report-state-card is-empty" role="status" data-testid="report-empty">
        <MapPin size={28} aria-hidden="true" />
        <h3>Görüntülenecek mahalle raporu seçilmedi</h3>
        <p>
          Arama sonucunda eşleşen bir mahalle bulunamadığında rapor ekranı temizlenir. Yukarıdan bir mahalle seçebilir veya aramayı sıfırlayabilirsin.
        </p>
        {onResetSearch && (
          <button type="button" className="button dark" onClick={onResetSearch}>
            Tüm mahalleleri göster <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
    );
  }

  if (report.assessment) {
    return <AssessedReport key={report.slug} report={report} onRefreshAi={onRefreshAi} refreshing={refreshing} />;
  }

  const {
    name,
    district,
    city,
    tagline,
    scores = {},
    suitability = {},
    rent_analysis = {},
    transport_analysis = {},
    disaster_risk = {},
    news_items = [],
    community_comments = [],
    data_sources = [],
    ai_report = {},
    scoring_methodology = {},
  } = report;

  const evidence = report.evidence_report;
  const assessment = report.assessment;
  const evidenceOnly = evidence && !assessment;
  const evidenceCategories = evidence?.categories || [];
  const findingCount = evidenceCategories.reduce((sum, category) => sum + category.items.length, 0);
  const coveredCount = evidenceCategories.filter(category => category.items.length > 0).length;
  const sourceCount = new Set(evidenceCategories.flatMap(category => category.items.flatMap(item => item.sources.map(source => source.url)))).size;
  const categoryIcons = { rent_cost: Wallet, social_life: Users, safety_news: ShieldCheck, earthquake_hazard: Activity, transportation: Bus };
  const rationale = key => assessment?.categories.find(c => c.category === key)?.rationale;
  const overallScore = normalizeScoreValue(scores?.overall_livability);
  const socialScore = normalizeScoreValue(scores?.social_life ?? scores?.social);
  const chartSummaryText = assessment ? `${assessment.coverage}/5 başlık kaynaklı proje kurallarıyla hesaplandı. Beş başlık tamamlanmadan genel puan verilmez; model nötr 50 eklemez.` : buildDynamicChartSummary(name, scores);

  const profileRows = [
    {
      key: 'students',
      label: 'Öğrenci',
      icon: GraduationCap,
      score: normalizeScoreValue(suitability?.students),
      verdict: ai_report?.student_verdict,
      toneClass: 'suitability-fill-green',
    },
    {
      key: 'families',
      label: 'Aile',
      icon: Users,
      score: normalizeScoreValue(suitability?.families),
      verdict: ai_report?.family_verdict,
      toneClass: 'suitability-fill-olive',
    },
    {
      key: 'professionals',
      label: 'Çalışan',
      icon: Briefcase,
      score: normalizeScoreValue(suitability?.professionals),
      verdict: ai_report?.professional_verdict,
      toneClass: 'suitability-fill-rust',
    },
  ];

  return (
    <div className="report-dashboard-wrapper" data-testid="report-dashboard">
      {/* Top Template Section: Copy + Score Bar Chart Preview */}
      <div className="report-grid">
        <div className="report-copy">
          <h2 id="report-title">
            Sadece bir puan değil.
            <br />
            Bir mahallenin
            <br />
            <em>bütün hikâyesi.</em>
          </h2>
          <p>
            {evidenceOnly ? "Kira, ulaşım ve mahalle yaşamına dair kaynaklı bulguları incele. Bilginin kaynağını ve eksik kalan başlıkları birlikte gör." : "Artıları, dikkat etmen gerekenler ve kategori puanları aynı yerde. Kendin için önemli olanı gör, sorularını bilerek sor."}
          </p>

          {neighborhoods.length > 0 && onSelectNeighborhood && (
            <div className="report-switcher" role="group" aria-label="Raporu gösterilen mahalleyi değiştir">
              <span className="report-switcher-label">Seçili mahalle:</span>
              <div className="report-switcher-pills">
                {neighborhoods.map((item) => {
                  const active = item.slug === (selectedSlug || report.slug);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      className={`switcher-pill ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => onSelectNeighborhood(item.slug)}
                    >
                      {item.name.replace(/\s+Mahallesi$/i, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="report-copy-actions">
            {onOpenDialog && (
              <button type="button" className="button dark" onClick={onOpenDialog}>
                {name.replace(/\s+Mahallesi$/i, '')} özet penceresi <span aria-hidden="true">↗</span>
              </button>
            )}
            <a className="button outline-dark" href="#rapor-detay">
              Detaylı kırılımı incele <span aria-hidden="true">↓</span>
            </a>
          </div>

          <p className="small-note">
            {evidenceOnly ? "Kaynaklı bilgi bulunması sayısal bir yaşam kalitesi puanı anlamına gelmez." : assessment ? "Puanlar açıklanmış proje kurallarıyla hesaplanır. Kullanılan girdiler ve hesaplama gerekçeleri kartlarda yer alır." : "Eksik kategori verileri sıfır puan gibi gösterilmez."}
          </p>
        </div>

        <div className="report-preview" aria-label={`${name} puan grafikleri kartı`}>
          <div className="report-preview-head">
            <div>
              <span className="eyebrow">
                {(city || 'MUĞLA').toLocaleUpperCase('tr-TR')} / {(district || 'MENTEŞE').toLocaleUpperCase('tr-TR')}
              </span>
              <h3 data-testid="report-neighborhood-name">{name}</h3>
              <span>{evidenceOnly ? "Kaynaklı mahalle raporu" : assessment ? "Kural tabanlı proje değerlendirmesi · 0–100" : "Mahalle değerlendirmesi · 0–100 ölçeği"}</span>
            </div>
            <div className="preview-score" data-testid="overall-score" aria-label={evidenceOnly ? `${findingCount} kaynaklı bulgu` : `Genel puan ${overallScore ?? 'mevcut değil'} / 100`}>
              {evidenceOnly ? findingCount : overallScore !== null ? overallScore : '—'}
              <small>{evidenceOnly ? 'bulgu' : '/100'}</small>
            </div>
          </div>

          {evidenceOnly ? <div className="report-bars" role="list" aria-label="Kaynaklı bilgi kapsamı">
            {evidenceCategories.map(category => <div className="bar-row" role="listitem" key={category.id}>
              <span className="bar-label">{category.label}</span>
              <span>{category.items.length ? `${category.items.length} kaynaklı bulgu` : 'Kaynaklı bilgi bulunamadı'}</span>
            </div>)}
          </div> : <ScoreBarChart scores={scores} idPrefix="report" />}

          <div className="report-note">
            <span aria-hidden="true">↗</span>
            <p>
              {evidenceOnly ? <><b>{sourceCount} farklı kaynak.</b> Beş başlıktan {coveredCount} tanesinde kaynaklı bilgi var. Ayrıntılarda kaynak bağlantılarını inceleyebilirsin.</> : <><b>Rakamları birlikte oku.</b> {chartSummaryText}</>}
            </p>
          </div>

          <div className="report-preview-foot">
            <span>{evidenceOnly ? "KAYNAK KAPSAMI" : assessment ? "PROJE PUANLAMA KURALLARI" : "MEVCUT BACKEND VERİSİ"}</span>
            <span>
              {evidence ? `Referans tarihi: ${evidence.reference_date}` : <>Ort. Kira: {formatCurrency(rent_analysis?.average_rent_tl)} · Sismik Risk: {disaster_risk?.risk_level || 'Belirtilmedi'}</>}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Report Stack in Matching Cream/Green/Terracotta Theme */}
      <div id="rapor-detay" className="report-details-stack">
        {/* Neighborhood Banner & Quick Facts */}
        <div className="report-banner-card">
          <div className="report-banner-main">
            <span className="report-pill-badge">
              <MapPin size={14} aria-hidden="true" />
              {district}, {city} · Mahalle Raporu
            </span>
            <h3>{name}</h3>
            <p>{tagline}</p>
          </div>

          {evidenceOnly ? <div className="report-banner-stats">
            <div className="banner-stat-box">
              <span className="banner-stat-label">Kaynaklı bulgu</span>
              <strong className="banner-stat-number">{findingCount}</strong>
            </div>
            <div className="banner-stat-divider" aria-hidden="true" />
            <dl className="banner-meta-list">
              <div><dt>Farklı kaynak:</dt><dd>{sourceCount}</dd></div>
              <div><dt>Bilgi bulunan başlık:</dt><dd>{coveredCount} / {evidenceCategories.length}</dd></div>
              <div><dt>Referans tarihi:</dt><dd>{evidence.reference_date}</dd></div>
            </dl>
          </div> : <div className="report-banner-stats">
            <div className="banner-stat-box">
              <span className="banner-stat-label">{assessment ? "Genel ön puan" : "Genel Puan"}</span>
              <strong className="banner-stat-number">
                {overallScore !== null ? overallScore : '—'}
                <small>/100</small>
              </strong>
            </div>
            <div className="banner-stat-divider" aria-hidden="true" />
            {assessment ? <dl className="banner-meta-list">
              <div><dt>Değerlendirilen başlık:</dt><dd>{assessment.coverage} / 5</dd></div>
              <div><dt>Kaynak:</dt><dd>{sourceCount}</dd></div>
              <div><dt>Değerlendirme:</dt><dd>Kural tabanlı gösterge</dd></div>
            </dl> : <dl className="banner-meta-list">
              <div>
                <dt>Ortalama Kira:</dt>
                <dd>{formatCurrency(rent_analysis?.average_rent_tl)}</dd>
              </div>
              <div>
                <dt>Sismik Tehlike:</dt>
                <dd>{disaster_risk?.risk_level || '—'} ({disaster_risk?.pga_value_g ?? '—'}g)</dd>
              </div>
              <div>
                <dt>Kampüs Mesafesi:</dt>
                <dd>{transport_analysis?.distance_to_campus_km ?? '—'} km</dd>
              </div>
            </dl>}
          </div>}
        </div>

        {assessment && <p className="small-note">Kural tabanlı proje değerlendirmesi · {assessment.coverage}/5 başlık puanlandı. {assessment.methodology}</p>}

        {/* Source coverage uses the existing category-card layout. */}
        {evidenceOnly ? <div className="score-cards-grid" aria-label="Kategori bazlı kaynaklı bilgiler">
          {['rent_cost', 'social_life', 'safety_news', 'earthquake_hazard', 'transportation'].map(key => {
            const category = evidenceCategories.find(item => item.id === key);
            if (!category) return null;
            const Icon = categoryIcons[key];
            const count = category.items.length;
            return <article className="score-card-item" key={key} data-testid={`evidence-card-${key}`}>
              <div className="score-card-head">
                <div className="score-card-title-wrap"><span className="score-card-icon"><Icon size={18} aria-hidden="true" /></span><h4 className="score-card-title">{category.label}</h4></div>
                <span className="score-card-badge">{count ? `${count} bulgu` : 'Kaynak eksik'}</span>
              </div>
              <p>{count ? category.items[0].text : category.missing_reason || 'Bu başlıkta yeterli kaynaklı bilgi bulunamadı.'}</p>
              {count > 1 && <small>{count - 1} bulgu daha · Ayrıntıları aşağıda incele</small>}
            </article>;
          })}
        </div> : <div className="score-cards-grid" aria-label="Kategori bazlı puan kartları">
          <ScoreCard
            title="Maliyet"
            score={scores?.cost_affordability}
            subtitle={rationale('rent_cost') || `Ort. ${formatCurrency(rent_analysis?.average_rent_tl)} · ${rent_analysis?.trend_6m || ''}`}
            icon={Wallet}
            testId="card-cost_affordability"
          />
          <ScoreCard
            title="Sosyal yaşam"
            score={socialScore}
            subtitle={
              rationale('social_life') || (socialScore !== null
                ? 'Mahalle yaşamı ve sosyal olanaklar'
                : `${community_comments.length} mahalle yorumu mevcut · Sayısal puan backend verisinde henüz tanımlı değil`)
            }
            icon={Users}
            testId="card-social_life"
          />
          <ScoreCard
            title="Güvenlik / haberler"
            score={scores?.safety}
            subtitle={rationale('safety_news') || `${news_items.length} yerel haber kaydı ve sokak güvenliği bağlamı`}
            icon={ShieldCheck}
            testId="card-safety"
          />
          <ScoreCard
            title="Afet"
            score={scores?.disaster_resilience}
            subtitle={rationale('earthquake_hazard') || `PGA: ${disaster_risk?.pga_value_g ?? '—'}g · ${disaster_risk?.soil_class || ''}`}
            icon={Activity}
            testId="card-disaster_resilience"
          />
          <ScoreCard
            title="Ulaşım"
            score={scores?.transportation}
            subtitle={rationale('transportation') || `${transport_analysis?.bus_frequency_min ?? '—'} dk sefer aralığı · Kampüs ${transport_analysis?.distance_to_campus_km ?? '—'} km`}
            icon={Bus}
            testId="card-transportation"
          />
        </div>}

        {/* AI Synthesis & Pros / Cons */}


        <div className="report-synthesis-card">
          <div className="synthesis-header">
            <div className="synthesis-title-group">
              <span className="synthesis-icon" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <h3>Mahalle Yaşam Sentezi ve Değerlendirme</h3>
                <p>{ai_report?.generated_by || 'MahallEN Rapor Sentezi'}</p>
              </div>
            </div>

            {onRefreshAi && (
              <button
                type="button"
                onClick={onRefreshAi}
                disabled={refreshing}
                className="refresh-report-btn"
              >
                <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} aria-hidden="true" />
                <span>{refreshing ? 'Yenileniyor…' : 'Raporu yenile'}</span>
              </button>
            )}
          </div>

          <div className="synthesis-summary">{(ai_report?.executive_summary || "").split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

          <div className="pros-cons-grid">
            {(!evidenceOnly || ai_report?.pros?.length > 0) && <>
            <div className="pros-box">
              <h4>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Öne Çıkan Avantajlar (Artılar)</span>
              </h4>
              <ul>
                {(ai_report?.pros || []).map((pro, idx) => (
                  <li key={idx}>{pro}</li>
                ))}
              </ul>
            </div>

            </>}
            <div className="cons-box">
              <h4>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{evidenceOnly ? "Verinin sınırları" : "Dikkat Edilmesi Gerekenler (Eksiler)"}</span>
              </h4>
              <ul>
                {(ai_report?.cons || []).map((con, idx) => (
                  <li key={idx}>{con}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {(!evidence || assessment) && <>
        {/* Suitability by User Profile (No purple!) */}
        <div className="suitability-cards-grid" aria-label="Yaşam profiline göre uygunluk">
          {profileRows.map((prof) => {
            const Icon = prof.icon;
            return (
              <article key={prof.key} className="suitability-card">
                <div className="suitability-head">
                  <div className="suitability-title">
                    <Icon size={18} aria-hidden="true" />
                    <h4>{prof.label} Profili</h4>
                  </div>
                  <strong className="suitability-score">
                    {prof.score !== null ? `${prof.score}/100` : '—'}
                  </strong>
                </div>

                {prof.score !== null ? (
                  <div
                    className="suitability-track"
                    role="progressbar"
                    aria-label={`${prof.label} uygunluk puanı`}
                    aria-valuenow={prof.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`suitability-fill ${prof.toneClass}`}
                      style={{ width: `${prof.score}%` }}
                    />
                  </div>
                ) : (
                  <div className="suitability-track is-missing" aria-hidden="true" />
                )}

                <p className="suitability-verdict">{prof.verdict}</p>
              </article>
            );
          })}
        </div>

        {!assessment && <>
        {/* Domain Breakdown: Rent, Transport & Disaster Risk */}
        <div className="domain-cards-grid">
          <article className="domain-card">
            <h4 className="domain-card-title">
              <Wallet size={17} aria-hidden="true" />
              <span>Kira ve Konut Piyasası</span>
            </h4>
            <dl className="domain-metrics-list">
              <div>
                <dt>Ortalama Aylık Kira</dt>
                <dd>{formatCurrency(rent_analysis?.average_rent_tl)}</dd>
              </div>
              <div>
                <dt>Tipik Kira Aralığı</dt>
                <dd>{rent_analysis?.rent_range_tl || '—'}</dd>
              </div>
              <div>
                <dt>6 Aylık Eğilim</dt>
                <dd className="rust-accent">{rent_analysis?.trend_6m || '—'}</dd>
              </div>
            </dl>
          </article>

          <article className="domain-card">
            <h4 className="domain-card-title">
              <Bus size={17} aria-hidden="true" />
              <span>Ulaşım ve Hareketlilik</span>
            </h4>
            <dl className="domain-metrics-list compact">
              <div>
                <dt>Otobüs Sefer Sıklığı</dt>
                <dd>Yaklaşık {transport_analysis?.bus_frequency_min ?? '—'} dk</dd>
              </div>
              <div>
                <dt>Kampüs / Merkez Mesafesi</dt>
                <dd>
                  {transport_analysis?.distance_to_campus_km ?? '—'} km / {transport_analysis?.distance_to_center_km ?? '—'} km
                </dd>
              </div>
            </dl>
            <ul className="domain-highlights-list">
              {(transport_analysis?.highlights || []).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </article>

          <article className="domain-card">
            <h4 className="domain-card-title">
              <Activity size={17} aria-hidden="true" />
              <span>Deprem ve Zemin Göstergeleri</span>
            </h4>
            <dl className="domain-metrics-list">
              <div>
                <dt>Tehlike Düzeyi</dt>
                <dd className="rust-accent">{disaster_risk?.risk_level || '—'}</dd>
              </div>
              <div>
                <dt>En Büyük Yer İvmesi (PGA)</dt>
                <dd>{disaster_risk?.pga_value_g ?? '—'} g</dd>
              </div>
              <div>
                <dt>Zemin Sınıfı</dt>
                <dd>{disaster_risk?.soil_class || '—'}</dd>
              </div>
            </dl>
          </article>
        </div>

        {/* Local News & Community Reviews */}
        <div className="evidence-cards-grid">
          <article className="evidence-card">
            <h4 className="domain-card-title">
              <Newspaper size={17} aria-hidden="true" />
              <span>Yerel Haberler ve Olay Kayıtları</span>
            </h4>
            <div className="evidence-list">
              {news_items.length > 0 ? (
                news_items.map((item, idx) => {
                  const badge = getSentimentLabel(item.sentiment);
                  return (
                    <div key={idx} className="evidence-item">
                      <div className="evidence-item-top">
                        <strong>{item.title}</strong>
                        <span className={`sentiment-badge ${badge.className}`}>{badge.text}</span>
                      </div>
                      <p>{item.summary}</p>
                      <small>
                        Kaynak: {item.source} · {item.date}
                      </small>
                    </div>
                  );
                })
              ) : (
                <p className="empty-subtext">Bu mahalle için kayıtlı yerel haber örneği bulunmuyor.</p>
              )}
            </div>
          </article>

          <article className="evidence-card">
            <h4 className="domain-card-title">
              <MessageSquareQuote size={17} aria-hidden="true" />
              <span>Mahalle Sakinleri ve Öğrenci Yorumları</span>
            </h4>
            <div className="evidence-list">
              {community_comments.length > 0 ? (
                community_comments.map((c, idx) => {
                  const rating = Math.max(0, Math.min(5, Number(c.rating) || 0));
                  return (
                    <div key={idx} className="evidence-item">
                      <div className="evidence-item-top">
                        <strong>{c.author_profile}</strong>
                        <span className="rating-stars" aria-label={`5 üzerinden ${rating} yıldız`}>
                          {'★'.repeat(rating)}
                          {'☆'.repeat(5 - rating)}
                        </span>
                      </div>
                      <p className="comment-quote">“{c.comment}”</p>
                      <small>Platform: {c.platform}</small>
                    </div>
                  );
                })
              ) : (
                <p className="empty-subtext">Bu mahalle için kayıtlı yorum bulunmuyor.</p>
              )}
            </div>
          </article>
        </div>

        </>}
        </>}

        {report.evidence_report && <div className="domain-cards-grid">
          {report.evidence_report.categories.map(category => <article className="domain-card" key={category.id}>
            <h4 className="domain-card-title">{category.label}</h4>
            {category.items.length ? category.items.map((item, index) => <div key={index} className="source-finding">
              <p>{item.text}</p>{item.note && <small>{item.note}</small>}
              <div>{item.sources.map(s => <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>)}</div>
            </div>) : <p>{category.missing_reason || 'Bu başlıkta yeterli kaynaklı bilgi bulunamadı.'}</p>}
          </article>)}
        </div>}

        {/* Transparency, Sources & Methodology Footer */}
        <div className="methodology-footer-card">
          <div className="methodology-head">
            <Database size={18} aria-hidden="true" />
            <h4>{evidenceOnly ? "Kaynaklar ve veri kapsamı" : "Veri Kaynakları ve Puanlama Yöntemi"}</h4>
          </div>

          {data_sources.length > 0 && (
            <div className="sources-chip-list">
              {data_sources.map((src, i) => (
                /^https?:\/\//i.test(src) ? (
                  <a key={i} className="source-chip" href={src} target="_blank" rel="noreferrer">
                    {new URL(src).hostname}
                  </a>
                ) : (
                  <span key={i} className="source-chip">{src}</span>
                )
              ))}
            </div>
          )}

          <details className="method-details">
            <summary>{evidenceOnly ? "Bu bilgiler nasıl hazırlandı?" : "Bu puanlar nasıl hesaplandı ve veri kapsamı nedir?"}</summary>
            <p>
              {scoring_methodology?.note ||
                'Kategori puanları 0 ile 100 arasında normalize edilmiştir. Backend üzerinde sayısal verisi bulunmayan kategoriler sıfır puan olarak değerlendirilmez.'}
            </p>
            {ai_report?.disclaimer && <p>{ai_report.disclaimer}</p>}
          </details>
        </div>
      </div>
    </div>
  );
}
