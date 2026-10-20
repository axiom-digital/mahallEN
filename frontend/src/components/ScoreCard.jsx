import React from 'react';

export function getScoreBadgeStyle(score) {
  if (score >= 80) {
    return {
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      label: 'High / Strong',
    };
  }
  if (score >= 65) {
    return {
      bar: 'bg-amber-400',
      badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
      label: 'Moderate / Good',
    };
  }
  return {
    bar: 'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    label: 'Challenging',
  };
}

export default function ScoreCard({ title, score, subtitle, icon: Icon }) {
  const style = getScoreBadgeStyle(score);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm transition hover:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${style.badge}`}>
          {score}/100
        </span>
      </div>

      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
