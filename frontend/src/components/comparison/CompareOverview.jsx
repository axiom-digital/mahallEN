import React from 'react';
import { RadarComparisonChart } from '../AnalyticsCharts';
import { normalizeScoreValue } from '../ScoreCard';

export default function CompareOverview({
  data1,
  data2,
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-6">
        <div className="mb-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            RADAR KARŞILAŞTIRMASI
          </span>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
            5 Boyutlu Profil Örtüşmesi
          </h2>
        </div>
        <RadarComparisonChart
          primary={data1 ? { label: data1.name, scores: data1.scores } : null}
          secondary={data2 ? { label: data2.name, scores: data2.scores } : null}
          size={270}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-6">
        <div className="mb-4">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            YAŞAM PROFİLLERİ
          </span>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
            Genel &amp; Profil Uygunlukları
          </h2>
        </div>

        <div className="space-y-4">
          {[
            { key: 'overall', label: 'Genel Skor', get: (d) => d?.scores?.overall_livability },
            { key: 'students', label: 'Öğrenci', get: (d) => d?.suitability?.students },
            { key: 'families', label: 'Aile', get: (d) => d?.suitability?.families },
            { key: 'professionals', label: 'Çalışan', get: (d) => d?.suitability?.professionals },
          ].map((row) => {
            const v1 = normalizeScoreValue(row.get(data1));
            const v2 = normalizeScoreValue(row.get(data2));
            const diff = v1 !== null && v2 !== null ? v1 - v2 : null;

            return (
              <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">{row.label}</span>
                  {diff !== null && diff !== 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                        diff > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {diff > 0
                        ? `${data1?.name} +${diff}`
                        : `${data2?.name} +${Math.abs(diff)}`}
                    </span>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-20 truncate text-[11px] text-slate-600">
                      {data1?.name || '1. Mahalle'}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      {v1 !== null && (
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: v1 === 0 ? '4px' : `${v1}%` }}
                        />
                      )}
                    </div>
                    <span className="w-10 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {v1 !== null ? v1 : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="w-20 truncate text-[11px] text-slate-600">
                      {data2?.name || '2. Mahalle'}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      {v2 !== null && (
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: v2 === 0 ? '4px' : `${v2}%` }}
                        />
                      )}
                    </div>
                    <span className="w-10 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {v2 !== null ? v2 : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
