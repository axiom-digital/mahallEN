import React from 'react';
import {
  CATEGORY_DEFINITIONS,
  extractCategoryScores,
  normalizeScoreValue,
} from '../scoring.mjs';
import { ConfidencePill, getScoreToneColors } from './AnalyticsCharts';

export { CATEGORY_DEFINITIONS, extractCategoryScores, normalizeScoreValue };

export function getScoreBadgeStyle(score) {
  const validScore = normalizeScoreValue(score);
  if (validScore === null) {
    return {
      tone: 'missing',
      label: 'Yeterli veri yok',
    };
  }
  if (validScore >= 75) {
    return {
      tone: 'strong',
      label: 'Güçlü / Olumlu',
    };
  }
  if (validScore >= 50) {
    return {
      tone: 'balanced',
      label: 'Dengeli / Orta',
    };
  }
  return {
    tone: 'watchout',
    label: 'Dikkat / Sınırlı',
  };
}

/**
 * Clean SaaS horizontal bar chart for the 5 evaluation dimensions.
 * Missing scores (`null`) are explicitly displayed as unavailable rather than 0.
 */
export function ScoreBarChart({
  scores,
  categoryMeta = null,
  rentMode = null,
  onSelectCategory = null,
  idPrefix = 'chart',
}) {
  const items = extractCategoryScores(scores);

  return (
    <div className="space-y-3" role="list" aria-label="Kategori puan grafikleri (0-100)">
      {items.map((item) => {
        const isAvailable = item.value !== null;
        const colors = getScoreToneColors(item.value);
        const meta = categoryMeta?.[item.key];
        const Wrapper = onSelectCategory ? 'button' : 'div';

        return (
          <Wrapper
            key={item.key}
            type={onSelectCategory ? 'button' : undefined}
            onClick={onSelectCategory ? () => onSelectCategory(item.evidenceKey) : undefined}
            className={`group flex w-full flex-col gap-1.5 rounded-xl border border-transparent px-3 py-2 text-left transition ${
              onSelectCategory ? 'hover:border-slate-200 hover:bg-slate-50/90' : ''
            }`}
            role="listitem"
            data-testid={`${idPrefix}-row-${item.key}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-800 group-hover:text-slate-950">
                  {item.label}
                </span>
                {meta && (
                  <ConfidencePill
                    meta={meta}
                    categoryKey={item.evidenceKey}
                    rentMode={rentMode}
                    compact
                  />
                )}
              </div>

              <span
                className={`font-mono text-sm font-semibold tabular-nums ${
                  isAvailable ? 'text-slate-900' : 'text-slate-400'
                }`}
                data-testid={`${idPrefix}-score-${item.key}`}
                title={
                  isAvailable
                    ? `${item.label}: ${item.value} / 100`
                    : `${item.label}: Sayısal puan henüz mevcut değil (0 puan olarak sayılmaz)`
                }
              >
                {isAvailable ? item.value : '—'}
              </span>
            </div>

            {isAvailable ? (
              <div
                className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`${item.label} puanı`}
                aria-valuenow={item.value}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: item.value === 0 ? '4px' : `${item.value}%` }}
                />
              </div>
            ) : (
              <div
                className="flex h-2 w-full items-center rounded-full border border-dashed border-slate-200 bg-slate-50"
                aria-label={`${item.label}: sayısal puan verisi henüz mevcut değil`}
              >
                <span className="sr-only">Yeterli veri yok</span>
              </div>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}

export default function ScoreCard({ title, score, subtitle, icon: Icon, testId, children }) {
  const validScore = normalizeScoreValue(score);
  const style = getScoreBadgeStyle(validScore);
  const colors = getScoreToneColors(validScore);

  return (
    <article
      className="print-card flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-card"
      data-testid={testId}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
                aria-hidden="true"
              >
                <Icon size={16} />
              </span>
            )}
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums ${colors.badge}`}
          >
            {validScore !== null ? `${validScore}/100` : style.label}
          </span>
        </div>

        <div className="mt-4">
          {validScore !== null ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={`${title} puanı`}
              aria-valuenow={validScore}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${colors.bar}`}
                style={{ width: validScore === 0 ? '4px' : `${validScore}%` }}
              />
            </div>
          ) : (
            <div
              className="flex h-6 items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-500"
              aria-hidden="true"
            >
              Sayısal puan hesaplanmadı (0 olarak kabul edilmez)
            </div>
          )}
        </div>

        {subtitle && <p className="mt-3 text-xs leading-relaxed text-slate-600">{subtitle}</p>}
      </div>

      {children && <div className="mt-3">{children}</div>}
    </article>
  );
}
