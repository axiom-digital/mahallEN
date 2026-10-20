import React, { useEffect, useState } from 'react';
import { Search, MapPin, Sparkles, Compass, ShieldAlert } from 'lucide-react';
import {
  fetchNeighborhoods,
  fetchNeighborhoodReport,
  fetchSystemHealth,
} from './services/api';
import ReportDashboard from './components/ReportDashboard';

export default function App() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('kotekli');
  const [report, setReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSystemHealth().then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    fetchNeighborhoods(searchQuery, profileFilter)
      .then((data) => {
        setNeighborhoods(data);
        if (data.length > 0 && !data.some((n) => n.slug === selectedSlug)) {
          setSelectedSlug(data[0].slug);
        }
      })
      .catch((err) => setError(err.message));
  }, [searchQuery, profileFilter]);

  useEffect(() => {
    if (!selectedSlug) return;
    setLoadingReport(true);
    setError(null);
    fetchNeighborhoodReport(selectedSlug, false)
      .then((data) => setReport(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingReport(false));
  }, [selectedSlug]);

  const handleRefreshAi = () => {
    if (!selectedSlug) return;
    setRefreshingAi(true);
    fetchNeighborhoodReport(selectedSlug, true)
      .then((data) => setReport(data))
      .catch((err) => setError(err.message))
      .finally(() => setRefreshingAi(false));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-inner">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Mahall<span className="text-emerald-400">EN</span>
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                  Muğla Pilot MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI-Powered Neighborhood Livability Report • Team Axiom (SE3003)
              </p>
            </div>
          </div>

          {health && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>DB: {health.database_backend}</span>
              <span>•</span>
              <span className="truncate max-w-[220px]">{health.llm_provider}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Sidebar: Search, Profile Filter & Neighborhood Selector */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              Explore Muğla Pilot Area
            </label>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Kötekli, Akyaka..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-slate-400 block">Rank by Suitability For:</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[
                  { id: '', label: 'Overall Score' },
                  { id: 'student', label: 'Students' },
                  { id: 'family', label: 'Families' },
                  { id: 'professional', label: 'Professionals' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setProfileFilter(tab.id)}
                    className={`py-1.5 px-2.5 rounded-lg font-medium border text-left transition ${
                      profileFilter === tab.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Neighborhood List */}
          <div className="space-y-2.5">
            {neighborhoods.map((item) => {
              const isSelected = item.slug === selectedSlug;
              return (
                <button
                  key={item.slug}
                  onClick={() => setSelectedSlug(item.slug)}
                  className={`w-full text-left p-4 rounded-2xl border transition flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white">{item.name}</h3>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {item.district}, {item.city}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-400">
                        {item.overall_score}
                      </span>
                      <span className="text-[11px] text-slate-500 block">Score</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Avg: {item.avg_rent_tl.toLocaleString()} TL</span>
                    <span>Student: {item.suitability_student}/100</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Column: Full AI Neighborhood Report */}
        <section className="lg:col-span-8 xl:col-span-9">
          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-200 text-sm flex items-center gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loadingReport ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium">
                Generating neighborhood livability report...
              </p>
            </div>
          ) : (
            <ReportDashboard
              report={report}
              onRefreshAi={handleRefreshAi}
              refreshing={refreshingAi}
            />
          )}
        </section>
      </main>
    </div>
  );
}
