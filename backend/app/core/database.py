import logging

from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings

logger = logging.getLogger(__name__)
Base = declarative_base()


def _create_db_engine(database_url: str | None = None):
    """Connect at application startup, never when importing models or tests."""
    db_url = database_url or settings.DATABASE_URL
    options = {"pool_pre_ping": True}
    if db_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if db_url in ("sqlite://", "sqlite:///:memory:"):
            options["poolclass"] = StaticPool
    elif db_url.startswith("postgresql"):
        options["connect_args"] = {"connect_timeout": 5}

    engine = create_engine(db_url, **options)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        engine.dispose()
        if (
            settings.AUTO_FALLBACK_SQLITE
            and settings.APP_ENV == "development"
            and not db_url.startswith("sqlite")
        ):
            logger.warning("Primary database unavailable; using development SQLite fallback.")
            fallback, _ = _create_db_engine("sqlite:///./mahallen_local.db")
            return fallback, "sqlite_fallback"
        raise
    return engine, engine.dialect.name


def get_db(request: Request):
    """Yield a session belonging to this application instance."""
    with request.app.state.session_factory() as db:
        yield db


def create_session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)
