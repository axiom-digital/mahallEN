import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()


def _create_db_engine():
    """Creates SQLAlchemy engine for PostgreSQL, with optional fallback to SQLite if Docker isn't running."""
    db_url = settings.DATABASE_URL
    try:
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Connected to primary database: %s", db_url.split("@")[-1])
        return engine, "postgresql"
    except Exception as exc:
        if settings.AUTO_FALLBACK_SQLITE and not db_url.startswith("sqlite"):
            sqlite_url = "sqlite:///./mahallen_local.db"
            logger.warning(
                "PostgreSQL connection failed (%s). Falling back to local SQLite (%s) for quick development.",
                exc,
                sqlite_url,
            )
            engine = create_engine(
                sqlite_url, connect_args={"check_same_thread": False}
            )
            return engine, "sqlite_fallback"
        raise


engine, active_db_backend = _create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
