import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Bus, MapPin, RefreshCw, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import VenueMap from './VenueMap';

const categories = [
  { key: 'rent_cost', score: 'cost_affordability', title: 'Maliyet', Icon: Wallet },
  { key: 'social_life', score: 'social_life', title: 'Sosyal yaşam', Icon: Users },
  { key: 'safety_news', score: 'safety', title: 'Haberler', Icon: ShieldCheck },
  { key: 'earthquake_hazard', score: 'disaster_resilience', title: 'Deprem verisi', Icon: Activity },
  { key: 'transportation', score: 'transportation', title: 'Ulaşım', Icon: Bus },
];
function atPlace(name) {
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g) || ['e'];
  const suffix = `${/[fstkçşhp]$/i.test(name) ? 't' : 'd'}${/[aıou]/.test(vowels.at(-1)) ? 'a' : 'e'}`;
  return `${name}’${suffix}`;
}
const currency = value => value == null ? 'Karşılaştırma yok' : `${Number(value).toLocaleString('tr-TR')} TL`;

function Sources({ item }) {
  const unique = [...new Map((item.sources || []).map(source => [source.url, source])).values()];
  return <div className="reading-source-links">{unique.slice(0, 2).map(source =>
    <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title && !source.title.startsWith('http') ? source.title : new URL(source.url).hostname} <ArrowUpRight size={12} /></a>)}
    {unique.length > 2 && <details><summary>{unique.length - 2} kaynak daha</summary>{unique.slice(2).map(source =>
      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title || new URL(source.url).hostname} ↗</a>)}</details>}
  </div>;
}

function CategoryDialog({ children, onClose, title }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className="neighborhood-category-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>{children}</dialog>;
}

export default function AssessedReport({ report, onRefreshAi, refreshing }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [room, setRoom] = useState('1+1');
  const [venueKind, setVenueKind] = useState('Tümü');
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [profile, setProfile] = useState('students');
  const assessment = report.assessment;
  const calculation = assessment.calculation || {};
  const briefing = assessment.briefing || {};
  const roomGroups = briefing.rent_types || [];
  const roomGroup = roomGroups.find(group => group.rooms === room) || roomGroups[0];
  const venues = useMemo(() => (briefing.venues || []).filter(venue => venueKind === 'Tümü' || venue.kind === venueKind), [briefing.venues, venueKind]);
  const counts = calculation.counts || {};
  const weekdayService = (briefing.routes || []).flatMap(route => (route.timetable || []).filter(schedule => schedule.days?.weekday).map(schedule => ({code:route.code,...schedule}))).sort((a,b) => b.days.weekday.count - a.days.weekday.count)[0];
  const evidence = report.evidence_report;
  const narrative = report.ai_report || {};
  const paragraphs = (narrative.executive_summary || '').split(/\n+/).filter(Boolean);
  const selected = categories.find(category => category.key === activeCategory);
  const categoryItems = key => evidence.categories.find(category => category.id === key)?.items || [];
  const findings = evidence.categories.find(category => category.id === activeCategory)?.items || [];
  const rationale = key => assessment.categories.find(category => category.category === key)?.rationale;
  const date = new Date(`${evidence.reference_date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  function openCategory(key) {
    setActiveCategory(key);
    setShowAllFindings(false);

  }
  return <div className="report-dashboard-wrapper reading-report" data-testid="report-dashboard">
    <header id="rapor-detay" className="neighborhood-intro">
      <div><span className="neighborhood-breadcrumb"><MapPin size={13} />{report.city} / {report.district}</span>
        <h1 id="report-title">{atPlace(report.name)} yaşam</h1>
        {roomGroup?.listings?.length > 0 && <button className="report-housing-fact" type="button" onClick={() => openCategory('rent_cost')}><Wallet size={16}/><span><b>{roomGroup.rooms} ilan örnekleri</b> · {currency(Math.min(...roomGroup.listings.map(item => item.amount)))} – {currency(Math.max(...roomGroup.listings.map(item => item.amount)))}</span><ArrowUpRight size={14}/></button>}
        <div className="neighborhood-meta"><span>{date} · kaynak kontrolü</span><span>{counts.venues || 0} mekân</span><span>{counts.routes || 0} resmî hat</span></div>
      </div>
      <aside className="report-overall-panel" aria-label="Genel değerlendirme">
        <span className="eyebrow">{assessment.partial ? 'GENEL ÖN PUAN' : 'GENEL PUAN'}</span>
        <div className="overall-score-ring" style={{'--score-angle': `${(report.scores.overall_livability || 0) * 3.6}deg`}}>
          <strong data-testid="overall-score">{report.scores.overall_livability ?? '—'}<small>/100</small></strong>
        </div>
        <p className="overall-coverage">{assessment.coverage}/5 kategoriye dayanıyor</p>
        {assessment.partial && <p className="overall-missing">{(assessment.missing_categories || []).map(key => categories.find(category => category.key === key)?.title).filter(Boolean).join(', ')} hesaba katılmadı.</p>}
        <a href="#report-method" onClick={event => { event.preventDefault(); const method = document.getElementById('report-method'); if (method) { method.open = true; method.scrollIntoView({behavior:'smooth',block:'start'}); } }}>Puan nasıl hesaplandı? <ArrowUpRight size={13}/></a>
      </aside>
    </header>

    <section className="neighborhood-overview" aria-label="Mahalle kategori puanları"><div className="neighborhood-section-title"><div><span className="eyebrow">BEŞ SORUDA MAHALLE</span><h3>Günlük hayatın nasıl olur?</h3></div><span>Ayrıntılar için bir başlık seç.</span></div>
      <div className="neighborhood-answer-grid">{categories.map(({key, score, title, Icon}) => {
        const items = categoryItems(key);
        const value = report.scores[score];
        const heading = key === 'rent_cost' ? (roomGroup?.listings?.length ? `${roomGroup.rooms} konut örnekleri` : 'Konut seçenekleri')
          : key === 'social_life' ? (briefing.venues?.slice(0, 2).map(v => v.name).join(' · ') || 'Günlük ihtiyaçlar ve mekânlar')
          : key === 'transportation' ? (briefing.routes?.map(r => r.code).filter(Boolean).slice(0, 4).join(' · ') || 'Hatlar ve duraklar')
          : key === 'earthquake_hazard' ? (briefing.hazard?.value != null ? `${briefing.hazard.value} g · PGA` : 'Zemin ve deprem kaynakları')
          : /silahlı saldırı/i.test(items[0]?.text || '') ? 'Silahlı saldırı haberi' : 'Tarihli yerel gelişmeler';
        const text = key === 'transportation' && weekdayService ? `${weekdayService.code} · ${weekdayService.direction}: hafta içi ${weekdayService.days.weekday.first}–${weekdayService.days.weekday.last}. Uç duraktan hareket saatleri.`
          : key === 'social_life' ? `${counts.venues || 0} kaynaklı mekân. Kafe, market ve açık alan seçeneklerini adresleriyle incele.`
          : key === 'rent_cost' ? (roomGroup?.listings?.length ? `${roomGroup.listings.length} ilanı oda tipi, tarih ve istenen bedeliyle karşılaştır.` : items[0]?.text)
          : key === 'earthquake_hazard' && briefing.hazard?.value != null ? 'Akademik gridin temsil noktasındaki sarsıntı tehlikesi; binanın dayanıklılığı değildir.'
          : items[0]?.text || 'Bu başlık için mahalleye ait yeterli kaynak henüz bulunamadı.';
        return <button key={key} type="button" className={`neighborhood-answer answer-${key}`} onClick={() => openCategory(key)} data-testid={`card-${score}`} aria-haspopup="dialog">
          <div className="answer-label"><Icon size={18}/><span>{title}</span></div><div className={`answer-score ${value == null ? 'is-unavailable' : ''}`} data-testid={`score-${score}`}>{value != null ? <><strong>{value}</strong><span>/100</span></> : <span>Veri eksik</span>}</div>
          <h4>{heading}</h4><p>{text}</p><span className="answer-action">{key === 'rent_cost' ? 'İlanları gör' : key === 'social_life' ? 'Mekânları keşfet' : key === 'transportation' ? 'Hatları incele' : 'Kaynakları incele'}<ArrowUpRight size={14}/></span>
        </button>;
      })}</div>
    </section>

    {selected && <CategoryDialog title={`${selected.title} · ${report.name}`} onClose={() => setActiveCategory(null)}><section id="category-evidence" className="report-synthesis-card reading-category-panel" aria-label={`${selected.title} ayrıntıları`}>
      <div className="synthesis-header"><div><span className="eyebrow">YAKINDAN BAK</span><h3>{selected.title}</h3></div>
        <button className="reading-close" type="button" aria-label="Kategori ayrıntılarını kapat" onClick={() => setActiveCategory(null)}><X size={20} /></button></div>
      {activeCategory === 'rent_cost' && roomGroups.length > 0 ? <>
        <div className="reading-filter-row" role="group" aria-label="Konut tipi">{roomGroups.map(group => <button type="button" key={group.rooms} className={roomGroup?.rooms === group.rooms ? 'active' : ''} onClick={() => setRoom(group.rooms)}>{group.rooms}</button>)}</div>
        {roomGroup.sample_count > 0 ? <div className="reading-rent-summary"><div><span>İlan medyanı</span><strong>{currency(roomGroup.median)}</strong></div><div><span>Karşılaştırılabilir örnek</span><strong>{roomGroup.sample_count}</strong></div><div><span>İstenen fiyat aralığı</span><strong>{roomGroup.min === roomGroup.max ? currency(roomGroup.min) : `${currency(roomGroup.min)} – ${currency(roomGroup.max)}`}</strong></div></div>
          : <div className="reading-listing-intro"><h4>{roomGroup.rooms} · {roomGroup.listings.length} kaynaklı ilan</h4><p>İstenen bedelleri ve ilan tarihlerini aşağıda inceleyebilirsin. Aylık karşılaştırma için tarih ve ödeme koşulları yeterince doğrulanmadığından medyan hesaplanmadı.</p></div>}
        <p className="reading-map-caption">İlanlardaki istenen bedeller; gerçekleşmiş kira veya mahalle ortalaması değildir. Maliyet puanında yalnız karşılaştırmaya uygun 1+1 örnekleri kullanılır.</p>
        <div className="reading-listings">{roomGroup.listings.map((listing, i) => <article key={i}><div><strong>{currency(listing.amount)}</strong><span>{listing.rooms} · {listing.date || 'Tarih belirsiz'}</span></div><span className="reading-listing-status">{listing.comparable ? 'Tarihli örnek' : 'Karşılaştırma dışında'}</span><Sources item={listing} /></article>)}</div>
      </> : activeCategory === 'social_life' && briefing.venues?.length > 0 ? <>
        <div className="reading-filter-row" role="group" aria-label="Mekân türü">{['Tümü', ...new Set(briefing.venues.map(venue => venue.kind))].map(kind => <button type="button" key={kind} className={venueKind === kind ? 'active' : ''} onClick={() => { setVenueKind(kind); setSelectedVenue(null); setShowAllFindings(false); }}>{kind}</button>)}</div>
        <div className={`reading-social-layout ${venues.some(v => Number.isFinite(v.lat) && Number.isFinite(v.lon)) ? 'has-map' : 'without-map'}`}><div className="reading-venue-list">{(showAllFindings ? venues : venues.slice(0, 6)).map(venue => <article key={venue.id} className={venue.id === selectedVenue ? 'is-selected' : ''}><span className="eyebrow">{venue.kind}</span><h4>{venue.name}</h4><p>{venue.address || 'Açık adres için kaynağı incele.'}</p>{venue.scope === 'reference_radius' && <small>Referans noktasının 1 km çevresinde</small>}<Sources item={venue} />{Number.isFinite(venue.lat) && Number.isFinite(venue.lon) && <button className="reading-detail-button" type="button" onClick={() => setSelectedVenue(venue.id)}>Haritada göster <MapPin size={14} /></button>}</article>)}{venues.length > 6 && <button className="reading-detail-button" type="button" onClick={() => setShowAllFindings(!showAllFindings)}>{showAllFindings ? 'Daha az göster' : `${venues.length} mekânın tamamını göster`}</button>}</div>{venues.some(v => Number.isFinite(v.lat) && Number.isFinite(v.lon)) && <VenueMap venues={venues} selected={selectedVenue} onSelect={setSelectedVenue} />}</div>
      </> : activeCategory === 'transportation' && briefing.routes?.length > 0 ? <>
        <div className="reading-route-list">{briefing.routes.map((route, i) => <article key={i}><span className="reading-route-code">{route.code || 'Hat'}</span><div><h4>{route.route}</h4><p>{route.local_evidence}</p>{route.timetable?.map((schedule, j) => <details className="published-timetable" key={j}><summary>{schedule.direction} · yayımlanmış saatler</summary><p>Uç duraktan hareket saatleri; mahalleden geçiş veya canlı bekleme süresi değildir.</p><div className="timetable-day-grid">{Object.entries(schedule.days).map(([day, service]) => <div key={day}><h5>{({weekday:'Hafta içi',saturday:'Cumartesi',sunday:'Pazar'})[day] || day}</h5><strong>{service.first} – {service.last}</strong><span>{service.count} yayımlanmış hareket</span><div className="timetable-times">{service.times.map((time, k) => <span key={k}>{time}</span>)}</div></div>)}</div></details>)}<Sources item={route} /></div></article>)}</div>
        {briefing.transport_notices?.length > 0 && <details className="reading-notices"><summary>Tarihli yol ve erişim duyuruları · {briefing.transport_notices.length}</summary><p>Bu kayıtlar yayınlandıkları tarihteki durumu anlatır; çalışmaların bugün sürdüğü varsayılmaz.</p>{briefing.transport_notices.map((notice, i) => <article className="reading-finding" key={i}><time>{notice.date || (notice.observed_at ? `${notice.observed_at} tarihinde sayfada görüldü` : 'Yayın tarihi belirtilmemiş')}</time><p>{notice.text}</p><Sources item={notice} /></article>)}</details>}
      </> : <>
        {findings.length ? (showAllFindings ? findings : findings.slice(0, 4)).map((item, index) => <article className="reading-finding" key={index}><p>{item.text}</p>{item.date && <time dateTime={item.date}>{item.date}</time>}<Sources item={item} />{item.note && <details className="reading-item-note"><summary>Bu kaydın kapsamı</summary><p>{item.note}</p></details>}</article>) : <p>Bu başlık için yeterli kaynaklı bilgi bulunmuyor.</p>}
        {findings.length > 4 && <button type="button" className="reading-detail-button" onClick={() => setShowAllFindings(!showAllFindings)}>{showAllFindings ? 'Daha az göster' : `${findings.length} bulgunun tamamını göster`}</button>}
      </>}
      <details className="method-details"><summary>Bu kategori puanı nasıl hesaplandı?</summary><p>{rationale(activeCategory)}</p></details>
    </section></CategoryDialog>}

    <section className="report-synthesis-card reading-narrative" aria-label="Mahalle değerlendirmesi">
      <div className="synthesis-header"><div><span className="eyebrow">MAHALLEYE BİR BAKIŞ</span><h3>{atPlace(report.name)} yaşam</h3></div>
        {onRefreshAi && <button type="button" className="refresh-report-btn" disabled={refreshing} onClick={onRefreshAi}>
          <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} /><span>{refreshing ? 'Yükleniyor…' : 'Yeniden yükle'}</span></button>}
      </div>
      <div className="synthesis-summary">{paragraphs.slice(0, 1).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
      {paragraphs.length > 1 && <details className="reading-full-report"><summary>Raporun tamamını oku</summary><div className="synthesis-summary">{paragraphs.slice(1).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></details>}
      <div className="pros-cons-grid">
        {narrative.pros?.length > 0 && <div className="pros-box"><h4>Öne çıkanlar</h4><ul>{narrative.pros.slice(0, 2).map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
        {narrative.cons?.length > 0 && <div className="cons-box"><h4>Dikkat etmen gerekenler</h4><ul>{narrative.cons.slice(0, 2).map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
      </div>
    </section>

    <section className="neighborhood-profile" aria-label="Yaşam profiline göre değerlendirme"><div><span className="eyebrow">SENİN ÖNCELİĞİN</span><h3>Hayatına nasıl uyar?</h3></div><div className="profile-answer"><div className="reading-filter-row" role="group" aria-label="Rapor yaşam profili">{[['students','Öğrenci'],['families','Aile'],['professionals','Çalışan']].map(([key,label]) => <button key={key} type="button" aria-pressed={profile === key} className={profile === key ? 'active' : ''} onClick={() => setProfile(key)}>{label}</button>)}</div><p>{narrative[({students:'student_verdict',families:'family_verdict',professionals:'professional_verdict'})[profile]]}</p>{report.suitability[profile] != null && <small>Profil ön puanı · {report.suitability[profile]}/100</small>}</div></section>

    <details id="report-method" className="methodology-footer-card reading-methodology"><summary>Kaynaklar, kapsam ve puanlama</summary>
      <p>{assessment.methodology}</p>
      <p>Kaynak dönemi: {date}. Haber göstergesi suç oranı, PGA göstergesi bina dayanıklılığı değildir. Eksik kategoriler sıfır sayılmaz.</p>
      {categories.map(category => <details className="method-details" key={category.key}><summary>{category.title}</summary>
        <p>{rationale(category.key)}</p><button className="reading-detail-button" type="button" onClick={() => openCategory(category.key)}>Bulguları ve kaynakları incele <ArrowUpRight size={14} /></button></details>)}
      {evidence.limitations?.map((limitation, i) => <p key={i}>{limitation}</p>)}
    </details>
    <p className="reading-disclaimer">Puanlar kaynaklı proje göstergeleridir. Ev seçerken kaynağın tarihini ve evin kendi koşullarını birlikte değerlendir.</p>
  </div>;
}
