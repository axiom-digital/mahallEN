import React, { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BusFront, Check, FileText, MapPin, Search } from 'lucide-react';
import data from '../data/gemini-test.json';
import safetyResearch from '../data/safety-research.json';
import ResearchNews from './ResearchNews';
import './gemini-test.css';
import './research-news.css';

const issues = [
  ['Anlam değişmiş', 'Araştırma “asfalt serimine başlandı” diyor; rapor bunu “tamamlandı” olarak aktarıyor.'],
  ['Kaynak eşleştirmesi hatalı', 'Modelin kaynak açıklamaları bazı kaynak kimlikleriyle uyuşmuyor. Aşağıdaki kaynak listesi API’nin gerçek kayıtlarından geliyor.'],
  ['Eski bilgi güncel gibi yazılmış', '2019 tarihli kampüs ring bilgisi raporda tarihini kaybetmiş. Bugünkü hizmet ayrıca teyit edilmeli.'],
  ['Araştırma eksik', 'C kapısının 19 Ekim tarihli kapanma duyurusu araştırmaya girmemiş. Ücret ve taksi bekleme süresi doğrulanmamış.'],
];

export default function GeminiTestReport() {
  const [tab, setTab] = useState('report');
  const [checks, setChecks] = useState({});
  const sources = Object.fromEntries(data.sources.map(s => [s.id, s]));
  function inline(text) {
    return text.split(/(\*\*.*?\*\*|\[S\d+(?:,\s*S\d+)*\])/g).map((part, i) => {
      if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (/^\[S\d/.test(part)) return <span className="gt-citations" key={i}>{part.match(/S\d+/g).map(id => <a key={id} href={`#source-${id}`} title={sources[id]?.title}>{id}</a>)}</span>;
      return part;
    });
  }
  function markdown(text) {
    return text.replace(/^(\*\*[^*\n]+\*\*)[ \t]*$/gm, '$1\n').split(/\n\s*\n/).map((block, i) => {
      const trimmed = block.trim();
      if (/^\*\*[^\n]+\*\*$/.test(trimmed)) return <h2 key={i}>{trimmed.slice(2, -2)}</h2>;
      if (trimmed.startsWith('* ')) return <ul key={i}>{trimmed.split(/\n(?=\* )/).map((line, j) => <li key={j}>{inline(line.replace(/^\*\s+/, ''))}</li>)}</ul>;
      return <p key={i}>{inline(trimmed)}</p>;
    });
  }
  return <div className="gt-page">
    <header className="gt-header"><a href="?" className="gt-brand">Mahall<span>EN</span></a><a href="?"><ArrowLeft size={16} /> Mahalle görünümüne dön</a></header>
    <main className="gt-wrap">
      <div className="gt-kicker"><MapPin size={14} /> Muğla / Menteşe / Kötekli <span>29 Ekim 2026</span></div>
      <section className="gt-hero"><div><span className="gt-tag">GEMINI ARAŞTIRMA DENEMESİ</span><h1>Kötekli’de yaşam,<br />kaynaklar ne söylüyor?</h1><p>Mahalledeki deneyiminle karşılaştır. Asayiş haberleri ve ulaşım raporunu kaynaklarıyla birlikte incele.</p></div><div className="gt-run"><BusFront size={30} /><strong>2.5 Search <span>→</span> 3.5 Flash-Lite</strong><p>Ulaşım raporu hazır · asayiş kaynakları incelendi</p><div><span><b>{safetyResearch.records.length}</b> asayiş / denetim kaydı</span><span><b>29</b> ulaşım kaynak kaydı</span></div></div></section>
      <nav className="gt-topic-nav" aria-label="Araştırma konuları"><a href="#asayis">Asayiş haberleri</a><a href="#ulasim">Ulaşım raporu</a></nav>
      <ResearchNews data={safetyResearch} />
      <aside className="gt-notice"><strong>İnceleme bekleyen test çıktısı</strong><p>Raporda anlam ve kaynak eşleştirme hataları bulundu. Modelin yazdığı metin aşağıda korunuyor; değerlendirme notlarını ayrı sekmeden okuyabilirsin.</p></aside>
      <div className="gt-layout" id="ulasim"><section className="gt-panel"><div className="gt-tabs" role="tablist" aria-label="Rapor görünümü">{[['report', 'Modelin raporu'], ['review', 'İnceleme notları · 4']].map(([id, label]) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); const next = id === 'report' ? 'review' : 'report'; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{label}</button>)}</div>
        <div className="gt-content" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>{tab === 'report' ? markdown(data.report) : <><span className="gt-tag">İLK KALİTE KONTROLÜ</span><h2>Çalıştı; doğruluk hâlâ sınanıyor.</h2>{issues.map(([title, text], i) => <article className="gt-issue" key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}<p>Kaynak kaydı sayısı, bağımsız doğrulanmış bulgu sayısı değildir. Rapordaki bilgileri mahalledeki gözlemlerinle birlikte kontrol ediyoruz.</p></>}</div>
      </section><aside className="gt-sidebar"><section className="gt-checks"><span className="gt-tag">SENİN GÖZÜNDEN</span><h2>Mahallede durum nasıl?</h2><p>Kontrol ettiklerini işaretle; doğru veya yanlış bulduklarını sohbette söyle.</p>{['1-62 ve 1-65 güzergâhları', 'Gece çalışan hatlar', 'Kısmet’e otobüs girişi', 'Gerçekte ödenen ücret', 'C kapısının durumu'].map(label => <label key={label}><input type="checkbox" checked={!!checks[label]} onChange={e => setChecks({ ...checks, [label]: e.target.checked })} /><span>{label}</span></label>)}<small><Check size={13} /> İşaretler bu sayfada kalır; gönderilmez.</small></section><section className="gt-method"><Search size={21}/><h3>Bu deneme nasıl üretildi?</h3><p>Gemini 2.5 Flash, Google Search ile araştırdı. 3.5 Flash-Lite aynı araştırmayı rapora dönüştürdü.</p><p>Sayfayı açmak yeni bir API çağrısı yapmaz.</p></section></aside></div>
      <section className="gt-sources"><span className="gt-tag">KAYNAK İZİ</span><h2>Aramada dönen kaynak kayıtları</h2><p>Bir atfın doğru iddiayı desteklediğini kaynağı açarak kontrol et. Bunlar API’nin kaynak kayıtlarıdır.</p><div>{data.sources.map(s => <a id={`source-${s.id}`} href={s.url} target="_blank" rel="noopener noreferrer" key={s.id}><span>{s.id}</span><strong>{s.title}</strong><ArrowUpRight size={17}/></a>)}</div></section>
      <footer className="gt-footer"><FileText size={15}/> Araştırma adayı · Otomatik doğrulama onayı değildir</footer>
    </main>
  </div>;
}
