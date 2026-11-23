import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { suggestPlaces } from '../../services/places';
import { pilotPlaces } from '../../station/pilotPlaces';
import { sameSelection } from './comparisonData';

export default function PlaceCombobox({ id, label, accent, value, oppositeValue, resolvedData, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEsc = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutsideClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutsideClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      suggestPlaces(query, controller.signal)
        .then((res) => {
          if (!controller.signal.aborted) {
            setResults(res?.results || []);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const displayTitle = resolvedData?.name || value.name;
  const displaySub =
    resolvedData?.district && resolvedData?.city
      ? `${resolvedData.district} / ${resolvedData.city}`
      : value.district && value.city
        ? `${value.district} / ${value.city}`
        : 'Mahalle seç';

  const dotClass = accent === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600';

  return (
    <div ref={containerRef} className="relative flex-1">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
        <span>{label}</span>
      </label>

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 20);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left shadow-card transition hover:border-slate-300"
      >
        <div className="min-w-0">
          <strong className="block truncate text-sm font-semibold text-slate-900">
            {displayTitle}
          </strong>
          <span className="block truncate text-xs text-slate-500">{displaySub}</span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-popover">
          <div className="border-b border-slate-100 p-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-blue-500 focus-within:bg-white">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Türkiye’den mahalle ara (en az 2 harf)…"
                className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label={`${label} seçenekleri`}>
            {query.trim().length < 2 ? (
              <>
                <div className="px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Hazır Pilot Raporlar (10)
                </div>
                {pilotPlaces.map((pilot) => {
                  const disabled = sameSelection(pilot, oppositeValue);
                  const selected = sameSelection(pilot, value);
                  return (
                    <button
                      key={pilot.slug}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(pilot);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                        disabled
                          ? 'cursor-not-allowed opacity-40'
                          : selected
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <strong className="block font-medium">{pilot.name}</strong>
                        <span className={selected ? 'text-slate-300' : 'text-slate-500'}>
                          {pilot.district} / {pilot.city}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          selected
                            ? 'bg-white/20 text-white'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Hazır
                      </span>
                    </button>
                  );
                })}
              </>
            ) : searching ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                <RefreshCw size={13} className="animate-spin text-blue-600" />
                <span>Mahalleler aranıyor…</span>
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500">
                Eşleşen mahalle bulunamadı. İlçe veya şehir eklemeyi dene.
              </p>
            ) : (
              results.map((place) => {
                const candidate = {
                  kind: 'place',
                  id: place.id,
                  name: place.name,
                  district: place.district,
                  city: place.city,
                  report_available: place.report_available,
                };
                const disabled = sameSelection(candidate, oppositeValue);
                return (
                  <button
                    key={place.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(candidate);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                      disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <strong className="block font-medium text-slate-900">{place.name}</strong>
                      <span className="text-slate-500">
                        {place.district} / {place.city}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        place.report_available
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {place.report_available ? 'Rapor hazır' : 'Araştırma gerekir'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
