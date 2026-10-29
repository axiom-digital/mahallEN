from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.neighborhoods import router as neighborhoods_router
from app.core.config import settings
from app.core.database import Base, _create_db_engine, create_session_factory
from app.services.seed_service import seed_initial_data


def create_app(database_url: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        engine, backend = _create_db_engine(database_url)
        application.state.database_backend = backend
        application.state.session_factory = create_session_factory(engine)
        try:
            Base.metadata.create_all(bind=engine)
            with application.state.session_factory() as db:
                seed_initial_data(db)
            yield
        finally:
            engine.dispose()

    application = FastAPI(
        title=settings.APP_NAME,
        description=(
            "MahallEN M1 project skeleton (SE3003 Team Axiom). "
            "Uses illustrative pilot data; source validation and live integration are planned work."
        ),
        version="0.1.0",
        debug=settings.DEBUG,
        lifespan=lifespan,
    )
    application.state.ai_refresh_lock = Lock()
    application.state.ai_refresh_not_before = 0.0
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "DELETE"],
        allow_headers=["Content-Type", "X-AI-Refresh-Token"],
        expose_headers=["X-Cache", "X-Cache-Hits"],
    )
    application.include_router(neighborhoods_router, prefix="/api/v1")

    @application.get("/api/v1/health", tags=["System"])
    def health_check(request: Request):
        return {
            "status": "ok",
            "project": "MahallEN - AI-Powered Neighborhood Livability Report",
            "team": "Axiom (SE3003)",
            "database_backend": request.app.state.database_backend,
            "llm_provider": "Demo synthesis (sample data)",
            "data_mode": "demo",
            "pilot_region": "Muğla (Menteşe & Ula)",
        }

    return application


app = create_app()
