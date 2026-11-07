import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchNeighborhoods,
  fetchNeighborhoodSuggestions,
  fetchSystemHealth,
} from './services/api';
import { normalizeScoreValue } from './components/ScoreCard';

import { openReportPage } from './navigation.mjs';

const NEIGHBORHOOD_VISUALS = {
  kotekli: {
    image: '/assets/sokak.jpg',
    tag: 'Kampüs çevresinde bir hayat',
    trDescription:
      'Kampüs çevresindeki günlük hayatı, sosyal yaşamı ve ulaşım seçeneklerini birlikte keşfet.',
  },
  akyaka: {
    image: '/assets/kiyi.jpg',
    tag: 'Kıyının başka bir ritmi var',
    trDescription:
      'Kıyı yaşamını hayal ederken günlük ihtiyaçları, ulaşımı ve dönemsel maliyetleri de düşün.',
  },
  emirbeyazit: {
    image: '/assets/merkez.jpg',
    tag: 'Günlük hayatın merkezinde',
    trDescription:
      'Merkezde yaşamanın günlük ihtiyaçlara erişim ve mahalle yaşamı açısından ne sunduğuna bak.',
  },
  muslihittin: {
    image: '/assets/tarihi-sokak.jpg',
    tag: 'Sokağın hikâyesini keşfet',
    trDescription:
      'Sokak dokusunun ötesine bak. Mahalle yaşamını kendi beklentilerinle birlikte değerlendir.',
  },
  orhaniye: {
    image: '/assets/carsi.jpg',
    tag: 'Şehrin akışına yakın',
    trDescription:
      'Günün hareketini, ulaşım olanaklarını ve çevredeki ihtiyaç noktalarını aynı çerçevede incele.',
  },
};

const PROFILE_CONFIG = {
  '': {
    id: '',
    buttonLabel: 'Genel bakış',
    rankTitle: 'Aradığın mahalleler',
    description:
      'Tüm değerlendirme boyutlarının dengeli birleşimi. Profil seçtiğinde sıralama önceliğine göre güncellenir.',
    scoreField: 'overall_score',
  },
  student: {
    id: 'student',
    buttonLabel: 'Öğrenciyim',
    rankTitle: 'Öğrenci gözüyle mahalleler',
    description:
      'Önce kampüse ulaşım, günlük maliyet ve sosyal yaşam. Seçiminle birlikte mahalle sıralaması backend verisiyle değişir.',
    scoreField: 'suitability_student',
  },
  family: {
    id: 'family',
    buttonLabel: 'Ailemle yaşıyorum',
    rankTitle: 'Aile gözüyle mahalleler',
    description:
      'Günlük ihtiyaçlar, sakin mahalle yaşamı, afet ve güvenlik bilgisi. Seçiminle birlikte sıralama güncellenir.',
    scoreField: 'suitability_family',
  },
  professional: {
    id: 'professional',
    buttonLabel: 'Çalışıyorum',
    rankTitle: 'Çalışan gözüyle mahalleler',
    description:
      'Ulaşım, günlük yaşamın akışı ve şehir merkezine erişim. Seçiminle birlikte sıralama güncellenir.',
    scoreField: 'suitability_professional',
  },
};

const QUICK_SUGGESTIONS = [];

export default function App() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);

  const [searchInput, setSearchInput] = useState(window.history.state?.search?.searchInput || '');
  const [searchQuery, setSearchQuery] = useState(window.history.state?.search?.searchQuery || '');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [districtFilter, setDistrictFilter] = useState(window.history.state?.search?.districtFilter || 'all');
  const [profileFilter, setProfileFilter] = useState(window.history.state?.search?.profileFilter || '');

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(null);
  const [listRetryCount, setListRetryCount] = useState(0);

  const [health, setHealth] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!suggestionsOpen || searchInput.trim().length < 2) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchNeighborhoodSuggestions(searchInput, { signal: controller.signal })
        .then(items => { if (!controller.signal.aborted) { setSuggestions(items); setActiveSuggestion(-1); } })
        .catch(() => { if (!controller.signal.aborted) setSuggestions([]); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchInput, suggestionsOpen]);

  const chooseSuggestion = place => {
    openReportPage(place, {searchInput, searchQuery: `${place.name} ${place.district} ${place.city}`, districtFilter, profileFilter});
  };

  // System health check
  useEffect(() => {
    const controller = new AbortController();
    fetchSystemHealth({ signal: controller.signal })
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Load & filter neighborhoods from backend API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setNeighborhoods([]);
      setSelectedSlug(null);
      setListError(null);
      setLoadingList(false);
      return;
    }
    const controller = new AbortController();
    setLoadingList(true);
    setListError(null);

    fetchNeighborhoods(searchQuery, profileFilter, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const safeList = Array.isArray(data) ? data : [];
        setNeighborhoods(safeList);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setListError('Mahalle listesi yüklenirken bir hata oluştu. Lütfen bağlantıyı kontrol edip tekrar dene.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingList(false);
        }
      });

    return () => controller.abort();
  }, [searchQuery, profileFilter, listRetryCount]);

  // Filter by district on client side if a specific district pill is chosen
  const displayedNeighborhoods = useMemo(() => {
    if (districtFilter === 'all') return neighborhoods;
    return neighborhoods.filter(
      (n) => (n.district || '').toLocaleLowerCase('tr-TR') === districtFilter.toLocaleLowerCase('tr-TR')
    );
  }, [neighborhoods, districtFilter]);

  // Keep selectedSlug synchronized with current search/filter results
  useEffect(() => {
    if (loadingList) return;
    if (displayedNeighborhoods.length === 0) {
      setSelectedSlug(null);
      return;
    }
    // A report opens only after the user explicitly selects a search result.
  }, [displayedNeighborhoods, loadingList, selectedSlug]);

  const scrollToSection = useCallback((elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReduced ? 'instant' : 'smooth' });
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) return;
    setSuggestionsOpen(false); setSuggestions([]); setSelectedSlug(null);
    setDistrictFilter('all');
    setSearchQuery(trimmed);
    scrollToSection('mahalleler');
  };

  const handleQuickSearch = (term) => {
    setSearchInput(term);
    setDistrictFilter('all');
    setSearchQuery(term);
    scrollToSection('mahalleler');
  };

  const handleResetFilters = () => {
    setSuggestionsOpen(false); setSuggestions([]);
    setSearchInput('');
    setSearchQuery('');
    setDistrictFilter('all');
  };

  const handleDistrictChange = (district) => {
    setDistrictFilter(district);
  };

  const handleSelectNeighborhood = slug => {
    const place = neighborhoods.find(item => item.slug === slug || item.id === slug);
    if (place) openReportPage(place, {searchInput, searchQuery, districtFilter, profileFilter});
  };

  const activeProfile = PROFILE_CONFIG[profileFilter] || PROFILE_CONFIG[''];

  const rankedNeighborhoods = useMemo(() => {
    const field = activeProfile.scoreField;
    return [...neighborhoods].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
  }, [neighborhoods, activeProfile]);


  return (
    <div className="mahallen-shell">
      <a className="skip" href="#mahalleler">
        İçeriğe geç
      </a>

      {/* HERO SECTION */}
      <header className="hero" id="baslangic">
        <img
          className="hero-image"
          src="/assets/mugla-temsili.png"
          alt="Muğla dokusundan esinlenen taş sokak ve kiremit çatılı evlerin temsilî görünümü"
          fetchPriority="high"
        />

        <nav className="nav container" aria-label="Ana menü">
          <a href="#baslangic" className="brand" aria-label="MahallEN ana sayfa">
            Mahall<span>EN</span>
            <i />
          </a>

          <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <a href="#mahalleler" onClick={() => setMobileMenuOpen(false)}>
              Mahalleler
            </a>
            <a href="#sana-gore" onClick={() => setMobileMenuOpen(false)}>
              Sana göre
            </a>
            <a href="#mahalleler" onClick={() => setMobileMenuOpen(false)}>
              Rapor &amp; Grafikler
            </a>
            <a href="#nasil-calisir" onClick={() => setMobileMenuOpen(false)}>
              Nasıl çalışır?
            </a>
            <button
              type="button"
              className="nav-report"
              onClick={() =>
                document.getElementById('neighborhood-search')?.focus()
              }
            >
              <span>Raporu incele</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <button
            type="button"
            className="menu-toggle"
            aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? '×' : '☰'}
          </button>
        </nav>

        <div className="hero-content container">
          <div className="eyebrow light">
            <span className="live-dot" /> KAYNAKLI MAHALLE REHBERİ
          </div>
          <h1>
            Yaşayacağın yeri
            <br />
            önce tanı.
          </h1>
          <p>
            Kira, ulaşım, güvenlik ve mahalle yaşamı.
            <br className="desktop-break" /> Taşınmadan önce merak ettiklerin, tek raporda.
          </p>

          <form className="search" id="hero-search" role="search" onSubmit={handleSearchSubmit}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSuggestionsOpen(false); }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <label className="sr-only" htmlFor="neighborhood-search">
              Mahalle ara
            </label>
            <input
              id="neighborhood-search"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                setSuggestionsOpen(true); setActiveSuggestion(-1);
                if (val === '') {
                  setSearchQuery('');
                }
              }}
              placeholder="Hangi mahalleyi merak ediyorsun?"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen && suggestions.length > 0}
              aria-controls="neighborhood-suggestions"
              aria-activedescendant={activeSuggestion >= 0 ? `suggestion-${activeSuggestion}` : undefined}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') setSuggestionsOpen(false);
                if (suggestionsOpen && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
                  e.preventDefault(); setActiveSuggestion(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
                }
                if (e.key === 'Enter' && suggestionsOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                  e.preventDefault(); chooseSuggestion(suggestions[activeSuggestion]);
                }
              }}
            />
            {(searchInput || searchQuery) && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleResetFilters}
                aria-label="Aramayı temizle"
              >
                ×
              </button>
            )}
            <button type="submit">
              Keşfet <span aria-hidden="true">↗</span>
            </button>
            {suggestionsOpen && suggestions.length > 0 && <ul id="neighborhood-suggestions" className="search-suggestions-list" role="listbox" aria-label="Mahalle önerileri">
              {suggestions.map((place, i) => <li key={place.id} role="option" id={`suggestion-${i}`} aria-selected={i === activeSuggestion}>
                <button type="button" onClick={() => chooseSuggestion(place)}><strong>{place.name}</strong><span>{place.district} / {place.city}</span></button>
              </li>)}
            </ul>}
          </form>

          <div className="hero-suggestions">
            <span>Mahalle adıyla birlikte ilçe veya şehir yazabilirsin.</span>
            {QUICK_SUGGESTIONS.map((name) => (
              <button key={name} type="button" onClick={() => handleQuickSearch(name)}>
                {name} ↗
              </button>
            ))}
            {searchQuery && (
              <button type="button" onClick={handleResetFilters}>
                Aramayı temizle ↺
              </button>
            )}
          </div>
        </div>

        <div className="hero-bottom container">
          <span>EV ARAMADAN ÖNCE, MAHALLENİ BUL.</span>
          <a href="#mahalleler">
            Mahalleni ara <span aria-hidden="true">↓</span>
          </a>
          <span className="image-note">Muğla dokusundan esinlenen temsilî görsel.</span>
        </div>
      </header>

      <main>
        {/* SCOPE STRIP */}
        <div className="scope-strip">
          <div className="container scope-inner">
            <p>
              <span className="live-dot" /> Kaynaklı mahalle rehberi
            </p>
            <div>
              {searchQuery ? <><b>{neighborhoods.length}</b> arama sonucu</> : 'Mahalleni arayarak başla'}
            </div>
            <div>
              <b>5</b> değerlendirme boyutu
            </div>
            <span className="preview-tag">
              Mahalle bilgileri ve kaynakları
            </span>
          </div>
        </div>

        {/* 01 / MAHALLELERİ KEŞFET */}
        <section
          className="neighborhoods section container"
          id="mahalleler"
          hidden={!searchQuery && !loadingList && !listError}
          aria-labelledby="places-title"
        >
          <div className="section-top">
            <span className="eyebrow">01 / MAHALLELERİ KEŞFET</span>
            <span className="section-index">Sana ait bir yer var.</span>
          </div>

          <div className="section-heading">
            <h2 id="places-title">
                Mahallene
              <br />
              biraz daha yakından bak.
            </h2>
            <div className="heading-aside">
              <p>
                Her mahallenin ritmi başka.
                <br />
                Seninkini bulmak için keşfetmeye başla.
              </p>
              <a className="text-link" href="#mahalleler">
                Bir mahalle seçerek raporunu aç <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

          <div className="directory-toolbar">
            <div className="filter-group" role="group" aria-label="İlçeye göre filtrele">
              {[
                { key: 'all', label: 'Tüm mahalleler', count: neighborhoods.length },
                ...[...new Set(neighborhoods.map(n => n.district))].map(district => ({ key: district, label: district })),
              ].map((item) => {
                const isActive = districtFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={isActive ? 'active' : ''}
                    aria-pressed={isActive}
                    onClick={() => handleDistrictChange(item.key)}
                  >
                    {item.label}
                    {typeof item.count === 'number' && <span>{item.count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="directory-search-inline">
              <label className="sr-only" htmlFor="directory-search-input">
                Listede mahalle filtrele
              </label>
              <input
                id="directory-search-input"
                type="search"
                maxLength={100}
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  setSearchQuery(val.trim());
                }}
                placeholder="Mahalle veya ilçe filtrele…"
              />
              {(searchQuery || districtFilter !== 'all') && (
                <button
                  type="button"
                  className="inline-reset-btn"
                  onClick={handleResetFilters}
                >
                  Filtreyi temizle
                </button>
              )}
            </div>
          </div>

          {/* LOADING STATE FOR LIST */}
          {loadingList && (
            <div className="list-state-banner" role="status" aria-live="polite" data-testid="list-loading">
              <div className="loading-spinner" aria-hidden="true" />
              <div>
                <strong>Mahalle listesi yükleniyor…</strong>
                <p>Aramana uygun mahalleler getiriliyor.</p>
              </div>
            </div>
          )}

          {/* ERROR STATE FOR LIST */}
          {!loadingList && listError && (
            <div className="list-state-banner is-error" role="alert" data-testid="list-error">
              <div>
                <strong>Bağlantı hatası</strong>
                <p>{listError}</p>
              </div>
              <button
                type="button"
                className="button dark"
                onClick={() => setListRetryCount((c) => c + 1)}
              >
                Tekrar dene <span aria-hidden="true">↻</span>
              </button>
            </div>
          )}

          {/* EMPTY STATE FOR LIST */}
          {searchQuery && !loadingList && !listError && displayedNeighborhoods.length === 0 && (
            <div className="empty-results-card" role="status" aria-live="polite" data-testid="list-empty">
              <h3>Bu aramada mahalle bulunamadı.</h3>
              <p id="search-message" className="search-message">
                Mahalle adıyla birlikte ilçe veya şehir ekleyerek yeniden ara.
              </p>
              <button type="button" className="button dark" onClick={handleResetFilters}>
                Aramayı temizle <span aria-hidden="true">↺</span>
              </button>
            </div>
          )}

          {/* NEIGHBORHOOD CARDS GRID */}
          {!loadingList && !listError && displayedNeighborhoods.length > 0 && (
            <div className="places-grid" id="places-grid">
              {displayedNeighborhoods.map((place) => {
                const visual = NEIGHBORHOOD_VISUALS[place.slug] || {
                  image: '/assets/sokak.jpg',
                  tag: `${place.district} mahallesi`,
                  trDescription: place.tagline,
                };
                const isSelected = place.slug === selectedSlug;
                const overallVal = normalizeScoreValue(place.overall_score);
                const activeSuitability = normalizeScoreValue(place[activeProfile.scoreField]);

                return (
                  <article
                    key={place.slug}
                    className={`place-card ${isSelected ? 'is-selected' : ''}`}
                    data-testid={`place-card-${place.slug}`}
                  >
                    <button
                      type="button"
                      className="card-image-link"
                      onClick={() => handleSelectNeighborhood(place.slug)}
                      aria-label={`${place.name} raporunu incele`}
                    >
                      <div className="card-photo">
                        <img
                          src={visual.image}
                          alt={`${place.name} kartı için temsilî mahalle sahnesi`}
                          loading="lazy"
                        />
                        <span className="card-label">{visual.tag}</span>
                        {isSelected && <span className="card-active-pill">Seçili Rapor</span>}
                      </div>
                    </button>

                    <p className="card-location">
                      {(place.city || 'MUĞLA').toLocaleUpperCase('tr-TR')} / {place.district}
                    </p>

                    <div className="card-title">
                      <h3>{place.name.replace(/\s+Mahallesi$/i, '')}</h3>
                      <button
                        type="button"
                        onClick={() => handleSelectNeighborhood(place.slug)}
                        aria-label={`${place.name} raporunu aç`}
                      >
                        ↗
                      </button>
                    </div>

                    <p className="card-description">{visual.trDescription}</p>

                    <div className="card-metrics-strip">
                      <span>
                        Kira: <b>{place.avg_rent_tl == null ? 'Kaynakları incele' : `${Number(place.avg_rent_tl).toLocaleString('tr-TR')} TL`}</b>
                      </span>
                      {activeSuitability !== null && <span>
                        {activeProfile.buttonLabel}:{' '}
                        <b>{`${activeSuitability}/100`}</b>
                      </span>}
                    </div>

                    <div className="card-bottom">
                      <span>
                        {overallVal !== null ? (place.score_partial ? 'Genel ön puan' : 'Genel puan') : place.report_available ? 'Kaynaklı rapor hazır' : 'İlk keşfe hazır'}{' '}
                        {overallVal !== null && <strong>
                          {overallVal}
                          <small>/100</small>
                        </strong>}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectNeighborhood(place.slug)}
                      >
                        Raporu incele ↗
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="section-end">
            <span>Bir mahalle, tek bir sayıdan fazlasıdır.</span>
            <a href="#mahalleler">
              Bir mahalle seçerek detaylarını gör <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        {/* 02 / SENİN ÖNCELİKLERİN (PROFILE SELECTION & RANKING) */}
        <section className="personalize" id="sana-gore" aria-labelledby="profile-title" hidden={!searchQuery}>
          <div className="container personalize-grid">
            <div className="profile-copy">
              <span className="eyebrow light">02 / SENİN ÖNCELİKLERİN</span>
              <h2 id="profile-title">
                Aynı mahalle.
                <br />
                <em>Başka bir hayat.</em>
              </h2>
              <p>
                Öğrenci için sosyal yaşam ve kampüs erişimi, aile için günlük ihtiyaçlar ve sakinlik, çalışan için ulaşım… Önceliğini seç, mahallelere o gözle bak.
              </p>

              <div className="profile-tabs" role="group" aria-label="Yaşam profili seçimi">
                {Object.values(PROFILE_CONFIG).map((prof) => {
                  const isActive = profileFilter === prof.id;
                  return (
                    <button
                      key={prof.id || 'general'}
                      type="button"
                      className={isActive ? 'active' : ''}
                      aria-pressed={isActive}
                      onClick={() => setProfileFilter(prof.id)}
                    >
                      {prof.buttonLabel}
                    </button>
                  );
                })}
              </div>

              <div className="profile-description" id="profile-description" aria-live="polite">
                {activeProfile.description}
              </div>
            </div>

            <div className="ranking-panel">
              <div className="panel-top">
                <span>SANA GÖRE BİR BAKIŞ</span>
                <span aria-hidden="true">↗</span>
              </div>
              <h3 id="rank-title">{activeProfile.rankTitle}</h3>

              <div id="ranking" aria-live="polite">
                {rankedNeighborhoods.length > 0 ? (
                  rankedNeighborhoods.slice(0, 5).map((item, index) => {
                    const score = normalizeScoreValue(item[activeProfile.scoreField]);
                    const isSelected = item.slug === selectedSlug;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        className={`ranking-row ranking-row-button ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleSelectNeighborhood(item.slug)}
                      >
                        <span className="rank-num">0{index + 1}</span>
                        <div className="rank-place">
                          {item.name.replace(/\s+Mahallesi$/i, '')}
                          <small>
                            {item.district} / {item.city} · 1+1 örnek medyanı:{' '}
                            {item.avg_rent_tl == null ? 'Kira bilgisi raporda' : `${Number(item.avg_rent_tl).toLocaleString('tr-TR')} TL`}
                          </small>
                        </div>
                        <span className="rank-score">{score !== null ? score : '↗'}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="panel-empty">
                    Arama filtresine uygun mahalle bulunamadı.
                  </p>
                )}
              </div>

              <p className="panel-note">
                Sıralama mevcut backend uygunluk puanlarıyla güncellenir. Bir mahalleye tıklayarak raporunu ve puan grafiklerini açabilirsin.
              </p>
            </div>
          </div>
        </section>

        {/* 04 / NASIL ÇALIŞIR? */}
        <section className="how-section" id="nasil-calisir" aria-labelledby="how-title">
          <div className="container section">
            <div className="section-top">
              <span className="eyebrow">04 / NASIL ÇALIŞIR?</span>
            </div>
            <div className="section-heading">
              <h2 id="how-title">
                Daha az belirsizlik.
                <br />
                Daha bilinçli bir başlangıç.
              </h2>
              <p className="how-intro">
                Mahalleni araştırmak
                <br />
                karmaşık olmak zorunda değil.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-num">01</span>
                <h3>Mahalleni bul.</h3>
                <p>
                  Mahalle adını yaz, önerilerden ilçe ve şehriyle birlikte seç. Merak ettiğin yerden başla.
                </p>
              </article>
              <article>
                <span className="step-num">02</span>
                <h3>Yakından tanı.</h3>
                <p>
                  Maliyet, sosyal yaşam, güvenlik ve haberler, afet ve ulaşım başlıklarını yatay puan grafikleriyle birlikte incele.
                </p>
              </article>
              <article>
                <span className="step-num">03</span>
                <h3>Kendine göre değerlendir.</h3>
                <p>
                  Öğrenci, aile veya çalışan profilini seç; senin önceliklerine göre mahalle sıralamasını ve detaylı raporu gör.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 05 / SIK SORULAN SORULAR */}
        <section className="faq-section section container" id="sorular" aria-labelledby="faq-title">
          <div>
            <span className="eyebrow">05 / AKLINDA KALMASIN</span>
            <h2 id="faq-title">
              İyi bir karar,
              <br />
              iyi sorularla başlar.
            </h2>
          </div>
          <div className="faqs">
            <details>
              <summary>
                Puan grafikleri hangi verileri kullanıyor?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Şablondaki temsilî örnek sayılar yerine doğrudan mevcut backend API verileri kullanılır. Seçtiğin mahalleye göre genel puan ve kategori çubukları güncellenir.
              </p>
            </details>
            <details>
              <summary>
                Rapor hangi konuları kapsıyor ve eksik veri nasıl gösteriliyor?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Maliyet, sosyal yaşam, güvenlik ve haberler, afet bilgisi ve ulaşım olmak üzere beş başlık yer alır. Backend üzerinde henüz sayısal puanı bulunmayan bir kategori sıfır (0) puan gibi gösterilmez; açıkça &ldquo;Veri bekleniyor&rdquo; olarak işaretlenir.
              </p>
            </details>
            <details>
              <summary>
                Yaşam profili seçimi neyi değiştirir?
                <span aria-hidden="true">+</span>
              </summary>
              <p>
                Öğrenci, aile veya çalışan profilini seçtiğinde mahalle listesi ve sıralama paneli ilgili kullanıcı profilinin uygunluk puanına göre yeniden sıralanır.
              </p>
            </details>
          </div>
        </section>

        {/* CLOSING */}
        <section className="closing">
          <div className="container">
            <span className="eyebrow light">YENİ BİR BAŞLANGIÇ, İYİ BİR MAHALLEYLE.</span>
            <h2>
              Evden önce,
              <br />
              <em>mahallene karar ver.</em>
            </h2>
            <a className="button cream" href="#mahalleler">
              Mahalleleri keşfet <span aria-hidden="true">↗</span>
            </a>
          </div>
          <span className="closing-mark" aria-hidden="true">
            m.
          </span>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="container">
        <div className="footer-top">
          <a className="brand" href="#baslangic">
            Mahall<span>EN</span>
            <i />
          </a>
          <p>Yaşayacağın yeri önce tanı.</p>
          <a href="#baslangic">Başa dön ↑</a>
        </div>
        <div className="footer-bottom">
          <span>Mahalle bilgileri ve kaynakları</span>
          <span>Krem, koyu yeşil ve kiremit tasarım dili · Backend API bağlantılı</span>
          <span>Team Axiom / MahallEN</span>
        </div>
      </footer>


    </div>
  );
}
