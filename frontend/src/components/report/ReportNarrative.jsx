import React from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { getScoreToneColors } from '../AnalyticsCharts';
import { normalizeScoreValue } from '../../scoring.mjs';
import { atPlace } from './reportDetails';

export default function ReportNarrative({
  report,
  paragraphs,
  narrative,
  profileOptions,
  profile,
  setProfile,
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <article
        className="print-card rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-7"
        aria-label="Mahalle değerlendirmesi"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Sparkles size={14} aria-hidden="true" />
          </span>
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              MAHALLEYE BİR BAKIŞ
            </span>
            <h2 className="text-lg font-semibold text-slate-900">{atPlace(report.name)} yaşam</h2>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
          {paragraphs.slice(0, 1).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {paragraphs.length > 1 && (
            <details className="group">
              <summary className="no-print cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700">
                Raporun tamamını oku ({paragraphs.length - 1} paragraf daha)
              </summary>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {paragraphs.slice(1).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </details>
          )}
        </div>

        {(narrative.pros?.length > 0 || narrative.cons?.length > 0) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {narrative.pros?.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>Öne çıkanlar</span>
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-emerald-950">
                  {narrative.pros.slice(0, 3).map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {narrative.cons?.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>Dikkat etmen gerekenler</span>
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-amber-950">
                  {narrative.cons.slice(0, 3).map((text, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-600" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </article>

      <article
        className="print-card flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-5"
        aria-label="Yaşam profiline göre değerlendirme"
      >
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            SENİN ÖNCELİĞİN
          </span>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Hayatına nasıl uyar?</h2>

          {/* Compact overview bars across all 3 profiles */}
          <div className="mt-4 space-y-2.5">
            {profileOptions.map((opt) => {
              const pScore = normalizeScoreValue(report.suitability?.[opt.key]);
              const tones = getScoreToneColors(pScore);
              const isSelected = profile === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setProfile(opt.key)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{opt.label} profili</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-800">
                      {pScore !== null ? `${pScore}/100` : 'Hesaplanmadı'}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    {pScore !== null && (
                      <div
                        className={`h-full rounded-full ${tones.bar}`}
                        style={{ width: pScore === 0 ? '4px' : `${pScore}%` }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900">
              {profileOptions.find((p) => p.key === profile)?.label} değerlendirmesi
            </span>
            {normalizeScoreValue(report.suitability?.[profile]) !== null && (
              <span className="font-mono text-xs font-medium text-slate-600">
                Ön puan · {report.suitability[profile]}/100
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            {
              narrative[
                profileOptions.find((p) => p.key === profile)?.verdictKey || 'student_verdict'
              ]
            }
          </p>
        </div>
      </article>
    </section>
  );
}
