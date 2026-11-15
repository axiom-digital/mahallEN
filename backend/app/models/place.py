from sqlalchemy import Column, String, JSON
from app.core.database import Base


class Place(Base):
    """Resolved neighborhood identity, independent of the five demo rows."""
    __tablename__ = "resolved_places"
    id = Column(String(40), primary_key=True)
    target = Column(JSON, nullable=False)
