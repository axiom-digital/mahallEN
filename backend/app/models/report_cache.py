from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.core.database import Base


class ReportCache(Base):
    """Persistent storage and TTL tracking for generated neighborhood reports."""

    __tablename__ = "report_caches"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    report_data = Column(JSON, nullable=False)
    model_version = Column(String(100), nullable=False, default="demo-synthesis")
    cached_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    hit_count = Column(Integer, default=0, nullable=False)
