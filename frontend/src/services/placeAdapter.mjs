function extractPgaFromCategories(categories = []) {
  const eq = categories.find((c) => c.id === 'earthquake_hazard');
  for (const item of eq?.items || []) {
    const match = String(item.text || '').match(/(\d+[.,]\d+)\s*g\b/i);
    if (match) {
      const parsed = Number(match[1].replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function formatRentRange(briefing) {
  const rentTypes = briefing?.rent_types || [];
  const preferred =
    rentTypes.find((g) => g.rooms === '1+1' && g.min != null && g.max != null) ||
    rentTypes.find((g) => g.min != null && g.max != null);
  if (!preferred) return null;
  const minText = `${Number(preferred.min).toLocaleString('tr-TR')} TL`;
  const maxText = `${Number(preferred.max).toLocaleString('tr-TR')} TL`;
  return preferred.min === preferred.max
    ? `${minText} (${preferred.rooms})`
    : `${minText} – ${maxText} (${preferred.rooms})`;
}

export function adaptPlaceReport(raw) {
  const assessment = raw.assessment;
  const categoriesList = Array.isArray(raw.categories) ? raw.categories : [];
  const score = (key) => assessment?.categories?.find((c) => c.category === key)?.score ?? null;
  const category = (key) => categoriesList.find((c) => c.id === key)?.items || [];
  const meta = (key) => {
    const row = assessment?.categories?.find((c) => c.category === key);
    const conf = assessment?.briefing?.confidence?.[key];
    const sample_count = row?.sample_count ?? conf?.sample_count ?? null;
    const confidence = row?.confidence ?? conf?.level ?? null;
    const confidence_label = row?.confidence_label ?? conf?.label ?? null;
    if (sample_count == null && confidence == null && confidence_label == null) return null;
    return { sample_count, confidence, confidence_label };
  };

  const briefingHazardPga = assessment?.briefing?.hazard?.value;
  const pgaValue =
    typeof briefingHazardPga === 'number' && Number.isFinite(briefingHazardPga)
      ? briefingHazardPga
      : extractPgaFromCategories(categoriesList);

  const allSources = categoriesList.flatMap((c) => [
    ...(c.items || []),
    ...(c.historical_items || []),
  ]);

  return {
    slug: raw.place.id,
    name: raw.place.name,
    city: raw.place.city,
    district: raw.place.district,
    tagline: `Kaynaklı mahalle bilgileri · ${raw.reference_date}`,
    coordinates: null,
    scores: {
      overall_livability: assessment?.overall_score ?? null,
      safety: score('safety_news'),
      transportation: score('transportation'),
      cost_affordability: score('rent_cost'),
      disaster_resilience: score('earthquake_hazard'),
      social_life: score('social_life'),
    },
    category_meta: {
      safety: meta('safety_news'),
      transportation: meta('transportation'),
      cost_affordability: meta('rent_cost'),
      disaster_resilience: meta('earthquake_hazard'),
      social_life: meta('social_life'),
    },
    suitability: assessment?.profile_scores || {
      students: null,
      families: null,
      professionals: null,
    },
    rent_analysis: {
      average_rent_tl: assessment?.calculation?.monthly_rent ?? null,
      rent_range_tl: formatRentRange(assessment?.briefing),
      trend_6m: assessment?.calculation?.rent_sample_count
        ? assessment?.calculation?.benchmark_count
          ? `1+1 eşdeğer medyan (ilan + endeks) · ${assessment.calculation.rent_sample_count} örnek`
          : assessment?.calculation?.rent_mode === 'normalized_rooms'
            ? `1+1 eşdeğer oda-normalize medyan · ${assessment.calculation.rent_sample_count} örnek`
            : `1+1 tarihli ilan medyanı · ${assessment.calculation.rent_sample_count} örnek`
        : null,
    },
    transport_analysis: {
      bus_frequency_min: null,
      distance_to_campus_km: null,
      distance_to_center_km: null,
      highlights: category('transportation').map((i) => i.text),
    },
    disaster_risk: {
      risk_level: null,
      pga_value_g: pgaValue,
      soil_class: null,
    },
    news_items: category('safety_news').map((i) => ({
      title: 'Kaynaklı haber kaydı',
      summary: i.text,
      source: (i.sources || []).map((s) => s.title).join(', '),
      date: i.date,
      sentiment: null,
    })),
    community_comments: [],
    data_sources: [
      ...new Set(
        allSources.flatMap((i) => (i.sources || []).map((s) => s.url).filter(Boolean))
      ),
    ],
    ai_report: {
      executive_summary: assessment?.executive_summary || raw.summary,
      pros: assessment?.pros || [],
      cons: assessment?.cons || (raw.limitations || []).slice(0, 3),
      generated_by: raw.generated_by,
      disclaimer: [assessment?.methodology, ...(raw.limitations || [])].filter(Boolean).join(' '),
      student_verdict: assessment?.student_verdict || 'Uygunluk puanı hesaplanmadı.',
      family_verdict: assessment?.family_verdict || 'Uygunluk puanı hesaplanmadı.',
      professional_verdict: assessment?.professional_verdict || 'Uygunluk puanı hesaplanmadı.',
    },
    scoring_methodology: {
      note:
        assessment?.methodology ||
        'Eksik bilgiler sıfır sayılmaz; kaynaklı bulgulardan sayısal puan türetilmedi.',
    },
    assessment,
    evidence_report: raw,
  };
}
