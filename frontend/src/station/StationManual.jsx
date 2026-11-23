import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { comparePath, navigate } from '../navigation.mjs';
import { pilotPlaces } from './pilotPlaces';

const cities = [...new Set(pilotPlaces.map(({ city }) => city))].sort((a, b) => a.localeCompare(b, 'tr'));
const questions = [
  ['Puan grafikleri hangi verileri kullanıyor?', 'Puanlar tarihli bulgular ve proje değerlendirme kurallarına dayanır. Kaynakları ve değerlendirme ölçütlerini mahalle raporunda inceleyebilirsin.'],
  ['Eksik veri (null) ile 0 puan nasıl ayırt ediliyor?', 'Sayısal değerlendirme için yeterli kaynak yoksa “Veri yetersiz” görünür. Hesaplanan 0 puan, raporda 0/100 olarak gösterilir.'],
  ['Yaşam profili seçimi neyi değiştirir?', 'Öğrenci, aile veya çalışan profilini seçtiğinde ölçüt ağırlıkları değişir ve arama sonuçları o profil için hesaplanan uygunluk puanına göre sıralanır.'],
  ['Türkiye’deki her mahalleyi arayabilir miyim?', 'Mahalle adıyla birlikte ilçe ya da şehir yazabilirsin. Hazır raporu olmayan mahallelerde uygulama kaynak taraması yaparak rapor hazırlamaya çalışır.'],
];

function Directory({ onOpen }) {
  const [city, setCity] = useState('');
  const places = pilotPlaces.filter((place) => !city || place.city === city);

  return (
    <section id="dizin" className="directory" aria-labelledby="directory-title">
      <div className="section-header">
        <h2 id="directory-title">Rapor dizini</h2>
        <label className="filter">
          Şehir
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">Tümü</option>
            {cities.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="locations">
        {places.map((place) => (
          <button key={place.slug} type="button" onClick={() => onOpen(place)}>
            <span><small>{place.city} / {place.district}</small><strong>{place.name}</strong></span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function PlaceSelect({ label, value, excluded, onChange }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {pilotPlaces.map(({ slug, name, city }) => (
          <option value={slug} key={slug} disabled={slug === excluded}>{name} / {city}</option>
        ))}
      </select>
    </label>
  );
}

function CompareRack() {
  const [first, setFirst] = useState('kotekli');
  const [second, setSecond] = useState('caferaga');
  return (
    <section className="compare-rack">
      <div><h2>Yan yana.</h2><p>İki mahalleyi aynı ölçütlerle karşılaştır.</p></div>
      <form className="patch" onSubmit={(event) => {
        event.preventDefault();
        navigate(comparePath(first, second));
      }}>
        <PlaceSelect label="Birinci mahalle" value={first} excluded={second} onChange={setFirst} />
        <PlaceSelect label="İkinci mahalle" value={second} excluded={first} onChange={setSecond} />
        <button type="submit">Karşılaştır <ArrowRight size={18} aria-hidden="true" /></button>
      </form>
    </section>
  );
}

export default function StationManual({ onOpen }) {
  return (
    <div className="manual">
      <Directory onOpen={onOpen} />
      <CompareRack />
      <section className="handbook">
        <h2>Kullanım kılavuzu</h2>
        <div>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<Plus size={16} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
