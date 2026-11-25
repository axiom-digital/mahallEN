import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ConfidencePill, getScoreToneColors } from '../AnalyticsCharts';
import { normalizeScoreValue } from '../../scoring.mjs';
import { CATEGORIES } from './reportDetails';

export default function CategoryCards({
  categoryItems,
  report,
  roomGroup,
  briefing,
  weekdayService,
  openCategory,
  assessment,
}) {
  return (
    <section className="space-y-3" aria-label="Mahalle kategori kartları">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            BEŞ SORUDA MAHALLE
          </span>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
            Günlük hayatın nasıl olur?
          </h2>
        </div>
        <span className="no-print text-xs text-slate-500">
          İlanları, haritayı ve kaynakları açmak için bir kart seç.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map(({ key, score, title, Icon }) => {
          const items = categoryItems(key);
          const value = normalizeScoreValue(report.scores[score]);
          const catMeta = report.category_meta?.[score];
          const tones = getScoreToneColors(value);

          const heading =
            key === 'rent_cost'
              ? roomGroup?.listings?.length
                ? `${roomGroup.rooms} konut örnekleri`
                : briefing.rent_benchmarks?.length
                  ? 'Piyasa kira endeksi'
                  : 'Konut seçenekleri'
              : key === 'social_life'
                ? briefing.venues?.slice(0, 2).map((v) => v.name).join(' · ') ||
                  'Günlük ihtiyaçlar ve mekânlar'
                : key === 'transportation'
                  ? briefing.routes?.map((r) => r.code).filter(Boolean).slice(0, 4).join(' · ') ||
                    'Hatlar ve duraklar'
                  : key === 'earthquake_hazard'
                    ? briefing.hazard?.value != null
                      ? `${briefing.hazard.value} g · PGA`
                      : 'Zemin ve deprem kaynakları'
                    : 'Tarihli yerel gelişmeler';

          const text =
            key === 'transportation' && weekdayService
              ? `${weekdayService.code} · ${weekdayService.direction}: hafta içi ${weekdayService.days.weekday.first}–${weekdayService.days.weekday.last}. Uç duraktan hareket saatleri.`
              : key === 'social_life'
                ? briefing.social_diversity?.note ||
                  `${briefing.venues?.length || 0} örnek kaydı kaynaklarıyla incele. Bu liste mahalledeki bütün mekânların sayısı değildir.`
                : key === 'rent_cost'
                  ? roomGroup?.listings?.length
                    ? `${roomGroup.listings.length} ilanı oda tipi, tarih ve istenen bedeliyle karşılaştır.`
                    : briefing.rent_benchmarks?.length
                      ? `${briefing.rent_benchmarks.length} piyasa endeksi kaydıyla kira seviyesini incele.`
                      : items[0]?.text
                  : key === 'earthquake_hazard' && briefing.hazard?.value != null
                    ? 'Akademik gridin temsil noktasındaki sarsıntı tehlikesi; binanın dayanıklılığı değildir.'
                    : key === 'safety_news'
                      ? items.length
                        ? `${items.length} tarihli yerel kayıt. Haberler mahalle güvenliği veya suç oranı ölçümü değildir.`
                        : 'Güncel tarihli kayıt bulunamadı. Eski kayıtlar arşivde; güvenlik ölçümü olarak kullanılmaz.'
                      : items[0]?.text ||
                        'Bu başlık için mahalleye ait yeterli kaynak henüz bulunamadı.';

          const ctaLabel =
            key === 'rent_cost'
              ? 'İlanları gör'
              : key === 'social_life'
                ? 'Mekânları keşfet'
                : key === 'transportation'
                  ? 'Hatları incele'
                  : 'Kaynakları incele';

          return (
            <button
              key={key}
              type="button"
              onClick={() => openCategory(key)}
              data-testid={`card-${score}`}
              aria-haspopup="dialog"
              className="print-card group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-card-hover"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Icon size={15} className="text-slate-500 group-hover:text-blue-600" aria-hidden="true" />
                    <span>{title}</span>
                  </span>
                  <span
                    data-testid={`score-${score}`}
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      value != null ? tones.text : 'text-slate-500'
                    }`}
                  >
                    {value != null ? (
                      <>
                        {value}
                        <span className="text-[11px] font-normal text-slate-400">/100</span>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium">Veri bekleniyor</span>
                    )}
                  </span>
                </div>

                <ConfidencePill
                  meta={catMeta}
                  categoryKey={key}
                  rentMode={assessment?.calculation?.rent_mode}
                  testId={`confidence-${score}`}
                />

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{heading}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {briefing.daily_life?.[key] || text}
                  </p>
                </div>
              </div>

              <span className="no-print mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                <span>{ctaLabel}</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
