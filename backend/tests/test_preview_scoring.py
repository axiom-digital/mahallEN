import importlib.util
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'scripts/prepare_enriched_report.py'
spec = importlib.util.spec_from_file_location('preview_scoring', path)
scoring = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scoring)


def test_hazard_direction_and_ties():
    assert scoring.hazard_score(1, [1, 2, 3, 4]) > scoring.hazard_score(4, [1, 2, 3, 4])
    assert scoring.hazard_score(2, [2, 2, 2]) == 50
    assert scoring.hazard_score(0, [1, 2, 3]) == 100
    assert scoring.hazard_score(4, [1, 2, 3]) == 0


def test_hazard_missing_data_is_not_zero_risk():
    assert scoring.hazard_score(None, [1, 2]) is None
    assert scoring.hazard_score(float('nan'), [1, 2]) is None
    assert scoring.hazard_score(.351, []) is None
    assert scoring.hazard_score(-1, [1, 2]) is None


def test_rent_budget_boundaries():
    assert scoring.rent_score(27000, 30000) == 70
    assert scoring.rent_score(30000, 30000) == 50
    assert scoring.rent_score(27000, 10000) == 0
    assert scoring.rent_score(21000, 60000) == 100
    assert scoring.rent_score(None, 30000) is None
