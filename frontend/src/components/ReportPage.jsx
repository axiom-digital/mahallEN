import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AppShell from './AppShell';
import ReportDashboard from './ReportDashboard';
import { fetchNeighborhoodReport } from '../services/api';
import { getPlace } from '../services/places';
import { navigate } from '../navigation.mjs';

export default function ReportPage({ id }) {
  const [place, setPlace] = useState(window.history.state?.place || null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('checking');
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPhase('checking');

    getPlace(id, controller.signal)
      .then((metadata) => {
        if (controller.signal.aborted) return;
        setPlace(metadata);
        return fetchNeighborhoodReport(id, {
          signal: controller.signal,
          onProgress: (value) => {
            if (!controller.signal.aborted) setPhase(value);
          },
        });
      })
      .then((data) => {
        if (data && !controller.signal.aborted) setReport(data);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason.message || 'Rapor açılamadı.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, retry]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${place?.name || 'Mahalle'} raporu · MahallEN`;
    return () => {
      document.title = previous;
    };
  }, [place?.name]);

  const goHome = (event) => {
    event.preventDefault();
    if (window.history.state?.returnTo === '/') window.history.back();
    else navigate('/');
  };

  return (
    <AppShell activeRoute="home">
      <main
        className="station-workspace mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        aria-label="Mahalle raporu"
      >
        <div className="no-print mb-5">
          <a
            href="/"
            onClick={goHome}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-card transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Aramaya dön</span>
          </a>
        </div>

        <ReportDashboard
          report={report}
          selectedSlug={id}
          loading={loading}
          loadingPhase={phase}
          loadingPlace={place}
          error={error}
          onRetry={() => setRetry((value) => value + 1)}
          onReloadReport={() => setRetry((value) => value + 1)}
        />
      </main>
    </AppShell>
  );
}
