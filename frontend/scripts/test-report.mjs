import assert from 'node:assert/strict';
import { evaluate, diverseVenues } from '../src/reportLogic.mjs';
import { neighborhoodSummary } from '../src/neighborhoodSummary.mjs';
import { categoryEvaluation, affordabilityScore, safetyAssessment } from '../src/categoryEvaluation.mjs';
import { transportPresentation } from '../src/transportPresentation.mjs';
const report={rents:[
  {rooms:'1+1',amount:20000,date:'2026-10-01',eligible:true,lease:'unknown',furnished:true},
  {rooms:'2+1',amount:40000,date:'2026-10-01',eligible:true,lease:'long_term',furnished:false},
  {rooms:'1+1',amount:10000,date:null,eligible:false,lease:'unknown',furnished:true},
  {rooms:'1+1',amount:5000,date:'2026-10-01',eligible:true,lease:'seasonal',furnished:true}],
  venues:[{type:'fast_food',name:'Example'},{type:'cafe',name:'Other'},{type:'park',name:'Park'}],
  routes:[{route:'Otogar Kampüs Hastane Merkez',localEvidence:'test',benefit:'test'}]};
const all=evaluate(report,{roomType:'all',furnished:'any'});
assert.equal(all.median,null,'Different dwelling types must never share a median');
assert.equal(all.transport,null,'Four destination types must not produce a 100 transport score');
assert.equal(all.social,null,'Venue types must not produce a social quality score');
assert.equal(all.compatibility,null,'Incomplete quality assessment must not produce an overall score');
assert.equal(all.typeStats.find(t=>t.rooms==='1+1').median,20000,'Undated and seasonal prices must not enter the dated reference');
const small=evaluate(report,{roomType:'1+1',furnished:'yes'});
assert.equal(small.median,20000);
assert.equal(small.selected.length,2);
assert.equal(evaluate(report,{roomType:'1+0',furnished:'any'}).median,null);
const venues=[{type:'cafe',name:'One'},{type:'cafe',name:'Two'},{type:'restaurant',name:'Food'},{type:'pub',name:'Pub'}];
assert.equal(new Set(diverseVenues(venues).map(v=>v.name)).size,4);
assert.ok(diverseVenues(venues).slice(0,3).some(v=>v.type==='pub'),'The initial list must not consist only of cafes');
console.log('Report checks passed: type separation, date/season guards, no inflated quality score, diverse initial list.');

const reference={netMinimumWage:{amount:28075.5}};
const base={...report,news:[],transportAlerts:[],hazard:{score:23}};
const summary=neighborhoodSummary(base,{roomType:'all',furnished:'any'},reference);
assert.equal(summary.room,'1+1','Default reference must identify the dwelling type');
assert.equal(summary.percent,71);
assert.match(summary.range,/20\.000/);
assert.equal(summary.higherThan,77);
const absent=neighborhoodSummary(base,{roomType:'1+0',furnished:'any'},reference);
assert.equal(absent.rent.median,null,'Missing room types must not borrow another type price');
assert.equal(absent.percent,null);
const current=neighborhoodSummary({...base,transportAlerts:[{date:'2025-12-01',summary:'Old',affected:''},{date:'2026-10-26',summary:'Latest',affected:'Street'}]}, {roomType:'all',furnished:'any'},reference);
assert.equal(current.alert.summary,'Latest');
console.log('Summary checks passed: typed rent reference, income ratio, missing-data guard and dated alerts.');

assert.equal(affordabilityScore(1),0,'Rent consuming the entire minimum wage cannot be affordable');
assert.ok(affordabilityScore(.82)<affordabilityScore(.4));
const simple={...base,venues:[{name:'Cafe',type:'cafe'}],routes:[]};
const scoreReference={...reference,asOf:'2026-10-28'};
const baseline=categoryEvaluation(simple,{roomType:'all',furnished:'any'},scoreReference);
const many=categoryEvaluation({...simple,venues:Array.from({length:100},(_,i)=>({name:`Cafe ${i}`,type:'cafe'}))},{roomType:'all',furnished:'any'},scoreReference);
assert.equal(many.social,baseline.social,'100 cafes must not score above one cafe just by repetition');
assert.equal(baseline.overall,null,'A missing transport assessment must prevent an overall score');
const timed={...simple,routes:[{officialHeadingVerified:true,localEvidence:'Otogar Merkez',route:'Otogar Merkez',timetable:[{days:{weekday:{times:['08:00','09:00','10:00']},saturday:{count:3},sunday:{count:3}}}]}]};
const plain=categoryEvaluation(timed,{roomType:'all'},scoreReference);
const badRoad={date:'2026-10-26',status:'dated_report',summary:'Yol çalışması nedeniyle giriş yapılamıyor'};
const disrupted=categoryEvaluation({...timed,transportAlerts:[badRoad]},{roomType:'all'},scoreReference);
assert.ok(disrupted.transport<plain.transport,'A recent road obstacle must affect transport, not just route counts');
assert.equal(categoryEvaluation({...timed,transportAlerts:Array(10).fill(badRoad)},{roomType:'all'},scoreReference).transport,disrupted.transport,'Repeated coverage must not multiply penalties');
assert.equal(categoryEvaluation({...timed,transportAlerts:[{...badRoad,status:'completion_reported'}]},{roomType:'all'},scoreReference).transport,plain.transport,'Completed works must not count as active obstacles');
assert.equal(disrupted.safety,null,'News counts must not invent a safety score');
console.log('Evaluation checks passed: affordability burden, repetition invariance, road disruption, completed works, missing category guards.');
const access={id:'gate',date:'2026-10-19',observedAt:'2026-10-28',status:'official_access_restriction',summary:'Access closure',sources:[]};
assert.ok(categoryEvaluation({...timed,transportAlerts:[access]},{roomType:'all'},scoreReference).transport<=35,'A verified major access restriction must cap transport despite available schedules');
const notices=[{id:'one',date:'2026-10-26',status:'dated_report',summary:'Yol çökmesi',affected:'Street',sources:[]},{id:'two',date:'2026-10-26',status:'dated_report',summary:'Yağış nedeniyle yol çöktü',affected:'Street',sources:[]},{id:'old',date:'2025-11-01',status:'dated_report',summary:'Altyapı çalışması',affected:'Street',sources:[]}];
const presentation=transportPresentation(notices,'2026-10-28');
assert.equal(presentation.current.length,1,'The same road collapse must not appear as multiple current faults');
assert.equal(presentation.history.length,1,'Older project news belongs in history');
const incident={id:'fatal',date:'2026-09-01',type:'asayiş',summary:'Silahlı olayda iki kişi yaşamını yitirdi.',sources:[{url:'https://example.org'}]};
const safety=safetyAssessment([incident],'2026-10-28');
assert.equal(safety.score,30);
assert.equal(safetyAssessment(Array(10).fill(incident),'2026-10-28').score,safety.score,'Duplicate coverage must not worsen the safety indicator');
assert.equal(safetyAssessment([{...incident,type:'yangın'}],'2026-10-28').score,null,'A house fire must not become an asayis score');
assert.equal(safetyAssessment([],'2026-10-28').score,null,'No crime articles must not be interpreted as a safe score');
