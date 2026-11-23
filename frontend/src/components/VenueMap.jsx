import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function VenueMap({ venues, selected, onSelect }) {
  const element = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map());
  const select = useRef(onSelect);
  const [tilesFailed, setTilesFailed] = useState(false);
  select.current = onSelect;

  useEffect(() => {
    const points = venues.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon));
    if (!element.current || !points.length) return;

    setTilesFailed(false);
    const container = element.current;
    const instance = L.map(container, {
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
    });
    map.current = instance;

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    tileLayer.on('tileerror', () => setTilesFailed(true));

    points.forEach((venue) => {
      const label = document.createElement('div');
      label.className = 'font-sans text-xs font-medium text-slate-900';
      label.textContent = venue.name;
      const isSelected = venue.id === selected;
      const marker = L.circleMarker([venue.lat, venue.lon], {
        radius: isSelected ? 9 : 7,
        color: '#ffffff',
        weight: isSelected ? 2.5 : 2,
        fillColor: isSelected ? '#059669' : '#2563eb',
        fillOpacity: 0.95,
      })
        .addTo(instance)
        .bindPopup(label);
      marker.on('click', () => select.current(venue.id));
      markers.current.set(venue.id, marker);
    });

    instance.fitBounds(
      points.map((v) => [v.lat, v.lon]),
      { padding: [30, 30], maxZoom: 16 }
    );

    const rafId = requestAnimationFrame(() => {
      if (map.current === instance) instance.invalidateSize();
    });
    const drawerTimer = setTimeout(() => {
      if (map.current === instance) instance.invalidateSize();
    }, 280);

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (map.current === instance) instance.invalidateSize();
      });
      observer.observe(container);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(drawerTimer);
      observer?.disconnect();
      instance.stop();
      markers.current.clear();
      instance.remove();
      map.current = null;
    };
  }, [venues]);

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const isSelected = id === selected;
      marker.setStyle({
        radius: isSelected ? 9 : 7,
        weight: isSelected ? 2.5 : 2,
        fillColor: isSelected ? '#059669' : '#2563eb',
      });
    });

    const marker = markers.current.get(selected);
    if (marker && map.current) {
      map.current.setView(marker.getLatLng(), 17);
      marker.openPopup();
    }
  }, [selected]);

  const count = venues.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)).length;

  return count ? (
    <div className="space-y-2">
      <div
        className="mahallen-leaflet-map"
        ref={element}
        aria-label="Kaynakla konumu eşleştirilen mekânlar"
      />
      {tilesFailed && (
        <p role="status" className="text-xs text-amber-700">
          Harita zemini şu anda yüklenemedi; işaretli konumlar ve kaynak bağlantıları aktif.
        </p>
      )}
      <p className="text-xs text-slate-500">
        {count} konumu eşleştirilmiş kayıt. Konumu bilinmeyen mekânlar haritada işaretlenmez.
      </p>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      Bu filtrede konumu eşleştirilmiş kayıt yok; adres ve kaynak bağlantılarını listeden inceleyebilirsin.
    </div>
  );
}
