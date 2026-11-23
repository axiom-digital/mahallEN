import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { navigate, reportPath } from '../../navigation.mjs';
import { normalizeScoreValue } from '../../scoring.mjs';

export default function ScoreChannel({ report, side }) {
  const score = normalizeScoreValue(report.scores?.overall_livability);
  const place = { id: report.placeId, name: report.name, district: report.district, city: report.city };

  function openReport(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(reportPath(place.id), { place, returnTo: '/karsilastir' });
  }

  return (
    <article className="score-channel" data-side={side} data-testid={`comp-card-${side}`}>
      <div className="channel-location">
        <small>{place.city} / {place.district}</small>
        <h2>{place.name}</h2>
      </div>
      <div className="channel-reading">
        <div>
          <strong data-testid={`comp-${side}-overall`}>{score ?? '—'}</strong>
          <small>{score === null ? 'Veri yetersiz' : 'Genel puan / 100'}</small>
        </div>
        {score !== null && (
          <div className="channel-meter" aria-hidden="true">
            <span style={{ width: score + '%' }} />
          </div>
        )}
      </div>
      {place.id && <a href={reportPath(place.id)} onClick={openReport}>Kaynaklı raporu aç <ArrowUpRight size={14} /></a>}
    </article>
  );
}
