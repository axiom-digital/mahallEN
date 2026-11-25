import React from 'react';
import { safetyStories } from '../reportReading.mjs';
import { PgaHazardGauge } from '../../AnalyticsCharts';
import { Sources } from '../reportDetails';

export default function GeneralEvidence({
  activeCategory,
  briefing,
  findings,
  showAllFindings,
  setShowAllFindings,
}) {
  const stories = activeCategory === 'safety_news' ? safetyStories(findings) : [];
  const ordered = [...stories, ...findings.filter(item => !stories.includes(item))];
  return (
    <>
      {activeCategory === 'earthquake_hazard' && (
        <section className="guide-explainer">
          <h4>🏘️ Bu bilgi ev seçerken ne işe yarar?</h4>
          <p>{briefing.hazard?.value != null
            ? 'Haritada bu bölgenin kuvvetli bir depremde ne kadar sarsılabileceği tahmin edilmiş. Puan düştükçe modelde beklenen sarsıntı artar. Puan bir deprem olasılığı yüzdesi değildir.'
            : 'Bu konum için karşılaştırılabilir bir sarsıntı tahmini bulunamadı.'} Bir binanın nasıl dayanacağını öğrenmek için o binanın mühendislik incelemesine bak.</p>
          {briefing.hazard?.value != null && <details className="mt-3"><summary>📐 Teknik ölçümü göster</summary><PgaHazardGauge pgaValue={briefing.hazard.value} /></details>}
        </section>
      )}
      {activeCategory === 'safety_news' && (
        <section className="guide-explainer"><h4>🛡️ Güvenlik konusunda ne biliyoruz?</h4>
          <p>{stories.length ? 'Önce güvenlikle ilgili olayları, ardından diğer yerel gelişmeleri görebilirsin.' : 'Bu raporda tarihli haberlerden güvenlikle doğrudan ilişkili bir olay ayırt edilemedi.'} Bu kaynaklar mahallede bildirilen olayları anlatır. Sokak bazında suç oranı için yeterli bilgi sağlamaz.</p>
        </section>
      )}
      <div className="space-y-2.5">
        {findings.length ? (
          (showAllFindings ? ordered : ordered.slice(0, 4)).map((item, index) => (
            <article
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
            >
              {activeCategory === 'safety_news' && <strong className="text-xs">{stories.includes(item) ? '🛡️ Güvenlikle ilgili haber' : '📰 Diğer yerel gelişme'}</strong>}
              {item.date && (
                <time
                  dateTime={item.date}
                  className="mb-1 block font-mono text-[11px] text-slate-500"
                >
                  {item.date}
                </time>
              )}
              <p className="text-xs leading-relaxed text-slate-800">{item.text}</p>
              <Sources item={item} />
              {item.note && (
                <details className="mt-2.5 text-[11px] text-slate-500">
                  <summary className="cursor-pointer font-medium hover:text-slate-700">
                    Bu kaydın kapsamı
                  </summary>
                  <p className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600">
                    {item.note}
                  </p>
                </details>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            Bu başlık için yeterli kaynaklı bilgi bulunmuyor.
          </p>
        )}
      </div>

      {findings.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAllFindings(!showAllFindings)}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showAllFindings
            ? 'Daha az göster'
            : `${findings.length} bulgunun tamamını göster`}
        </button>
      )}
    </>
  );
}
