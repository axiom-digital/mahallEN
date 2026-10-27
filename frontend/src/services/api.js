const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function fetchNeighborhoods(query = '', profile = '', { signal } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (profile) params.set('profile', profile);
  const url = `${API_BASE}/neighborhoods${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Failed to load neighborhoods');
  return res.json();
}

export async function fetchNeighborhoodReport(slug, { signal } = {}) {
  const url = `${API_BASE}/neighborhoods/${encodeURIComponent(slug)}/report`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to load report for ${slug}`);
  return res.json();
}

export async function fetchSystemHealth({ signal } = {}) {
  const res = await fetch(`${API_BASE}/health`, { signal });
  if (!res.ok) return null;
  return res.json();
}
