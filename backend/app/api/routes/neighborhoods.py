from contextlib import nullcontext
from typing import List, Literal, Optional
from hmac import compare_digest
from math import ceil
from time import monotonic
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.neighborhood import Neighborhood
from app.schemas.neighborhood import (
    NeighborhoodSummarySchema,
    NeighborhoodFullReportSchema,
)
from app.services.ai_service import generate_kotekli_ai_report, generate_neighborhood_ai_report
from app.services.cache_service import (
    get_cached_report,
    set_cached_report,
    invalidate_cached_report,
)
from app.services.kotekli_report import build_kotekli_report, kotekli_pilot_evidence, load_kotekli_pilot
from app.services.scoring_service import get_scoring_methodology

router = APIRouter(prefix="/neighborhoods", tags=["Neighborhoods & AI Reports"])
refresh_token_header = APIKeyHeader(name="X-AI-Refresh-Token", auto_error=False)


def _search_text(value: str) -> str:
    """Literal, accent-insensitive search for the small pilot dataset."""
    decomposed = unicodedata.normalize("NFKD", value.casefold().replace("ı", "i"))
    return "".join(char for char in decomposed if not unicodedata.combining(char))


@router.get("", response_model=List[NeighborhoodSummarySchema])
def list_neighborhoods(
    q: Optional[str] = Query(None, max_length=100, description="Search by neighborhood or district name"),
    profile: Optional[Literal["student", "family", "professional"]] = Query(
        None, description="Sort by suitability profile: student | family | professional"
    ),
    db: Session = Depends(get_db),
):
    """Lists or searches Muğla pilot neighborhoods with summary scores."""
    results = db.query(Neighborhood).all()
    if q:
        search_term = _search_text(q.strip())
        results = [
            item for item in results
            if any(search_term in _search_text(value) for value in (
                item.name, item.district, item.slug, item.tagline
            ))
        ]
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
    request: Request,
    response: Response,
    refresh_ai: bool = Query(
        False, description="Force live Gemini LLM generation if API key is configured"
    ),
    refresh_token: Optional[str] = Security(refresh_token_header),
    db: Session = Depends(get_db),
):
    """Return a pilot report and indicate whether it was served from cache."""
    if refresh_ai:
        expected_token = settings.AI_REFRESH_TOKEN
        if not expected_token or len(expected_token) < 32:
            raise HTTPException(status_code=403, detail="Live AI refresh is disabled.")
        if not refresh_token or not compare_digest(refresh_token.encode(), expected_token.encode()):
            raise HTTPException(status_code=403, detail="Invalid AI refresh token.")
        if not settings.GEMINI_API_KEY or not settings.GEMINI_MODEL:
            raise HTTPException(status_code=503, detail="Live AI provider is not configured.")

    neighborhood = (
        db.query(Neighborhood).filter(Neighborhood.slug == slug.lower().strip()).first()
    )
    if not neighborhood:
        raise HTTPException(
            status_code=404,
            detail=f"Neighborhood '{slug}' not found in Muğla pilot dataset.",
        )

    pilot = load_kotekli_pilot() if neighborhood.slug == "kotekli" else None
    if pilot and refresh_ai and not settings.REPORT_CACHE_ENABLED:
        raise HTTPException(status_code=503, detail="Kötekli refresh requires the report cache.")

    if refresh_ai:
        with request.app.state.ai_refresh_lock:
            now = monotonic()
            remaining = request.app.state.ai_refresh_not_before - now
            if remaining > 0:
                raise HTTPException(
                    status_code=429,
                    detail="Wait before requesting another live report.",
                    headers={"Retry-After": str(ceil(remaining))},
                )
            request.app.state.ai_refresh_not_before = now + 60

    refreshed_report = None
    if pilot and refresh_ai:
        refreshed_report = build_kotekli_report(neighborhood.id, pilot[0])
        try:
            refreshed_report["ai_report"] = generate_kotekli_ai_report(pilot[0], refreshed_report)
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Gemini could not generate a valid Kötekli report. The cache was not changed.",
            ) from None

    # Keep a local cache fill from racing a completed Gemini refresh in this process.
    cache_lock = request.app.state.ai_refresh_lock if pilot else nullcontext()
    with cache_lock:
        cache_version = pilot[1] if pilot else None
        # Kötekli must bypass any cached M1 demo report or older pilot snapshot.
        if not refresh_ai and settings.REPORT_CACHE_ENABLED:
            cached_result = get_cached_report(db, neighborhood.slug, model_version=cache_version)
            if cached_result is not None:
                cached_data, hit_count = cached_result
                response.headers["X-Cache"] = "HIT"
                response.headers["X-Cache-Hits"] = str(hit_count)
                if pilot and "pilot_evidence" not in cached_data:
                    # Keep valid narratives cached before the evidence field was added.
                    return {**cached_data, "pilot_evidence": kotekli_pilot_evidence(pilot[0])}
                return cached_data

        report_payload = refreshed_report
        if report_payload is None:
            report_payload = (
                build_kotekli_report(neighborhood.id, pilot[0])
                if pilot else _build_demo_report(neighborhood, force_live_llm=refresh_ai)
            )

        if settings.REPORT_CACHE_ENABLED:
            model_version = cache_version or report_payload["ai_report"]["generated_by"]
            set_cached_report(
                db,
                neighborhood.slug,
                report_payload,
                ttl_seconds=settings.REPORT_CACHE_TTL_SECONDS,
                model_version=model_version,
            )

        response.headers["X-Cache"] = "MISS"
        response.headers["X-Cache-Hits"] = "0"
        return report_payload


def _build_demo_report(neighborhood: Neighborhood, force_live_llm: bool) -> dict:
    ai_report = generate_neighborhood_ai_report(
        neighborhood, force_live_llm=force_live_llm
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


@router.delete("/{slug}/cache", tags=["Neighborhoods & AI Reports"])
def delete_neighborhood_cache(
    slug: str,
    refresh_token: Optional[str] = Security(refresh_token_header),
    db: Session = Depends(get_db),
):
    """Invalidate cached report for a specific neighborhood."""
    expected_token = settings.AI_REFRESH_TOKEN
    if not expected_token or len(expected_token) < 32:
        raise HTTPException(status_code=403, detail="Cache invalidation is disabled.")
    if not refresh_token or not compare_digest(refresh_token.encode(), expected_token.encode()):
        raise HTTPException(status_code=403, detail="Invalid token for cache invalidation.")

    deleted = invalidate_cached_report(db, slug)
    return {"slug": slug, "cache_invalidated": deleted}
