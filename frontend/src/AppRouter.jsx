import React, { useEffect, useState } from 'react';
import App from './App';
import AppShell from './components/AppShell';
import ReportPage from './components/ReportPage';
import ComparisonView from './components/ComparisonView';
import { NAVIGATION_EVENT, reportId, navigate } from './navigation.mjs';

export default function AppRouter() {
  const [location, setLocation] = useState({
    pathname: window.location.pathname,
    search: window.location.search,
  });

  useEffect(() => {
    const changed = () =>
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    window.addEventListener('popstate', changed);
    window.addEventListener(NAVIGATION_EVENT, changed);
    return () => {
      window.removeEventListener('popstate', changed);
      window.removeEventListener(NAVIGATION_EVENT, changed);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  const id = reportId(location.pathname);
  if (id) return <ReportPage key={id} id={id} />;
  if (location.pathname === '/karsilastir') {
    return <ComparisonView searchParams={location.search} />;
  }
  if (location.pathname === '/') return <App />;

  return (
    <AppShell activeRoute="none">
      <main className="station-workspace mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs font-medium text-slate-600">
          404 · SAYFA BULUNAMADI
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Aradığın sayfa burada değil.
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Bağlantı değişmiş veya eksik girilmiş olabilir. Mahalle aramaya dönebilirsin.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Mahalle aramaya dön
          </a>
        </div>
      </main>
    </AppShell>
  );
}
