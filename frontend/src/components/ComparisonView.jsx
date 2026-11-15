import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, Building2, ShieldAlert, Bus, Home, Info, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { CATEGORY_DEFINITIONS, getScoreBadgeStyle } from './ScoreCard';
import { navigate } from '../navigation.mjs';

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

export default function ComparisonView({ initialSlug1 = 'kotekli', initialSlug2 = 'emirbeyazit' }) {
  const [slug1, setSlug1] = useState(initialSlug1);
  const [slug2, setSlug2] = useState(initialSlug2);

  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  useEffect(() => {
    let active = true;
    if (!slug1) return;
    setLoading1(true);
    fetch(`/api/v1/neighborhoods/${slug1}/report`)
      .then(res => res.json())
      .then(json => { if (active) setData1(json); })
      .catch(() => { if (active) setData1(null); })
      .finally(() => { if (active) setLoading1(false); });
    return () => { active = false; };
  }, [slug1]);

  useEffect(() => {
    let active = true;
    if (!slug2) return;
    setLoading2(true);
    fetch(`/api/v1/neighborhoods/${slug2}/report`)
      .then(res => res.json())
      .then(json => { if (active) setData2(json); })
      .catch(() => { if (active) setData2(null); })
      .finally(() => { if (active) setLoading2(false); });
    return () => { active = false; };
  }, [slug2]);

  const swapNeighborhoods = () => {
    const temp = slug1;
    setSlug1(slug2);
    setSlug2(temp);
  };

  const renderScoreValue = (val) => {
    if (val === null || val === undefined) {
      return (
        <span className="comp-score-missing" title="Bu kategori için karşılaştırmalı sayısal puan üretilmedi.">
          Veri yetersiz
        </span>
      );
    }
    const badge = getScoreBadgeStyle(val);
    return (
      <div className="comp-score-badge">
        <span className="comp-score-num">{val}</span>
        <span className={`comp-score-tag ${badge.tone}`}>{badge.label}</span>
      </div>
    );
  };

  const renderPersonaScore = (suitability, key, label) => {
    const val = suitability?.[key];
    if (val === null || val === undefined) {
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
    return data?.pilot_evidence?.categories?.[categoryKey]?.observations?.length || 0;
  };

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
            {AVAILABLE_NEIGHBORHOODS.map(n => (
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
            {AVAILABLE_NEIGHBORHOODS.map(n => (
              <option key={n.slug} value={n.slug} disabled={n.slug === slug1}>
                {n.name} ({n.district} / {n.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="comp-grid">
        {/* Left Column */}
        <div className={`comp-card ${loading1 ? 'comp-loading' : ''}`}>
          {loading1 ? (
            <div className="comp-spinner-box">Yükleniyor...</div>
          ) : data1 ? (
            <div className="comp-card-inner">
              <div className="comp-card-head">
                <h3>{data1.name}</h3>
                <span className="comp-location-badge">{data1.district} / {data1.city}</span>
                <p className="comp-tagline">{data1.tagline}</p>
              </div>

              {/* Overall Score */}
              <div className="comp-section">
                <h4>Genel Yaşanabilirlik Skoru</h4>
                {renderScoreValue(data1.scores?.overall_livability)}
              </div>

              {/* Profiles */}
              <div className="comp-section">
                <h4>Profil Uygunlukları</h4>
                <div className="comp-personas-list">
                  {renderPersonaScore(data1.suitability, 'students', 'Öğrenci')}
                  {renderPersonaScore(data1.suitability, 'families', 'Aile')}
                  {renderPersonaScore(data1.suitability, 'professionals', 'Çalışan')}
                </div>
              </div>

              {/* Category Scores & Evidence */}
              <div className="comp-section">
                <h4>Kategori Boyutları (0-100)</h4>
                <div className="comp-categories-list">
                  {CATEGORY_DEFINITIONS.map(cat => (
                    <div key={cat.key} className="comp-cat-row">
                      <span className="comp-cat-name">{cat.label}</span>
                      <div className="comp-cat-val">
                        {renderScoreValue(data1.scores?.[cat.scoreKey])}
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
                    <strong>{data1.disaster_risk?.pga_value_g ? `${data1.disaster_risk.pga_value_g} g` : 'Ölçüm yok'}</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Kira İlan Örnekleri:</span>
                    <strong>{getEvidenceCount(data1, 'rent_cost')} doğrulanmış kayıt</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Ulaşım Kayıtları:</span>
                    <strong>{getEvidenceCount(data1, 'transportation')} hat / durak kaydı</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Sosyal Yaşam Kayıtları:</span>
                    <strong>{getEvidenceCount(data1, 'social_life')} mekan / alan</strong>
                  </div>
                </div>
              </div>

              {/* Transport Highlights */}
              <div className="comp-section">
                <h4>Ulaşım Vurguları</h4>
                {data1.transport_analysis?.highlights?.length > 0 ? (
                  <ul className="comp-bullets">
                    {data1.transport_analysis.highlights.map((h, i) => (
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
                <p>{data1.ai_report?.executive_summary || 'Özet bulunmuyor.'}</p>
                <div className="comp-disclaimer">
                  <Info size={13} /> {data1.ai_report?.disclaimer || data1.scoring_methodology?.note}
                </div>
              </div>
            </div>
          ) : (
            <div className="comp-error-box">Mahalle verisi alınamadı.</div>
          )}
        </div>

        {/* Right Column */}
        <div className={`comp-card ${loading2 ? 'comp-loading' : ''}`}>
          {loading2 ? (
            <div className="comp-spinner-box">Yükleniyor...</div>
          ) : data2 ? (
            <div className="comp-card-inner">
              <div className="comp-card-head">
                <h3>{data2.name}</h3>
                <span className="comp-location-badge">{data2.district} / {data2.city}</span>
                <p className="comp-tagline">{data2.tagline}</p>
              </div>

              {/* Overall Score */}
              <div className="comp-section">
                <h4>Genel Yaşanabilirlik Skoru</h4>
                {renderScoreValue(data2.scores?.overall_livability)}
              </div>

              {/* Profiles */}
              <div className="comp-section">
                <h4>Profil Uygunlukları</h4>
                <div className="comp-personas-list">
                  {renderPersonaScore(data2.suitability, 'students', 'Öğrenci')}
                  {renderPersonaScore(data2.suitability, 'families', 'Aile')}
                  {renderPersonaScore(data2.suitability, 'professionals', 'Çalışan')}
                </div>
              </div>

              {/* Category Scores & Evidence */}
              <div className="comp-section">
                <h4>Kategori Boyutları (0-100)</h4>
                <div className="comp-categories-list">
                  {CATEGORY_DEFINITIONS.map(cat => (
                    <div key={cat.key} className="comp-cat-row">
                      <span className="comp-cat-name">{cat.label}</span>
                      <div className="comp-cat-val">
                        {renderScoreValue(data2.scores?.[cat.scoreKey])}
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
                    <strong>{data2.disaster_risk?.pga_value_g ? `${data2.disaster_risk.pga_value_g} g` : 'Ölçüm yok'}</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Kira İlan Örnekleri:</span>
                    <strong>{getEvidenceCount(data2, 'rent_cost')} doğrulanmış kayıt</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Ulaşım Kayıtları:</span>
                    <strong>{getEvidenceCount(data2, 'transportation')} hat / durak kaydı</strong>
                  </div>
                  <div className="comp-dp-row">
                    <span>Sosyal Yaşam Kayıtları:</span>
                    <strong>{getEvidenceCount(data2, 'social_life')} mekan / alan</strong>
                  </div>
                </div>
              </div>

              {/* Transport Highlights */}
              <div className="comp-section">
                <h4>Ulaşım Vurguları</h4>
                {data2.transport_analysis?.highlights?.length > 0 ? (
                  <ul className="comp-bullets">
                    {data2.transport_analysis.highlights.map((h, i) => (
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
                <p>{data2.ai_report?.executive_summary || 'Özet bulunmuyor.'}</p>
                <div className="comp-disclaimer">
                  <Info size={13} /> {data2.ai_report?.disclaimer || data2.scoring_methodology?.note}
                </div>
              </div>
            </div>
          ) : (
            <div className="comp-error-box">Mahalle verisi alınamadı.</div>
          )}
        </div>
      </div>
    </div>
  );
}

