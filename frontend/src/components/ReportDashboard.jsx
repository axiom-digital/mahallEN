import React from 'react';
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
import ScoreCard from './ScoreCard';

export default function ReportDashboard({ report, onRefreshAi, refreshing }) {
  if (!report) return null;

  const {
    name,
    district,
    city,
    tagline,
    scores,
    suitability,
    rent_analysis,
    transport_analysis,
    disaster_risk,
    news_items,
    community_comments,
    data_sources,
    ai_report,
    scoring_methodology,
  } = report;

  return (
    <div className="space-y-6">
      {/* Top Neighborhood Hero Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>{district}, {city} • Pilot Area Report</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
              {name}
            </h2>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              {tagline}
            </p>
          </div>

          <div className="flex items-center gap-5 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 shrink-0">
            <div className="text-center">
              <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">
                Overall Livability
              </span>
              <div className="text-4xl font-extrabold text-emerald-400">
                {scores.overall_livability}
                <span className="text-lg text-slate-500 font-normal">/100</span>
              </div>
            </div>
            <div className="h-12 w-px bg-slate-800" />
            <div className="space-y-1 text-xs text-slate-300">
              <div>
                <span className="text-slate-400">Avg. Rent:</span>{' '}
                <strong className="text-white">{rent_analysis.average_rent_tl.toLocaleString()} TL</strong>
              </div>
              <div>
                <span className="text-slate-400">Seismic Risk:</span>{' '}
                <strong className="text-amber-300">{disaster_risk.risk_level}</strong>
              </div>
              <div>
                <span className="text-slate-400">Campus Dist:</span>{' '}
                <strong className="text-white">{transport_analysis.distance_to_campus_km} km</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Scores Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard
          title="Safety & News"
          score={scores.safety}
          subtitle="Incident reports, street lighting & local sentiment"
          icon={ShieldCheck}
        />
        <ScoreCard
          title="Transportation"
          score={scores.transportation}
          subtitle={`Bus every ${transport_analysis.bus_frequency_min} min • Campus ${transport_analysis.distance_to_campus_km} km`}
          icon={Bus}
        />
        <ScoreCard
          title="Cost Affordability"
          score={scores.cost_affordability}
          subtitle={`Avg ${rent_analysis.average_rent_tl.toLocaleString()} TL • ${rent_analysis.trend_6m}`}
          icon={Wallet}
        />
        <ScoreCard
          title="Disaster Resilience"
          score={scores.disaster_resilience}
          subtitle={`AFAD PGA: ${disaster_risk.pga_value_g}g • ${disaster_risk.soil_class}`}
          icon={Activity}
        />
      </div>

      {/* AI Executive Report & Pros/Cons */}
      <div className="rounded-3xl border border-emerald-500/25 bg-slate-900/90 p-6 md:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI-Synthesized Livability Verdict</h3>
              <p className="text-xs text-slate-400">{ai_report.generated_by}</p>
            </div>
          </div>

          <button
            onClick={onRefreshAi}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Synthesizing...' : 'Re-Synthesize with AI'}
          </button>
        </div>

        <p className="text-slate-200 leading-relaxed text-sm md:text-base">
          {ai_report.executive_summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/20 p-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Key Advantages (Pros)
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {ai_report.pros.map((pro, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-amber-950/20 border border-amber-500/20 p-4 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Trade-offs & Watchouts (Cons)
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {ai_report.cons.map((con, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Suitability by Target User Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
              <GraduationCap className="w-5 h-5" />
              <span>University Students</span>
            </div>
            <span className="text-lg font-bold text-white">{suitability.students}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${suitability.students}%` }} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{ai_report.student_verdict}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <Users className="w-5 h-5" />
              <span>Families</span>
            </div>
            <span className="text-lg font-bold text-white">{suitability.families}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${suitability.families}%` }} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{ai_report.family_verdict}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Briefcase className="w-5 h-5" />
              <span>Working Professionals</span>
            </div>
            <span className="text-lg font-bold text-white">{suitability.professionals}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${suitability.professionals}%` }} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{ai_report.professional_verdict}</p>
        </div>
      </div>

      {/* Domain Breakdown: Rent, Transport & Earthquake */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" /> Rent & Housing Market
          </h4>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Average Monthly Rent:</span>
              <span className="font-semibold text-white">{rent_analysis.average_rent_tl.toLocaleString()} TL</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Typical Range:</span>
              <span className="font-medium text-slate-200">{rent_analysis.rent_range_tl}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">6-Month Trend:</span>
              <span className="font-medium text-amber-300">{rent_analysis.trend_6m}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bus className="w-4 h-4 text-sky-400" /> Transit & Mobility Highlights
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            {transport_analysis.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sky-400">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" /> AFAD Earthquake & Soil Data
          </h4>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Hazard Level:</span>
              <span className="font-semibold text-amber-300">{disaster_risk.risk_level}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Peak Ground Accel. (PGA):</span>
              <span className="font-medium text-white">{disaster_risk.pga_value_g} g</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Soil Classification:</span>
              <span className="font-medium text-slate-200">{disaster_risk.soil_class}</span>
            </div>
          </div>
        </div>
      </div>

      {/* News & Community Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-emerald-400" /> Verified Local News & Events
          </h4>
          <div className="space-y-3">
            {news_items.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${
                      item.sentiment === 'positive'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : item.sentiment === 'negative'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.sentiment}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.summary}</p>
                <div className="text-[11px] text-slate-500">
                  Source: {item.source} • {item.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-sky-400" /> Community & Student Reviews
          </h4>
          <div className="space-y-3">
            {community_comments.map((c, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-300">{c.author_profile}</span>
                  <span className="text-xs text-amber-400">{'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</span>
                </div>
                <p className="text-xs text-slate-300 italic">"{c.comment}"</p>
                <div className="text-[11px] text-slate-500">Via {c.platform}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transparency, Sources & Risk R-02/R-03 Mitigation Footer */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-5 space-y-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Data Sources & Transparent Scoring Methodology</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {data_sources.map((src, i) => (
            <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              {src}
            </span>
          ))}
        </div>
        <p className="text-slate-500 flex items-start gap-1.5 pt-1">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Methodology & Disclaimer:</strong> {scoring_methodology?.note} {ai_report.disclaimer}
          </span>
        </p>
      </div>
    </div>
  );
}
