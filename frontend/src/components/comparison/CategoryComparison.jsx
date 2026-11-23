import React from 'react';
import { ConfidencePill, getScoreToneColors } from '../AnalyticsCharts';
import { CATEGORY_DEFINITIONS, getScoreBadgeStyle, normalizeScoreValue } from '../ScoreCard';

export default function CategoryComparison({
  data1,
  data2,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            KATEGORİ BOYUTLARI (0–100)
          </span>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
            Beş Değerlendirme Başlığında Detaylı Kıyaslama
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          Eksik veriler “Veri yetersiz” olarak işaretlenir ve 0 sayılmaz.
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {CATEGORY_DEFINITIONS.map((cat) => {
          const v1 = normalizeScoreValue(data1?.scores?.[cat.key]);
          const v2 = normalizeScoreValue(data2?.scores?.[cat.key]);
          const badge1 = getScoreBadgeStyle(v1);
          const badge2 = getScoreBadgeStyle(v2);
          const tones1 = getScoreToneColors(v1);
          const tones2 = getScoreToneColors(v2);
          const meta1 = data1?.category_meta?.[cat.key];
          const meta2 = data2?.category_meta?.[cat.key];
          const diff = v1 !== null && v2 !== null ? v1 - v2 : null;

          return (
            <div key={cat.key} className="grid items-center gap-4 py-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <strong className="block text-sm font-semibold text-slate-900">
                  {cat.label}
                </strong>
                <span className="text-xs text-slate-500">{cat.shortNote}</span>
              </div>

              {/* Left Neighborhood Cell */}
              <div
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:col-span-4"
                data-testid={`comp-left-cat-${cat.key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {data1?.name || '1. Mahalle'}
                  </span>
                  {v1 !== null ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${tones1.badge}`}
                    >
                      {v1}/100 · {badge1.label}
                    </span>
                  ) : (
                    <span
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500"
                      title="Bu kategori için karşılaştırmalı sayısal puan üretilmedi (0 olarak sayılmaz)."
                    >
                      Veri yetersiz
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  {v1 !== null && (
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: v1 === 0 ? '4px' : `${v1}%` }}
                    />
                  )}
                </div>
                {meta1 && (
                  <div className="mt-2">
                    <ConfidencePill meta={meta1} categoryKey={cat.key} compact />
                  </div>
                )}
              </div>

              {/* Center Diff Badge */}
              <div className="flex justify-center md:col-span-1">
                {diff !== null ? (
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                      diff === 0
                        ? 'bg-slate-100 text-slate-600'
                        : diff > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {diff === 0 ? 'Eşit' : diff > 0 ? `+${diff}` : `+${Math.abs(diff)}`}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-slate-300">—</span>
                )}
              </div>

              {/* Right Neighborhood Cell */}
              <div
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:col-span-4"
                data-testid={`comp-right-cat-${cat.key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {data2?.name || '2. Mahalle'}
                  </span>
                  {v2 !== null ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${tones2.badge}`}
                    >
                      {v2}/100 · {badge2.label}
                    </span>
                  ) : (
                    <span
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500"
                      title="Bu kategori için karşılaştırmalı sayısal puan üretilmedi (0 olarak sayılmaz)."
                    >
                      Veri yetersiz
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  {v2 !== null && (
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: v2 === 0 ? '4px' : `${v2}%` }}
                    />
                  )}
                </div>
                {meta2 && (
                  <div className="mt-2">
                    <ConfidencePill meta={meta2} categoryKey={cat.key} compact />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
