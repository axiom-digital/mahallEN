import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { RadarComparisonChart, RadialScoreRing } from '../AnalyticsCharts';
import { ScoreBarChart } from '../ScoreCard';

export default function ScoreOverview({
  report,
  assessment,
  chartMode,
  setChartMode,
  openCategory,
}) {
  return (
    <section className="grid gap-5 md:grid-cols-12" aria-label="Genel puan ve kategori özeti">
      <aside
        className="print-card flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card md:col-span-5 lg:col-span-4"
        aria-label="Genel değerlendirme"
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          GENEL DEĞERLENDİRME
        </span>

        <div className="my-5">
          <RadialScoreRing
            score={report.scores.overall_livability}
            size={148}
            strokeWidth={11}
            testId="overall-score"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">
            {report.scores.overall_livability != null
              ? `${assessment.coverage}/5 kategoriye dayanıyor`
              : 'Genel puan için en az 2 kategoride kaynaklı puan gerekir.'}
          </p>
          {assessment.score_explanation && (
            <p className="text-sm leading-relaxed text-slate-600">{assessment.score_explanation}</p>
          )}
          <a
            href="#report-method"
            onClick={(event) => {
              event.preventDefault();
              const method = document.getElementById('report-method');
              if (method) {
                method.open = true;
                method.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="no-print inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700"
          >
            <span>Puan nasıl hesaplandı?</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </aside>

      <div className="print-card flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:col-span-7 lg:col-span-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              BEŞ BOYUT ANALİZİ
            </span>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
              Kategori puanları ve güven kapsamı
            </h2>
          </div>

          <div
            className="no-print inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="Grafik görünümü"
          >
            <button
              type="button"
              aria-pressed={chartMode === 'bars'}
              onClick={() => setChartMode('bars')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                chartMode === 'bars'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Çubuklar
            </button>
            <button
              type="button"
              aria-pressed={chartMode === 'radar'}
              onClick={() => setChartMode('radar')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                chartMode === 'radar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Radar
            </button>
          </div>
        </div>

        {chartMode === 'bars' ? (
          <ScoreBarChart
            scores={report.scores}
            categoryMeta={report.category_meta}
            rentMode={assessment?.calculation?.rent_mode}
            onSelectCategory={openCategory}
            idPrefix="report"
          />
        ) : (
          <div className="py-1">
            <RadarComparisonChart
              primary={{ label: report.name, scores: report.scores }}
              size={250}
            />
          </div>
        )}

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Eksik kategoriler sıfır (0) puan sayılmaz. Ayrıntılı kaynakları ve kanıtları görmek için herhangi bir başlığa tıkla.
        </p>
      </div>
    </section>
  );
}
