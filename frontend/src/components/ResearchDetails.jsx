import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { evaluate, groups, typeLabels } from '../reportLogic.mjs';
import { roomTypes } from '../scoring.mjs';
import ResearchNews from './ResearchNews';
import './research-details.css';

const titles = { cost_affordability: 'Kira ve konut maliyeti', transportation: 'Ulaşım ve yol durumu', social_life: 'Sosyal yaşam ve mahalle haritası', safety: 'Asayiş ve mahalle gündemi', disaster_resilience: 'Deprem açısından ev seçimi' };
const money = value => Number.isFinite(value) ? `${value.toLocaleString('tr-TR')} TL` : '—';
const date = value => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : 'Tarih belirtilmemiş';
function Source({ source }) {
  let href; try { const u = new URL(source?.url); if (u.protocol === 'https:') href = u.href; } catch {}
  return href ? <a className="rd-source" href={href} target="_blank" rel="noopener noreferrer">{source.publisher || 'Kaynak'} ↗</a> : null;
}

function VenueMap({ report, venues, selected }) {
  const root = useRef(null), map = useRef(null), markers = useRef(null), points = useRef(new Map());
  useEffect(() => {
    const latitude = report.location?.lat, longitude = report.location?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const instance = L.map(root.current).setView([latitude, longitude], 15);
    map.current = instance;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(instance);
    L.circleMarker([latitude, longitude], { radius: 9, color: '#ac4b2c', fillOpacity: .8 }).addTo(instance).bindTooltip('Mahalle referans noktası');
    markers.current = L.layerGroup().addTo(instance);
    const frame = requestAnimationFrame(() => instance.invalidateSize());
    return () => { cancelAnimationFrame(frame); instance.remove(); map.current = null; };
  }, [report.id]);
  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers(); points.current.clear();
    for (const venue of venues) {
      const latitude = venue.lat, longitude = venue.lon ?? venue.lng;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const label = document.createElement('div');
      label.textContent = `${venue.name} · ${typeLabels[venue.type] || venue.type}`;
      const marker = L.circleMarker([latitude, longitude], { radius: 7, color: '#31513b', fillColor: '#608652', fillOpacity: .9 }).bindPopup(label).addTo(markers.current);
      points.current.set(venue.id, marker);
    }
  }, [venues]);
  useEffect(() => {
    const marker = points.current.get(selected);
    if (marker && map.current) { map.current.setView(marker.getLatLng(), 17); marker.openPopup(); }
  }, [selected]);
  if (!Number.isFinite(report.location?.lat) || !Number.isFinite(report.location?.lon)) return <p>Bu mahalle için doğrulanmış referans koordinatı yok.</p>;
  return <div><div className="rd-map" ref={root} role="region" aria-label={`${report.name} OpenStreetMap haritası`} /><p className="rd-caption">Pinler kaynakta koordinatı bulunan mekânlardır. Koordinatı olmayan yerler listeye alınır, haritada konum uydurulmaz.</p></div>;
}

function Social({ report }) {
  const [kind, setKind] = useState('all'), [query, setQuery] = useState(''), [limit, setLimit] = useState(18), [selected, setSelected] = useState(null);
  const venues = useMemo(() => report.venues.filter(v => (kind === 'all' || groups[kind].types.includes(v.type)) && `${v.name} ${v.address}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))), [report, kind, query]);
  return <><div className="rd-controls"><label>Mekân türü<select value={kind} onChange={e => { setKind(e.target.value); setLimit(18); setSelected(null); }}><option value="all">Tüm türler</option>{Object.entries(groups).map(([key, group]) => <option key={key} value={key}>{group.label}</option>)}</select></label><label>Mekân ara<input value={query} onChange={e => { setQuery(e.target.value); setLimit(18); }} placeholder="İsim veya adres" /></label></div><div className="rd-social"><VenueMap report={report} venues={venues} selected={selected}/><div className="rd-venues"><p>{venues.length} kaynaklı kayıt</p>{venues.slice(0, limit).map(v => <article key={v.id}><h4>{v.name}</h4><span>{typeLabels[v.type] || v.type}</span><p>{v.address}</p><small>{v.scope === 'nearby' ? 'Yakın çevrede' : v.scope === 'reference_radius' ? 'Referans noktasının çevresinde' : 'Kaynak konum kaydı'}</small><div>{Number.isFinite(v.lat) && Number.isFinite(v.lon ?? v.lng) && <button onClick={() => setSelected(v.id)}>Haritada göster</button>}<Source source={v.sources?.[0]}/></div></article>)}{venues.length > limit && <button className="button dark" onClick={() => setLimit(limit+18)}>Daha fazla mekân göster</button>}{!venues.length && <p>Bu filtrede kaynaklı mekân kaydı yok.</p>}</div></div></>;
}

function Rent({ report, reference }) {
  const [room, setRoom] = useState('1+1'), [furnished, setFurnished] = useState('any');
  const analysis = evaluate(report, { roomType: room, furnished });
  const rows = roomTypes.map(type => ({ type, ...evaluate(report, { roomType: type, furnished }) })).filter(row => row.median != null);
  const max = Math.max(1, ...rows.map(r => r.median || 0));
  return <><div className="rd-controls"><label>Konut tipi<select value={room} onChange={e => setRoom(e.target.value)}>{roomTypes.map(r => <option key={r}>{r}</option>)}</select></label><label>Eşya durumu<select value={furnished} onChange={e => setFurnished(e.target.value)}><option value="any">Tümü</option><option value="yes">Eşyalı</option><option value="no">Eşyasız</option></select></label></div><div className="rd-stats"><div><span>{room} ortanca kira</span><strong>{money(analysis.median)}</strong></div><div><span>Tarihli uygun örnek</span><strong>{analysis.dated.length}</strong></div><div><span>Net asgari ücrete oran</span><strong>{analysis.median == null ? '—' : `%${Math.round(analysis.median/reference.netMinimumWage.amount*100)}`}</strong></div></div><h3>Konut tiplerine göre kaynaklı kira</h3><div className="rd-bars">{rows.map(r => <div key={r.type}><span>{r.type}</span><div>{r.median != null && <i style={{width:`${r.median/max*100}%`}}/>}</div><strong>{money(r.median)}</strong></div>)}</div><p className="rd-caption">Farklı konut tipleri birbiriyle ortalanmaz. Sezonluk ve tarihi uygun olmayan örnekler güncel hesaba girmez. Aidat ve faturalar bu tutara dahil değildir.</p><div className="rd-table-wrap"><table><thead><tr><th>Konut</th><th>Kira</th><th>İlan tarihi</th><th>Hesap durumu</th><th>Kaynak</th></tr></thead><tbody>{analysis.selected.map(r => <tr key={r.id}><td>{r.rooms}</td><td>{money(r.amount)}</td><td>{date(r.date)}</td><td>{r.eligible ? 'Tarihli örnek' : 'Hesap dışında'}</td><td><Source source={r.sources?.[0]}/></td></tr>)}</tbody></table></div></>;
}

function Timetable({ route }) {
  const [day, setDay] = useState('weekday');
  return <article className="rd-route"><header><h3>{route.code}</h3><Source source={route.sources?.[0]}/></header><p>{route.route}</p><p>{route.localEvidence}</p><p className="rd-caption">Kaynağın güncellemesi: {route.publisherUpdated || 'Belirtilmemiş'}</p>{!!route.timetable?.length && <><label>Sefer günü<select value={day} onChange={e => setDay(e.target.value)}><option value="weekday">Hafta içi</option><option value="saturday">Cumartesi</option><option value="sunday">Pazar</option></select></label>{route.timetable.map((table, i) => <details key={i}><summary>{table.direction} · {table.days[day]?.count || 0} listelenen kalkış</summary><p>{table.days[day]?.times?.join(' · ') || 'Bu gün için ayrıştırılan saat yok.'}</p></details>)}</>}{!route.timetable?.length && <p>Güncel kalkış listesi bu kayıtta okunamadı.</p>}<p className="rd-caption">Saatler kalkış noktasına aittir; kullanıcının durağından geçiş saati değildir.</p></article>;
}

function Transport({ report }) {
  return <><h3>Yol ve erişim bildirimleri</h3><div className="rd-alerts">{(report.transportAlerts || []).map(a => <article key={a.id}><small>{date(a.date || a.observedAt)} · {a.date ? 'Kaynak tarihi' : 'Sayfada görülme tarihi'}</small><h4>{a.summary}</h4><p>{a.affected}</p><Source source={a.sources?.[0]}/></article>)}</div><h3>Kaynaklı hatlar ve tarifeler</h3>{report.routes.map(route => <Timetable key={route.id} route={route}/>)}</>;
}

export function ProfileCharts({ evaluations }) {
  const [profile, setProfile] = useState('student');
  if (!evaluations) return null;
  const active = evaluations[profile];
  const names = { rent: 'Maliyet', transport: 'Ulaşım', social: 'Sosyal yaşam', news: 'Güvenlik / haberler', hazard: 'Deprem göstergesi' };
  return <section className="rd-profiles"><h3>Profiller ve öncelik ağırlıkları</h3><p>Senin için hangi başlık daha önemli? Bir profil seçerek değerlendirmede hangi konulara ağırlık verildiğini görebilirsin.</p><div className="rd-profile-select" role="group" aria-label="Profil ağırlık grafiği">{['student','family','professional'].map(key => <button aria-pressed={key === profile} key={key} onClick={() => setProfile(key)}>{evaluations[key].label}<strong>{evaluations[key].score != null && `${evaluations[key].score}/100`}</strong></button>)}</div><div className="rd-bars">{Object.entries(active.weights).map(([key, weight]) => <div key={key}><span>{names[key]}</span><div role="progressbar" aria-label={`${active.label} ${names[key]} ağırlığı`} aria-valuenow={weight} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${weight}%`}}/></div><strong>%{weight}</strong></div>)}</div><p className="rd-caption">Yüzdeler profilin önceliklerini gösterir. Profil puanları, beş kategori birlikte değerlendirilebildiğinde sunulur.</p></section>;
}

function Earthquake({ hazard }) {
  return <section className="rd-earthquake">
    <div className="rd-explainer"><h3>Bu bilgi ev seçerken ne işime yarar?</h3><p>Bölgenin depremde ne kadar sarsılabileceğine dair bir fikir verir. Aynı mahalledeki iki binanın dayanıklılığı farklı olabilir; mahalle puanı, seçtiğin evin sağlam olduğunu göstermez.</p></div>
    <h3>Evi değerlendirirken</h3><ul className="rd-checklist"><li>Binaya ait zemin etüdünü ve yapı belgelerini sor.</li><li>Varsa bina için hazırlanmış mühendislik incelemesini iste.</li><li>Dayanıklılık konusunda karar vermek için binayı uzman bir mühendise incelet.</li></ul>
    <p className="rd-caption">AFAD da bölgesel deprem tehlikesini, bina ve çevresindeki olası kayıpları değerlendiren risk bilgisinden ayrı tutar. <a href="https://afad.gov.tr/turkiye-deprem-tehlike-haritasi" target="_blank" rel="noopener noreferrer">AFAD açıklamasını oku ↗</a></p>
    <details className="rd-technical"><summary>Teknik bilgi ve araştırma kaynağı</summary><p>Bu rapor, mahalle referans noktasına yakın bir araştırma noktası kullanır; resmî AFAD parsel sorgusu değildir.</p><dl>{Number.isFinite(hazard.value) && <div><dt>Beklenen yer ivmesi (PGA)</dt><dd>{hazard.value} g</dd></div>}{hazard.probability && <div><dt>Hesap dönemi</dt><dd>{hazard.probability}</dd></div>}{hazard.gridDistance != null && <div><dt>Referans noktasına uzaklık</dt><dd>{hazard.gridDistance} km</dd></div>}{hazard.sourceYear && <div><dt>Kaynak yılı</dt><dd>{hazard.sourceYear}</dd></div>}</dl><Source source={{url: hazard.url, publisher: hazard.title}}/></details>
  </section>;
}

export default function ResearchDetails({ category, report: adapted, onClose }) {
  const dialog = useRef(null), titleId = useId();
  const { report, reference } = adapted.research_detail;
  useEffect(() => { const d = dialog.current; d.showModal(); const frame = requestAnimationFrame(() => d.querySelector('button')?.focus()); return () => { cancelAnimationFrame(frame); d.close(); }; }, []);
  return <dialog className="rd-dialog" ref={dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><header className="rd-dialog-head"><div><span>{report.name} · {report.district}</span><h2 id={titleId}>{titles[category]}</h2></div><button aria-label="Kategori detayını kapat" onClick={onClose}>×</button></header><div className="rd-body">{category === 'cost_affordability' && <Rent report={report} reference={reference}/ >}{category === 'transportation' && <Transport report={report}/ >}{category === 'social_life' && <Social report={report}/ >}{category === 'safety' && <>{adapted.research_news && <ResearchNews data={adapted.research_news} sectionId="safety-detail"/>}<h3>Diğer mahalle gündemi</h3>{report.news.filter(n => !adapted.research_news || !/suç|şiddet|asayiş/.test(n.type)).map(n => <article className="rd-event" key={n.id}><small>{date(n.date)} · {n.type}</small><p>{n.summary}</p><Source source={n.sources?.[0]}/></article>)}</>}{category === 'disaster_resilience' && <Earthquake hazard={report.hazard}/>}</div></dialog>;
}
