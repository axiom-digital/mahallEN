export const referenceDate = '2026-10-29';
export const recentStart = '2026-08-01';
export const historyStart = '2025-10-29';

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function newsPeriod(event) {
  const when = validDate(event.event_date) || validDate(event.publication_date);
  if (!when) return 'undated';
  if (when > referenceDate || when < historyStart) return 'outside';
  return when >= recentStart ? 'recent' : 'history';
}

export function reviewEvents(events, sources) {
  const ids = new Set(sources.map(s => s.id));
  return events.filter(e => e.title && e.summary && Array.isArray(e.source_ids) &&
    e.source_ids.length && e.source_ids.every(id => ids.has(id)) &&
    newsPeriod(e) !== 'outside');
}
