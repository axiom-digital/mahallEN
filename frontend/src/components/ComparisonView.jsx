import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, ArrowUpRight, Info, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import './comparison/comparison.css';
import AppShell from './AppShell';
import { RadialScoreRing } from './AnalyticsCharts';
import { normalizeScoreValue } from './ScoreCard';
import { navigate, reportPath } from '../navigation.mjs';
import CompareOverview from './comparison/CompareOverview';
import CategoryComparison from './comparison/CategoryComparison';
import CompareMeasurements from './comparison/CompareMeasurements';
import PlaceCombobox from './comparison/PlaceCombobox';
import { PHASE_LABELS, selectionFromParam, useComparisonSlot } from './comparison/comparisonData';

export default function ComparisonView({
  initialSlug1 = 'kotekli',
  initialSlug2 = 'emirbeyazit',
  searchParams = '',
}) {
  const initialSelections = useMemo(() => {
    const params = new URLSearchParams(searchParams || window.location.search);
    const paramA = params.get('a');
    const paramB = params.get('b');
    const sel1 = selectionFromParam(paramA, initialSlug1);
    const fallbackB =
      sel1.kind === 'pilot' && sel1.slug === initialSlug2 ? 'kotekli' : initialSlug2;
    const sel2 = selectionFromParam(paramB, fallbackB);
    return [sel1, sel2];
  }, [searchParams, initialSlug1, initialSlug2]);

  const [sel1, setSel1] = useState(initialSelections[0]);
  const [sel2, setSel2] = useState(initialSelections[1]);

  useEffect(() => {
    setSel1(initialSelections[0]);
    setSel2(initialSelections[1]);
  }, [initialSelections]);

  const { state: slot1, startLivePrepare: prepareSlot1 } = useComparisonSlot(sel1);
  const { state: slot2, startLivePrepare: prepareSlot2 } = useComparisonSlot(sel2);

  const data1 = slot1.data;
  const data2 = slot2.data;

  const swapNeighborhoods = () => {
    setSel1(sel2);
    setSel2(sel1);
  };

  const getEvidenceCount = (data, categoryKey) => {
    const fromEvidenceReport = data?.evidence_report?.categories?.find(
      (c) => c.id === categoryKey
    )?.items?.length;
    if (typeof fromEvidenceReport === 'number') {
      return fromEvidenceReport;
    }
    return data?.pilot_evidence?.categories?.[categoryKey]?.observations?.length || 0;
  };

  const renderSlotHeaderCard = (slotState, selection, onPrepare, accent, testPrefix) => {
    const isEmerald = accent === 'emerald';
    const accentBar = isEmerald ? 'bg-emerald-600' : 'bg-blue-600';

    if (slotState.loading) {
      return (
        <div
          className="flex min-h-[200px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
          data-testid={`comp-card-${testPrefix}`}
        >
          <div className={`h-1 w-full ${accentBar}`} aria-hidden="true" />
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <RefreshCw size={16} className="animate-spin text-blue-600" />
              <span>Mahalle verileri yükleniyor…</span>
            </div>
          </div>
        </div>
      );
    }

    if (slotState.status === 'needs-prepare') {
      const placeInfo = slotState.place || selection;
      return (
        <div
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
          data-testid={`comp-card-${testPrefix}`}
        >
          <div className={`h-1 w-full ${accentBar}`} aria-hidden="true" />
          <div className="flex flex-1 flex-col justify-between p-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                Önbellekte hazır rapor yok
              </span>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{placeInfo.name}</h3>
              <p className="text-xs text-slate-500">
                {[placeInfo.district, placeInfo.city].filter(Boolean).join(' / ')}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Bu mahallenin raporu henüz önbellekte bulunmuyor. Canlı kaynak araştırması ve rapor
                üretimi yaklaşık 15–40 saniye sürebilir.
              </p>
              {slotState.error && (
                <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
                  {slotState.error}
                </p>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={slotState.preparing}
                onClick={onPrepare}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {slotState.preparing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{PHASE_LABELS[slotState.phase] || 'Hazırlanıyor…'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Raporu şimdi hazırla</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!slotState.data) {
      return (
        <div
          className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-card"
          data-testid={`comp-card-${testPrefix}`}
          role="alert"
        >
          <div className={`h-1 w-full ${accentBar}`} aria-hidden="true" />
          <div className="p-6 text-sm text-rose-700">Mahalle verisi alınamadı.</div>
        </div>
      );
    }

    const d = slotState.data;
    return (
      <article
        className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
        data-testid={`comp-card-${testPrefix}`}
      >
        <div className={`h-1 w-full ${accentBar}`} aria-hidden="true" />
        <div className="flex flex-1 flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                <MapPin size={11} className={isEmerald ? 'text-emerald-600' : 'text-blue-600'} />
                {d.district} / {d.city}
              </span>
              <h3 className="mt-2.5 truncate text-2xl font-semibold tracking-tight text-slate-900">
                {d.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{d.tagline}</p>
            </div>

            <RadialScoreRing score={d.scores?.overall_livability} size={86} strokeWidth={7} testId={`comp-${testPrefix}-overall`} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 text-xs">
            <span className="text-slate-500">
              Genel Skor:{' '}
              <strong className="font-mono text-slate-900">
                {normalizeScoreValue(d.scores?.overall_livability) !== null
                  ? `${normalizeScoreValue(d.scores?.overall_livability)}/100`
                  : 'Veri yetersiz'}
              </strong>
            </span>

            {d.placeId && (
              <a
                href={reportPath(d.placeId)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(reportPath(d.placeId), {
                    place: { id: d.placeId, name: d.name, district: d.district, city: d.city },
                    returnTo: '/karsilastir',
                  });
                }}
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
              >
                <span>Tam raporu ve kaynakları aç</span>
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  const bothReady = Boolean(data1 && data2);

  return (
    <AppShell activeRoute="compare">
      <main className="comparison-station">
        <header className="comparison-heading">
          <a href="/" onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate('/');
          }}><ArrowLeft size={15} /> Aramaya dön</a>
          <h1>Yan yana<span>.</span></h1>
          <p>İki mahalleyi seç, puanlarını ve bu puanların dayandığı kaynakları karşılaştır.</p>
        </header>
        <section aria-label="Karşılaştırılacak mahalle seçimi" className="comparison-console">
          <PlaceCombobox
            id="select-m1"
            label="1. Mahalle"
            accent="emerald"
            value={sel1}
            oppositeValue={sel2}
            resolvedData={data1 || slot1.place}
            onChange={setSel1}
          />

          <div className="comparison-swap">
            <button
              type="button"
              onClick={swapNeighborhoods}
              title="Mahallelerin yerini değiştir"
              aria-label="Mahallelerin yerini değiştir"
              className="swap-control"
            >
              <ArrowRightLeft size={16} />
            </button>
          </div>

          <PlaceCombobox
            id="select-m2"
            label="2. Mahalle"
            accent="blue"
            value={sel2}
            oppositeValue={sel1}
            resolvedData={data2 || slot2.place}
            onChange={setSel2}
          />
        </section>

        <div className="comparison-panels">
        <section className="grid gap-5 md:grid-cols-2">
          {renderSlotHeaderCard(slot1, sel1, prepareSlot1, 'emerald', 'left')}
          {renderSlotHeaderCard(slot2, sel2, prepareSlot2, 'blue', 'right')}
        </section>

        {/* Visual Radar + Profile Suitability Overview */}
        {(data1 || data2) && (
          <CompareOverview data1={data1} data2={data2} />
        )}

        {/* Synchronized 5-Category Matrix */}
        {(data1 || data2) && (
          <CategoryComparison data1={data1} data2={data2} />
        )}

        {/* Hard Data Points & Transport Matrix */}
        {bothReady && (
          <CompareMeasurements data1={data1} data2={data2} getEvidenceCount={getEvidenceCount} />
        )}

        {/* Side-by-Side AI Synthesis */}
        {bothReady && (
          <section className="grid gap-5 md:grid-cols-2">
            {[data1, data2].map((d, idx) => (
              <article
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Sparkles size={15} className="text-slate-500" />
                  <span>{d.name} · Sentez Özeti</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-700">
                  {d.ai_report?.executive_summary || 'Özet bulunmuyor.'}
                </p>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>{d.ai_report?.disclaimer || d.scoring_methodology?.note}</span>
                </div>
              </article>
            ))}
          </section>
        )}
        </div>
      </main>
    </AppShell>
  );
}
