import React, { useState } from 'react';
import { ArrowUpRight, Newspaper } from 'lucide-react';

const dateLabel = value => value ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(`${value}T12:00:00Z`)) : 'Belirtilmemiş';
const titleCase = value => value.split(' ').map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1)).join(' ');
const safeHref = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } };

export default function ResearchNews({ data, sectionId = 'asayis' }) {
  const [period, setPeriod] = useState('recent');
  const [category, setCategory] = useState('all');
  const records = data.records || [];
  const sources = Object.fromEntries(data.sources.map(s => [s.id, s]));
  const categories = [...new Set(records.map(r => r.category))];
  const visible = records.filter(r => (period === 'all' || r.period === period) && (category === 'all' || r.category === category))
    .sort((a, b) => (b.event_date || b.publication_date || '').localeCompare(a.event_date || a.publication_date || ''));
  const counts = key => records.filter(r => key === 'all' || r.period === key).length;
  return <section className="rn-section" id={sectionId}>
    <header className="rn-heading"><div><span className="gt-tag">MAHALLE GÜNDEMİ · ASAYİŞ</span><h2>{titleCase(data.specification.target.neighborhood)} haberlerini incele</h2><p>{data.summary}</p></div><Newspaper size={29} /></header>
    <div className="rn-scope"><span><b>{records.length}</b> farklı haber kaydı</span><span><b>{records.filter(r => r.category === 'denetim').length}</b> denetim kaydı</span><span>Tarama: <b>{dateLabel(data.specification.as_of)}</b></span></div>
    <p className="rn-context">Denetimler ve suç olmadığı açıklanan olaylar ayrı etiketlenir. Olay tarihi doğrulanamayan kayıtlarda dönem, haberin yayın tarihine göre belirlenir.</p>
    {data.status === 'sources_ready_synthesis_deferred' && <p className="rn-context"><strong>Kaynak başlıkları gösteriliyor.</strong> AI özeti servis yoğunluğu nedeniyle bekliyor. Başlıklar doğrudan haber sayfalarından alındı.</p>}
    <div className="rn-filters"><div role="group" aria-label="Haber dönemi">{[['recent','Son 90 gün'],['history','Önceki dönem'],['undated','Tarihsiz'],['all','Son 12 ay']].map(([key, label]) => <button key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}<span>{counts(key)}</span></button>)}</div><label>Olay türü<select aria-label="Asayiş olay türü" value={category} onChange={e => setCategory(e.target.value)}><option value="all">Tüm türler</option>{categories.map(c => <option key={c} value={c}>{titleCase(c)}</option>)}</select></label></div>
    <div className="rn-grid">{visible.map(record => <article className="rn-card" key={record.id}><div className="rn-card-top"><span className={record.category === 'denetim' ? 'rn-type neutral' : 'rn-type'}>{record.category}</span><span>{record.period === 'recent' ? 'Son 90 gün' : record.period === 'history' ? 'Geçmiş kayıt' : 'Tarih belirsiz'}</span></div><h3>{record.title}</h3><p>{record.summary}</p><div className="rn-dates"><span>Yayın: <time>{dateLabel(record.publication_date)}</time></span>{record.event_date && <span>Olay tarihi: {dateLabel(record.event_date)}</span>}</div><div className="rn-links">{record.source_ids.map(id => { const source = sources[id]; return source && <a key={id} href={safeHref(source.url)} target="_blank" rel="noopener noreferrer">{source.publisher || source.title}<ArrowUpRight size={14}/></a>; })}</div><details><summary>Konum ve tarih incelemesi</summary><p>{record.uncertainty}</p><p>Kaynak haber gövdesinde il, ilçe ve mahalle bağlantısı ile alıntı eşleşmesi kontrol edildi. Bu, resmî olay/suç istatistiği değildir.</p></details></article>)}</div>
    {!visible.length && <div className="rn-empty"><h3>Bu filtrede incelenmiş kayıt yok.</h3><p>Bu durum olay yaşanmadığı anlamına gelmez. Diğer dönem veya türleri inceleyebilirsin.</p><button onClick={() => { setPeriod('all'); setCategory('all'); }}>Son 12 ayın kayıtlarını göster</button></div>}
    {!!data.gaps?.length && <details className="rn-gaps"><summary>Haberler nasıl seçildi?</summary><ul>{data.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul><p>Aynı kaynak bağlantıları birleştirildi. Tarih aralığı dışındaki ve mahalle bağlantısı desteklenmeyen kaynaklar listeye alınmadı.</p></details>}
  </section>;
}
