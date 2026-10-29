from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
import logging

from sqlalchemy.orm import Session
from app.models.report_cache import ReportCache

logger = logging.getLogger(__name__)


def get_cached_report(
    db: Session, slug: str
) -> Optional[Tuple[Dict[str, Any], int]]:
    """
    Retrieves cached report data if present and not expired.
    Increments hit_count on cache hit.
    Returns (report_data, hit_count) or None.
    """
    normalized_slug = slug.lower().strip()
    cache_entry = (
        db.query(ReportCache)
        .filter(ReportCache.slug == normalized_slug)
        .first()
    )
    if not cache_entry:
        return None

    now = datetime.now(timezone.utc)
    # Check if entry is expired
    entry_expires = cache_entry.expires_at
    if entry_expires.tzinfo is None:
        entry_expires = entry_expires.replace(tzinfo=timezone.utc)

    if entry_expires <= now:
        logger.info(f"Cache expired for '{normalized_slug}'")
        return None

    cache_entry.hit_count += 1
    db.commit()
    return cache_entry.report_data, cache_entry.hit_count


def set_cached_report(
    db: Session,
    slug: str,
    report_data: Dict[str, Any],
    ttl_seconds: int = 86400,
    model_version: str = "demo-synthesis",
) -> ReportCache:
    """
    Stores or updates generated report data in the database with TTL.
    Resets hit_count to 0.
    """
    normalized_slug = slug.lower().strip()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=max(ttl_seconds, 1))

    cache_entry = (
        db.query(ReportCache)
        .filter(ReportCache.slug == normalized_slug)
        .first()
    )

    if cache_entry:
        cache_entry.report_data = report_data
        cache_entry.model_version = model_version
        cache_entry.cached_at = now
        cache_entry.expires_at = expires_at
        cache_entry.hit_count = 0
    else:
        cache_entry = ReportCache(
            slug=normalized_slug,
            report_data=report_data,
            model_version=model_version,
            cached_at=now,
            expires_at=expires_at,
            hit_count=0,
        )
        db.add(cache_entry)

    db.commit()
    db.refresh(cache_entry)
    logger.info(f"Report cached for '{normalized_slug}' with TTL {ttl_seconds}s")
    return cache_entry


def invalidate_cached_report(db: Session, slug: str) -> bool:
    """
    Removes cached report entry from database to force fresh generation.
    Returns True if an entry was removed, False otherwise.
    """
    normalized_slug = slug.lower().strip()
    cache_entry = (
        db.query(ReportCache)
        .filter(ReportCache.slug == normalized_slug)
        .first()
    )
    if cache_entry:
        db.delete(cache_entry)
        db.commit()
        logger.info(f"Cache invalidated for '{normalized_slug}'")
        return True
    return False
