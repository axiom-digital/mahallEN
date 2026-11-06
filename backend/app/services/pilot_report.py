"""Serve the source-reviewed Issue #32 dataset through the report API."""

from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path


DATASET_PATH = Path(__file__).resolve().parents[3] / "data/pilot_neighborhoods.json"
SCORE_CATEGORIES = {
    "safety": "safety_news",
    "transportation": "transportation",
    "cost_affordability": "rent_cost",
    "disaster_resilience": "earthquake_hazard",
    "social_life": "social_life",
}


@lru_cache(maxsize=1)
def load_pilot_neighborhoods():
    records = json.loads(DATASET_PATH.read_bytes())["neighborhoods"]
    return {
        record["id"]: (
            index,
            record,
            "issue32-v1:" + sha256(json.dumps(record, sort_keys=True).encode()).hexdigest(),
        )
        for index, record in enumerate(records, start=1)
    }


def pilot_summary(neighborhood_id: int, pilot: dict) -> dict:
    return {
        "id": neighborhood_id,
        "slug": pilot["id"],
        "name": pilot["name"],
        "district": pilot["district"],
        "city": pilot["city"],
        "tagline": f"{pilot['name']} pilot araştırması ({pilot['reference_date']})",
        "overall_score": None,
        "avg_rent_tl": pilot["categories"]["rent_cost"]["average_rent_tl"],
        "earthquake_risk_level": None,
        "suitability_student": None,
        "suitability_family": None,
        "suitability_professional": None,
    }


def build_pilot_report(neighborhood_id: int, pilot: dict) -> dict:
    summary = pilot_summary(neighborhood_id, pilot)
    categories = pilot["categories"]
    location = pilot["location"]
    sources = {source["id"]: source for source in pilot["sources"]}
    missing_verdict = "Bu pilot raporda profil uygunluk puanı hesaplanmadı."
    return {
        **{key: summary[key] for key in ("id", "slug", "name", "district", "city", "tagline")},
        "coordinates": {"lat": location["lat"], "lng": location["lon"]} if location else {},
        "scores": {
            "overall_livability": summary["overall_score"],
            **{key: categories[category]["score"] for key, category in SCORE_CATEGORIES.items()},
        },
        "suitability": {"students": None, "families": None, "professionals": None},
        "rent_analysis": {"average_rent_tl": summary["avg_rent_tl"], "rent_range_tl": None, "trend_6m": None},
        "transport_analysis": {
            "bus_frequency_min": None,
            "distance_to_campus_km": None,
            "distance_to_center_km": None,
            "highlights": [item["text"] for item in categories["transportation"]["observations"]],
        },
        "disaster_risk": {
            "risk_level": None,
            "pga_value_g": categories["earthquake_hazard"]["value"],
            "soil_class": None,
        },
        "news_items": [
            {
                "title": "Yerel haber kaydı",
                "source": ", ".join(sources[source_id]["publisher"] for source_id in item["source_ids"]),
                "date": item["publication_date"],
                "sentiment": None,
                "summary": item["text"],
            }
            for item in categories["safety_news"]["observations"]
        ],
        "community_comments": [],
        "data_sources": list(dict.fromkeys(source["url"] for source in sources.values())),
        "pilot_evidence": {
            key: pilot[key]
            for key in ("geo_key", "reference_date", "categories", "sources", "missing_values", "limitations")
        },
        "ai_report": {
            "executive_summary": f"{summary['tagline']}. Kaynakları kontrol edilmiş pilot gözlemler derlendi.",
            "pros": [],
            "cons": [],
            "student_verdict": missing_verdict,
            "family_verdict": missing_verdict,
            "professional_verdict": missing_verdict,
            "generated_by": "MahallEN Pilot Sentezi",
            "disclaimer": "Pilot örnekler mahalleyi temsil etmez. PGA değeri bina güvenliğini göstermez.",
        },
        "scoring_methodology": {"note": "Bu pilot veri paketinde puan hesaplanmadı."},
    }
