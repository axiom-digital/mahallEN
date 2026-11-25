import React from 'react';
import { RentRangeBar } from '../../AnalyticsCharts';
import { currency, Sources } from '../reportDetails';

export default function RentEvidence({
  roomGroups,
  setRoom,
  roomGroup,
  roomPriceExtents,
  validBudget,
  activeRoomMedian,
  personalBudgetInput,
  setPersonalBudgetInput,
  personalFitScore,
  assessment,
  briefing,
}) {
  return (
    <>
      {roomGroups.length > 0 && (
        <>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Konut tipi"
          >
            {roomGroups.map((group) => (
              <button
                type="button"
                key={group.rooms}
                onClick={() => setRoom(group.rooms)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition ${
                  roomGroup?.rooms === group.rooms
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {group.rooms}
              </button>
            ))}
          </div>

          {roomGroup.sample_count > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">İlan medyanı</span>
                <strong className="mt-1 block font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {currency(roomGroup.median)}
                </strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Karşılaştırılabilir</span>
                <strong className="mt-1 block font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {roomGroup.sample_count} örnek
                </strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-500">Fiyat aralığı</span>
                <strong className="mt-1 block font-mono text-xs font-semibold tabular-nums text-slate-900">
                  {roomGroup.min === roomGroup.max
                    ? currency(roomGroup.min)
                    : `${currency(roomGroup.min)} – ${currency(roomGroup.max)}`}
                </strong>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">
                {roomGroup.rooms} · {roomGroup.listings.length} kaynaklı ilan
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                İstenen bedelleri ve ilan tarihlerini aşağıda inceleyebilirsin. 1+1
                dışında kalan oda tipleri puanlamada standart katsayıyla 1+1
                eşdeğerine normalize edilir.
              </p>
            </div>
          )}

          {roomPriceExtents && (
            <RentRangeBar
              min={roomPriceExtents.min}
              median={roomPriceExtents.median}
              max={roomPriceExtents.max}
              userBudget={validBudget}
            />
          )}

          {/* Personal Monthly Budget Check (uses scoring.mjs formula) */}
          {activeRoomMedian != null && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-900">
                    Aylık kira bütçene göre uyum
                  </span>
                  <p className="text-[11px] text-slate-600">
                    {roomGroup.rooms} medyanı ({currency(activeRoomMedian)}) ile kişisel bütçeni karşılaştır.
                  </p>
                </div>
                <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Kişisel tahmin · backend puanını değiştirmez
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    type="number"
                    min="1000"
                    max="1000000"
                    step="500"
                    value={personalBudgetInput}
                    onChange={(e) => setPersonalBudgetInput(e.target.value)}
                    placeholder="Aylık bütçen (örn. 25000)"
                    aria-label="Aylık kira bütçen TL"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-14 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-500">
                    TL/ay
                  </span>
                </div>

                {personalFitScore !== null && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5">
                    <span className="text-xs text-slate-600">Bütçe uyumu:</span>
                    <strong className="font-mono text-sm font-semibold tabular-nums text-blue-700">
                      {personalFitScore}/100
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-xs leading-relaxed text-slate-500">
            {assessment?.calculation?.rent_mode === 'strict_1+1'
              ? 'İlanlardaki istenen bedeller; gerçekleşmiş kira veya mahalle ortalaması değildir. Maliyet puanında yalnız karşılaştırmaya uygun 1+1 örnekleri kullanılır.'
              : '1+1 ilanı az olan mahallelerde farklı oda tipleri standart katsayılarla 1+1 eşdeğerine normalize edilir ve varsa piyasa kira endeksiyle birlikte medyan hesaplanır.'}
          </p>

          <div className="space-y-2.5">
            {roomGroup.listings.map((listing, i) => (
              <article
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {currency(listing.amount)}
                    </strong>
                    <span className="ml-2 text-xs text-slate-500">
                      {listing.rooms} · {listing.date || 'Tarih belirsiz'}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      listing.comparable
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {listing.comparable ? 'Tarihli örnek' : 'Oda / endeks havuzunda'}
                  </span>
                </div>
                <Sources item={listing} />
              </article>
            ))}
          </div>
        </>
      )}

      {briefing.rent_benchmarks?.length > 0 && (
        <div className="border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">
            Piyasa Kira Endeksi
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {briefing.rent_benchmarks.map((b, i) => (
              <article
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
              >
                <strong className="block font-mono text-sm font-semibold text-emerald-700">
                  {b.label || currency(b.amount)}
                </strong>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {b.rooms || 'genel'} · {b.date || 'Güncel endeks'}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  {b.description}
                </p>
                <Sources item={b} />
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
