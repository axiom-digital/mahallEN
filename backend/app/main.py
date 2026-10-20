from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal, active_db_backend
from app.api.routes.neighborhoods import router as neighborhoods_router
from app.services.seed_service import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Creates database tables and seeds initial Muğla pilot data on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-Powered Neighborhood Livability Report API (SE3003 Team Axiom). "
        "Provides category scores, suitability ratings, rent/transport/earthquake metrics, "
        "and source-backed AI synthesis for Muğla pilot neighborhoods."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(neighborhoods_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["System"])
def health_check():
    """Returns API health, database mode, and LLM configuration status."""
    return {
        "status": "ok",
        "project": "MahallEN - AI-Powered Neighborhood Livability Report",
        "team": "Axiom (SE3003)",
        "database_backend": active_db_backend,
        "llm_provider": (
            f"Google Gemini ({settings.GEMINI_MODEL})"
            if settings.GEMINI_API_KEY
            else "Grounded Fallback Synthesis (Set GEMINI_API_KEY for live LLM)"
        ),
        "pilot_region": "Muğla (Menteşe & Ula)",
    }
