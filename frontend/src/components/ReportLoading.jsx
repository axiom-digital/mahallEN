import React, { useEffect, useState } from 'react';
import { Check, FileText, MapPin, Radar, Search, Sparkles } from 'lucide-react';

const stages = [
  {
    id: 'checking',
    title: 'Rapor kontrol ediliyor',
    text: 'Önce hazırlanmış kayıtlı rapor kontrol ediliyor.',
    Icon: MapPin,
  },
  {
    id: 'research',
    title: 'Mahallenin izi sürülüyor',
    text: 'Konut, ulaşım, yerel gündem ve sosyal yaşam kaynakları taranıyor.',
    Icon: Search,
  },
  {
    id: 'extraction',
    title: 'Bulgular ayrıştırılıyor',
    text: 'Kaynaklardaki ilanlar, hatlar, mekânlar ve tarihler doğrulanıyor.',
    Icon: Radar,
  },
  {
    id: 'writing',
    title: 'Mahalle raporu hazırlanıyor',
    text: 'Kaynaklı bulgular okunabilir bir değerlendirme raporuna dönüştürülüyor.',
    Icon: FileText,
  },
];

function formatElapsed(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function ReportLoading({ place, phase = 'checking' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const index = phase === 'ready' ? 3 : Math.max(0, stages.findIndex((stage) => stage.id === phase));
  const current = stages[index];

  return (
    <section
      className="mx-auto max-w-4xl py-6"
      data-testid="report-loading"
      aria-busy="true"
      aria-label="Mahalle raporu hazırlanıyor"
    >
      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-12">
        {/* Left geospatial radar visual */}
        <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden border-b border-slate-200 bg-slate-900 p-6 text-white md:col-span-5 md:border-b-0 md:border-r">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative z-10 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300">
              <Sparkles size={12} />
              CANLI ARAŞTIRMA
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-300">
              {formatElapsed(elapsed)}
            </span>
          </div>

          <div className="relative z-10 my-8 flex items-center justify-center">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/40">
              <div className="absolute inset-4 rounded-full border border-dashed border-slate-600/80" />
              <div className="animate-radar-sweep absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/20 via-transparent to-transparent" />
              <span className="animate-pulse-ring absolute h-10 w-10 rounded-full bg-emerald-400/35" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/60 bg-slate-900 text-emerald-400 shadow-lg">
                <MapPin size={20} />
              </span>
            </div>
          </div>

          <div className="relative z-10 space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              {[place?.district, place?.city].filter(Boolean).join(' / ') || 'Mahalle araştırması'}
            </p>
            <p className="text-lg font-semibold tracking-tight text-white">
              {place?.name || 'Mahalle'} inceleniyor
            </p>
          </div>
        </div>

        {/* Right live 4-stage stepper */}
        <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-7">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-blue-600">
              ADIM {index + 1} / {stages.length}
            </span>
            <h2 id="report-title" className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
              {place?.name || 'Mahalle'} raporu hazırlanıyor
            </h2>

            <div
              className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="text-sm font-semibold text-slate-900">{current.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{current.text}</p>
            </div>

            <ol className="mt-6 space-y-3" aria-label="Rapor hazırlama aşamaları">
              {stages.map(({ id, title, Icon }, i) => {
                const isDone = i < index;
                const isActive = i === index;
                return (
                  <li
                    key={id}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition ${
                      isDone
                        ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                        : isActive
                          ? 'border-blue-200 bg-white font-medium text-slate-900 shadow-sm'
                          : 'border-slate-100 bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200/80 text-slate-500'
                        }`}
                      >
                        {isDone ? <Check size={14} /> : <Icon size={14} />}
                      </span>
                      <span>{title}</span>
                    </div>

                    {isActive && (
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                        İşleniyor
                      </span>
                    )}
                    {isDone && (
                      <span className="font-mono text-[11px] text-emerald-700">Tamamlandı</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            {elapsed >= 45
              ? 'Kaynakların yanıt süresine bağlı olarak araştırma biraz daha devam edebilir.'
              : 'İlk keşif kaynakların taranması nedeniyle kısa bir süre alır. Hazırlandığında sonraki ziyaretinde önbellekten anında açılır.'}
          </p>
        </div>
      </div>
    </section>
  );
}
