import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, BusFront, Coffee, Info, Layers3, MapPin, Search, ShieldCheck, ShoppingBasket, Trees, UsersRound, Wallet, X } from 'lucide-react';
import report from '../data/kotekli-preview.json';
import { housingComparison, housingPreferences, profiles, roomTypes, weightedScore } from '../scoring.mjs';

const money = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);
const date = (s) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T12:00:00+03:00`));
const names = { cafe: 'Kafe', restaurant: 'Restoran', fast_food: 'Yeme içme', pub: 'Bar / pub', bar: 'Bar', nightclub: 'Gece kulübü', entertainment: 'Eğlence mekânı', park: 'Park', supermarket: 'Market', convenience: 'Market' };
const icons = { rent: Wallet, transport: BusFront, social: Coffee, news: ShieldCheck, hazard: Layers3 };
const categoryReason = (key) => key === 'news' ? 'Yerel olay haberleri birlikte değerlendirildi. Resmî suç oranı ve mahalle ölçeğinde güvenlik ölçümü henüz yok.' : report.scores[key].reason;
const groupKeys = { rent: ['rent'], transport: ['transport'], news: ['news'] };
const filters = [ ['all', 'Tümü'], ['food', 'Yeme içme'], ['nightlife', 'Bar / pub / eğlence'], ['cafe', 'Kafeler'], ['market', 'Marketler'], ['park', 'Parklar'] ];
const routeDetails = {
  '1-66': ['Otogar → Kötekli → Yeniköy', 'Gece ulaşımı için kontrol et. Güncel gece tarifesi doğrulanmadı.'],
  '1-65': ['Otogar → Tıp Fakültesi → Kötekli → Yeniköy', 'Otogar ve tıp fakültesi bağlantısı için.'],
  '1-62': ['Stadyum → AVM → Kötekli → Yeniköy', 'Merkez ve alışveriş bağlantısı için.'],
  '1-48': ['Yeniköy → Kötekli → Kampüs → Tıp Fakültesi / KYK', 'Kampüs ve yurt bağlantısı için.'],
};

function ScoreEvidence({ category }) {
  const rows = category === 'transport' ? [
    ['Kampüs ve KYK bağlantısı', '1-48 hat adayı bulundu'],
    ['Otogar ve tıp fakültesi', '1-65 / 1-66 hat adayları bulundu'],
    ['Merkez ve AVM bağlantısı', '1-62 hat adayı bulundu'],
    ['Sefer sıklığı ve yolculuk süresi', 'Ölçülmedi'],
    ['Güncel son sefer / gece tarifesi', 'Doğrulanmadı'],
  ] : [
    ['Yeme içme, kafe, market, park', 'Kaynaklı örnekler bulundu'],
    ['Bar / pub / eğlence', 'Webden eklenen örnekler var'],
    ['Gece kulübü kapsamı', 'Yeterli kaynaklı örnek yok'],
    ['İşletmelerin güncel faaliyeti', 'Doğrulanmadı'],
    ['Yürüyüş mesafesi, fiyat ve hizmet kalitesi', 'Ölçülmedi'],
  ];
  return <div className="score-evidence"><h3>Değerlendirmede neler var?</h3><dl>{rows.map(([label, status]) => <div key={label}><dt>{label}</dt><dd>{status}</dd></div>)}</dl></div>;
}

function SourceLink({ url, children, className = '' }) {
  let safe;
  try { const u = new URL(url); if (u.protocol === 'https:') safe = u.href; } catch {}
  return safe ? <a className={className} href={safe} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14} /></a> : <span>{children}</span>;
}

function Sources({ category, onClose }) {
  const ref = useRef(null);
  const [filter, setFilter] = useState(category);
  useEffect(() => {
    ref.current.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, []);
  const groups = Object.entries(report.scores).map(([key, score]) => ({ key, label: score.label,
    sources: key === 'social' ? report.social.places.flatMap(p => p.sources) : key === 'hazard' ? [{ publisher: 'TÜBİTAK Aperta · CC-BY-SA-4.0', url: report.hazard.url }] : groupKeys[key].flatMap(k => report[k].flatMap(i => i.sources)) }));
  return <dialog ref={ref} className="source-dialog" aria-labelledby="sources-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-shell"><div className="dialog-heading"><h2 id="sources-title">Kaynaklar ve veri sınırları</h2><button className="icon-button" onClick={onClose} aria-label="Kaynakları kapat"><X /></button></div>
      <p className="dialog-intro">Google aramasına bağlı sonuçlar kaynak kontrolü bekliyor. Kaynak bulunması, tüm açıklamaların doğrulandığı anlamına gelmez. İşletme dizini kaydı, işletmenin bugün açık olduğunu göstermez.</p>
      <div className="source-filters">{[{ key: 'all', label: 'Tümü' }, ...groups].map(g => <button key={g.key} className={filter === g.key ? 'selected' : ''} onClick={() => setFilter(g.key)}>{g.label}</button>)}</div>
      <div className="source-groups">{groups.filter(g => filter === 'all' || g.key === filter).map(g => <section key={g.key}><h3>{g.label}</h3><p>{categoryReason(g.key)}</p>{g.key === 'hazard' && <p>{report.hazard.authors.join('; ')} (2025). {report.hazard.sourceTitle}. Resmî AFAD TDTH ürünü değildir.</p>}{[...new Map(g.sources.map(s => [s.url, s])).values()].map(s => <SourceLink key={s.url} url={s.url} className="source-link">{s.publisher}</SourceLink>)}</section>)}</div>
    </div>
  </dialog>;
}

function NeighborhoodMap({ places, selected, onSelect }) {
  const element = useRef(null), map = useRef(null), layer = useRef(null), onSelectRef = useRef(onSelect);
  const [tilesFailed, setTilesFailed] = useState(false);
  onSelectRef.current = onSelect;
  useEffect(() => {
    const center = [report.location.lat, report.location.lon];
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(center, 15);
    map.current = instance;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
    tiles.on('tileerror', () => setTilesFailed(true));
    L.circle(center, { radius: 1000, color: '#617d48', weight: 1, fillOpacity: .025, dashArray: '5 6', interactive: false }).addTo(instance);
    L.circleMarker(center, { radius: 8, color: 'white', weight: 3, fillColor: '#214d3c', fillOpacity: 1 }).bindTooltip('Kötekli referans noktası').addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).forEach(p => {
      const text = document.createElement('span'); text.textContent = `${p.name} · ${names[p.category] || 'Mekân'}`;
      const active = selected?.id === p.id;
      const marker = L.circleMarker([p.lat, p.lon], { radius: active ? 9 : 6, color: 'white', weight: 2, fillColor: p.category === 'park' ? '#28744f' : p.category === 'cafe' ? '#926441' : '#496ec1', fillOpacity: 1 });
      marker.bindTooltip(text).on('click', () => onSelectRef.current(p)).addTo(layer.current);
      if (active) marker.openTooltip();
    });
    if (Number.isFinite(selected?.lat) && map.current) map.current.panTo([selected.lat, selected.lon]);
  }, [places, selected]);
  return <div className="real-map-wrap"><div className="real-map" ref={element} role="region" aria-label="Kötekli sokak haritası ve konumu bilinen mekânlar" />{tilesFailed && <p role="status" className="map-error">Harita zemini yüklenemedi. Mekânların kaynak bağlantılarından konumlarını açabilirsin.</p>}<p className="map-caption">Çember: referans noktasının 1 km çevresi. İşaretler: konumu bilinen OSM kayıtları. Webden eklenen mekânların koordinatları henüz doğrulanmadığı için haritada işaretlenmedi.</p></div>;
}

export default function NeighborhoodPreview() {
  const [profile, setProfile] = useState('general'), [source, setSource] = useState(null);
  const [draftBudget, setDraftBudget] = useState(''), [draftRoomType, setDraftRoomType] = useState('');
  const [preferences, setPreferences] = useState(null), [preferenceError, setPreferenceError] = useState('');
  const preferenceForm = useRef(null);
  const [filter, setFilter] = useState('all'), [selected, setSelected] = useState(null), [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState(''), [message, setMessage] = useState('');
  const [saved, setSaved] = useState(() => { try { return localStorage.getItem('mahallen:kotekli:saved') === 'true'; } catch { return false; } });
  const { listings: comparableRents, median: rentMedian, score: rentScore } = housingComparison(report.rent, preferences);
  const budget = preferences?.budget, roomType = preferences?.roomType;
  const scores = Object.fromEntries(Object.entries(report.scores).map(([key, s]) => [key, key === 'rent' ? rentScore : s.value]));
  const overall = preferences && Object.values(scores).every(Number.isFinite) ? weightedScore(scores, profiles[profile].weights) : null;
  const rentDescription = !preferences ? 'Konut tipini ve aylık kira bütçeni seç; sana uygun kira puanını hesaplayalım.' : rentMedian == null ? `${roomType} için kaynaklı ilan örneği yok. Başka konut tiplerinin fiyatıyla puan üretilmedi.` : `${roomType} için ortanca ${money(rentMedian)} TL; aylık ${money(budget)} TL kira bütçene göre.`;
  const submitPreferences = e => {
    e.preventDefault();
    const next = housingPreferences(draftRoomType, draftBudget);
    if (!next) { setPreferenceError('Bir konut tipi ve 1.000–1.000.000 TL arasında aylık kira bütçesi seç.'); return; }
    setPreferenceError(''); setPreferences(next);
  };
  const places = useMemo(() => [...report.social.places].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)), []);
  const matches = places.filter(p => filter === 'all' || (filter === 'food' ? ['restaurant', 'fast_food'].includes(p.category) : filter === 'nightlife' ? ['pub', 'bar', 'nightclub', 'entertainment'].includes(p.category) : filter === 'market' ? ['supermarket', 'convenience'].includes(p.category) : p.category === filter));
  const count = (categories) => places.filter(p => categories.includes(p.category)).length;
  const toggleSave = () => { setSaved(!saved); try { localStorage.setItem('mahallen:kotekli:saved', String(!saved)); } catch {} };
  const submitSearch = e => { e.preventDefault(); setMessage(/k[öo]tekli/i.test(search) || !search.trim() ? 'Kötekli raporu gösteriliyor.' : 'Bu pilotta Kötekli raporu hazır; diğer mahalleler henüz hazırlanmadı.'); };
  return <div className="preview-app" id="top">
    <header className="site-header"><div className="header-inner"><a className="brand" href="#top"><span className="brand-mark"><MapPin /></span><span>mahall<span>EN</span><small>Mahalleni tanı.</small></span></a><nav className="header-nav"><a href="#overview">Genel bakış</a><a href="#daily-life">Sosyal yaşam</a><button onClick={() => setSource('all')}>Kaynaklar</button></nav><button className="save-button" onClick={toggleSave}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Kaydedildi' : 'Raporu kaydet'}</button></div></header>
    <main className="page-container">
      <div className="explore-toolbar"><span><MapPin size={14} />Muğla pilot bölgesi</span><form className="neighborhood-search" onSubmit={submitSearch}><Search size={17} /><input aria-label="Mahalle ara" placeholder="Mahalle veya ilçe ara" value={search} onChange={e => setSearch(e.target.value)} maxLength={100} /><button aria-label="Ara"><ArrowRight size={17} /></button></form></div>
      {message && <p className="search-message" role="status">{message}<button onClick={() => setMessage('')} aria-label="Mesajı kapat"><X size={16} /></button></p>}
      <section className="housing-intake" id="housing-preferences" aria-labelledby="housing-title">
        <div><span className="eyebrow">ÖNCE SENİN ARADIĞIN EV</span><h2 id="housing-title">Nasıl bir ev arıyorsun?</h2><p>Kira değerlendirmesini seçtiğin konut tipine ve aylık bütçene göre hazırlayalım.</p></div>
        <form ref={preferenceForm} onSubmit={submitPreferences}>
          <label>Konut tipi<select aria-label="Aradığın konut tipi" required value={draftRoomType} onChange={e => setDraftRoomType(e.target.value)}><option value="" disabled>Seçiniz</option>{roomTypes.map(type => <option key={type} value={type}>{type}{type === '1+0' ? ' · Stüdyo' : ''}</option>)}</select></label>
          <label>Aylık kira bütçen<div className="budget-input"><input aria-label="Aylık kira bütçen" type="number" required min="1000" max="1000000" step="1" placeholder="Örn. 25000" value={draftBudget} onChange={e => setDraftBudget(e.target.value)} /><span>TL / ay</span></div></label>
          <button className="primary-button" type="submit">{preferences ? 'Tercihlerimi güncelle' : 'Bana göre değerlendir'}<ArrowRight size={16} /></button>
        </form>
        <p className="intake-note">Ev için ayırdığın toplam aylık kira; aidat, faturalar ve depozito hariç. Seçmediğin konut tiplerinin fiyatları kira puanına katılmaz.</p>
        {preferenceError && <p role="alert">{preferenceError}</p>}
        {preferences && <p className="preference-confirmation" role="status">{roomType} · {money(budget)} TL / ay tercihin uygulandı.{rentMedian == null ? ' Bu konut tipi için henüz ilan örneği yok.' : ''}</p>}
      </section>
      <section className="report-hero" id="report-start"><div className="hero-copy"><span className="eyebrow">MENTEŞE / MUĞLA</span><h1 className="new-hero-title">Kötekli<span>Burada hayat nasıl?</span></h1><p className="hero-description">Bütçene uyumu, günlük ulaşımın, sosyal hayatın ve dikkat etmen gerekenler. Her başlığın puanı, gerekçesi ve kaynağı bir arada.</p><div className="hero-metadata"><span>{date(report.date)}</span><span>5 kategori</span></div><div className="hero-actions"><a className="primary-button" href="#overview">Raporu keşfet<ArrowDown size={17} /></a><button className="text-button" onClick={() => setSource('all')}>Kaynakları incele<ArrowUpRight size={16} /></button></div></div>
        <aside className="overall-card"><span className="eyebrow">GENEL ÖN DEĞERLENDİRME</span><div className="overall-number" data-testid="overall-score">{overall ?? '—'}<small>/100</small></div><p>{!preferences ? "Önce konut tipini ve bütçeni seç." : overall == null ? `${roomType} için kira verisi eksik; genel puan hesaplanmadı.` : `${profiles[profile].label} profiline göre · 5 kategori dahil`}</p><div className="mini-score-bars">{Object.entries(scores).map(([key, score]) => <div key={key}><span>{report.scores[key].label}</span><div><i style={{ width: `${score ?? 0}%` }} /></div><strong>{score ?? '—'}</strong></div>)}</div><a href="#scoring">Nasıl hesaplandı?<ArrowDown size={14} /></a></aside>
      </section>
      <div className="preview-notice"><Info size={19} /><p><strong>Puanları nasıl okumalı?</strong> Yüksek puan daha olumlu değerlendirmeyi gösterir. Hesaplama ayrıntılarını “Nasıl hesaplandı?” bölümünde inceleyebilirsin.</p></div>
      <div className="section-navigation"><nav aria-label="Rapor bölümleri"><a href="#overview">Puanlar</a><a href="#rent">Kira</a><a href="#transport">Ulaşım</a><a href="#daily-life">Sosyal yaşam</a><a href="#safety">Güvenlik</a><a href="#hazard">Deprem</a></nav></div>
      <section className="overview-section" id="overview"><div className="section-heading"><div><span className="eyebrow">BİR BAKIŞTA</span><h2>Beş başlık, açıklanan puanlar</h2></div></div><div className="metrics-grid">{Object.entries(report.scores).map(([key, item]) => { const Icon = icons[key]; return <article className={`metric-card ${key === 'hazard' ? 'hazard-metric' : ''}`} key={key} data-testid={`score-${key}`}><div className="metric-heading"><span className="metric-icon"><Icon size={20} /></span><span>{item.label}</span></div><div className="metric-value">{scores[key] ?? '—'}{scores[key] != null && <small>/ 100</small>}</div><p>{key === 'rent' ? rentDescription : key === 'hazard' ? 'Sarsıntı tehlikesi, araştırma gridindeki noktaların yaklaşık %77’sinden yüksek. Bina dayanıklılığı puanı değildir.' : categoryReason(key)}</p><div className="metric-bottom"><span className="metric-status">{key === 'rent' && rentScore == null ? (preferences ? 'İlan örneği yok' : 'Tercih bekleniyor') : item.confidence}</span><button onClick={() => setSource(key)} aria-label={`${item.label} kaynakları`}><ArrowUpRight size={19} /></button></div><a className="category-detail-link" href={`#${key === 'news' ? 'safety' : key === 'social' ? 'daily-life' : key}`}>Gerekçeyi incele<ArrowRight size={14} /></a></article>; })}</div></section>
      <section id="scoring" className="scoring-section"><div className="section-heading"><div><span className="eyebrow">ÖNCELİKLERİNE GÖRE</span><h2>Genel puanın nasıl oluşuyor?</h2></div><UsersRound size={25} /></div><div className="profile-tabs" role="group" aria-label="Bakış açısı seç">{Object.entries(profiles).map(([key, p]) => <button key={key} className={profile === key ? 'selected' : ''} aria-pressed={profile === key} onClick={() => setProfile(key)}>{p.label}</button>)}</div><p className="scoring-intro">Kategori puanları, aşağıdaki ağırlıklarla birleştirilir. Profil değiştirdiğinde genel puan değişir. Deprem her profilde hesaba katılır.</p><div className="weight-list">{Object.entries(profiles[profile].weights).map(([key, weight]) => <span key={key}>{report.scores[key].label}<strong>%{weight}</strong></span>)}</div><details className="method-details"><summary>Puanların yöntemi ve sınırları</summary><p>Genel puan = (her kategori puanı × kendi ağırlığı) toplamı / 100. Genel profil, ekibin anket sonrası seçtiği %32 kira, %28 sosyal yaşam, %20 güvenlik, %10 deprem ve %10 ulaşım ağırlıklarını kullanır. Diğer profillerin dağılımları prototip varsayımıdır.</p><p>Kira: seçilen konut tipinin ortanca ilan kirası ile bütçen karşılaştırılır. Formül: 50 + 200 × (bütçe − ortanca kira) / bütçe; sonuç 0–100 arasında tutulur. Kira bütçeye eşitse 50 puan.</p><p>Ulaşım, sosyal yaşam ve güvenlik puanları, kaynaklı araştırmaya dayanan Gemini 2.5 Flash ön değerlendirmeleridir; henüz saha verisiyle doğrulanmadı. Alt ölçüt puanları toplanarak hesaplanmış sonuçlar değildir. Aynı puan, iki kategorinin aynı kalitede olduğunu göstermez. Güvenlikte resmî suç oranı yok; 55 puan “%55 güvenli” anlamına gelmez.</p><p>Deprem: araştırma gridindeki PGA değerinin ters yüzdelik sırası. Formül: 100 × [1 − (daha düşük değerli noktalar + eşit değerli noktaların yarısı) / tüm noktalar]. {money(report.hazard.gridRows)} grid noktası kullanıldı. 100 daha düşük, 0 daha yüksek modellenmiş sarsıntı tehlikesi demektir. Mahalle, nüfus veya bina yüzdeliği değildir.</p><p>Güvenlik ve deprem farklı şeyleri değerlendirir. Önce konut tipi ve kira bütçesi seçilir. Seçilen konut tipinde ilan yoksa kira puanı ve genel puan hesaplanmaz; diğer tiplerin fiyatları veya sıfır kira kullanılmaz. Böylece eksik veri, genel puanı yapay olarak yükseltmez.</p></details></section>
      <section id="rent" className="rent-section">
        <div className="section-heading"><div><span className="eyebrow">KİRA VE MALİYET{rentScore != null ? ` · ${rentScore}/100` : ''}</span><h2>Senin bütçene uyuyor mu?</h2></div><a className="text-button" href="#housing-preferences" onClick={() => preferenceForm.current?.querySelector('select')?.focus({ preventScroll: true })}>{preferences ? 'Tercihlerini değiştir' : 'Konut tipi ve bütçe seç'}<ArrowUpRight size={15} /></a></div>
        {preferences && <div className="housing-summary"><div><span>Aradığın konut</span><strong>{roomType}{roomType === '1+0' ? ' · Stüdyo' : ''}</strong></div><div><span>Aylık kira bütçen</span><strong>{money(budget)} TL</strong></div><div><span>Bu tipte ortanca istenen kira</span><strong>{rentMedian == null ? 'İlan örneği yok' : `${money(rentMedian)} TL / ay`}</strong><small>{comparableRents.length} ilan adayı · mahalle ortalaması değildir</small></div></div>}
        {!preferences ? <p className="empty-rent">Kira puanı için yukarıdan aradığın konut tipini ve aylık bütçeni seç.</p> : !comparableRents.length ? <p className="empty-rent" role="status">{roomType} için son 90 günden kaynaklı ilan örneği bulunmuyor. Bu, kiralık ev olmadığı anlamına gelmez. Kira ve genel puan için bu tipe ait örnekler gerekiyor.</p> : <div className="rent-table-wrap"><table className="rent-table"><thead><tr><th>Konut</th><th>İstenen kira</th><th>İlan tarihi</th><th>Kaynak</th></tr></thead><tbody>{comparableRents.map((r, i) => <tr key={i}><td><strong>{r.rooms}</strong><small>Eşyalı daire</small></td><td><strong>{money(r.amount)} TL</strong><small>aylık</small></td><td>{date(r.date)}</td><td><SourceLink url={r.sources[0]?.url} className="table-source">{r.sources[0]?.publisher}</SourceLink></td></tr>)}</tbody></table></div>}
        <p className="section-explanation">Yalnızca seçtiğin konut tipinin ilanları karşılaştırılır. İlan fiyatları arama sonuçlarından geldi; ilanın hâlâ yayında olması ve uzun dönem koşulları kontrol bekliyor. Aidat, faturalar ve depozito dahil değil. Tarihi belirsiz ve 90 günden eski örnekler hesaplamadan çıkarıldı.</p>
      </section>
      <section id="transport" className="transport-section"><div className="section-heading"><div><span className="eyebrow">ULAŞIM · {scores.transport}/100</span><h2>Nereye, hangi hatla?</h2></div></div><p className="section-explanation">Otogar, kampüs, tıp fakültesi ve merkez için bağlantı adayları bulundu. Güncel sefer sıklığı, yolculuk süresi ve son sefer saati henüz doğrulanmadı; çıkmadan önce resmî tarifeyi kontrol et.</p><ScoreEvidence category="transport" /><div className="route-grid">{report.transport.map(r => <article className="route-card" key={r.code}><strong className="route-code">{r.code}</strong><div><h3>{routeDetails[r.code]?.[0]}</h3><p>{routeDetails[r.code]?.[1]}</p><SourceLink url={r.sources[0]?.url}>MUTTAŞ kaynağı · kontrol bekliyor</SourceLink></div></article>)}</div></section>
      <section id="daily-life" className="daily-section"><div className="section-heading"><div><span className="eyebrow">SOSYAL YAŞAM · {scores.social}/100</span><h2>Yemek, buluşmak, dışarı çıkmak</h2></div></div><div className="social-summary"><div><Coffee size={20} /><strong>{count(['restaurant', 'fast_food'])}</strong><span>Yeme içme</span></div><div><UsersRound size={20} /><strong>{count(['pub', 'bar', 'entertainment', 'nightclub'])}</strong><span>Bar / pub / eğlence</span></div><div><ShoppingBasket size={20} /><strong>{count(['supermarket', 'convenience'])}</strong><span>Market</span></div><div><Trees size={20} /><strong>{count(['park'])}</strong><span>Park</span></div></div><p className="section-explanation">Bunlar bulunan örnekler; tüm işletmelerin sayımı değildir. Harita kayıtları, ek web kaynaklarından bulunan pub ve yeme-içme örnekleriyle tamamlandı. Gece kulübü için yeterli kaynaklı örnek henüz yok; “yok” sonucu çıkarılamaz.</p><ScoreEvidence category="social" /><div className="daily-layout"><div className="places-panel"><div className="place-filters" role="group" aria-label="Mekân türü seç">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} aria-pressed={filter === key} onClick={() => { setFilter(key); setShowAll(false); setSelected(null); }}>{label}</button>)}</div><div className="place-list">{(showAll ? matches : matches.slice(0, 6)).map(p => <article className={`place-row ${selected?.id === p.id ? 'selected' : ''}`} key={p.id}><div className="venue-copy"><strong>{p.name}</strong><span>{names[p.category]}{p.distance != null ? ` · ${p.distance} m kuş uçuşu` : ' · Konum doğrulanacak'}</span><small className={p.origin === 'OSM' ? 'origin-osm' : 'origin-web'}>{p.origin === 'OSM' ? 'Harita kaydı' : 'Web kaynağı'} · Güncel açık olma durumu bilinmiyor</small>{p.distance == null && <small>{p.address}</small>}<div className="venue-actions">{p.lat != null && <button onClick={() => setSelected(p)}>Haritada göster<MapPin size={13} /></button>}<SourceLink url={p.url}>{p.origin === 'OSM' ? 'OSM kaydı' : p.sources[0].publisher}</SourceLink></div></div></article>)}</div>{matches.length > 6 && <button className="show-places" onClick={() => setShowAll(!showAll)}>{showAll ? 'Daha az göster' : `${matches.length} örneğin tümünü göster`}</button>}{!matches.length && <p className="section-explanation">Bu tür için henüz kaynaklı örnek yok.</p>}</div><NeighborhoodMap places={matches} selected={selected} onSelect={setSelected} /></div></section>
      <section id="safety" className="safety-section"><div className="section-heading"><div><span className="eyebrow">GÜVENLİK · {scores.news}/100</span><h2>Hangi olaylar biliniyor, ne eksik?</h2></div><ShieldCheck size={26} /></div><p className="section-explanation">Yerel haberler güvenlik değerlendirmesinin kaynaklarından biri. Bulunan olaylar mahalledeki suç oranını veya kişisel güvenliği ölçmüyor. Resmî istatistikler ve saha gözlemleri değerlendirmede eksik kalan noktalar.</p><div className="security-layout"><div>{report.news.map((n, i) => <article className="security-event" key={i}><time>{date(n.date)}</time><h3>{n.text}</h3><span>Kaynak kontrolü bekliyor</span><div>{n.sources.map(s => <SourceLink key={s.url} url={s.url}>{s.publisher}</SourceLink>)}</div></article>)}</div><aside className="missing-data"><h3>Sağlam bir değerlendirme için eksikler</h3><ul><li>Resmî, mahalle ölçeğinde suç istatistikleri</li><li>Gece aydınlatması ve yaya güzergâhları</li><li>Farklı saatlerde saha gözlemi</li><li>Mahalle sakinlerinden temsil gücü olan deneyimler</li></ul><p>Haber bulunmayan bir yer otomatik olarak güvenli sayılmaz.</p></aside></div></section>
      <section id="hazard" className="hazard-section"><div className="section-heading"><div><span className="eyebrow">DEPREM TEHLİKESİ · {scores.hazard}/100</span><h2>0,351 g senin için ne demek?</h2></div><Layers3 size={27} /></div><div className="hazard-content"><div className="hazard-score-block"><strong>{scores.hazard}<small>/100</small></strong><span>Karşılaştırmalı tehlike puanı</span><p>Yüksek puan = daha düşük modellenmiş sarsıntı tehlikesi.</p><div className="hazard-scale"><i style={{ left: `${scores.hazard}%` }} /></div><div className="scale-labels"><span>Daha yüksek tehlike</span><span>Daha düşük tehlike</span></div></div><div><p><strong>0,351 g, yer hareketinin en büyük ivmesini (PGA) ifade eder.</strong> Depremin büyüklüğü veya gerçekleşme tarihi değildir. Veri, 50 yılda %10 aşılma olasılığına göre hazırlanmış araştırma modelinden geliyor.</p><p>Kötekli referans noktası için en yakın grid noktası yaklaşık {report.hazard.gridDistance.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} km uzakta. Bu PGA değeri, veri setindeki noktaların yaklaşık %77’sinden yüksek. Ters yüzdelik sıradan <strong>{scores.hazard}/100</strong> elde ediliyor ve genel puana %{profiles[profile].weights.hazard} ağırlıkla katılıyor.</p><p><strong>Binanın sağlamlığını söylemez.</strong> Bina yaşı, taşıyıcı sistem, zemin ve yapı incelemesi bu puanda yok. Kaynak resmî AFAD TDTH haritası değil; jeodezik bir araştırma veri seti.</p><SourceLink url={report.hazard.url}>{report.hazard.sourceTitle} · kaynağı incele</SourceLink><small className="hazard-credit">{report.hazard.authors.join('; ')} (2025) · CC-BY-SA-4.0. Karşılaştırma puanı MahallEN tarafından bu veriden türetildi.</small></div></div></section>
      <section className="transparency-bar"><div><ShieldCheck size={27} /><div><h2>Her puanın arkasına bakabilirsin.</h2><p>Verinin kaynağı, eksikleri ve hesaplama yöntemi açık.</p></div></div><button className="secondary-button" onClick={() => setSource('all')}>Tüm kaynaklar<ArrowUpRight size={16} /></button></section>
    </main><footer className="site-footer"><a className="footer-brand" href="#top">mahall<span>EN</span></a><p>Muğla pilotu · deneysel değerlendirme<small>© OpenStreetMap contributors · ODbL. Araştırma deprem verisi: CC-BY-SA-4.0.</small></p></footer>
    {source && <Sources category={source} onClose={() => setSource(null)} />}
  </div>;
}
