import React from 'react';
import { Info } from 'lucide-react';
import { PgaHazardGauge } from '../../AnalyticsCharts';
import { Sources } from '../reportDetails';

export default function GeneralEvidence({
  activeCategory,
  briefing,
  findings,
  showAllFindings,
  setShowAllFindings,
}) {
  return (
    <>
      {activeCategory === 'earthquake_hazard' && briefing.hazard?.value != null && (
        <PgaHazardGauge pgaValue={briefing.hazard.value} />
      )}

      {activeCategory === 'safety_news' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            Yerel haberler güvenlik değerlendirmesinin yalnızca kaynaklarından biridir;
            resmî suç oranı veya kişisel güvenlik ölçümü değildir.
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {findings.length ? (
          (showAllFindings ? findings : findings.slice(0, 4)).map((item, index) => (
            <article
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
            >
              {item.date && (
                <time
                  dateTime={item.date}
                  className="mb-1 block font-mono text-[11px] text-slate-500"
                >
                  {item.date}
                </time>
              )}
              <p className="text-xs leading-relaxed text-slate-800">{item.text}</p>
              <Sources item={item} />
              {item.note && (
                <details className="mt-2.5 text-[11px] text-slate-500">
                  <summary className="cursor-pointer font-medium hover:text-slate-700">
                    Bu kaydın kapsamı
                  </summary>
                  <p className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600">
                    {item.note}
                  </p>
                </details>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            Bu başlık için yeterli kaynaklı bilgi bulunmuyor.
          </p>
        )}
      </div>

      {findings.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAllFindings(!showAllFindings)}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAllFindings
            ? 'Daha az göster'
            : `${findings.length} bulgunun tamamını göster`}
        </button>
      )}
    </>
  );
}
