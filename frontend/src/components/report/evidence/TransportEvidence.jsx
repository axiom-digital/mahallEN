import React from 'react';
import { Sources, RouteTimetableTabs } from '../reportDetails';

export default function TransportEvidence({
  briefing,
}) {
  return (
    <>
      <div className="space-y-3">
        {briefing.routes.map((route, i) => (
          <article
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex shrink-0 items-center rounded-lg bg-blue-600 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                {route.code || 'Hat'}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900">{route.route}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {route.local_evidence}
                </p>
                {route.timetable?.map((schedule, j) => (
                  <RouteTimetableTabs key={j} schedule={schedule} />
                ))}
                <Sources item={route} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {briefing.transport_notices?.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-900">
            Tarihli yol ve erişim duyuruları · {briefing.transport_notices.length}
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Bu kayıtlar yayınlandıkları tarihteki durumu anlatır; çalışmaların bugün
            sürdüğü varsayılmaz.
          </p>
          <div className="mt-3 space-y-2.5">
            {briefing.transport_notices.map((notice, i) => (
              <article
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <time className="font-mono text-[11px] text-slate-500">
                  {notice.date ||
                    (notice.observed_at
                      ? `${notice.observed_at} tarihinde sayfada görüldü`
                      : 'Yayın tarihi belirtilmemiş')}
                </time>
                <p className="mt-1 text-xs text-slate-700">{notice.text}</p>
                <Sources item={notice} />
              </article>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
