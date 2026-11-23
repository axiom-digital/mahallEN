import React from 'react';
import { ArrowRightLeft, ArrowUpRight, Check, MapPin, Printer, RefreshCw, Share2, Wallet } from 'lucide-react';
import { comparePath, navigate, reportPath } from '../../navigation.mjs';
import { currency, atPlace } from './reportDetails';

export default function ReportHeading({
  report,
  roomGroup,
  openCategory,
  date,
  briefing,
  counts,
  handleShareLink,
  copiedLink,
  onReloadReport,
  refreshing,
}) {
  return (
    <header
      id="rapor-detay"
      className="print-card rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
    >
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-700">
              <MapPin size={12} className="text-emerald-600" aria-hidden="true" />
              {report.city} / {report.district}
            </span>
            {roomGroup?.listings?.length > 0 && (
              <button
                type="button"
                onClick={() => openCategory('rent_cost')}
                className="no-print inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
              >
                <Wallet size={13} aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {roomGroup.rooms}:{' '}
                  {currency(Math.min(...roomGroup.listings.map((item) => item.amount)))} –{' '}
                  {currency(Math.max(...roomGroup.listings.map((item) => item.amount)))}
                </span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <h1
            id="report-title"
            className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
          >
            {atPlace(report.name)} yaşam
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="font-mono">{date} kaynak kontrolü</span>
            {briefing.venues?.length > 0 && (
              <span>
                <strong className="font-mono font-medium text-slate-700">
                  {briefing.venues.length}
                </strong>{' '}
                örnek mekân kaydı
              </span>
            )}
            {counts.routes > 0 && (
              <span>
                <strong className="font-mono font-medium text-slate-700">
                  {counts.routes}
                </strong>{' '}
                resmî hat kaydı
              </span>
            )}
            {report.data_sources?.length > 0 && (
              <span>
                <strong className="font-mono font-medium text-slate-700">
                  {report.data_sources.length}
                </strong>{' '}
                doğrulanmış URL
              </span>
            )}
          </div>
        </div>

        {/* SaaS Action Buttons */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(comparePath(report.slug), {
                returnTo: reportPath(report.slug),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-card transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowRightLeft size={14} aria-hidden="true" />
            <span>Karşılaştır</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-card transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            {copiedLink ? (
              <>
                <Check size={14} className="text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700">Bağlantı kopyalandı</span>
              </>
            ) : (
              <>
                <Share2 size={14} aria-hidden="true" />
                <span>Paylaş</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-card transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <Printer size={14} aria-hidden="true" />
            <span>Yazdır / PDF</span>
          </button>

          {onReloadReport && (
            <button
              type="button"
              disabled={refreshing}
              onClick={onReloadReport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              <span>{refreshing ? 'Yükleniyor…' : 'Yeniden yükle'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
