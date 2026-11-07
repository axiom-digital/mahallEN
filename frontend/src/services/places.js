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

export async function getPlace(id, signal) {
  return (await request(`/${encodeURIComponent(id)}`, { signal })).data;
}

export async function openPlaceReport(id, signal, onPrepare = () => {}, onProgress = () => {}) {
  const path = `/${encodeURIComponent(id)}/report`;
  try {
    return await request(path, { signal });
  } catch (error) {
    if (error.status !== 404) throw error;
    onPrepare();
    onProgress('research');
    let timer;
    let stopped = false;
    const poll = async () => {
      try {
        const result = await request(`${path}/status`, { signal });
        if (!stopped && !signal?.aborted && ['research', 'extraction', 'writing', 'ready'].includes(result.data.phase)) onProgress(result.data.phase);
      } catch { /* Progress failure must not discard a successful report request. */ }
      if (!stopped && !signal?.aborted) timer = setTimeout(poll, 1200);
    };
    timer = setTimeout(poll, 600);
    try {
      return await request(path, { method: 'POST', signal });
    } finally {
      stopped = true;
      clearTimeout(timer);
    }
  }
}
