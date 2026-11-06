"""Prepare full cached reports from the ten saved evidence packages, without web search.

Run from backend: python scripts/prepare_place_reports.py
Existing complete, unexpired reports are reused; failures preserve the source package.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.report_cache import ReportCache
from app.services.cache_service import set_cached_report
from app.services.place_assessment import assess_place_report
from app.services.place_service import DATASET, place_id, saved_report


def current(row):
    if not row or row.report_data.get("report_version") != 3:
        return False
    expiry = row.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return expiry > datetime.now(timezone.utc)


def main():
    engine = create_engine(settings.DATABASE_URL)
    records = json.loads(DATASET.read_text(encoding="utf-8"))["neighborhoods"]

    def prepare(record):
        identity = place_id(record)
        key = "place:" + identity
        with Session(engine) as db:
            row = db.query(ReportCache).filter_by(slug=key).first()
            if current(row):
                return record["name"], "HIT"
            evidence = row.report_data if row else saved_report(record, identity)
        try:
            report = assess_place_report(evidence)
            with Session(engine) as db:
                if not current(db.query(ReportCache).filter_by(slug=key).first()):
                    set_cached_report(db, key, report, settings.REPORT_CACHE_TTL_SECONDS, "places-v3:rules")
            return record["name"], "PREPARED"
        except Exception as error:
            # Never log provider request headers or credential-bearing responses.
            return record["name"], "FAILED: " + type(error).__name__

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(prepare, records))
    for name, status in results:
        print(name + ": " + status)
    return 1 if any(status.startswith("FAILED") for _, status in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
