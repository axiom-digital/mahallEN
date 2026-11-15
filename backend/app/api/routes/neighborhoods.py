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
from app.schemas.neighborhood import (
    NeighborhoodSummarySchema,
    NeighborhoodFullReportSchema,
)
from app.services.ai_service import generate_pilot_ai_report
from app.services.cache_service import (
    get_cached_report,
    set_cached_report,
    invalidate_cached_report,
)
from app.services.pilot_report import build_pilot_report, load_pilot_neighborhoods, pilot_summary

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
):
    """List pilot neighborhoods, optionally filtered by name, district or city."""
    results = [pilot_summary(index, pilot) for index, pilot, _ in load_pilot_neighborhoods().values()]
    if q:
        search_term = _search_text(q.strip())
        results = [
            item for item in results
            if any(search_term in _search_text(item[key]) for key in ("name", "district", "city", "slug"))
        ]
    score_field = f"suitability_{profile}" if profile else "overall_score"
    results.sort(key=lambda item: (item[score_field] is None, -(item[score_field] or 0)))
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

    record = load_pilot_neighborhoods().get(slug.lower().strip())
    if record is None:
        raise HTTPException(status_code=404, detail=f"Neighborhood '{slug}' not found in the pilot dataset.")

    neighborhood_id, pilot, cache_version = record
    cache_key = pilot["geo_key"]
    if refresh_ai and not settings.REPORT_CACHE_ENABLED:
        raise HTTPException(status_code=503, detail="Live refresh requires the report cache.")

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
    if refresh_ai:
        refreshed_report = build_pilot_report(neighborhood_id, pilot)
        try:
            refreshed_report["ai_report"] = generate_pilot_ai_report(pilot, refreshed_report)
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Gemini could not generate a valid pilot report. The cache was not changed.",
            ) from None

    # Prevent a local cache fill from racing a completed live refresh in this process.
    with request.app.state.ai_refresh_lock:
        if not refresh_ai and settings.REPORT_CACHE_ENABLED:
            cached_result = get_cached_report(db, cache_key, model_version=cache_version)
            if cached_result is not None:
                cached_data, hit_count = cached_result
                response.headers["X-Cache"] = "HIT"
                response.headers["X-Cache-Hits"] = str(hit_count)
                return cached_data

        report_payload = refreshed_report or build_pilot_report(neighborhood_id, pilot)
        if settings.REPORT_CACHE_ENABLED:
            set_cached_report(
                db,
                cache_key,
                report_payload,
                ttl_seconds=settings.REPORT_CACHE_TTL_SECONDS,
                model_version=cache_version,
            )

        response.headers["X-Cache"] = "MISS"
        response.headers["X-Cache-Hits"] = "0"
        return report_payload


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

    record = load_pilot_neighborhoods().get(slug.lower().strip())
    deleted = invalidate_cached_report(db, record[1]["geo_key"]) if record else False
    return {"slug": slug, "cache_invalidated": deleted}
