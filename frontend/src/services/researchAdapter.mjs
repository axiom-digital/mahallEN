import { evaluate } from '../reportLogic.mjs';
import { categoryEvaluation } from '../categoryEvaluation.mjs';
import { neighborhoodSummary } from '../neighborhoodSummary.mjs';
import { profiles } from '../scoring.mjs';

export function profileEvaluations(scores) {
  const complete = ['rent', 'transport', 'social', 'news', 'hazard'].every(key => Number.isFinite(scores[key]));
  return Object.fromEntries(Object.entries(profiles).map(([key, profile]) => [key, {
    label: profile.label, weights: profile.weights, provisional: true,
    score: complete ? Math.round(Object.entries(profile.weights).reduce((sum, [category, weight]) => sum + scores[category] * weight / 100, 0)) : null,
  }]));
}

export function targetMatches(report, feed) {
  const normalize = s => String(s || '').toLocaleLowerCase('tr-TR').trim();
  const target = feed?.specification?.target;
  return !!target && normalize(report.city) === normalize(target.province) &&
    normalize(report.district) === normalize(target.district) && normalize(report.name) === normalize(target.neighborhood);
}

export function adaptResearchReport(report, reference, feeds = []) {
  const preferences = { roomType: '1+1', furnished: 'any' };
  const analysis = evaluate(report, preferences);
  const summary = neighborhoodSummary(report, preferences, reference);
  const score = categoryEvaluation(report, preferences, reference);
  const profileScores = profileEvaluations({ rent: score.rent, transport: score.transport, social: score.social, news: score.safety, hazard: score.hazard });
  const feed = feeds.find(f => targetMatches(report, f));
  const prices = analysis.dated.map(r => r.amount);
  const primary = f => f.sources?.[0];
  const sources = [...new Set([...report.rents, ...report.routes, ...report.news, ...report.venues].flatMap(r => (r.sources || []).map(s => s.publisher)))];
  return {
    id: report.id, slug: report.id, name: report.name, district: report.district, city: report.city,
    tagline: summary.dailyLifeText, coordinates: { lat: report.location?.lat, lng: report.location?.lng },
    scores: { overall_livability: score.overall, cost_affordability: score.rent, transportation: score.transport,
      social_life: score.social, safety: score.safety, disaster_resilience: score.hazard },
    suitability: { students: profileScores.student.score, families: profileScores.family.score, professionals: profileScores.professional.score },
    rent_analysis: { average_rent_tl: analysis.median,
      rent_range_tl: prices.length ? `${Math.min(...prices).toLocaleString('tr-TR')}–${Math.max(...prices).toLocaleString('tr-TR')} TL` : null,
      trend_6m: '1+1 tarihli ilan örnekleri · eğilim ölçülmedi', dwelling_type: '1+1' },
    transport_analysis: { bus_frequency_min: null, distance_to_campus_km: null, distance_to_center_km: null,
      highlights: report.routes.map(r => `${r.code} · ${r.route || r.localEvidence || 'Kaynaklı hat kaydı'}`) },
    disaster_risk: { risk_level: 'Araştırma gridi · bina güvenliği sonucu değil', pga_value_g: report.hazard.value, soil_class: null },
    news_items: report.news.map(n => ({ title: n.type || 'Mahalle gündemi', summary: n.summary,
      source: primary(n)?.publisher, url: primary(n)?.url, date: n.date || 'Tarih belirsiz', sentiment: 'neutral' })),
    community_comments: [], data_sources: sources,
    ai_report: { generated_by: 'Kaynaklı araştırma paketi · kayıtlı bulgular',
      executive_summary: summary.dailyLifeText,
      pros: report.venues.length ? [`${report.venues.slice(0, 3).map(v => v.name).join(', ')} mahalledeki seçeneklerden. Diğer mekânları harita üzerinde keşfedebilirsin.`] : ['Günlük ihtiyaçlarına yakın seçenekleri mahalle haritasında incele.'],
      cons: summary.alert ? [`${summary.alert.summary} Kaynak tarihini ve ev aradığın konumu birlikte değerlendir.`] : ['Evden işe veya okula gideceğin güzergâhı, kullanacağın saatlerde kontrol et. Hatların kalkış saatlerini ulaşım detaylarında karşılaştırabilirsin.'],
      student_verdict: 'Proje senaryosu: kira, ulaşım ve sosyal yaşama daha yüksek ağırlık verilir.', family_verdict: 'Proje senaryosu: güvenlik ve deprem göstergelerine daha yüksek ağırlık verilir.',
      professional_verdict: 'Proje senaryosu: ulaşım ve konut maliyetine daha yüksek ağırlık verilir.',
      disclaimer: 'Proje ölçütleriyle hesaplanan ön puanlardır. Asayiş haberleri suç oranı değildir. Eksik değerler sıfır sayılmaz.' },
    scoring_methodology: { note: '32% konut maliyeti, 28% sosyal yaşam, 20% haber temelli güvenlik, 10% araştırma deprem gridi, 10% ulaşım. Ölçütler ve farklı profil ağırlıkları proje senaryosudur; kişisel uygunluk tahmini değildir. Eksik kategori varsa toplam puan hesaplanmaz. Kira yalnız 1+1 tarihli örneklerdir.' },
    research_news: feed || null, source_mode: 'research', source_as_of: report.asOf,
    profile_evaluations: profileScores, research_detail: { report, reference },
  };
}

export function researchList(reports, reference, feeds, query = '', profile = '') {
  const normalize = s => String(s).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i');
  return reports.filter(r => normalize(`${r.name} ${r.district} ${r.id}`).includes(normalize(query)))
    .map(r => { const data = adaptResearchReport(r, reference, feeds); return {
      id: data.id, slug: data.slug, name: data.name, city: data.city, district: data.district,
      tagline: data.tagline, overall_score: data.scores.overall_livability,
      avg_rent_tl: data.rent_analysis.average_rent_tl, safety_score: data.scores.safety,
      transport_score: data.scores.transportation, social_score: data.scores.social_life,
      cost_score: data.scores.cost_affordability, disaster_safety_score: data.scores.disaster_resilience,
      suitability_student: data.suitability.students, suitability_family: data.suitability.families, suitability_professional: data.suitability.professionals,
    }; }).sort((a, b) => {
      const field = ({ student: 'suitability_student', family: 'suitability_family', professional: 'suitability_professional' })[profile] || 'overall_score';
      const left = a[field], right = b[field];
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return right - left;
    });
}
