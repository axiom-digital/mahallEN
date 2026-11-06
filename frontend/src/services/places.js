const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request(path, options) {
  const response = await fetch(`${BASE}/places${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof body?.detail === 'string' ? body.detail : 'Bağlantı kurulamadı. Tekrar deneyebilirsin.');
    error.status = response.status;
    throw error;
  }
  return { data: body, cache: response.headers.get('X-Cache') };
}

export async function searchPlaces(query, signal) {
  return (await request(`/search?q=${encodeURIComponent(query.trim())}`, { signal })).data;
}

export async function suggestPlaces(query, signal) {
  return (await request(`/suggest?q=${encodeURIComponent(query.trim())}`, { signal })).data;
}

export async function openPlaceReport(id, signal, onPrepare = () => {}) {
  const path = `/${encodeURIComponent(id)}/report`;
  try {
    return await request(path, { signal });
  } catch (error) {
    if (error.status !== 404) throw error;
    onPrepare();
    return request(path, { method: 'POST', signal });
  }
}
