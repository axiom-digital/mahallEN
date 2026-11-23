import React from 'react';
import { CATEGORY_DEFINITIONS, normalizeScoreValue } from '../../scoring.mjs';
import { ConfidencePill } from '../AnalyticsCharts';
import './categoryTable.css';

function ScoreCell({ report, category, side }) {
  const value = normalizeScoreValue(report?.scores?.[category.key]);
  return (
    <td data-testid={`comp-${side}-cat-${category.key}`}>
      <strong>{value ?? '—'}</strong>
      {value === null && <small>Veri yetersiz</small>}
      <ConfidencePill
        compact
        plain
        meta={report?.category_meta?.[category.key]}
        categoryKey={category.key}
        rentMode={report?.assessment?.calculation?.rent_mode}
      />
    </td>
  );
}

function ScoreScale({ left, right }) {
  return (
    <td className="scale-column" aria-hidden="true">
      <div className="score-ruler">
        {left !== null && right !== null && (
          <span className="score-distance" style={{ left: Math.min(left, right) + '%', width: Math.abs(left - right) + '%' }} />
        )}
        {left !== null && <i className="first-mark" style={{ left: left + '%' }} />}
        {right !== null && <i className="second-mark" style={{ left: right + '%' }} />}
      </div>
    </td>
  );
}

export default function CategoryComparison({ data1, data2 }) {
  return (
    <section className="category-ledger" id="puanlar" aria-labelledby="category-title">
      <header><h2 id="category-title">Kategori puanları</h2><span>100 üzerinden</span></header>
      <table aria-labelledby="category-title">
        <thead>
          <tr>
            <th scope="col">Ölçüt</th>
            <th scope="col"><i className="first-mark" />{data1?.name || 'Birinci mahalle'}</th>
            <th scope="col"><i className="second-mark" />{data2?.name || 'İkinci mahalle'}</th>
            <th className="scale-column" scope="col"><span className="ruler-labels"><span>0</span><span>50</span><span>100</span></span></th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_DEFINITIONS.map((category) => (
            <tr key={category.key}>
              <th scope="row" title={category.shortNote}>{category.label}</th>
              <ScoreCell report={data1} category={category} side="left" />
              <ScoreCell report={data2} category={category} side="right" />
              <ScoreScale left={normalizeScoreValue(data1?.scores?.[category.key])} right={normalizeScoreValue(data2?.scores?.[category.key])} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
