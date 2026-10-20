from typing import List, Optional
from pydantic import BaseModel, Field


class NewsItemSchema(BaseModel):
    title: str
    source: str
    date: str
    sentiment: str = Field(description="positive | neutral | negative")
    summary: str


class CommunityCommentSchema(BaseModel):
    author_profile: str
    rating: int
    comment: str
    platform: str


class CategoryScoresSchema(BaseModel):
    overall_livability: int = Field(ge=0, le=100)
    safety: int = Field(ge=0, le=100)
    transportation: int = Field(ge=0, le=100)
    cost_affordability: int = Field(ge=0, le=100)
    disaster_resilience: int = Field(ge=0, le=100)


class SuitabilitySchema(BaseModel):
    students: int = Field(ge=0, le=100)
    families: int = Field(ge=0, le=100)
    professionals: int = Field(ge=0, le=100)


class RentAnalysisSchema(BaseModel):
    average_rent_tl: int
    rent_range_tl: str
    trend_6m: str


class TransportAnalysisSchema(BaseModel):
    bus_frequency_min: int
    distance_to_campus_km: float
    distance_to_center_km: float
    highlights: List[str]


class DisasterRiskSchema(BaseModel):
    risk_level: str
    pga_value_g: float
    soil_class: str


class AIReportSynthesisSchema(BaseModel):
    executive_summary: str
    pros: List[str]
    cons: List[str]
    student_verdict: str
    family_verdict: str
    professional_verdict: str
    generated_by: str
    disclaimer: str


class NeighborhoodSummarySchema(BaseModel):
    id: int
    slug: str
    name: str
    district: str
    city: str
    tagline: str
    overall_score: int
    avg_rent_tl: int
    earthquake_risk_level: str
    suitability_student: int
    suitability_family: int
    suitability_professional: int

    class Config:
        from_attributes = True


class NeighborhoodFullReportSchema(BaseModel):
    id: int
    slug: str
    name: str
    district: str
    city: str
    tagline: str
    coordinates: dict
    scores: CategoryScoresSchema
    suitability: SuitabilitySchema
    rent_analysis: RentAnalysisSchema
    transport_analysis: TransportAnalysisSchema
    disaster_risk: DisasterRiskSchema
    news_items: List[NewsItemSchema]
    community_comments: List[CommunityCommentSchema]
    data_sources: List[str]
    ai_report: AIReportSynthesisSchema
    scoring_methodology: dict
