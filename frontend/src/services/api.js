import { searchPlaces, openPlaceReport, suggestPlaces } from './places';
import { adaptPlaceReport } from './placeAdapter.mjs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const RESEARCH_MODE = import.meta.env.VITE_REPORT_DATA_SOURCE === 'research';

async function researchData(signal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const data = await import('./researchData');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return data;
}

export async function fetchNeighborhoods(query = '', profile = '', { signal } = {}) {
  if (RESEARCH_MODE) return (await researchData(signal)).list(query, profile);
  if (!query.trim()) return [];
  const response = await searchPlaces(query, signal);
  const field = ({ student: 'suitability_student', family: 'suitability_family', professional: 'suitability_professional' })[profile] || 'overall_score';
  return response.results.map(place => ({ ...place, slug: place.id, tagline: `${place.district} / ${place.city}` }))
    .sort((a, b) => (b[field] ?? -1) - (a[field] ?? -1));
}

export async function fetchNeighborhoodSuggestions(query, { signal } = {}) {
  if (RESEARCH_MODE) {
    const items = await (await researchData(signal)).list(query, '');
    return items.map(item => ({ id: item.slug, name: item.name, district: item.district, city: item.city }));
  }
  return (await suggestPlaces(query, signal)).results;
}

export async function fetchNeighborhoodReport(slug, { signal, onPrepare, onProgress } = {}) {
  if (RESEARCH_MODE) return (await researchData(signal)).report(slug);
  const result = await openPlaceReport(slug, signal, onPrepare, onProgress);
  return adaptPlaceReport(result.data);
}

export async function fetchSystemHealth({ signal } = {}) {
  if (RESEARCH_MODE) return { status: 'ok', database_backend: 'Araştırma paketi', source_mode: 'research' };
  const response = await fetch(`${API_BASE}/health`, { signal });
  return response.ok ? response.json() : null;
}

export async function askReport(slug, question, history, { signal } = {}) {
  const res = await fetch(`${API_BASE}/neighborhoods/${encodeURIComponent(slug)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
    signal,
  });
  if (res.status === 429) {
    const seconds = Number(res.headers.get('Retry-After'));
    const wait = Number.isInteger(seconds) && seconds > 0 && seconds <= 60
      ? `Yaklaşık ${seconds} saniye bekle.`
      : 'Biraz bekle.';
    throw new Error(`Asistan şu anda yoğun. ${wait}`);
  }
  if (res.status === 503) throw new Error('Sohbete şu anda bağlanılamıyor.');
  if (res.status === 504) throw new Error('Yanıt gecikti. Lütfen tekrar dene.');
  if (!res.ok) throw new Error('Yanıt alınamadı. Tekrar deneyebilirsin.');
  return res.json();
}
