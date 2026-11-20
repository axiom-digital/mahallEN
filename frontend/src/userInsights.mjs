import { groups } from './reportLogic.mjs';
import { foodStyles } from './categoryEvaluation.mjs';

const names = rows => [...new Set(rows.map(v => v.name))].slice(0,4).join(', ');
const shortDate = d => new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long'}).format(new Date(`${d}T12:00:00+03:00`));

export function userInsights(report, summary, scores) {
  const venues=report.venues.filter(v=>v.scope!=='nearby');
  const select = key => venues.filter(v=>groups[key].types.includes(v.type));
  const food=select('food'), coffee=select('coffee'), night=select('nightlife'), outside=select('outdoors'), culture=select('culture');
  const mealStyles=foodStyles.map(([label,re])=>({label,rows:food.filter(v=>re.test(v.name))})).filter(g=>g.rows.length).sort((a,b)=>b.rows.length-a.rows.length);
  const majority=food.length+coffee.length >= (food.length+coffee.length+night.length+culture.length)*.65;
  const socialTitle=majority?'Kafe ve yeme içme ağırlıklı':night.length?'Yemek ve gece hayatı bir arada':'Günlük ihtiyaçlar ve açık hava';
  const socialText=majority
    ? `Bulunan seçeneklerde kafeler ve yeme içme mekânları öne çıkıyor.${mealStyles[0]?.rows.length>=3?` Yemek tarafında ${mealStyles[0].label.toLocaleLowerCase('tr-TR')} belirgin.`:''} Mekân sayısının çokluğu, her mutfaktan seçenek olduğu anlamına gelmiyor.`
    : 'Restoran ve kafelerin yanında akşam dışarı çıkmak ve açık havada vakit geçirmek için de seçenekler var.';
  const socialPoints=[
    food.length?`Yemek: ${names(mealStyles[0]?.rows.length>=3?mealStyles[0].rows:food)}.`:null,
    coffee.length?`Kahve ve buluşma: ${names(coffee)}.`:null,
    night.length?`Bar / pub / müzik: ${names(night)}.`:null,
    outside.length?`Açık hava: ${names(outside)}.`:null,
    culture.length?`Kültür ve etkinlik alanları: ${names(culture)}.`:null,
  ].filter(Boolean);
  const alerts=scores.recent;
  const site=alerts.find(a=>a.status==='official_notice_visible' && /1-62/.test(a.affected) && /giriş/.test(a.summary.toLocaleLowerCase('tr-TR'))) || alerts.find(a=>/1-62/.test(a.affected)&&/giriş/i.test(a.summary));
  const detour=alerts.find(a=>/güzerg.h.*düzen|güzerg.h.*değiş/i.test(a.summary));
  const collapse=alerts.find(a=>/çök/i.test(a.summary));
  const works=alerts.find(a=>/çalış/i.test(a.summary) && a.status!=='completion_reported');
  const transportPoints=[];
  const reviewed=(report.transportAlerts||[]).filter(a=>['reviewed_project_schedule','official_access_restriction'].includes(a.status));
  for(const a of reviewed)transportPoints.push(a.summary);
  if(site)transportPoints.push(site.status==='official_notice_visible'?`MUTTAŞ’ın 1-62 sayfasındaki uyarıya göre yol çalışması nedeniyle Kısmet Sitesi olarak belirtilen seferlerde siteye giriş yapılamıyor. Otobüs siteye girmediği için ineceğin durak ve yürüme mesafen önemli. Uyarı ${shortDate(site.observedAt)}’de resmî sayfada görüldü.`:`Yol çalışması nedeniyle 1-62’nin Kısmet Sitesi olarak belirtilen seferlerinde siteye giriş yapılamadığı duyuruldu (${shortDate(site.date)}). Bu seferi kullanırken ineceğin durağa dikkat et.`);
  if(detour)transportPoints.push(/yurt/i.test(`${detour.summary} ${detour.affected}`)?`Yurtlar bölgesinde duraklara erişimi kolaylaştırmak için güzergâh düzenlemesi yapıldı (${shortDate(detour.date)}). Dönüşte hangi durakta ineceğini hat sayfasından kontrol et.`:`${shortDate(detour.date)}: ${detour.summary}`);
  if(collapse)transportPoints.push(`${collapse.affected} noktasında yol çökmesi bildirildi (${shortDate(collapse.date)}). Yağışlı havada bu bağlantıyı kullanırken dikkat gerekiyor.`);
  if(!site && works)transportPoints.push(`${shortDate(works.date)} tarihli haberde ${works.summary.replace(/\.$/,'')} Bu güzergâhtan geçiyorsan yol durumunu çıkmadan kontrol et.`);
  const routeExamples=report.routes.filter(r=>!/(?:kontrol edilmeli|bilinmiyor)/i.test(r.localEvidence||'')).slice(0,3).map(r=>`${r.code}: ${r.route}`);
  const transportTitle=scores.roadProblem||scores.changedRoute?'Yol işleri ve güzergâh değişiklikleri':report.routes.length>2?'Birden fazla otobüs bağlantısı var':'Hat seçeneği sınırlı görünüyor';
  const transportText=(scores.roadProblem||scores.changedRoute)
    ? 'Otobüs bağlantıları var; fakat yol ve altyapı işleri bazı yol ve durak bağlantılarında ulaşımı etkiledi. Hat numarası aynı kalsa da kullanacağın durak değişebiliyor.'
    : `${routeExamples.join('; ')}.${routeExamples.length?' Günlük yolculuğunda evin bu hatların duraklarına yakınlığı önemli.':' Evin yakınındaki durakları adres üzerinden kontrol etmek gerekiyor.'}`;
  const localEvents=[...report.news].filter(n=>n.date && /suç|şiddet|asayiş/.test(n.type)).sort((a,b)=>b.date.localeCompare(a.date));
  const safetyExamples=[];const types=new Set();
  for(const n of localEvents){safetyExamples.push(`${shortDate(n.date)}: ${n.summary}`);if(safetyExamples.length===3)break;}
  const publicSafety=localEvents.filter(n=>/suç|şiddet|asayiş|yangın|trafik/.test(n.type));
  const safetyTitle=publicSafety.some(n=>/ateş|silah/.test(n.summary))?'Silahlı olay haberleri dikkat çekiyor':publicSafety.length?'Yerel asayiş olayları':'Asayiş için araştırma sürüyor';
  const safetyText=publicSafety.length
    ? 'Son 12 aydaki asayiş haberleri aşağıda. Bu olaylar mahalle genelindeki suç sıklığını göstermiyor; gece güvenliğine ilişkin alan araştırması ayrıca gerekiyor.'
    : 'Asayiş hakkında değerlendirme yapmaya yetecek yerel kayıt bu taramada yok. Yol çalışması ve ev yangını gibi olaylar ayrı gelişmeler bölümünde tutuluyor.';
  const rentTitle=summary.percent==null?'İlanları tek tek karşılaştırmak gerekiyor':summary.percent>=75?'Tek başına kiralamak pahalı':summary.percent>=50?'Kira gelirde büyük yer tutuyor':'Kira yükü görece daha hafif';
  const rentText=summary.rent.median
    ? `${summary.room} örnekleri ${summary.range}. Tipik örnek ${new Intl.NumberFormat('tr-TR').format(summary.rent.median)} TL. Tek net asgari ücretle bu kirayı ödeyince ${summary.percent>=100?'maaş kiraya yetmiyor':`yemek, faturalar ve diğer giderler için maaşın yalnızca yaklaşık %${100-summary.percent}’lik bölümü kalıyor`}.`
    : `${summary.room} ilanları var; fakat tarihler net olmadığı için bu fiyatları güncel mahalle fiyatı gibi sunmuyoruz. İlan listesinden fiyatı, eşyayı ve kontrat süresini birlikte karşılaştırabilirsin.`;
  return {socialTitle,socialText,socialPoints,transportTitle,transportText,transportPoints,routeExamples,safetyTitle,safetyText,safetyExamples,rentTitle,rentText,
    lead:`${socialTitle}. ${scores.roadProblem||scores.changedRoute?'Yol ve altyapı çalışmaları ulaşımda dikkat etmen gereken konu. ':''}${summary.percent>=75?'Kira ise tek başına yaşayan biri için ağır bir gider.':'Ev seçerken durak ve günlük ihtiyaç noktalarına yakınlığı birlikte değerlendir.'}`};
}
