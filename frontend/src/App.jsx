import React, { useEffect, useRef, useState } from 'react';
import AppShell from './components/AppShell';
import { openReportPage } from './navigation.mjs';
import { searchPlaces, suggestPlaces } from './services/places';
import PlaceSearch from './station/PlaceSearch';
import ProfileModule from './station/ProfileModule';
import SearchResults from './station/SearchResults';
import StationManual from './station/StationManual';
import { pilotPlaces, placeQuery, samePlace } from './station/pilotPlaces';
import { profiles } from './scoring.mjs';

const emptySearch = { places: [], loading: false, notice: null, error: null };

export default function App() {
  const saved = window.history.state?.search;
  const [input, setInput] = useState(saved?.searchInput || '');
  const [query, setQuery] = useState(saved?.searchQuery || '');
  const [profile, setProfile] = useState(profiles[saved?.profileFilter] ? saved.profileFilter : 'general');
  const [search, setSearch] = useState(emptySearch);
  const [retry, setRetry] = useState(0);
  const [directoryError, setDirectoryError] = useState(null);
  const directoryRequest = useRef(null);
  const scrollToResults = useRef(Boolean(saved?.searchQuery));

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setSearch({ ...emptySearch, loading: true });
    searchPlaces(query, controller.signal).then(({ results, notice }) => {
      if (!controller.signal.aborted) setSearch({ ...emptySearch, places: results, notice });
    }).catch((error) => {
      if (!controller.signal.aborted) setSearch({ ...emptySearch, error: error.message });
    });
    return () => controller.abort();
  }, [query, retry]);

  useEffect(() => {
    if (query && scrollToResults.current) {
      scrollToResults.current = false;
      document.getElementById('mahalleler')?.scrollIntoView();
    }
  }, [query, retry]);

  useEffect(() => () => directoryRequest.current?.abort(), []);

  function openReport(place, searchState = {}) {
    openReportPage(place, { searchInput: input, searchQuery: query, profileFilter: profile, ...searchState });
  }

  function updateInput(value) {
    setInput(value);
    if (!value) {
      setQuery('');
      setSearch(emptySearch);
    }
  }

  function submitSearch() {
    const value = input.trim();
    if (value.length < 2) return;
    scrollToResults.current = true;
    setQuery(value);
    setRetry((count) => count + 1);
  }

  async function openDirectoryPlace(place) {
    directoryRequest.current?.abort();
    const controller = new AbortController();
    directoryRequest.current = controller;
    setDirectoryError(null);
    try {
      const { results } = await suggestPlaces(placeQuery(place), controller.signal);
      if (controller.signal.aborted) return;
      const match = results.find((result) => samePlace(result, place));
      if (!match) {
        setDirectoryError(`${place.name} dizinde bulunamadı.`);
        return;
      }
      openReport(match);
    } catch (error) {
      if (!controller.signal.aborted) setDirectoryError(error.message);
    }
  }

  return (
    <AppShell activeRoute="home">
      <main>
        <section className="station-cover">
          <div className="intro">
            <h1>Mahalle <br />istasyonu<span>.</span></h1>
            <p>Yaşamak istediğin yeri bul. Bir profil seç, mahalleleri kira, ulaşım ve günlük yaşam açısından incele.</p>
            <PlaceSearch
              input={input}
              onInput={updateInput}
              onSubmit={submitSearch}
              onSelect={(place) => openReport(place, { searchQuery: placeQuery(place) })}
            />
            <small>Yerel seçki · {pilotPlaces.length} pilot mahalle</small>
          </div>
          <ProfileModule profile={profile} onProfile={setProfile} />
        </section>
        {query && (
          <SearchResults
            query={query}
            profile={profile}
            search={search}
            onRetry={() => setRetry((count) => count + 1)}
            onSelect={openReport}
            onClear={() => updateInput('')}
          />
        )}
        {directoryError && <p className="directory-error" role="alert">{directoryError}</p>}
        <StationManual onOpen={openDirectoryPlace} />
      </main>
    </AppShell>
  );
}
