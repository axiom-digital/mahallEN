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
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (profile) params.set('profile', profile);
  const url = `${API_BASE}/neighborhoods${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Failed to load neighborhoods');
  return res.json();
}

export async function fetchNeighborhoodReport(slug, { signal } = {}) {
  if (RESEARCH_MODE) return (await researchData(signal)).report(slug);
  const url = `${API_BASE}/neighborhoods/${encodeURIComponent(slug)}/report`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to load report for ${slug}`);
  return res.json();
}

export async function fetchSystemHealth({ signal } = {}) {
  if (RESEARCH_MODE) return { status: 'ok', database_backend: 'Araştırma paketi', source_mode: 'research' };
  const res = await fetch(`${API_BASE}/health`, { signal });
  if (!res.ok) return null;
  return res.json();
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
