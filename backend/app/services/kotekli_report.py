"""Build the Kötekli API report from the existing, review-pending pilot snapshot."""

from functools import lru_cache
from hashlib import sha256
import json
from pathlib import Path


PILOT_PATH = Path(__file__).resolve().parents[3] / "data/pilot/kotekli.ui.v0.2.json"


@lru_cache(maxsize=1)
def load_kotekli_pilot() -> tuple[dict, str]:
    raw = PILOT_PATH.read_bytes()
    return json.loads(raw), f"kotekli-pilot-v1:{sha256(raw).hexdigest()}"


def build_kotekli_report(neighborhood_id: int, pilot: dict) -> dict:
    scores = pilot["scores"]
    location = pilot["location"]
    hazard = pilot["hazard"]
    tagline = f"Kötekli pilot araştırması ({pilot['date']})"
    sources = [location["source_url"], hazard["url"]]
    for item in pilot["rent"] + pilot["transport"] + pilot["news"] + pilot["social"]["places"]:
        sources.extend(source["url"] for source in item["sources"])

    missing_verdict = "Bu raporda kişiselleştirilmiş uygunluk puanı hesaplanmadı."
    return {
        "id": neighborhood_id,
        "slug": "kotekli",
        "name": pilot["name"],
        "district": pilot["district"],
        "city": pilot["city"],
        "tagline": tagline,
        "coordinates": {"lat": location["lat"], "lng": location["lon"]},
        "scores": {
            "overall_livability": None,
            "safety": scores["news"]["value"],
            "transportation": scores["transport"]["value"],
            "cost_affordability": scores["rent"]["value"],
            "disaster_resilience": scores["hazard"]["value"],
            "social_life": scores["social"]["value"],
        },
        "suitability": {"students": None, "families": None, "professionals": None},
        "rent_analysis": {"average_rent_tl": None, "rent_range_tl": None, "trend_6m": None},
        "transport_analysis": {
            "bus_frequency_min": None,
            "distance_to_campus_km": None,
            "distance_to_center_km": None,
            "highlights": [route["text"] for route in pilot["transport"]],
        },
        "disaster_risk": {"risk_level": None, "pga_value_g": hazard["value"], "soil_class": None},
        "news_items": [
            {
                "title": "Yerel haber kaydı",
                "source": ", ".join(source["publisher"] for source in item["sources"]),
                "date": item["date"],
                "sentiment": None,
                "summary": item["text"],
            }
            for item in pilot["news"]
        ],
        "community_comments": [],
        "data_sources": list(dict.fromkeys(sources)),
        "ai_report": {
            "executive_summary": (
                f"{tagline}. Kira ilanları, toplu taşıma hatları, yerel haberler, "
                "sosyal yaşam ve deprem tehlikesi için pilot gözlemler derlendi."
            ),
            "pros": [scores["social"]["reason"], scores["transport"]["reason"]],
            "cons": [scores["news"]["reason"], scores["hazard"]["reason"]],
            "student_verdict": missing_verdict,
            "family_verdict": missing_verdict,
            "professional_verdict": missing_verdict,
            "generated_by": "MahallEN Kötekli Pilot Sentezi",
            "disclaimer": (
                "Kaynak kontrolü devam ediyor. Puanlar deneysel. PGA değeri araştırma "
                "gridinden alınmıştır ve bina güvenliğini göstermez."
            ),
        },
        "scoring_methodology": {
            "note": (
                "Kategori puanları mevcut Kötekli pilot çıktısından alınır. Kira puanı "
                "2+1 ilanlarının ortanca kirasını 30.000 TL aylık bütçeyle karşılaştırır. "
                "Genel ve profil puanları için konut tercihi gerekir."
            ),
        },
    }
