import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.place import Place
from app.services import place_service, place_research, place_assessment
from app.services.cache_service import get_cached_report, set_cached_report
from app.services.research_progress import track

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/places", tags=["Neighborhood search"])


@router.get("/suggest")
def suggest_places(q: str = Query(min_length=2, max_length=150), db: Session = Depends(get_db)):
    # Search-as-you-type stays local. It does not call the public Nominatim API.
    results = [place_service.register(db, target) for target in place_service.suggest_neighborhoods(q)]
    return {"results": [place_service.public_place(db, row) for row in results]}


@router.get("/search")
def search_places(q: str = Query(min_length=2, max_length=150), db: Session = Depends(get_db)):
    words = [w for w in place_service.normalize(q).split() if w not in {"mahallesi", "mah"}]
    if not words:
        raise HTTPException(400, "Mahalle adıyla birlikte ilçe veya şehir yazabilirsin.")
    local = [p for p in db.query(Place).all() if all(w in place_service.normalize(
        " ".join(p.target[k] for k in ("name", "district", "city"))) for w in words)]
    notice = None
    try:
        found = place_service.suggest_neighborhoods(q.strip(), limit=20)
        if not found:
            found = place_service.lookup_neighborhoods(q.strip())
    except Exception as error:
        logger.warning("Place lookup unavailable: %s", type(error).__name__)
        if not local:
            raise HTTPException(503, "Mahalle arama servisine şu anda ulaşılamıyor. Tekrar deneyebilirsin.") from None
        found = []
        notice = "Arama servisine ulaşılamadı; eşleşen kayıtlı mahalleler gösteriliyor."
    results = {p.id: p for p in local}
    for target in found:
        p = place_service.register(db, target)
        results[p.id] = p
    return {"results": [place_service.public_place(db, p) for p in results.values()], "notice": notice,
            "attribution": "© OpenStreetMap contributors"}


def require_place(db, identity):
    place = db.get(Place, identity)
    if not place:
        raise HTTPException(404, "Mahalle bulunamadı. Önce aramadan bir mahalle seç.")
    return place


@router.get("/{identity}")
def place_details(identity: str, db: Session = Depends(get_db)):
    return place_service.public_place(db, require_place(db, identity))


@router.get("/{identity}/report/status")
def report_status(identity: str, request: Request, db: Session = Depends(get_db)):
    require_place(db, identity)
    active = request.app.state.place_report_progress.get(identity)
    if active:
        return {"phase": active}
    cached = get_cached_report(db, "place:" + identity, increment_hit=False)
    return {"phase": "ready" if cached and place_assessment.is_current_report(cached[0]) else "checking"}


@router.get("/{identity}/report")
def read_report(identity: str, response: Response, db: Session = Depends(get_db)):
    require_place(db, identity)
    cached = get_cached_report(db, "place:" + identity)
    if cached is None or not place_assessment.is_current_report(cached[0]):
        raise HTTPException(404, "Bu mahalle için tam rapor henüz hazırlanmadı.")
    response.headers["X-Cache"] = "HIT"
    response.headers["X-Cache-Hits"] = str(cached[1])
    return place_assessment.with_score_summary(cached[0])


@router.post("/{identity}/report")
def prepare_report(identity: str, request: Request, response: Response, db: Session = Depends(get_db)):
    place = require_place(db, identity)
    # Fixed lock stripes bound memory and make concurrent clicks on one locality
    # share the same completed report in this API process.
    lock = request.app.state.place_report_locks[int(identity[:8], 16) % 32]
    with lock:
        cached = get_cached_report(db, "place:" + identity)
        if cached is not None and place_assessment.is_current_report(cached[0]):
            response.headers["X-Cache"] = "HIT"
            return place_assessment.with_score_summary(cached[0])
        if not settings.REPORT_CACHE_ENABLED:
            raise HTTPException(503, "Rapor hazırlamak için sunucu önbelleği etkin olmalı.")
        if not request.app.state.place_generation_slots.acquire(blocking=False):
            raise HTTPException(429, "Şu anda başka raporlar hazırlanıyor. Biraz sonra tekrar dene.", headers={"Retry-After": "30"})
        try:
            progress = request.app.state.place_report_progress
            progress[identity] = "research" if cached is None or place_assessment.needs_research(cached[0]) else "writing"
            with track(lambda value: progress.__setitem__(identity, value)):
                report = (place_assessment.assess_place_report(cached[0]) if cached is not None and not place_assessment.needs_research(cached[0])
                          else place_research.generate_place_report(place.target, identity))
        except place_research.ResearchUnavailable as error:
            raise HTTPException(503, str(error)) from None
        except Exception as error:
            logger.warning("Place research failed: %s", type(error).__name__)
            raise HTTPException(502, "Kaynak araştırması veya rapor servisi yanıt veremedi. Rapor kaydedilmedi; tekrar deneyebilirsin.") from None
        finally:
            request.app.state.place_report_progress.pop(identity, None)
            request.app.state.place_generation_slots.release()
        set_cached_report(db, "place:" + identity, report, settings.REPORT_CACHE_TTL_SECONDS, "places-v3:rules")
        response.headers["X-Cache"] = "MISS"
        response.status_code = 201
        return report
