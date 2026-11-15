export const NAVIGATION_EVENT = 'mahallen:navigate';

export function reportPath(id) {
  return `/mahalle/${encodeURIComponent(id)}`;
}

export function reportId(pathname) {
  return pathname.match(/^\/mahalle\/([a-f0-9]{32})\/?$/i)?.[1] || null;
}

export function navigate(path, state = {}) {
  window.history.pushState(state, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function openReportPage(place, searchState) {
  window.history.replaceState({ ...window.history.state, search: searchState }, '', window.location.href);
  navigate(reportPath(place.id || place.slug), { place, returnTo: window.location.pathname });
}
