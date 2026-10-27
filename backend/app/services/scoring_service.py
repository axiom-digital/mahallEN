"""
Transparent & Documented Scoring Engine for MahallEN (Risk R-03 Mitigation).
Calculates overall livability; profile scores currently come from the demo dataset.
"""

from typing import Dict

SCORE_WEIGHTS: Dict[str, float] = {
    "safety": 0.25,
    "transportation": 0.25,
    "cost_affordability": 0.25,
    "disaster_resilience": 0.25,
}


def compute_overall_livability(
    safety: int,
    transportation: int,
    cost_affordability: int,
    disaster_resilience: int,
) -> int:
    """Computes weighted overall livability score (0-100)."""
    weighted = (
        safety * SCORE_WEIGHTS["safety"]
        + transportation * SCORE_WEIGHTS["transportation"]
        + cost_affordability * SCORE_WEIGHTS["cost_affordability"]
        + disaster_resilience * SCORE_WEIGHTS["disaster_resilience"]
    )
    return max(0, min(100, round(weighted)))


def get_scoring_methodology() -> dict:
    """Returns transparent explanation of how scores are calculated."""
    return {
        "weights": {
            "Safety & News Sentiment": "25%",
            "Transportation & Accessibility": "25%",
            "Rent & Cost Affordability": "25%",
            "Earthquake & Disaster Resilience": "25%",
        },
        "note": (
            "M1 demo scores are illustrative values between 0 and 100. Overall livability "
            "uses equal 25% category weights. Validated source data and survey-derived "
            "weights are planned project work."
        ),
    }
