import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { normalizeScoreValue, profiles } from '../scoring.mjs';

const profileFields = {
  general: 'overall_score',
  student: 'suitability_student',
  family: 'suitability_family',
  professional: 'suitability_professional',
};

export default function SearchResults({ query, profile, search, onSelect, onRetry, onClear }) {
  const score = (place) => normalizeScoreValue(place[profileFields[profile]]);
  const results = [...search.places].sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));

  return (
    <section id="mahalleler" className="manual directory search-results" aria-labelledby="places-title" aria-busy={search.loading}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Arama sonuçları · {profiles[profile].label}</p>
          <h2 id="places-title">“{query}” için eşleşen mahalleler</h2>
        </div>
        <button type="button" className="station-button" onClick={onClear}>Temizle</button>
      </div>
      {search.loading && <p role="status">Mahalleler aranıyor…</p>}
      {search.error && (
        <div className="search-error" role="alert">
          <p>{search.error}</p>
          <button type="button" className="station-button" onClick={onRetry}>Tekrar dene</button>
        </div>
      )}
      {search.notice && <p className="search-notice">{search.notice}</p>}
      {!search.loading && !search.error && results.length === 0 && <p>Mahalle bulunamadı. İlçe veya şehir adıyla tekrar ara.</p>}
      {results.length > 0 && (
        <div className="locations">
          {results.map((place) => (
            <button key={place.id} type="button" onClick={() => onSelect(place)}>
              <span>
                <small>{place.city} / {place.district}</small>
                <strong>{place.name}</strong>
                <small>{score(place) === null ? 'Veri yetersiz' : `${score(place)}/100`}</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
