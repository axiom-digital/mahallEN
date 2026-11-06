export function adaptPlaceReport(raw) {
  const assessment = raw.assessment;
  const score = key => assessment?.categories.find(c => c.category === key)?.score ?? null;
  const category = key => raw.categories.find(c => c.id === key)?.items || [];
  return {
    slug: raw.place.id, name: raw.place.name, city: raw.place.city, district: raw.place.district,
    tagline: `Kaynaklı mahalle bilgileri · ${raw.reference_date}`,
    coordinates: null,
    scores: { overall_livability: assessment?.overall_score ?? null, safety: score('safety_news'), transportation: score('transportation'), cost_affordability: score('rent_cost'), disaster_resilience: score('earthquake_hazard'), social_life: score('social_life') },
    suitability: assessment?.profile_scores || { students: null, families: null, professionals: null },
    rent_analysis: { average_rent_tl: null, rent_range_tl: null, trend_6m: null },
    transport_analysis: { bus_frequency_min: null, distance_to_campus_km: null, distance_to_center_km: null, highlights: category('transportation').map(i => i.text) },
    disaster_risk: { risk_level: null, pga_value_g: null, soil_class: null },
    news_items: category('safety_news').map(i => ({ title: 'Kaynaklı haber kaydı', summary: i.text, source: i.sources.map(s => s.title).join(', '), date: i.date, sentiment: null })),
    community_comments: [], data_sources: [...new Set(raw.categories.flatMap(c => c.items.flatMap(i => i.sources.map(s => s.url))))],
    ai_report: { executive_summary: assessment?.executive_summary || raw.summary, pros: assessment?.pros || [], cons: assessment?.cons || raw.limitations.slice(0, 3), generated_by: raw.generated_by,
      disclaimer: [assessment?.methodology, ...raw.limitations].filter(Boolean).join(' '), student_verdict: assessment?.student_verdict || 'Uygunluk puanı hesaplanmadı.', family_verdict: assessment?.family_verdict || 'Uygunluk puanı hesaplanmadı.', professional_verdict: assessment?.professional_verdict || 'Uygunluk puanı hesaplanmadı.' },
    scoring_methodology: { note: assessment?.methodology || 'Eksik bilgiler sıfır sayılmaz; kaynaklı bulgulardan sayısal puan türetilmedi.' },
    assessment,
    evidence_report: raw,
  };
}
