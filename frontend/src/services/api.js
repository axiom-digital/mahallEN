import { searchPlaces, openPlaceReport, suggestPlaces } from './places';
import { adaptPlaceReport } from './placeAdapter.mjs';

export async function fetchNeighborhoods(query = '', profile = '', { signal } = {}) {
  if (!query.trim()) return [];
  const response = await searchPlaces(query, signal);
  return response.results.map(place => ({...place, slug: place.id, tagline: `${place.district} / ${place.city}`, overall_score: null, avg_rent_tl: null}));
}
export async function fetchNeighborhoodSuggestions(query, { signal } = {}) {
  return (await suggestPlaces(query, signal)).results;
}
export async function fetchNeighborhoodReport(slug, { signal, onPrepare } = {}) {
  const result = await openPlaceReport(slug, signal, onPrepare);
  return adaptPlaceReport(result.data);
}
export async function fetchSystemHealth({ signal } = {}) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(`${base}/health`, { signal });
  return response.ok ? response.json() : null;
}
