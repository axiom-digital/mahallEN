import { evaluate, groups } from './reportLogic.mjs';
import { median, agreedWeights } from './scoring.mjs';

const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const age = (date, asOf) => date ? (Date.parse(asOf) - Date.parse(date)) / 86400000 : Infinity;
const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const foodStyles = [
  ['Döner, kebap ve pide', /döner|dürüm|kebap|köfte|pide|lahmacun/i],
  ['Burger, tost ve sandviç', /burger|tost|sandviç/i],
  ['Pizza', /pizza|caesars/i],
  ['Ev yemeği ve çorba', /ev yemek|lokanta|esnaf|çorba/i],
  ['Farklı mutfaklar', /sushi|asya|hint mutfa|çin mutfa|meksika|vegan|vejetaryen/i],
];

export function affordabilityScore(ratio) {
  if (!Number.isFinite(ratio) || ratio < 0) return null;
  const anchors = [[0,100],[.2,100],[.3,80],[.5,50],[.75,25],[1,0]];
  if (ratio >= 1) return 0;
  for (let i=1;i<anchors.length;i++) {
    const [x,y]=anchors[i], [previousX,previousY]=anchors[i-1];
    if (ratio<=x) return clamp(previousY+(y-previousY)*(ratio-previousX)/(x-previousX));
  }
  return 0;
}

// A transparent prototype indicator, not a crime-rate or personal safety estimate.
export function safetyAssessment(news, asOf) {
  const incidents=new Map();
  for(const n of news){
    const days=age(n.date,asOf);
    if(!Number.isFinite(days)||days<0||days>365||!n.sources?.length||!/suç|şiddet|asayiş/.test(n.type))continue;
    const text=n.summary.toLocaleLowerCase('tr-TR');
    const severity=/ölüm|öldür|yaşamını yitir|hayatını kaybet/.test(text)?20:/ateş|silah|bıçak|darp|yarala/.test(text)?10:/hırsız|soygun|gasp/.test(text)?8:0;
    if(!severity)continue;
    const key=`${n.date}:${text.replace(/\W/g,'').slice(0,90)}`;
    incidents.set(key,{id:n.id,summary:n.summary,date:n.date,points:severity*(days>180?.5:1)});
  }
  const evidence=[...incidents.values()].sort((a,b)=>b.points-a.points);
  // Only the two strongest dated incidents contribute: extra press coverage
  // and articles on unrelated infrastructure never multiply the penalty.
  const deduction=(evidence[0]?.points||0)+Math.min(5,evidence[1]?.points||0);
  return {score:evidence.length?clamp(50-deduction):null,baseline:50,deduction,evidence,confidence:'low'};
}

// Explicit project rubric: availability, published service and dated obstacles.
// Unmeasured on-time performance is a pending 20 points, never an invented bonus.
export function categoryEvaluation(report, preferences, reference) {
  const roomType=preferences.roomType==='all'?'1+1':preferences.roomType;
  const analysis=evaluate(report,{...preferences,roomType});
  const rent=affordabilityScore(analysis.median==null?NaN:analysis.median/reference.netMinimumWage.amount);
  const routes=report.routes.filter(r=>r.officialHeadingVerified && !/kontrol edilmeli|bilinmiyor/i.test(r.localEvidence || ''));
  const routeText=routes.map(r=>`${r.route} ${r.localEvidence}`).join(' ');
  const connections=[/otogar/i,/kampüs|üniversite|kyk|yurt/i,/hastane|tıp/i,/avm|şehir içi|şehiriçi|merkez/i].filter(r=>r.test(routeText)).length;
  const schedules=routes.flatMap(r=>r.timetable||[]);
  const weekdays=schedules.map(s=>s.days.weekday).filter(Boolean);
  const spans=weekdays.map(d=>Math.max(...d.times.map(minutes))-Math.min(...d.times.map(minutes)));
  const gaps=weekdays.map(d=>{const times=d.times.map(minutes).sort((a,b)=>a-b);return median(times.slice(1).map((t,i)=>t-times[i]).filter(n=>n>0));}).filter(Number.isFinite);
  const bestGap=gaps.length?Math.min(...gaps):null;
  const serviceSpan=spans.length?Math.max(...spans):0;
  const service=serviceSpan>=16*60?15:serviceSpan>=12*60?10:serviceSpan>0?5:0;
  const frequency=bestGap==null?0:bestGap<=15?15:bestGap<=30?10:bestGap<=60?5:0;
  const night=weekdays.some(d=>d.times.some(t=>minutes(t)>=23*60||minutes(t)<3*60))?10:0;
  const weekend=schedules.some(s=>s.days.saturday?.count && s.days.sunday?.count)?10:0;
  const recent=(report.transportAlerts||[]).filter(a=>age(a.date||(a.status==='official_notice_visible'?a.observedAt:null),reference.asOf)>=0 && age(a.date||(a.status==='official_notice_visible'?a.observedAt:null),reference.asOf)<=90 && a.status!=='completion_reported');
  const roadProblem=recent.some(a=>/çök|giriş yapılam|kapan|ulaşım.*kilit|yol.*çalış|altyapı.*çalış/.test(a.summary.toLocaleLowerCase('tr-TR')));
  const changedRoute=recent.some(a=>/güzerg.h.*düzen|güzerg.h.*değiş|durak.*taş|giriş yapılam/.test(a.summary.toLocaleLowerCase('tr-TR')));
  const penalty=(roadProblem?12:0)+(changedRoute?8:0);
  const baseTransport=routes.length?clamp(connections*7.5+service+frequency+night+weekend-penalty):null;
  const confirmedAccess=(report.transportAlerts||[]).some(a=>a.status==='official_access_restriction' && age(a.observedAt,reference.asOf)>=0 && age(a.observedAt,reference.asOf)<=30);
  const routeAccess=recent.some(a=>a.status==='official_notice_visible' && /giriş yapılam/.test(a.summary.toLocaleLowerCase('tr-TR')));
  // A timetable cannot override an explicitly published access closure.
  const transportCap=confirmedAccess?35:routeAccess?45:100;
  const transport=baseTransport==null?null:Math.min(baseTransport,transportCap);
  const venues=report.venues.filter(v=>v.scope!=='nearby');
  const groupPoints=Object.values(groups).filter(g=>venues.some(v=>g.types.includes(v.type))).length*10;
  const food=venues.filter(v=>groups.food.types.includes(v.type));
  const styles=foodStyles.filter(([,re])=>food.some(v=>re.test(v.name)));
  // Names are a limited clue, not verified menus: at most 10 / 20 food points.
  const cuisine=Math.min(10,styles.length*2);
  const culture=venues.some(v=>groups.culture.types.includes(v.type))?5:0;
  const sport=venues.some(v=>['sports_centre','fitness_centre'].includes(v.type))?3:0;
  const datedActivity=(report.assessments?.social_life||[]).some(f=>f.sources.length && f.sentiment==='positive' && /aktivite|kafe dışı/i.test(f.criterion) && age(f.date,reference.asOf)>=0 && age(f.date,reference.asOf)<=90)?2:0;
  // Regional fares and student cafeteria prices do not prove restaurant affordability.
  const menuPrices=venues.filter(v=>v.menuVerifiedAt && age(v.menuVerifiedAt,reference.asOf)<=90 && v.menuPrices?.length);
  const pricePoints=menuPrices.length>=3?10:menuPrices.length?5:0;
  const social=venues.length?clamp(groupPoints+cuisine+culture+sport+datedActivity+pricePoints):null;
  const hazard=report.hazard.score;
  const safetyReview=safetyAssessment(report.news,reference.asOf);
  const safety=safetyReview.score;
  const scores={rent,transport,social,hazard,safety};
  const weights={...agreedWeights,safety:agreedWeights.news};
  const complete=Object.values(scores).every(Number.isFinite);
  const weight=Object.keys(scores).reduce((n,k)=>n+weights[k],0);
  const overall=complete?clamp(Object.entries(scores).reduce((n,[k,s])=>n+s*weights[k],0)/weight):null;
  return {rent,transport,social,hazard,safety,safetyReview,overall,baseTransport,transportCap,
    transportReasons:[{label:'Günlük hedeflere bağlantı',points:connections*7.5,max:30},{label:'Yayımlanan sefer saatlerinin yayılımı',points:service,max:15},{label:'Tarifedeki sefer aralığı',points:frequency,max:15},{label:'Gece seferi',points:night,max:10},{label:'Hafta sonu seferi',points:weekend,max:10},{label:'Gerçek gecikme ve yolculuk süresi',points:null,max:20},{label:'Son 90 gündeki yol / güzergâh bildirimleri',points:-penalty,max:0}],
    socialReasons:[{label:'Altı farklı sosyal olanak türü',points:groupPoints,max:60},{label:'Yemek çeşitlerine ilişkin ipuçları',points:cuisine,max:20},{label:'Kültür, spor ve tarihli aktiviteler',points:culture+sport+datedActivity,max:10},{label:'Güncel işletme menü fiyatları',points:menuPrices.length?pricePoints:null,max:10}],
    styles, recent, roadProblem, changedRoute,
  };
}
