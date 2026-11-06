export function adaptPlaceReport(raw) {
  const category = key => raw.categories.find(c => c.id === key)?.items || [];
  return {
    slug: raw.place.id, name: raw.place.name, city: raw.place.city, district: raw.place.district,
    tagline: `Kaynaklı mahalle bilgileri · ${raw.reference_date}`,
    coordinates: null,
    scores: { overall_livability: null, safety: null, transportation: null, cost_affordability: null, disaster_resilience: null, social_life: null },
    suitability: { students: null, families: null, professionals: null },
    rent_analysis: { average_rent_tl: null, rent_range_tl: null, trend_6m: null },
    transport_analysis: { bus_frequency_min: null, distance_to_campus_km: null, distance_to_center_km: null, highlights: category('transportation').map(i => i.text) },
    disaster_risk: { risk_level: null, pga_value_g: null, soil_class: null },
    news_items: category('safety_news').map(i => ({ title: 'Kaynaklı haber kaydı', summary: i.text, source: i.sources.map(s => s.title).join(', '), date: i.date, sentiment: null })),
    community_comments: [], data_sources: [...new Set(raw.categories.flatMap(c => c.items.flatMap(i => i.sources.map(s => s.url))))],
    ai_report: { executive_summary: raw.summary, pros: [], cons: raw.limitations.slice(0, 3), generated_by: raw.generated_by,
      disclaimer: raw.limitations.join(' '), student_verdict: 'Uygunluk puanı hesaplanmadı.', family_verdict: 'Uygunluk puanı hesaplanmadı.', professional_verdict: 'Uygunluk puanı hesaplanmadı.' },
    scoring_methodology: { note: 'Eksik bilgiler sıfır sayılmaz; kaynaklı bulgulardan sayısal puan türetilmedi.' },
    evidence_report: raw,
  };
}
