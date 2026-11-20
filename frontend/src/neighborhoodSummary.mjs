import { evaluate, groups } from './reportLogic.mjs';

const format = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);
const newest = rows => [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// Summaries describe the records we have; counts never stand in for quality.
export function neighborhoodSummary(report, preferences, reference) {
  const room = preferences.roomType === 'all' ? '1+1' : preferences.roomType;
  const rent = evaluate(report, { ...preferences, roomType: room });
  const prices = rent.dated.map(r => r.amount);
  const percent = rent.median == null ? null : Math.round(rent.median / reference.netMinimumWage.amount * 100);
  const range = prices.length ? `${format(Math.min(...prices))}–${format(Math.max(...prices))} TL` : 'Güncel fiyat net değil';
  const rentText = prices.length
    ? `${room} için ${prices.length} tarihli ilanda ortanca kira ${format(rent.median)} TL. Tek net asgari ücretin %${percent}’i yalnızca kiraya gider; faturalar ve yemek hariç.`
    : `${room} için tarihi ve mahalle bilgisi uygun kira örneği yok. Tarihsiz ilanlardan güncel fiyat sonucu çıkarılamıyor.`;
  const alerts = newest((report.transportAlerts || []).filter(a => a.date));
  const alert = alerts[0];
  const destinations = evaluate(report, preferences).destinations.filter(d => d.found).map(d => d.label);
  const transportText = alert
    ? `${alert.summary}${/[.!?]$/.test(alert.summary) ? '' : '.'} ${alert.affected && !alert.summary.includes(alert.affected) ? `${alert.affected}. ` : ''}Bugünkü etkisi teyit edilmedi.`
    : `${report.routes.length} kaynaklı hat bulundu${destinations.length ? `; ${destinations.join(', ').toLocaleLowerCase('tr-TR')} bağlantıları listeleniyor` : ''}. Kapıdan kapıya yolculuk süresi ve gecikme bilgisi yok.`;
  const example = key => report.venues.find(v => groups[key].types.includes(v.type) && v.scope !== 'nearby');
  const socialExamples = ['food', 'nightlife', 'outdoors'].map(example).filter(Boolean);
  const socialText = socialExamples.length
    ? socialExamples.map(v => `${v.name} (${v.type === 'park' ? 'park' : groups.nightlife.types.includes(v.type) ? 'gece hayatı' : groups.food.types.includes(v.type) ? 'yeme içme' : 'açık hava'})`).join('; ') + '. Menü fiyatları ve açık oldukları saatler her mekân için bilinmiyor.'
    : 'Mekân listesi, sosyal hayatı değerlendirmek için yeterince çeşitli değil. Güncel menü ve etkinlik bilgisi eksik.';
  const crimes = newest(report.news.filter(n => /suç|şiddet/.test(n.type) && n.date));
  const safetyText = crimes.length
    ? `${crimes[0].summary} Bu tekil haberden mahallenin suç oranı veya gece güvenliği çıkarılamaz.`
    : 'Mahalleye ait karşılaştırılabilir suç oranı ve gece aydınlatması ölçümü yok. Mevcut duyuru ve etkinlikler “güvenli” sonucu vermek için yeterli değil.';
  const higherThan = Number.isFinite(report.hazard.score) ? 100 - report.hazard.score : null;
  const dailyLifeText = [
    destinations.length ? `Kaynaklarda ${destinations.join(', ').toLocaleLowerCase('tr-TR')} için otobüs bağlantıları var.` : 'Günlük ulaşım bağlantıları hakkında bilgi sınırlı.',
    socialExamples.length ? `${socialExamples.map(v => v.name).join(', ')} çevrede bulunan seçeneklerden.` : 'Mekân bilgileri henüz sınırlı.',
    alert ? `${alert.date.split('-').reverse().join('.')} tarihli yol / güzergâh bildirimini ev aradığın konumla birlikte incele.` : 'İşe veya okula yolculuk süresi henüz ölçülmedi.',
  ].join(' ');
  return { room, rent, percent, range, rentText, alert, transportText, socialText, crimes,
    safetyText, higherThan, dailyLifeText,
    hazardText: higherThan == null ? 'Araştırma karşılaştırması bulunmuyor.' : `Araştırma modelinde sarsıntı tehlikesi, grid noktalarının yaklaşık %${higherThan}’inden yüksek. Bu karşılaştırma binanın sağlamlığını göstermez.`,
    socialExamples,
  };
}
