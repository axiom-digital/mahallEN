import React from 'react';
import { X } from 'lucide-react';
import { ConfidencePill, getScoreToneColors } from '../AnalyticsCharts';
import { SlideOverDrawer, CATEGORIES, Sources } from './reportDetails';
import RentEvidence from './evidence/RentEvidence';
import SocialEvidence from './evidence/SocialEvidence';
import TransportEvidence from './evidence/TransportEvidence';
import GeneralEvidence from './evidence/GeneralEvidence';

export default function CategoryEvidence({
  selectedCategoryDef,
  report,
  setActiveCategory,
  activeCategoryScore,
  activeCategoryMeta,
  assessment,
  activeCategory,
  openCategory,
  roomGroups,
  briefing,
  setRoom,
  roomGroup,
  roomPriceExtents,
  validBudget,
  activeRoomMedian,
  personalBudgetInput,
  setPersonalBudgetInput,
  personalFitScore,
  setVenueKind,
  setSelectedVenue,
  setShowAllFindings,
  venueKind,
  venues,
  selectedVenue,
  showAllFindings,
  findings,
  archivedNews,
  rationale,
}) {
  return (
    <SlideOverDrawer
      open={Boolean(selectedCategoryDef)}
      title={selectedCategoryDef ? `${selectedCategoryDef.title} · ${report.name}` : ''}
      onClose={() => setActiveCategory(null)}
    >
      {selectedCategoryDef && (
        <>
          {/* Sticky Drawer Header with 5-Category Quick Switcher */}
          <div className="border-b border-slate-200 bg-white px-5 pt-5 pb-3 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  YAKINDAN BAK · {report.name}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {selectedCategoryDef.title}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                      getScoreToneColors(activeCategoryScore).badge
                    }`}
                  >
                    {activeCategoryScore !== null ? `${activeCategoryScore}/100` : 'Veri bekleniyor'}
                  </span>
                  <ConfidencePill
                    meta={activeCategoryMeta}
                    categoryKey={selectedCategoryDef.key}
                    rentMode={assessment?.calculation?.rent_mode}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                aria-label="Kategori ayrıntılarını kapat"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Switcher Tabs */}
            <div
              className="mt-4 flex gap-1 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Kategori geçişi"
            >
              {CATEGORIES.map((cat) => {
                const Icon = cat.Icon;
                const active = cat.key === activeCategory;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => openCategory(cat.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    <span>{cat.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Drawer Content */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6" id="category-evidence">
            {activeCategory === 'rent_cost' &&
            (roomGroups.length > 0 || briefing.rent_benchmarks?.length > 0) ? (
              <RentEvidence
                roomGroups={roomGroups}
                setRoom={setRoom}
                roomGroup={roomGroup}
                roomPriceExtents={roomPriceExtents}
                validBudget={validBudget}
                activeRoomMedian={activeRoomMedian}
                personalBudgetInput={personalBudgetInput}
                setPersonalBudgetInput={setPersonalBudgetInput}
                personalFitScore={personalFitScore}
                assessment={assessment}
                briefing={briefing}
              />
            ) : activeCategory === 'social_life' && briefing.venues?.length > 0 ? (
              <SocialEvidence
                briefing={briefing}
                setVenueKind={setVenueKind}
                setSelectedVenue={setSelectedVenue}
                setShowAllFindings={setShowAllFindings}
                venueKind={venueKind}
                venues={venues}
                selectedVenue={selectedVenue}
                showAllFindings={showAllFindings}
              />
            ) : activeCategory === 'transportation' && briefing.routes?.length > 0 ? (
              <TransportEvidence briefing={briefing} />
            ) : (
              <GeneralEvidence
                activeCategory={activeCategory}
                briefing={briefing}
                findings={findings}
                showAllFindings={showAllFindings}
                setShowAllFindings={setShowAllFindings}
              />
            )}

            {activeCategory === 'safety_news' && archivedNews.length > 0 && (
              <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-900">
                  Eski veya tarihi doğrulanmamış kayıtlar · {archivedNews.length}
                </summary>
                <div className="mt-3 space-y-2.5">
                  {archivedNews.map((item, i) => (
                    <article
                      key={i}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <time className="font-mono text-[11px] text-slate-500">
                        {item.date || 'Yayın tarihi doğrulanmadı'}
                      </time>
                      <p className="mt-1 text-xs text-slate-700">{item.text}</p>
                      <Sources item={item} />
                    </article>
                  ))}
                </div>
              </details>
            )}

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-slate-900">
                Değerlendirmenin dayanağı
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {rationale(activeCategory) || 'Kategori değerlendirme gerekçesi mevcut değil.'}
              </p>
            </details>
          </div>
        </>
      )}
    </SlideOverDrawer>
  );
}
