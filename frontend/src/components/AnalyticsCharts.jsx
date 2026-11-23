import React from 'react';
import { extractCategoryScores, normalizeScoreValue } from '../scoring.mjs';

const SHORT_RADAR_LABELS = {
  cost_affordability: 'Maliyet',
  social_life: 'Sosyal Yaşam',
  safety: 'Güvenlik',
  disaster_resilience: 'Deprem',
  transportation: 'Ulaşım',
};

export function getScoreToneColors(score) {
  const valid = normalizeScoreValue(score);
  if (valid === null) {
    return {
      stroke: '#cbd5e1',
      bar: 'bg-slate-200',
      badge: 'border-slate-200 bg-slate-100 text-slate-600',
      text: 'text-slate-500',
    };
  }
  if (valid >= 75) {
    return {
      stroke: '#059669',
      bar: 'bg-emerald-600',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      text: 'text-emerald-700',
    };
  }
  if (valid >= 50) {
    return {
      stroke: '#2563eb',
      bar: 'bg-blue-600',
      badge: 'border-blue-200 bg-blue-50 text-blue-700',
      text: 'text-blue-700',
    };
  }
  if (valid >= 35) {
    return {
      stroke: '#d97706',
      bar: 'bg-amber-500',
      badge: 'border-amber-200 bg-amber-50 text-amber-800',
      text: 'text-amber-700',
    };
  }
  return {
    stroke: '#dc2626',
    bar: 'bg-rose-600',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    text: 'text-rose-700',
  };
}

export function RadialScoreRing({ score, size = 136, strokeWidth = 10, testId = 'overall-score' }) {
  const valid = normalizeScoreValue(score);
  const colors = getScoreToneColors(valid);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = valid !== null ? (valid / 100) * circumference : 0;
  const dashOffset = circumference - progress;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeDasharray={valid === null ? '4 5' : undefined}
        />
        {valid !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={valid === 0 ? circumference - 2 : dashOffset}
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <strong
          data-testid={testId}
          className={`font-mono tabular-nums tracking-tight text-slate-900 ${
            size >= 120 ? 'text-3xl font-semibold' : 'text-xl font-semibold'
          }`}
        >
          {valid !== null ? valid : '—'}
          <small className="ml-0.5 text-xs font-normal text-slate-400">/100</small>
        </strong>
      </div>
    </div>
  );
}

export function ConfidencePill({ meta, categoryKey, rentMode, testId, compact = false }) {
  if (!meta || !(meta.sample_count > 0)) return null;

  const unitMap = {
    rent_cost: rentMode === 'market_index' ? 'endeks' : 'ilan',
    cost_affordability: rentMode === 'market_index' ? 'endeks' : 'ilan',
    social_life: 'mekân',
    transportation: 'hat',
    safety_news: 'haber',
    safety: 'haber',
    earthquake_hazard: 'grid',
    disaster_resilience: 'grid',
  };
  const isHazard = categoryKey === 'earthquake_hazard' || categoryKey === 'disaster_resilience';
  const unit = unitMap[categoryKey] || 'kayıt';
  const countText = isHazard
    ? compact
      ? 'PGA gridi'
      : 'Akademik PGA'
    : `${meta.sample_count} ${unit}`;

  const label = compact
    ? `${countText}${meta.confidence === 'low' ? ' · Sınırlı' : ''}`
    : meta.confidence_label
      ? `${countText} · ${meta.confidence_label}`
      : countText;

  const level = meta.confidence || 'low';
  const toneClass =
    level === 'high'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : level === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <span
      data-testid={testId}
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight ${toneClass}`}
    >
      {label}
    </span>
  );
}

export function RadarComparisonChart({ primary, secondary = null, size = 300 }) {
  const padX = 76;
  const padY = 42;
  const vbWidth = size + padX * 2;
  const vbHeight = size + padY * 2;
  const cx = vbWidth / 2;
  const cy = vbHeight / 2;
  const maxR = size * 0.42;

  const primaryAxes = extractCategoryScores(primary?.scores);
  const secondaryAxes = secondary ? extractCategoryScores(secondary?.scores) : null;
  const rings = [25, 50, 75, 100];

  const polarPoint = (axisIndex, ratio) => {
    const angle = (-Math.PI / 2) + (axisIndex * 2 * Math.PI) / 5;
    return {
      x: cx + maxR * ratio * Math.cos(angle),
      y: cy + maxR * ratio * Math.sin(angle),
      angle,
    };
  };

  const buildShape = (axes) => {
    if (!axes) return { polygonPoints: '', vertices: [], hasMissing: false };
    const vertices = axes.map((item, idx) => {
      if (item.value === null) return { ...item, valid: false, x: cx, y: cy };
      const pt = polarPoint(idx, item.value / 100);
      return { ...item, valid: true, x: pt.x, y: pt.y };
    });
    const validVertices = vertices.filter((v) => v.valid);
    const polygonPoints =
      validVertices.length >= 3
        ? validVertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
        : '';
    return {
      polygonPoints,
      validVertices,
      vertices,
      hasMissing: validVertices.length < vertices.length,
    };
  };

  const pShape = buildShape(primaryAxes);
  const sShape = buildShape(secondaryAxes);
  const anyMissing = pShape.hasMissing || (sShape && sShape.hasMissing);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="w-full max-w-[420px] select-none overflow-visible"
        role="img"
        aria-label={
          secondary
            ? `${primary?.label || '1. Mahalle'} ve ${secondary?.label || '2. Mahalle'} 5 boyutlu radar karşılaştırması`
            : `${primary?.label || 'Mahalle'} 5 boyutlu kategori radar grafiği`
        }
      >
        {/* Concentric pentagon grid rings */}
        {rings.map((ring) => {
          const pts = primaryAxes
            .map((_, idx) => {
              const p = polarPoint(idx, ring / 100);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill={ring === 100 ? '#f8fafc' : 'none'}
              fillOpacity={ring === 100 ? 0.65 : 0}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* Radial spoke lines & ring ticks */}
        {primaryAxes.map((axis, idx) => {
          const outer = polarPoint(idx, 1);
          return (
            <line
              key={axis.key}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {rings.map((ring) => (
          <text
            key={`tick-${ring}`}
            x={cx + 4}
            y={cy - (maxR * ring) / 100 + 3}
            className="fill-slate-400 font-mono text-[9px]"
          >
            {ring}
          </text>
        ))}

        {/* Secondary polygon (Cobalt) */}
        {sShape.polygonPoints && (
          <polygon
            points={sShape.polygonPoints}
            fill="#2563eb"
            fillOpacity={0.14}
            stroke="#2563eb"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {sShape.validVertices?.length === 2 && (
          <line
            x1={sShape.validVertices[0].x}
            y1={sShape.validVertices[0].y}
            x2={sShape.validVertices[1].x}
            y2={sShape.validVertices[1].y}
            stroke="#2563eb"
            strokeWidth={2}
          />
        )}

        {/* Primary polygon (Emerald) */}
        {pShape.polygonPoints && (
          <polygon
            points={pShape.polygonPoints}
            fill="#059669"
            fillOpacity={0.18}
            stroke="#059669"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {pShape.validVertices?.length === 2 && (
          <line
            x1={pShape.validVertices[0].x}
            y1={pShape.validVertices[0].y}
            x2={pShape.validVertices[1].x}
            y2={pShape.validVertices[1].y}
            stroke="#059669"
            strokeWidth={2}
          />
        )}

        {/* Vertex markers */}
        {sShape.validVertices?.map((v) => (
          <circle
            key={`s-${v.key}`}
            cx={v.x}
            cy={v.y}
            r={4}
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}
        {pShape.validVertices?.map((v) => (
          <circle
            key={`p-${v.key}`}
            cx={v.x}
            cy={v.y}
            r={4}
            fill="#059669"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}

        {/* Axis labels + live scores */}
        {primaryAxes.map((axis, idx) => {
          const labelPt = polarPoint(idx, 1.2);
          const cos = Math.cos(labelPt.angle);
          const textAnchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
          const secVal = secondaryAxes?.[idx]?.value ?? null;
          return (
            <g key={`lbl-${axis.key}`}>
              <text
                x={labelPt.x}
                y={labelPt.y - 4}
                textAnchor={textAnchor}
                className="fill-slate-700 text-[11px] font-medium"
              >
                {SHORT_RADAR_LABELS[axis.key] || axis.label}
              </text>
              <text
                x={labelPt.x}
                y={labelPt.y + 11}
                textAnchor={textAnchor}
                className="font-mono text-[11px] font-semibold tabular-nums"
              >
                <tspan fill={axis.value !== null ? '#059669' : '#94a3b8'}>
                  {axis.value !== null ? axis.value : '—'}
                </tspan>
                {secondary && (
                  <>
                    <tspan fill="#cbd5e1"> / </tspan>
                    <tspan fill={secVal !== null ? '#2563eb' : '#94a3b8'}>
                      {secVal !== null ? secVal : '—'}
                    </tspan>
                  </>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend + honest null-axis note */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
        {primary?.label && (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
            {primary.label}
          </span>
        )}
        {secondary?.label && (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />
            {secondary.label}
          </span>
        )}
        {anyMissing && (
          <span className="text-[11px] text-slate-500">
            Eksik (—) eksenler grafiğe 0 olarak eklenmez.
          </span>
        )}
      </div>
    </div>
  );
}

export function RentRangeBar({ min, median, max, userBudget = null }) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return null;
  const candidates = [min, max, median, userBudget].filter(Number.isFinite);
  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  const span = Math.max(rawMax - rawMin, max * 0.25, 2000);
  const domainMin = Math.max(0, rawMin - span * 0.12);
  const domainMax = rawMax + span * 0.12;
  const pct = (val) => Math.max(0, Math.min(100, ((val - domainMin) / (domainMax - domainMin)) * 100));

  const leftPct = pct(min);
  const rightPct = pct(max);
  const widthPct = Math.max(2, rightPct - leftPct);
  const medianPct = Number.isFinite(median) ? pct(median) : null;
  const budgetPct = Number.isFinite(userBudget) ? pct(userBudget) : null;

  const fmt = (val) => `${Number(val).toLocaleString('tr-TR')} TL`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Fiyat aralığı dağılımı</span>
        <span className="font-mono tabular-nums">
          {min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`}
        </span>
      </div>

      <div className="relative my-4 h-3 w-full rounded-full bg-slate-200/80">
        <div
          className="absolute top-0 h-3 rounded-full bg-emerald-200 border border-emerald-400"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        {medianPct !== null && (
          <div
            className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full bg-emerald-700"
            style={{ left: `${medianPct}%` }}
            title={`Medyan: ${fmt(median)}`}
          />
        )}
        {budgetPct !== null && (
          <div
            className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full border border-white bg-blue-600 shadow-sm"
            style={{ left: `${budgetPct}%` }}
            title={`Bütçen: ${fmt(userBudget)}`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        {medianPct !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-1 rounded-full bg-emerald-700" />
            Medyan: <strong className="font-mono tabular-nums text-slate-900">{fmt(median)}</strong>
          </span>
        )}
        {budgetPct !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-1.5 rounded-full bg-blue-600" />
            Bütçen: <strong className="font-mono tabular-nums text-blue-700">{fmt(userBudget)}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

export function PgaHazardGauge({ pgaValue }) {
  if (!Number.isFinite(pgaValue)) return null;
  const maxScale = 0.6;
  const pct = Math.max(2, Math.min(98, (pgaValue / maxScale) * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Modellenen Pik Yer İvmesi (PGA)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <strong className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {pgaValue} g
            </strong>
            <span className="text-xs text-slate-500">50 yılda %10 aşılma olasılığı</span>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          Akademik grid noktası
        </span>
      </div>

      <div className="relative mt-4">
        <div
          className="h-2.5 w-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #10b981 0%, #f59e0b 45%, #ef4444 85%, #991b1b 100%)',
          }}
        />
        <div
          className="absolute -top-1.5 h-5 w-2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
        <span>0.0 g (Düşük)</span>
        <span>0.2 g</span>
        <span>0.4 g</span>
        <span>0.6 g+ (Çok yüksek)</span>
      </div>
    </div>
  );
}
