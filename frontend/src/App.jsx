import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchNeighborhoods,
  fetchNeighborhoodReport,
  fetchSystemHealth,
} from './services/api';
import ReportDashboard from './components/ReportDashboard';
import { ScoreBarChart, normalizeScoreValue } from './components/ScoreCard';

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
    rankTitle: 'Genel değerlendirmeyle Muğla',
    description:
      'Tüm değerlendirme boyutlarının dengeli birleşimi. Profil seçtiğinde sıralama önceliğine göre güncellenir.',
    scoreField: 'overall_score',
  },
  student: {
    id: 'student',
    buttonLabel: 'Öğrenciyim',
    rankTitle: 'Öğrenci gözüyle Muğla',
    description:
      'Önce kampüse ulaşım, günlük maliyet ve sosyal yaşam. Seçiminle birlikte mahalle sıralaması backend verisiyle değişir.',
    scoreField: 'suitability_student',
  },
  family: {
    id: 'family',
    buttonLabel: 'Ailemle yaşıyorum',
    rankTitle: 'Aile gözüyle Muğla',
    description:
      'Günlük ihtiyaçlar, sakin mahalle yaşamı, afet ve güvenlik bilgisi. Seçiminle birlikte sıralama güncellenir.',
    scoreField: 'suitability_family',
  },
  professional: {
    id: 'professional',
    buttonLabel: 'Çalışıyorum',
    rankTitle: 'Çalışan gözüyle Muğla',
    description:
      'Ulaşım, günlük yaşamın akışı ve şehir merkezine erişim. Seçiminle birlikte sıralama güncellenir.',
    scoreField: 'suitability_professional',
  },
};

const QUICK_SUGGESTIONS = ['Kötekli', 'Akyaka', 'Emirbeyazıt', 'Muslihittin', 'Orhaniye'];

export default function App() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('kotekli');
  const [report, setReport] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('student');

  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [listRetryCount, setListRetryCount] = useState(0);

  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [reportRetryCount, setReportRetryCount] = useState(0);
  const [refreshingAi, setRefreshingAi] = useState(false);

  const [health, setHealth] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const reportDialogRef = useRef(null);

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
    const controller = new AbortController();
    setLoadingList(true);
    setListError(null);

    fetchNeighborhoods(searchQuery, profileFilter, { signal: controller.signal })
      .then((data) => {
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
      setReport(null);
      return;
    }
    if (!selectedSlug || !displayedNeighborhoods.some((n) => n.slug === selectedSlug)) {
      setSelectedSlug(displayedNeighborhoods[0].slug);
    }
  }, [displayedNeighborhoods, loadingList, selectedSlug]);

  // Fetch full report whenever selectedSlug changes
  useEffect(() => {
    if (!selectedSlug) {
      setReport(null);
      setReportError(null);
      setLoadingReport(false);
      return;
    }

    const controller = new AbortController();
    setLoadingReport(true);
    setReportError(null);

    fetchNeighborhoodReport(selectedSlug, { signal: controller.signal })
      .then((data) => {
        setReport(data);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setReportError(`"${selectedSlug}" mahalle raporu yüklenirken bir sorun oluştu.`);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingReport(false);
        }
      });

    return () => controller.abort();
  }, [selectedSlug, reportRetryCount]);

  // Sync modal <dialog> state
  useEffect(() => {
    const dialog = reportDialogRef.current;
    if (!dialog) return;
    if (dialogOpen && report) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [dialogOpen, report]);

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
    setSearchInput('');
    setSearchQuery('');
    setDistrictFilter('all');
  };

  const handleDistrictChange = (district) => {
    setDistrictFilter(district);
  };

  const handleSelectNeighborhood = (slug, { scrollToReport = false, openModal = false } = {}) => {
    setSelectedSlug(slug);
    setMobileMenuOpen(false);
    if (openModal) {
      setDialogOpen(true);
    } else if (scrollToReport) {
      scrollToSection('ornek-rapor');
    }
  };

  const handleRefreshAi = () => {
    if (!selectedSlug) return;
    setRefreshingAi(true);
    fetchNeighborhoodReport(selectedSlug)
      .then((data) => setReport(data))
      .catch((err) => setReportError(err.message || 'Rapor yenilenemedi.'))
      .finally(() => setRefreshingAi(false));
  };

  const activeProfile = PROFILE_CONFIG[profileFilter] || PROFILE_CONFIG[''];

  const rankedNeighborhoods = useMemo(() => {
    const field = activeProfile.scoreField;
    return [...neighborhoods].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
  }, [neighborhoods, activeProfile]);

  const dialogOverallScore = normalizeScoreValue(report?.scores?.overall_livability);

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
            <a href="#ornek-rapor" onClick={() => setMobileMenuOpen(false)}>
              Rapor &amp; Grafikler
            </a>
            <a href="#nasil-calisir" onClick={() => setMobileMenuOpen(false)}>
              Nasıl çalışır?
            </a>
            <button
              type="button"
              className="nav-report"
              onClick={() =>
                handleSelectNeighborhood(selectedSlug || 'kotekli', { scrollToReport: true })
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
            <span className="live-dot" /> MUĞLA&apos;DAN BAŞLAYAN MAHALLE REHBERİ
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

          <form className="search" id="hero-search" role="search" onSubmit={handleSearchSubmit}>
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
                if (val === '') {
                  setSearchQuery('');
                }
              }}
              placeholder="Hangi mahalleyi merak ediyorsun?"
              autoComplete="off"
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
          </form>

          <div className="hero-suggestions">
            <span>Bir yerden başla:</span>
            {QUICK_SUGGESTIONS.map((name) => (
              <button key={name} type="button" onClick={() => handleQuickSearch(name)}>
                {name} ↗
              </button>
            ))}
            {searchQuery && (
              <button type="button" onClick={handleResetFilters}>
                Tümünü göster ↺
              </button>
            )}
          </div>
        </div>

        <div className="hero-bottom container">
          <span>EV ARAMADAN ÖNCE, MAHALLENİ BUL.</span>
          <a href="#mahalleler">
            Muğla&apos;yı keşfet <span aria-hidden="true">↓</span>
          </a>
          <span className="image-note">Muğla dokusundan esinlenen temsilî görsel.</span>
        </div>
      </header>

      <main>
        {/* SCOPE STRIP */}
        <div className="scope-strip">
          <div className="container scope-inner">
            <p>
              <span className="live-dot" /> Muğla pilotu{' '}
              <span className="scope-location">/ Menteşe &amp; Ula</span>
            </p>
            <div>
              <b>{neighborhoods.length || 5}</b> mahalle
            </div>
            <div>
              <b>5</b> değerlendirme boyutu
            </div>
            <span className="preview-tag">
              {health ? `API Aktif · ${health.database_backend}` : 'Muğla Pilot MVP'}
            </span>
          </div>
        </div>

        {/* 01 / MAHALLELERİ KEŞFET */}
        <section
          className="neighborhoods section container"
          id="mahalleler"
          aria-labelledby="places-title"
        >
          <div className="section-top">
            <span className="eyebrow">01 / MAHALLELERİ KEŞFET</span>
            <span className="section-index">Sana ait bir yer var.</span>
          </div>

          <div className="section-heading">
            <h2 id="places-title">
              Muğla&apos;ya
              <br />
              biraz daha yakından bak.
            </h2>
            <div className="heading-aside">
              <p>
                Her mahallenin ritmi başka.
                <br />
                Seninkini bulmak için keşfetmeye başla.
              </p>
              <a className="text-link" href="#ornek-rapor">
                Seçili mahalle raporuna geç <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

          <div className="directory-toolbar">
            <div className="filter-group" role="group" aria-label="İlçeye göre filtrele">
              {[
                { key: 'all', label: 'Tüm mahalleler', count: neighborhoods.length },
                { key: 'Menteşe', label: 'Menteşe' },
                { key: 'Ula', label: 'Ula' },
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
                <p>Muğla pilot bölgesindeki mahalle verileri getiriliyor.</p>
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
          {!loadingList && !listError && displayedNeighborhoods.length === 0 && (
            <div className="empty-results-card" role="status" aria-live="polite" data-testid="list-empty">
              <h3>Bu aramada mahalle bulunamadı.</h3>
              <p id="search-message" className="search-message">
                Kötekli, Akyaka, Emirbeyazıt, Muslihittin veya Orhaniye adlarından birini dene ya da arama filtresini temizle.
              </p>
              <button type="button" className="button dark" onClick={handleResetFilters}>
                Tüm mahalleleri listele <span aria-hidden="true">↺</span>
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
                      onClick={() => handleSelectNeighborhood(place.slug, { scrollToReport: true })}
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
                        onClick={() => handleSelectNeighborhood(place.slug, { scrollToReport: true })}
                        aria-label={`${place.name} raporunu aç`}
                      >
                        ↗
                      </button>
                    </div>

                    <p className="card-description">{visual.trDescription}</p>

                    <div className="card-metrics-strip">
                      <span>
                        Ort. Kira: <b>{Number(place.avg_rent_tl).toLocaleString('tr-TR')} TL</b>
                      </span>
                      <span>
                        {activeProfile.buttonLabel}:{' '}
                        <b>{activeSuitability !== null ? `${activeSuitability}/100` : '—'}</b>
                      </span>
                    </div>

                    <div className="card-bottom">
                      <span>
                        Genel puan{' '}
                        <strong>
                          {overallVal !== null ? overallVal : '—'}
                          <small>/100</small>
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectNeighborhood(place.slug, { scrollToReport: true })}
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
            <a href="#ornek-rapor">
              Seçili mahalle raporunda detayları gör <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        {/* 02 / SENİN ÖNCELİKLERİN (PROFILE SELECTION & RANKING) */}
        <section className="personalize" id="sana-gore" aria-labelledby="profile-title">
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
                        onClick={() => handleSelectNeighborhood(item.slug, { scrollToReport: true })}
                      >
                        <span className="rank-num">0{index + 1}</span>
                        <div className="rank-place">
                          {item.name.replace(/\s+Mahallesi$/i, '')}
                          <small>
                            {item.district} / {item.city} · Ort.{' '}
                            {Number(item.avg_rent_tl).toLocaleString('tr-TR')} TL
                          </small>
                        </div>
                        <span className="rank-score">{score !== null ? score : '—'}</span>
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

        {/* 03 / RAPOR VE PUAN GRAFİKLERİ */}
        <section
          className="report-section section container"
          id="ornek-rapor"
          aria-labelledby="report-title"
        >
          <div className="section-top">
            <span className="eyebrow">03 / RAKAMLARIN ARKASINDAKİ HAYAT</span>
            <span className="section-index">Açık, anlaşılır, gerekçeli.</span>
          </div>

          <ReportDashboard
            report={report}
            neighborhoods={displayedNeighborhoods}
            selectedSlug={selectedSlug}
            onSelectNeighborhood={(slug) => handleSelectNeighborhood(slug, { scrollToReport: false })}
            onOpenDialog={() => setDialogOpen(true)}
            onRefreshAi={handleRefreshAi}
            refreshing={refreshingAi}
            loading={loadingReport}
            error={reportError}
            onRetry={() => setReportRetryCount((c) => c + 1)}
            onResetSearch={handleResetFilters}
          />
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
                  Muğla&apos;daki pilot mahalleleri ara veya ilçeye göre filtrele. Merak ettiğin yerden başla.
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
          <span>Muğla pilotu · Menteşe &amp; Ula</span>
          <span>Krem, koyu yeşil ve kiremit tasarım dili · Backend API bağlantılı</span>
          <span>Team Axiom / MahallEN</span>
        </div>
      </footer>

      {/* REPORT SUMMARY DIALOG (Template Modal) */}
      <dialog
        ref={reportDialogRef}
        id="report-dialog"
        className="report-dialog"
        aria-labelledby="dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          setDialogOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialogOpen(false);
          }
        }}
      >
        {report && (
          <>
            <div className="dialog-top">
              <span className="eyebrow">MAHALLEN / MAHALLE RAPOR ÖZETİ</span>
              <button
                type="button"
                className="close"
                aria-label="Raporu kapat"
                onClick={() => setDialogOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="dialog-title-row">
              <div>
                <p className="dialog-location" id="dialog-location">
                  {report.city} / {report.district}
                </p>
                <h2 id="dialog-title">{report.name}</h2>
              </div>
              <div className="dialog-score" id="dialog-score">
                {dialogOverallScore !== null ? dialogOverallScore : '—'}
                <small> /100</small>
              </div>
            </div>

            <p className="demo-notice">
              Bu özet mevcut backend verilerini gösterir. Eksik kategori verisi sıfır (0) puan olarak değerlendirilmez.
            </p>

            <ScoreBarChart scores={report.scores} idPrefix="dialog" />

            <div className="dialog-story">
              <h3>Mahalleye dair genel değerlendirme</h3>
              <p id="dialog-description">
                {report.ai_report?.executive_summary || report.tagline}
              </p>
            </div>

            <details className="method-details">
              <summary>Puanlama yöntemi ve veri kapsamı</summary>
              <p>
                {report.scoring_methodology?.note ||
                  'Gösterilen değerler 0–100 ölçeğindeki backend kategori puanlarıdır.'}
              </p>
            </details>

            <button
              type="button"
              className="button dark dialog-compare"
              onClick={() => {
                setDialogOpen(false);
                scrollToSection('rapor-detay');
              }}
            >
              Tam rapor kırılımına git <span aria-hidden="true">↓</span>
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
