import React from 'react';
import { ArrowUpRight, ChevronDown, Database, ExternalLink } from 'lucide-react';
import { CATEGORIES, safeHref, safeHostname } from './reportDetails';

export default function ReportMethod({
  assessment,
  date,
  openCategory,
  rationale,
  report,
  evidence,
}) {
  return (
    <details
      id="report-method"
      className="print-card group rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50/70">
        <span className="inline-flex items-center gap-2">
          <Database size={16} className="text-slate-500" aria-hidden="true" />
          <span>Kaynaklar, kapsam ve puanlama yöntemi</span>
        </span>
        <ChevronDown
          size={16}
          className="text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-4 border-t border-slate-200 px-6 py-5 text-xs leading-relaxed text-slate-600">
        <p>{assessment.methodology}</p>
        <p>
          Kaynak dönemi: <strong className="text-slate-800">{date}</strong>. Haber göstergesi suç oranı,
          PGA göstergesi bina dayanıklılığı değildir. Eksik kategoriler sıfır sayılmaz.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div
              key={category.key}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-xs font-semibold text-slate-900">{category.title}</strong>
                <button
                  type="button"
                  onClick={() => openCategory(category.key)}
                  className="no-print inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  <span>Bulguları incele</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                {rationale(category.key) || 'Kategori gerekçesi mevcut değil.'}
              </p>
            </div>
          ))}
        </div>

        {report.data_sources?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold text-slate-900">
              Doğrulanmış Kaynak Bağlantıları ({report.data_sources.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {report.data_sources.map((src, idx) => {
                const href = safeHref(src);
                return href ? (
                  <a
                    key={idx}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <span>{safeHostname(src)}</span>
                    <ExternalLink size={10} />
                  </a>
                ) : null;
              })}
            </div>
          </div>
        )}

        {evidence.limitations?.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <strong className="text-xs font-semibold text-slate-800">Veri sınırları</strong>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {evidence.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
