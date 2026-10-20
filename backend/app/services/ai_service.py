"""
AI & LLM Report Synthesis Service (Osman Kalkan - AI & LLM Integration Module).
Uses Google Gemini API when GEMINI_API_KEY is configured, and gracefully falls back
to a grounded, source-backed synthesis engine when offline or rate-limited (Risk R-02 & R-05 mitigation).
"""

import json
import logging
from typing import Dict, Any
from app.core.config import settings
from app.models.neighborhood import Neighborhood

logger = logging.getLogger(__name__)

STANDARD_DISCLAIMER = (
    "This AI-generated livability report is synthesized from public datasets (AFAD hazard data, "
    "OpenStreetMap/MUTTAŞ transit info, regional rent indices, and public news/reviews) for informational "
    "purposes only. It does not constitute legal, financial, or structural engineering advice."
)


def generate_neighborhood_ai_report(
    neighborhood: Neighborhood, force_live_llm: bool = False
) -> Dict[str, Any]:
    """
    Generates or returns grounded AI report for a neighborhood.
    If GEMINI_API_KEY is set and force_live_llm is True (or no cached summary exists),
    calls Gemini API with strict JSON schema grounding. Otherwise uses deterministic grounded synthesis.
    """
    if settings.GEMINI_API_KEY and (force_live_llm or not neighborhood.ai_summary):
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)

            prompt = f"""
You are MahallEN AI, an objective neighborhood livability analyst in Türkiye.
Analyze the following verified data for {neighborhood.name} ({neighborhood.district}, {neighborhood.city})
and return ONLY valid JSON with keys:
"executive_summary" (string, 3-4 sentences),
"pros" (list of 4 short strings),
"cons" (list of 3 short strings),
"student_verdict" (string, 1-2 sentences),
"family_verdict" (string, 1-2 sentences),
"professional_verdict" (string, 1-2 sentences).

Grounded Data:
- Overall Score: {neighborhood.overall_score}/100 (Safety: {neighborhood.safety_score}, Transport: {neighborhood.transport_score}, Cost Affordability: {neighborhood.cost_score}, Disaster Resilience: {neighborhood.disaster_safety_score})
- Average Rent: {neighborhood.avg_rent_tl} TL ({neighborhood.rent_range_tl}, 6m trend: {neighborhood.rent_trend_6m})
- Distance to Campus: {neighborhood.distance_to_campus_km} km, Distance to Center: {neighborhood.distance_to_center_km} km, Bus Every: {neighborhood.bus_frequency_min} mins
- Earthquake Hazard: Risk={neighborhood.earthquake_risk_level}, PGA={neighborhood.pga_value_g}g, Soil={neighborhood.soil_class}
- Recent News: {json.dumps(neighborhood.news_items, ensure_ascii=False)}
- Community Comments: {json.dumps(neighborhood.community_comments, ensure_ascii=False)}

Do not hallucinate facts outside the provided data. Maintain neutral, non-stigmatizing language.
"""
            response = model.generate_content(prompt)
            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`").removeprefix("json").strip()
            parsed = json.loads(raw_text)
            return {
                "executive_summary": parsed.get("executive_summary", neighborhood.ai_summary),
                "pros": parsed.get("pros", neighborhood.ai_pros),
                "cons": parsed.get("cons", neighborhood.ai_cons),
                "student_verdict": parsed.get("student_verdict", _build_student_verdict(neighborhood)),
                "family_verdict": parsed.get("family_verdict", _build_family_verdict(neighborhood)),
                "professional_verdict": parsed.get(
                    "professional_verdict", _build_professional_verdict(neighborhood)
                ),
                "generated_by": f"Google Gemini ({settings.GEMINI_MODEL}) - Grounded RAG",
                "disclaimer": STANDARD_DISCLAIMER,
            }
        except Exception as exc:
            logger.warning("Gemini API call failed, using grounded fallback: %s", exc)

    return {
        "executive_summary": neighborhood.ai_summary,
        "pros": neighborhood.ai_pros,
        "cons": neighborhood.ai_cons,
        "student_verdict": _build_student_verdict(neighborhood),
        "family_verdict": _build_family_verdict(neighborhood),
        "professional_verdict": _build_professional_verdict(neighborhood),
        "generated_by": "MahallEN Grounded AI Synthesis Engine (Cached / Fallback Mode)",
        "disclaimer": neighborhood.ai_disclaimer or STANDARD_DISCLAIMER,
    }


def _build_student_verdict(n: Neighborhood) -> str:
    if n.suitability_student >= 85:
        return (
            f"Highly Recommended ({n.suitability_student}/100): Direct proximity to MSKÜ campus "
            f"({n.distance_to_campus_km} km) and frequent transit ({n.bus_frequency_min} min) make it the top student hub."
        )
    elif n.suitability_student >= 70:
        return (
            f"Good Option ({n.suitability_student}/100): Balanced city amenities and transit access, "
            f"though commute to campus is {n.distance_to_campus_km} km."
        )
    return (
        f"Moderate/Niche ({n.suitability_student}/100): Higher rent ({n.avg_rent_tl:,} TL) or longer "
        f"campus commute ({n.distance_to_campus_km} km) makes it better suited for students with vehicles."
    )


def _build_family_verdict(n: Neighborhood) -> str:
    if n.suitability_family >= 85:
        return (
            f"Top Family Choice ({n.suitability_family}/100): Quiet residential streets, strong safety score "
            f"({n.safety_score}/100), and proximity to schools, parks, and healthcare."
        )
    elif n.suitability_family >= 70:
        return (
            f"Suitable ({n.suitability_family}/100): Good overall infrastructure and central access, "
            "with moderate traffic during peak hours."
        )
    return (
        f"Less Ideal for Families ({n.suitability_family}/100): Dominated by student studio apartments "
        "and lively late-night cafes rather than family-oriented housing."
    )


def _build_professional_verdict(n: Neighborhood) -> str:
    if n.suitability_professional >= 85:
        return (
            f"Excellent for Professionals ({n.suitability_professional}/100): Fast access to administrative/commercial "
            f"centers ({n.distance_to_center_km} km) with modern housing stock and high livability."
        )
    return (
        f"Balanced ({n.suitability_professional}/100): Offers solid daily amenities and {n.bus_frequency_min}-minute "
        "transit intervals, suitable for remote workers or commuters."
    )
