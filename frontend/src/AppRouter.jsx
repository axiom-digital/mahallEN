import React, { useEffect, useState } from 'react';
import App from './App';
import ReportPage from './components/ReportPage';
import { NAVIGATION_EVENT, reportId, navigate } from './navigation.mjs';

export default function AppRouter() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const changed = () => setPath(window.location.pathname);
    window.addEventListener('popstate', changed);
    window.addEventListener(NAVIGATION_EVENT, changed);
    return () => {
      window.removeEventListener('popstate', changed);
      window.removeEventListener(NAVIGATION_EVENT, changed);
    };
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [path]);
  const id = reportId(path);
  if (id) return <ReportPage key={id} id={id} />;
  if (path === '/') return <App />;
  return <main className="container report-page"><h1>Sayfa bulunamadı</h1><a href="/" onClick={event => { event.preventDefault(); navigate('/'); }}>Mahalle aramaya dön</a></main>;
}
