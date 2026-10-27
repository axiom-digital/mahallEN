from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, JSON
from app.core.database import Base


class Neighborhood(Base):
    """Stores pilot neighborhood metadata, raw metrics, and cached AI report."""

    __tablename__ = "neighborhoods"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(120), index=True, nullable=False)
    district = Column(String(100), nullable=False, default="Menteşe")
    city = Column(String(100), nullable=False, default="Muğla")
    tagline = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Category scores (0 - 100)
    overall_score = Column(Integer, nullable=False)
    safety_score = Column(Integer, nullable=False)
    transport_score = Column(Integer, nullable=False)
    cost_score = Column(Integer, nullable=False)
    disaster_safety_score = Column(Integer, nullable=False)

    # Suitability scores (0 - 100)
    suitability_student = Column(Integer, nullable=False)
    suitability_family = Column(Integer, nullable=False)
    suitability_professional = Column(Integer, nullable=False)

    # Domain metrics
    avg_rent_tl = Column(Integer, nullable=False)
    rent_range_tl = Column(String(100), nullable=False)
    rent_trend_6m = Column(String(50), nullable=False)
    bus_frequency_min = Column(Integer, nullable=False)
    distance_to_campus_km = Column(Float, nullable=False)
    distance_to_center_km = Column(Float, nullable=False)
    pga_value_g = Column(Float, nullable=False)
    soil_class = Column(String(50), nullable=False)
    earthquake_risk_level = Column(String(50), nullable=False)

    # Structured evidence lists stored as JSON
    news_items = Column(JSON, nullable=False, default=list)
    community_comments = Column(JSON, nullable=False, default=list)
    transport_highlights = Column(JSON, nullable=False, default=list)
    data_sources = Column(JSON, nullable=False, default=list)

    # Pre-generated or cached AI synthesis
    ai_summary = Column(Text, nullable=True)
    ai_pros = Column(JSON, nullable=False, default=list)
    ai_cons = Column(JSON, nullable=False, default=list)
    ai_disclaimer = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
