from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.neighborhood import Neighborhood
from app.schemas.neighborhood import (
    NeighborhoodSummarySchema,
    NeighborhoodFullReportSchema,
)
from app.services.ai_service import generate_neighborhood_ai_report
from app.services.scoring_service import get_scoring_methodology

router = APIRouter(prefix="/neighborhoods", tags=["Neighborhoods & AI Reports"])


@router.get("", response_model=List[NeighborhoodSummarySchema])
def list_neighborhoods(
    q: Optional[str] = Query(None, description="Search by neighborhood or district name"),
    profile: Optional[str] = Query(
        None, description="Sort by suitability profile: student | family | professional"
    ),
    db: Session = Depends(get_db),
):
    """Lists or searches Muğla pilot neighborhoods with summary scores."""
    query = db.query(Neighborhood)
    if q:
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Neighborhood.name.ilike(search_term),
                Neighborhood.district.ilike(search_term),
                Neighborhood.slug.ilike(search_term),
                Neighborhood.tagline.ilike(search_term),
            )
        )

    results = query.all()
    if profile == "student":
        results.sort(key=lambda x: x.suitability_student, reverse=True)
    elif profile == "family":
        results.sort(key=lambda x: x.suitability_family, reverse=True)
    elif profile == "professional":
        results.sort(key=lambda x: x.suitability_professional, reverse=True)
    else:
        results.sort(key=lambda x: x.overall_score, reverse=True)

    return results


@router.get("/{slug}/report", response_model=NeighborhoodFullReportSchema)
def get_neighborhood_report(
    slug: str,
    refresh_ai: bool = Query(
        False, description="Force live Gemini LLM generation if API key is configured"
    ),
    db: Session = Depends(get_db),
):
    """Returns the complete, source-backed AI livability report for a neighborhood."""
    neighborhood = (
        db.query(Neighborhood).filter(Neighborhood.slug == slug.lower().strip()).first()
    )
    if not neighborhood:
        raise HTTPException(
            status_code=404,
            detail=f"Neighborhood '{slug}' not found in Muğla pilot dataset.",
        )

    ai_report = generate_neighborhood_ai_report(
        neighborhood, force_live_llm=refresh_ai
    )

    return {
        "id": neighborhood.id,
        "slug": neighborhood.slug,
        "name": neighborhood.name,
        "district": neighborhood.district,
        "city": neighborhood.city,
        "tagline": neighborhood.tagline,
        "coordinates": {
            "lat": neighborhood.latitude,
            "lng": neighborhood.longitude,
        },
        "scores": {
            "overall_livability": neighborhood.overall_score,
            "safety": neighborhood.safety_score,
            "transportation": neighborhood.transport_score,
            "cost_affordability": neighborhood.cost_score,
            "disaster_resilience": neighborhood.disaster_safety_score,
        },
        "suitability": {
            "students": neighborhood.suitability_student,
            "families": neighborhood.suitability_family,
            "professionals": neighborhood.suitability_professional,
        },
        "rent_analysis": {
            "average_rent_tl": neighborhood.avg_rent_tl,
            "rent_range_tl": neighborhood.rent_range_tl,
            "trend_6m": neighborhood.rent_trend_6m,
        },
        "transport_analysis": {
            "bus_frequency_min": neighborhood.bus_frequency_min,
            "distance_to_campus_km": neighborhood.distance_to_campus_km,
            "distance_to_center_km": neighborhood.distance_to_center_km,
            "highlights": neighborhood.transport_highlights,
        },
        "disaster_risk": {
            "risk_level": neighborhood.earthquake_risk_level,
            "pga_value_g": neighborhood.pga_value_g,
            "soil_class": neighborhood.soil_class,
        },
        "news_items": neighborhood.news_items,
        "community_comments": neighborhood.community_comments,
        "data_sources": neighborhood.data_sources,
        "ai_report": ai_report,
        "scoring_methodology": get_scoring_methodology(),
    }
