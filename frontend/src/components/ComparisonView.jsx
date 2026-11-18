import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, ArrowUpRight, Info, Sparkles } from 'lucide-react';
import { CATEGORY_DEFINITIONS, getScoreBadgeStyle, normalizeScoreValue } from './ScoreCard';
import { adaptPlaceReport } from '../services/placeAdapter.mjs';
import { suggestPlaces } from '../services/places';
import { navigate, reportPath } from '../navigation.mjs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const AVAILABLE_NEIGHBORHOODS = [
  { slug: 'kotekli', name: 'Kötekli', district: 'Menteşe', city: 'Muğla' },
  { slug: 'emirbeyazit', name: 'Emirbeyazıt', district: 'Menteşe', city: 'Muğla' },
  { slug: 'muslihittin', name: 'Muslihittin', district: 'Menteşe', city: 'Muğla' },
  { slug: 'orhaniye', name: 'Orhaniye', district: 'Menteşe', city: 'Muğla' },
  { slug: 'akyaka', name: 'Akyaka', district: 'Ula', city: 'Muğla' },
  { slug: 'caferaga', name: 'Caferağa', district: 'Kadıköy', city: 'İstanbul' },
  { slug: 'bahcelievler', name: 'Bahçelievler', district: 'Çankaya', city: 'Ankara' },
  { slug: 'kultur', name: 'Kültür', district: 'Konak', city: 'İzmir' },
  { slug: 'yenibaglar', name: 'Yenibağlar', district: 'Tepebaşı', city: 'Eskişehir' },
  { slug: 'gorukle', name: 'Görükle', district: 'Nilüfer', city: 'Bursa' },
];

async function fetchComparisonReport(slug, signal) {
  const target = AVAILABLE_NEIGHBORHOODS.find((n) => n.slug === slug);
  let placeId = null;

  if (target) {
    try {
      const suggestionRes = await suggestPlaces(
        `${target.name} ${target.district} ${target.city}`,
        signal
      );
      const matched = (suggestionRes?.results || []).find(
        (p) =>
          p.name.toLocaleLowerCase('tr-TR') === target.name.toLocaleLowerCase('tr-TR') &&
          p.district.toLocaleLowerCase('tr-TR') === target.district.toLocaleLowerCase('tr-TR')
      );
      if (matched?.id) {
        placeId = matched.id;
        const placeReportRes = await fetch(
          `${API_BASE}/places/${encodeURIComponent(placeId)}/report`,
          { signal }
        );
        if (placeReportRes.ok) {
          const rawPlaceReport = await placeReportRes.json();
          const adapted = adaptPlaceReport(rawPlaceReport);
          return { ...adapted, placeId };
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  const pilotRes = await fetch(
    `${API_BASE}/neighborhoods/${encodeURIComponent(slug)}/report`,
    { signal }
  );
  if (!pilotRes.ok) {
    throw new Error('Mahalle verisi alınamadı.');
  }
  const pilotJson = await pilotRes.json();
  return { ...pilotJson, placeId };
}

export default function ComparisonView({ initialSlug1 = 'kotekli', initialSlug2 = 'emirbeyazit' }) {
  const [slug1, setSlug1] = useState(initialSlug1);
  const [slug2, setSlug2] = useState(initialSlug2);

  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  useEffect(() => {
    if (!slug1) return;
    const controller = new AbortController();
    setLoading1(true);
    fetchComparisonReport(slug1, controller.signal)
      .then((json) => {
        if (!controller.signal.aborted) setData1(json);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setData1(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading1(false);
      });
    return () => controller.abort();
  }, [slug1]);

  useEffect(() => {
    if (!slug2) return;
    const controller = new AbortController();
    setLoading2(true);
    fetchComparisonReport(slug2, controller.signal)
      .then((json) => {
        if (!controller.signal.aborted) setData2(json);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setData2(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading2(false);
      });
    return () => controller.abort();
  }, [slug2]);

  const swapNeighborhoods = () => {
    const temp = slug1;
    setSlug1(slug2);
    setSlug2(temp);
  };

  const renderScoreValue = (val) => {
    const normalized = normalizeScoreValue(val);
    if (normalized === null) {
      return (
        <span className="comp-score-missing" title="Bu kategori için karşılaştırmalı sayısal puan üretilmedi (0 olarak sayılmaz).">
          Veri yetersiz
        </span>
      );
    }
    const badge = getScoreBadgeStyle(normalized);
    return (
      <div className="comp-score-badge">
        <span className="comp-score-num">{normalized}</span>
        <span className={`comp-score-tag ${badge.tone}`}>{badge.label}</span>
      </div>
    );
  };

  const renderPersonaScore = (suitability, key, label) => {
    const val = normalizeScoreValue(suitability?.[key]);
    if (val === null) {
      return (
        <div className="comp-persona-item">
          <span className="comp-persona-label">{label}</span>
          <span className="comp-persona-missing">Puan hesaplanmadı</span>
        </div>
      );
    }
    return (
      <div className="comp-persona-item">
        <span className="comp-persona-label">{label}</span>
        <span className="comp-persona-val">{val} / 100</span>
      </div>
    );
  };

  const getEvidenceCount = (data, categoryKey) => {
    const fromEvidenceReport = data?.evidence_report?.categories?.find((c) => c.id === categoryKey)?.items?.length;
    if (typeof fromEvidenceReport === 'number') {
      return fromEvidenceReport;
    }
    return data?.pilot_evidence?.categories?.[categoryKey]?.observations?.length || 0;
  };

  const renderColumn = (data, loading, testPrefix) => (
    <div className={`comp-card ${loading ? 'comp-loading' : ''}`} data-testid={`comp-card-${testPrefix}`}>
      {loading ? (
        <div className="comp-spinner-box" role="status">Yükleniyor...</div>
      ) : data ? (
        <div className="comp-card-inner">
          <div className="comp-card-head">
            <h3>{data.name}</h3>
            <span className="comp-location-badge">{data.district} / {data.city}</span>
            <p className="comp-tagline">{data.tagline}</p>
            {data.placeId && (
              <a
                href={reportPath(data.placeId)}
                className="text-link"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(reportPath(data.placeId), {
                    place: { id: data.placeId, name: data.name, district: data.district, city: data.city },
                    returnTo: '/karsilastir',
                  });
                }}
              >
                Tam raporu ve kaynakları aç <ArrowUpRight size={15} />
              </a>
            )}
          </div>

          {/* Overall Score */}
          <div className="comp-section">
            <h4>Genel Yaşanabilirlik Skoru</h4>
            {renderScoreValue(data.scores?.overall_livability)}
          </div>

          {/* Profiles */}
          <div className="comp-section">
            <h4>Profil Uygunlukları</h4>
            <div className="comp-personas-list">
              {renderPersonaScore(data.suitability, 'students', 'Öğrenci')}
              {renderPersonaScore(data.suitability, 'families', 'Aile')}
              {renderPersonaScore(data.suitability, 'professionals', 'Çalışan')}
            </div>
          </div>

          {/* Category Scores & Evidence */}
          <div className="comp-section">
            <h4>Kategori Boyutları (0-100)</h4>
            <div className="comp-categories-list">
              {CATEGORY_DEFINITIONS.map((cat) => (
                <div key={cat.key} className="comp-cat-row" data-testid={`comp-${testPrefix}-cat-${cat.key}`}>
                  <span className="comp-cat-name">{cat.label}</span>
                  <div className="comp-cat-val">
                    {renderScoreValue(data.scores?.[cat.key])}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hard Data Points */}
          <div className="comp-section">
            <h4>Somut Ölçüm ve Kayıtlar</h4>
            <div className="comp-datapoints">
              <div className="comp-dp-row">
                <span>Deprem Tehlikesi (PGA):</span>
                <strong>{data.disaster_risk?.pga_value_g != null ? `${data.disaster_risk.pga_value_g} g` : 'Ölçüm yok'}</strong>
              </div>
              <div className="comp-dp-row">
                <span>Kira İlan Örnekleri:</span>
                <strong>{getEvidenceCount(data, 'rent_cost')} doğrulanmış kayıt</strong>
              </div>
              <div className="comp-dp-row">
                <span>Ulaşım Kayıtları:</span>
                <strong>{getEvidenceCount(data, 'transportation')} hat / durak kaydı</strong>
              </div>
              <div className="comp-dp-row">
                <span>Sosyal Yaşam Kayıtları:</span>
                <strong>{getEvidenceCount(data, 'social_life')} mekan / alan</strong>
              </div>
            </div>
          </div>

          {/* Transport Highlights */}
          <div className="comp-section">
            <h4>Ulaşım Vurguları</h4>
            {data.transport_analysis?.highlights?.length > 0 ? (
              <ul className="comp-bullets">
                {data.transport_analysis.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="comp-empty-hint">Kayıtlı ulaşım hattı bulunamadı.</p>
            )}
          </div>

          {/* AI Sentez Notu */}
          <div className="comp-section comp-ai-note">
            <div className="comp-ai-note-head">
              <Sparkles size={16} /> <span>Sentez Özeti</span>
            </div>
            <p>{data.ai_report?.executive_summary || 'Özet bulunmuyor.'}</p>
            <div className="comp-disclaimer">
              <Info size={13} /> {data.ai_report?.disclaimer || data.scoring_methodology?.note}
            </div>
          </div>
        </div>
      ) : (
        <div className="comp-error-box" role="alert">Mahalle verisi alınamadı.</div>
      )}
    </div>
  );

  return (
    <div className="comparison-container">
      <header className="comp-header">
        <button className="comp-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Aramaya dön
        </button>
        <div className="comp-title-wrap">
          <h2>Mahalle Karşılaştırması</h2>
          <p>İki referans mahalleyi nesnel veriler, ulaşım olanakları ve risk göstergeleriyle yan yana inceleyin.</p>
        </div>
      </header>

      {/* Selectors Bar */}
      <div className="comp-selectors-bar">
        <div className="comp-select-col">
          <label htmlFor="select-m1">1. Mahalle</label>
          <select
            id="select-m1"
            value={slug1}
            onChange={(e) => setSlug1(e.target.value)}
            className="comp-select"
          >
            {AVAILABLE_NEIGHBORHOODS.map((n) => (
              <option key={n.slug} value={n.slug} disabled={n.slug === slug2}>
                {n.name} ({n.district} / {n.city})
              </option>
            ))}
          </select>
        </div>

        <button className="comp-swap-btn" onClick={swapNeighborhoods} title="Mahallelerin yerini değiştir">
          <ArrowRightLeft size={18} />
        </button>

        <div className="comp-select-col">
          <label htmlFor="select-m2">2. Mahalle</label>
          <select
            id="select-m2"
            value={slug2}
            onChange={(e) => setSlug2(e.target.value)}
            className="comp-select"
          >
            {AVAILABLE_NEIGHBORHOODS.map((n) => (
              <option key={n.slug} value={n.slug} disabled={n.slug === slug1}>
                {n.name} ({n.district} / {n.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="comp-grid">
        {renderColumn(data1, loading1, 'left')}
        {renderColumn(data2, loading2, 'right')}
      </div>
    </div>
  );
}
