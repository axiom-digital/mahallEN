import { openPlaceReport } from './places';
import { adaptPlaceReport } from './placeAdapter.mjs';

export async function fetchNeighborhoodReport(id, { signal, onProgress } = {}) {
  const { data } = await openPlaceReport(id, signal, undefined, onProgress);
  return adaptPlaceReport(data);
}
