import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Bus, ChevronDown, ShieldCheck, Users, Wallet } from 'lucide-react';

export const CATEGORIES = [
  { key: 'rent_cost', score: 'cost_affordability', title: 'Maliyet', shortTitle: 'Maliyet', Icon: Wallet },
  { key: 'social_life', score: 'social_life', title: 'Sosyal yaşam', shortTitle: 'Sosyal', Icon: Users },
  { key: 'transportation', score: 'transportation', title: 'Ulaşım', shortTitle: 'Ulaşım', Icon: Bus },
  { key: 'earthquake_hazard', score: 'disaster_resilience', title: 'Deprem verisi', shortTitle: 'Deprem', Icon: Activity },
  { key: 'safety_news', score: 'safety', title: 'Yerel gündem', shortTitle: 'Gündem', Icon: ShieldCheck },
];

const DAY_LABELS = {
  weekday: 'Hafta içi',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

export function atPlace(name) {
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g) || ['e'];
  const suffix = `${/[fstkçşhp]$/i.test(name) ? 't' : 'd'}${/[aıou]/.test(vowels.at(-1)) ? 'a' : 'e'}`;
  return `${name}’${suffix}`;
}

export function currency(value) {
  if (value == null) return 'Karşılaştırma yok';
  return `${Number(value).toLocaleString('tr-TR')} TL`;
}

export function safeHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

export function safeHref(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function Sources({ item }) {
  const unique = [...new Map((item.sources || []).map((source) => [source.url, source])).values()].filter(
    (source) => safeHref(source.url)
  );
  if (!unique.length) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {unique.slice(0, 2).map((source) => {
        const href = safeHref(source.url);
        const label =
          source.title && !source.title.startsWith('http')
            ? source.title
            : safeHostname(source.url);
        return (
          <a
            key={source.url}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="max-w-[180px] truncate">{label}</span>
            <ArrowUpRight size={11} aria-hidden="true" />
          </a>
        );
      })}
      {unique.length > 2 && (
        <details className="inline-block text-[11px] text-slate-500">
          <summary className="cursor-pointer rounded-md px-1.5 py-0.5 font-medium hover:bg-slate-100 hover:text-slate-700">
            +{unique.length - 2} kaynak
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unique.slice(2).map((source) => (
              <a
                key={source.url}
                href={safeHref(source.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-blue-200 hover:text-blue-700"
              >
                <span>{source.title || safeHostname(source.url)}</span>
                <ArrowUpRight size={11} aria-hidden="true" />
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function RouteTimetableTabs({ schedule }) {
  const availableDays = Object.keys(schedule.days || {});
  const [activeDay, setActiveDay] = useState(availableDays[0] || 'weekday');
  const currentService = schedule.days?.[activeDay];

  if (!availableDays.length) return null;

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100/70">
        <span>{schedule.direction} · yayımlanmış sefer saatleri</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </summary>
      <div className="border-t border-slate-200 bg-white p-3.5">
        <p className="mb-3 text-[11px] text-slate-500">
          Uç duraktan hareket saatleridir; mahalleden geçiş veya canlı bekleme süresi değildir.
        </p>
        <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
          {availableDays.map((day) => (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={activeDay === day}
              onClick={() => setActiveDay(day)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeDay === day
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {DAY_LABELS[day] || day}
            </button>
          ))}
        </div>

        {currentService && (
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {currentService.first} – {currentService.last}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                {currentService.count} yayımlanmış hareket
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(currentService.times || []).map((time, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-slate-700"
                >
                  {time}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export function SlideOverDrawer({ open, title, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-drawer outline-none animate-slide-in-right"
      >
        {children}
      </aside>
    </div>
  );
}
