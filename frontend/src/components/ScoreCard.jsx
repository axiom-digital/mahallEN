import React from 'react';
import {
  CATEGORY_DEFINITIONS,
  extractCategoryScores,
  normalizeScoreValue,
} from '../scoring.mjs';

export { CATEGORY_DEFINITIONS, extractCategoryScores, normalizeScoreValue };

export function getScoreBadgeStyle(score) {
  const validScore = normalizeScoreValue(score);
  if (validScore === null) {
    return {
      tone: 'missing',
      label: 'Veri bekleniyor',
    };
  }
  if (validScore >= 80) {
    return {
      tone: 'strong',
      label: 'Güçlü / Olumlu',
    };
  }
  if (validScore >= 65) {
    return {
      tone: 'balanced',
      label: 'Dengeli / Orta',
    };
  }
  return {
    tone: 'watchout',
    label: 'Dikkat / Sınırlı',
  };
}

/**
 * Template horizontal bar chart for the 5 evaluation dimensions.
 * Missing scores are explicitly shown as unavailable rather than 0.
 */
export function ScoreBarChart({ scores, idPrefix = 'chart' }) {
  const items = extractCategoryScores(scores);

  return (
    <div className="report-bars" role="list" aria-label="Kategori puan grafikleri (0-100)">
      {items.map((item) => {
        const isAvailable = item.value !== null;
        return (
          <div
            key={item.key}
            className={`bar-row ${isAvailable ? '' : 'bar-row-missing'}`}
            role="listitem"
            data-testid={`${idPrefix}-row-${item.key}`}
          >
            <span className="bar-label">{item.label}</span>

            {isAvailable ? (
              <div
                className="bar-track"
                role="progressbar"
                aria-label={`${item.label} puanı`}
                aria-valuenow={item.value}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`bar-fill ${item.value >= 80 ? 'bar-fill-strong' : item.value < 60 ? 'bar-fill-rust' : ''}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            ) : (
              <div
                className="bar-track is-missing"
                aria-label={`${item.label}: sayısal puan verisi henüz mevcut değil`}
              >
                <span className="bar-missing-tag">Veri bekleniyor</span>
              </div>
            )}

            <span
              className={`bar-value ${isAvailable ? '' : 'bar-value-missing'}`}
              data-testid={`${idPrefix}-score-${item.key}`}
              title={
                isAvailable
                  ? `${item.label}: ${item.value} / 100`
                  : `${item.label}: Backend sayısal puanı henüz eklenmedi (0 puan olarak sayılmaz)`
              }
            >
              {isAvailable ? item.value : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreCard({ title, score, subtitle, icon: Icon, testId }) {
  const validScore = normalizeScoreValue(score);
  const style = getScoreBadgeStyle(validScore);

  return (
    <article className={`score-card-item tone-${style.tone}`} data-testid={testId}>
      <div className="score-card-head">
        <div className="score-card-title-wrap">
          {Icon && (
            <span className="score-card-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
          )}
          <h4 className="score-card-title">{title}</h4>
        </div>
        <span className={`score-card-badge tone-${style.tone}`}>
          {validScore !== null ? `${validScore}/100` : 'Veri bekleniyor'}
        </span>
      </div>

      {validScore !== null ? (
        <div
          className="score-card-track"
          role="progressbar"
          aria-label={`${title} puanı`}
          aria-valuenow={validScore}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="score-card-fill" style={{ width: `${validScore}%` }} />
        </div>
      ) : (
        <div className="score-card-track is-missing" aria-hidden="true">
          <span>Sayısal puan hesaplanmadı (0 olarak kabul edilmez)</span>
        </div>
      )}

      {subtitle && <p className="score-card-subtitle">{subtitle}</p>}
    </article>
  );
}
