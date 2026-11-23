import React from 'react';
import AssessedReport from './AssessedReport';
import ReportLoading from './ReportLoading';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Bus,
  CheckCircle2,
  Database,
  GraduationCap,
  MapPin,
  MessageSquareQuote,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import ScoreCard, {
  ScoreBarChart,
  extractCategoryScores,
  normalizeScoreValue,
} from './ScoreCard';
import { RadialScoreRing, getScoreToneColors } from './AnalyticsCharts';

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Belirtilmedi';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Belirtilmedi';
  return `${num.toLocaleString('tr-TR')} TL`;
}

function getSentimentLabel(sentiment) {
  if (sentiment === 'positive') {
    return { text: 'Olumlu', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (sentiment === 'negative') {
    return { text: 'Dikkat', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  return { text: 'Bilgi', className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
  onReloadReport,
  refreshing = false,
  loading = false,
  loadingPhase = 'checking',
  loadingPlace,
  error = null,
  onRetry,
  onResetSearch,
}) {
  if (loading) {
    return <ReportLoading key={selectedSlug} place={loadingPlace} phase={loadingPhase} />;
  }

  if (error) {
    return (
      <div
        className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-card"
        role="alert"
        data-testid="report-error"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Rapor verisi alınamadı</h3>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <span>Tekrar dene</span>
            <RefreshCw size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"
        role="status"
        data-testid="report-empty"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <MapPin size={24} aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          Görüntülenecek mahalle raporu seçilmedi
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Arama sonucunda eşleşen bir mahalle seçtiğinde kaynaklı rapor burada açılır.
        </p>
        {onResetSearch && (
          <button
            type="button"
            onClick={onResetSearch}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <span>Tüm mahalleleri göster</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  if (report.assessment) {
    return (
      <AssessedReport
        key={report.slug}
        report={report}
        onReloadReport={onReloadReport}
        refreshing={refreshing}
      />
    );
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
  const evidenceOnly = Boolean(evidence);
  const evidenceCategories = evidence?.categories || [];
  const findingCount = evidenceCategories.reduce((sum, category) => sum + category.items.length, 0);
  const coveredCount = evidenceCategories.filter((category) => category.items.length > 0).length;
  const sourceCount = new Set(
    evidenceCategories.flatMap((category) =>
      category.items.flatMap((item) => (item.sources || []).map((source) => source.url))
    )
  ).size;

  const categoryIcons = {
    rent_cost: Wallet,
    social_life: Users,
    safety_news: ShieldCheck,
    earthquake_hazard: Activity,
    transportation: Bus,
  };

  const overallScore = normalizeScoreValue(scores?.overall_livability);
  const socialScore = normalizeScoreValue(scores?.social_life ?? scores?.social);
  const chartSummaryText = buildDynamicChartSummary(name, scores);

  const profileRows = [
    {
      key: 'students',
      label: 'Öğrenci',
      icon: GraduationCap,
      score: normalizeScoreValue(suitability?.students),
      verdict: ai_report?.student_verdict,
    },
    {
      key: 'families',
      label: 'Aile',
      icon: Users,
      score: normalizeScoreValue(suitability?.families),
      verdict: ai_report?.family_verdict,
    },
    {
      key: 'professionals',
      label: 'Çalışan',
      icon: Briefcase,
      score: normalizeScoreValue(suitability?.professionals),
      verdict: ai_report?.professional_verdict,
    },
  ];

  return (
    <div className="space-y-6" data-testid="report-dashboard">
      {/* Overview Header Card */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-700">
              <MapPin size={12} className="text-emerald-600" />
              {district}, {city}
            </span>
            <h1 id="report-title" className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">{tagline}</p>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              {evidenceOnly
                ? 'Kira, ulaşım ve mahalle yaşamına dair kaynaklı bulguları incele. Bilginin kaynağını ve eksik kalan başlıkları birlikte gör.'
                : 'Artıları, dikkat etmen gerekenler ve kategori puanları aynı yerde. Eksik kategori verileri sıfır puan gibi gösterilmez.'}
            </p>

            {neighborhoods.length > 0 && onSelectNeighborhood && (
              <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Mahalle seçimi">
                {neighborhoods.map((item) => {
                  const active = item.slug === (selectedSlug || report.slug);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectNeighborhood(item.slug)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.name.replace(/\s+Mahallesi$/i, '')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>{evidenceOnly ? 'Kaynak kapsamı' : 'Genel skor'}</span>
            {evidenceOnly ? (
              <strong data-testid="overall-score" className="font-mono text-base text-slate-900">
                {findingCount} <small className="font-sans font-normal text-slate-500">bulgu</small>
              </strong>
            ) : (
              <span className="font-mono text-sm font-semibold text-slate-900">
                {overallScore !== null ? `${overallScore}/100` : '—/100'}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {evidenceOnly ? 'KAYNAKLI BİLGİ KAPSAMI' : 'KATEGORİ ANALİZİ'}
              </span>
              <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                {evidenceOnly ? `${coveredCount} / ${evidenceCategories.length} başlıkta bulgu` : 'Beş değerlendirme boyutu'}
              </h2>
            </div>
            {!evidenceOnly && <RadialScoreRing score={overallScore} size={76} strokeWidth={7} />}
          </div>

          {evidenceOnly ? (
            <div className="space-y-2.5" role="list" aria-label="Kaynaklı bilgi kapsamı">
              {evidenceCategories.map((category) => (
                <div
                  key={category.id}
                  role="listitem"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                >
                  <span className="font-medium text-slate-800">{category.label}</span>
                  <span className="font-mono text-slate-600">
                    {category.items.length
                      ? `${category.items.length} kaynaklı bulgu`
                      : 'Kaynaklı bilgi bulunamadı'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <ScoreBarChart scores={scores} idPrefix="report" />
          )}

          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
            {evidenceOnly
              ? `${sourceCount} farklı kaynaktan derlenen bulgular aşağıda listelenir.`
              : chartSummaryText}
          </p>
        </div>
      </div>

      {/* Category Cards Grid */}
      {evidenceOnly ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Kategori bazlı kaynaklı bilgiler">
          {['rent_cost', 'social_life', 'safety_news', 'earthquake_hazard', 'transportation'].map(
            (key) => {
              const category = evidenceCategories.find((item) => item.id === key);
              if (!category) return null;
              const Icon = categoryIcons[key];
              const count = category.items.length;
              return (
                <article
                  key={key}
                  data-testid={`evidence-card-${key}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <Icon size={15} className="text-slate-500" />
                      {category.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      {count ? `${count} bulgu` : 'Kaynak eksik'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    {count
                      ? category.items[0].text
                      : category.missing_reason || 'Bu başlıkta yeterli kaynaklı bilgi bulunamadı.'}
                  </p>
                </article>
              );
            }
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Kategori bazlı puan kartları">
          <ScoreCard
            title="Maliyet"
            score={scores?.cost_affordability}
            subtitle={`Ort. ${formatCurrency(rent_analysis?.average_rent_tl)} · ${rent_analysis?.trend_6m || ''}`}
            icon={Wallet}
            testId="card-cost_affordability"
          />
          <ScoreCard
            title="Sosyal yaşam"
            score={socialScore}
            subtitle={
              socialScore !== null
                ? 'Mahalle yaşamı ve sosyal olanaklar'
                : 'Sayısal puan backend verisinde henüz tanımlı değil'
            }
            icon={Users}
            testId="card-social_life"
          />
          <ScoreCard
            title="Güvenlik / haberler"
            score={scores?.safety}
            subtitle={`${news_items.length} yerel haber kaydı ve çevre bağlamı`}
            icon={ShieldCheck}
            testId="card-safety"
          />
          <ScoreCard
            title="Afet"
            score={scores?.disaster_resilience}
            subtitle={`PGA: ${disaster_risk?.pga_value_g ?? '—'} g · ${disaster_risk?.soil_class || ''}`}
            icon={Activity}
            testId="card-disaster_resilience"
          />
          <ScoreCard
            title="Ulaşım"
            score={scores?.transportation}
            subtitle={`${transport_analysis?.bus_frequency_min ?? '—'} dk sefer · Kampüs ${transport_analysis?.distance_to_campus_km ?? '—'} km`}
            icon={Bus}
            testId="card-transportation"
          />
        </div>
      )}

      {/* AI Narrative */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Sparkles size={15} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Mahalle Yaşam Sentezi ve Değerlendirme
              </h3>
              <p className="text-xs text-slate-500">
                {ai_report?.generated_by || 'MahallEN Rapor Sentezi'}
              </p>
            </div>
          </div>

          {onReloadReport && (
            <button
              type="button"
              onClick={onReloadReport}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Yenileniyor…' : 'Raporu yenile'}</span>
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700">
          {(ai_report?.executive_summary || '')
            .split(/\n+/)
            .filter(Boolean)
            .map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(!evidenceOnly || ai_report?.pros?.length > 0) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <CheckCircle2 size={14} />
                <span>Öne Çıkan Avantajlar</span>
              </h4>
              <ul className="mt-2 space-y-1.5 text-xs text-emerald-950">
                {(ai_report?.pros || []).map((pro, idx) => (
                  <li key={idx}>• {pro}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
              <AlertTriangle size={14} />
              <span>{evidenceOnly ? 'Verinin sınırları' : 'Dikkat Edilmesi Gerekenler'}</span>
            </h4>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-950">
              {(ai_report?.cons || []).map((con, idx) => (
                <li key={idx}>• {con}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {!evidence && (
        <div className="grid gap-4 sm:grid-cols-3" aria-label="Yaşam profiline göre uygunluk">
          {profileRows.map((prof) => {
            const Icon = prof.icon;
            const tones = getScoreToneColors(prof.score);
            return (
              <article
                key={prof.key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon size={16} className="text-slate-500" />
                    {prof.label}
                  </span>
                  <strong className="font-mono text-sm text-slate-900">
                    {prof.score !== null ? `${prof.score}/100` : '—'}
                  </strong>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {prof.score !== null && (
                    <div className={`h-full rounded-full ${tones.bar}`} style={{ width: `${prof.score}%` }} />
                  )}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{prof.verdict}</p>
              </article>
            );
          })}
        </div>
      )}

      {evidence && (
        <div className="grid gap-4 md:grid-cols-2">
          {evidence.categories.map((category) => (
            <article
              key={category.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
            >
              <h4 className="text-sm font-semibold text-slate-900">{category.label}</h4>
              <div className="mt-3 space-y-2.5">
                {category.items.length ? (
                  category.items.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <p className="text-slate-700">{item.text}</p>
                      {item.note && <small className="mt-1 block text-slate-500">{item.note}</small>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(item.sources || []).map((s) => (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            {s.title} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    {category.missing_reason || 'Bu başlıkta yeterli kaynaklı bilgi bulunamadı.'}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!evidence && (news_items.length > 0 || community_comments.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Newspaper size={16} className="text-slate-500" />
              <span>Yerel Haberler ve Olay Kayıtları</span>
            </h4>
            <div className="mt-3 space-y-2.5">
              {news_items.map((item, idx) => {
                const badge = getSentimentLabel(item.sentiment);
                return (
                  <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-slate-900">{item.title}</strong>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{item.summary}</p>
                    <small className="mt-1 block text-slate-500">
                      Kaynak: {item.source} · {item.date}
                    </small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquareQuote size={16} className="text-slate-500" />
              <span>Mahalle Sakinleri ve Yorumlar</span>
            </h4>
            <div className="mt-3 space-y-2.5">
              {community_comments.length > 0 ? (
                community_comments.map((c, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <strong className="text-slate-900">{c.author_profile}</strong>
                    <p className="mt-1 italic text-slate-700">“{c.comment}”</p>
                    <small className="mt-1 block text-slate-500">Platform: {c.platform}</small>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Bu mahalle için kayıtlı yorum bulunmuyor.</p>
              )}
            </div>
          </article>
        </div>
      )}

      {/* Transparency Footer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Database size={16} className="text-slate-500" />
          <h4>{evidenceOnly ? 'Kaynaklar ve veri kapsamı' : 'Veri Kaynakları ve Puanlama Yöntemi'}</h4>
        </div>
        {data_sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data_sources.map((src, i) =>
              /^https?:\/\//i.test(src) ? (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700 hover:border-blue-200 hover:text-blue-700"
                >
                  {safeHostname(src)}
                </a>
              ) : (
                <span
                  key={i}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700"
                >
                  {src}
                </span>
              )
            )}
          </div>
        )}
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-800">
            {evidenceOnly
              ? 'Bu bilgiler nasıl hazırlandı?'
              : 'Bu puanlar nasıl hesaplandı ve veri kapsamı nedir?'}
          </summary>
          <p className="mt-2 leading-relaxed">
            {scoring_methodology?.note ||
              'Kategori puanları 0 ile 100 arasında normalize edilmiştir. Backend üzerinde sayısal verisi bulunmayan kategoriler sıfır puan olarak değerlendirilmez.'}
          </p>
          {ai_report?.disclaimer && <p className="mt-1.5 leading-relaxed">{ai_report.disclaimer}</p>}
        </details>
      </div>
    </div>
  );
}
