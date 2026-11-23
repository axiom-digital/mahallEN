import React from 'react';
import { MapPin } from 'lucide-react';
import VenueMap from '../../VenueMap';
import { Sources } from '../reportDetails';

export default function SocialEvidence({
  briefing,
  setVenueKind,
  setSelectedVenue,
  setShowAllFindings,
  venueKind,
  venues,
  selectedVenue,
  showAllFindings,
}) {
  return (
    <>
      {briefing.social_diversity && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {briefing.social_diversity.monoculture_warning && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {briefing.social_diversity.monoculture_warning}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {[
              ['yeme_icme', 'Yeme-içme'],
              ['kafe', 'Kafe'],
              ['gece', 'Gece'],
              ['gunluk', 'Günlük'],
              ['park_spor', 'Park / Spor'],
              ['kultur_sanat', 'Kültür / Sanat'],
            ].map(([gkey, glabel]) => {
              const cnt = briefing.social_diversity.groups?.[gkey] ?? 0;
              const low =
                (gkey === 'park_spor' || gkey === 'kultur_sanat') && cnt <= 2;
              return (
                <span
                  key={gkey}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                    cnt === 0 || low
                      ? 'border-slate-200 bg-white text-slate-500'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  <span>{glabel}:</span>
                  <strong className="font-mono">{cnt}</strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Adres bağlamı kaynakta eşleşen örneklerdir. Aramanın bulduğu kayıt sayısı,
        mahalledeki toplam mekân sayısı veya mutlak yaşam kalitesi değildir.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mekân türü">
        {['Tümü', ...new Set(briefing.venues.map((venue) => venue.kind))].map(
          (kind) => (
            <button
              type="button"
              key={kind}
              onClick={() => {
                setVenueKind(kind);
                setSelectedVenue(null);
                setShowAllFindings(false);
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                venueKind === kind
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {kind}
            </button>
          )
        )}
      </div>

      {venues.some((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)) && (
        <VenueMap
          venues={venues}
          selected={selectedVenue}
          onSelect={setSelectedVenue}
        />
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {(showAllFindings ? venues : venues.slice(0, 6)).map((venue) => {
          const isSel = venue.id === selectedVenue;
          return (
            <article
              key={venue.id}
              className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                isSel
                  ? 'border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {venue.kind}
                </span>
                <h4 className="mt-0.5 text-sm font-semibold text-slate-900">
                  {venue.name}
                </h4>
                <p className="mt-1 text-xs text-slate-600">
                  {venue.address || 'Açık adres için kaynağı incele.'}
                </p>
                {venue.scope === 'reference_radius' && (
                  <small className="mt-1 block text-[11px] text-slate-500">
                    Referans noktasının 1 km çevresinde
                  </small>
                )}
                <Sources item={venue} />
              </div>

              {Number.isFinite(venue.lat) && Number.isFinite(venue.lon) && (
                <button
                  type="button"
                  onClick={() => setSelectedVenue(venue.id)}
                  className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span>Haritada göster</span>
                </button>
              )}
            </article>
          );
        })}
      </div>

      {venues.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAllFindings(!showAllFindings)}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAllFindings
            ? 'Daha az göster'
            : `${venues.length} mekânın tamamını göster`}
        </button>
      )}
    </>
  );
}
