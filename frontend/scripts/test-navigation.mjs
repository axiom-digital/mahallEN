import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPath, reportId, openReportPage, NAVIGATION_EVENT } from '../src/navigation.mjs';

const id = 'c889a9a94df57a2243dbd3507a1849bc';

test('a report has its own refreshable pathname rather than a home-page hash', () => {
  assert.equal(reportPath(id), `/mahalle/${id}`);
  assert.equal(reportId(`/mahalle/${id}`), id);
  assert.equal(reportId(`/mahalle/${id}/`), id);
  assert.equal(reportId('/'), null);
  assert.equal(reportId('/#ornek-rapor'), null);
  assert.equal(reportId('/mahalle/not-an-id'), null);
});

test('opening a report creates a separate history entry and retains the previous search', () => {
  const previous = globalThis.window;
  const entries = [], events = [];
  globalThis.window = {
    location: { pathname: '/', href: 'http://localhost/' },
    history: {
      state: {},
      replaceState(state, _, url) { entries.push({action:'replace',state,url}); this.state = state; },
      pushState(state, _, url) { entries.push({action:'push',state,url}); this.state = state; },
    },
    dispatchEvent(event) { events.push(event.type); },
  };
  try {
    const place = {id,name:'Bebek',district:'Beşiktaş',city:'İstanbul'};
    const search = {searchInput:'Bebek',searchQuery:'Bebek',profileFilter:'family',districtFilter:'all'};
    openReportPage(place, search);
    assert.deepEqual(entries[0].state.search, search);
    assert.equal(entries[1].url, `/mahalle/${id}`);
    assert.deepEqual(entries[1].state, {place,returnTo:'/'});
    assert.deepEqual(events, [NAVIGATION_EVENT]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
