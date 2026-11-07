import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
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
    setLoading(true); setError(null); setPhase('checking');
    getPlace(id, controller.signal).then(metadata => {
      if (controller.signal.aborted) return;
      setPlace(metadata);
      return fetchNeighborhoodReport(id, { signal: controller.signal,
        onProgress: value => { if (!controller.signal.aborted) setPhase(value); } });
    }).then(data => { if (data && !controller.signal.aborted) setReport(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Rapor açılamadı.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${place?.name || 'Mahalle'} raporu · MahallEN`;
    return () => { document.title = previous; };
  }, [place?.name]);
  const goHome = event => {
    event.preventDefault();
    if (window.history.state?.returnTo === '/') window.history.back();
    else navigate('/');
  };
  return <div className="report-page-shell">
    <header className="report-page-header"><nav className="container" aria-label="Rapor sayfası">
      <a className="brand" href="/" onClick={goHome} aria-label="MahallEN ana sayfa">Mahall<span>EN</span><i /></a>
      <a className="report-back-link" href="/" onClick={goHome}><ArrowLeft size={16} /> Aramaya dön</a>
      <a className="report-new-search" href="/" onClick={goHome} aria-label="Başka mahalle ara"><Search size={16} /><span>Başka mahalle ara</span></a>
    </nav></header>
    <main className="container report-page" aria-label="Mahalle raporu">
      <ReportDashboard report={report} selectedSlug={id} loading={loading} loadingPhase={phase} loadingPlace={place}
        error={error} onRetry={() => setRetry(value => value + 1)} onRefreshAi={() => setRetry(value => value + 1)} />
    </main>
    <footer className="container report-page-footer">MahallEN · Mahalleni tanı, kararını kendin ver.</footer>
  </div>;
}
