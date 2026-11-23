import React from 'react';
import { navigate } from '../navigation.mjs';

export default function AppShell({ children, activeRoute, headerExtra }) {
  function followLink(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href');
    if (href === window.location.pathname && !window.location.search) {
      window.scrollTo({ top: 0 });
      return;
    }
    navigate(href);
  }

  return (
    <div className="station">
      <a className="skip" href="#main-content">İçeriğe geç</a>
      <header className="topline no-print">
        <a className="brand" href="/" onClick={followLink} aria-label="MahallEN ana sayfa">MahallEN.</a>
        <nav aria-label="Ana menü">
          <a href="/" onClick={followLink} aria-current={activeRoute === 'home' ? 'page' : undefined}>Keşfet</a>
          <a href="/karsilastir" onClick={followLink} aria-current={activeRoute === 'compare' ? 'page' : undefined}>Karşılaştır</a>
          {headerExtra}
        </nav>
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
      <footer className="foot no-print">
        <b>MahallEN.</b>
        <a href="#main-content">Başa dön ↑</a>
      </footer>
    </div>
  );
}
