const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function fetchNeighborhoods(query = '', profile = '') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (profile) params.set('profile', profile);
  const url = `${API_BASE}/neighborhoods${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load neighborhoods');
  return res.json();
}

export async function fetchNeighborhoodReport(slug, refreshAi = false) {
  const url = `${API_BASE}/neighborhoods/${slug}/report${refreshAi ? '?refresh_ai=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load report for ${slug}`);
  return res.json();
}

export async function fetchSystemHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) return null;
  return res.json();
}
