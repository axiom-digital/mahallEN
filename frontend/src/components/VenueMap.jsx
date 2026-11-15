import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function VenueMap({ venues, selected, onSelect }) {
  const element = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map());
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const points = venues.filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lon));
    if (!element.current || !points.length) return;
    const instance = L.map(element.current, { scrollWheelZoom: false });
    map.current = instance;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
    points.forEach(venue => {
      const label = document.createElement('div');
      label.textContent = venue.name;
      const marker = L.circleMarker([venue.lat, venue.lon], { radius: 7, color: '#fff', weight: 2,
        fillColor: '#1a4537', fillOpacity: .95 }).addTo(instance).bindPopup(label);
      marker.on('click', () => select.current(venue.id));
      markers.current.set(venue.id, marker);
    });
    instance.fitBounds(points.map(v => [v.lat, v.lon]), { padding: [30, 30], maxZoom: 16 });
    requestAnimationFrame(() => instance.invalidateSize());
    return () => { markers.current.clear(); instance.remove(); map.current = null; };
  }, [venues]);
  useEffect(() => {
    const marker = markers.current.get(selected);
    if (marker && map.current) { map.current.setView(marker.getLatLng(), 17); marker.openPopup(); }
  }, [selected]);
  const count = venues.filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lon)).length;
  return count ? <div><div className="venue-map" ref={element} aria-label="Kaynakla konumu eşleştirilen mekânlar" />
    <p className="reading-map-caption">{count} konumu eşleştirilmiş kayıt. Konumu bilinmeyen mekânlar haritada işaretlenmez.</p></div>
    : <p className="reading-map-caption">Bu filtrede konumu eşleştirilmiş kayıt yok; adres ve kaynak bağlantılarını inceleyebilirsin.</p>;
}
