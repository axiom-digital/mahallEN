"""Typed, source-grounded observations shared by the writer, UI and scoring."""
import re
from datetime import date
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field
from app.services.place_service import normalize

RESEARCH_VERSION = 3
OFFICIAL_TRANSPORT = {"ulasim.muttas.com.tr", "eshot.gov.tr", "iett.istanbul", "iett.istanbul.tr",
    "ego.gov.tr", "metro.istanbul", "izmir.bel.tr", "izdeniz.com.tr", "sehirhatlari.istanbul",
    "ulasim.istanbul", "burulas.com.tr", "estram.com.tr"}


class FactDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str | None = None
    published_date: str | None = None
    amount_tl: float | None = Field(default=None, gt=0)
    rooms: str | None = None
    payment_period: str | None = None
    name: str | None = None
    venue_type: str | None = None
    address: str | None = None
    route_code: str | None = None
    route_name: str | None = None
    local_evidence: str | None = None


def iso_date(value):
    try:
        return date.fromisoformat(value).isoformat()
    except (TypeError, ValueError):
        return None


def source_date(value, support, sources):
    """A date needs an explicit year/day/month in evidence or provider metadata."""
    parsed = iso_date(value)
    if not parsed:
        return None
    if any(iso_date(s.get("published_date", "")[:10]) == parsed for s in sources):
        return parsed
    y, m, d = map(int, parsed.split("-"))
    months = "ocak şubat mart nisan mayıs haziran temmuz ağustos eylül ekim kasım aralık".split()
    text = normalize(support)
    patterns = [rf"\b{y}-{m:02}-{d:02}\b", rf"\b0?{d}[./]0?{m}[./]{y}\b",
        rf"\b0?{d}\s+{normalize(months[m-1])}\s+{y}\b"]
    return parsed if any(re.search(p, text) for p in patterns) else None


def grounded_record(location, reference_date, findings, sources, supports):
    record = {**location, "asOf": reference_date, "rents": [], "routes": [], "venues": [],
              "news": [], "hazard": {}, "transportAlerts": []}
    seen = set()
    for index, f in enumerate(findings):
        details = f.details
        if not details:
            continue
        refs = [sources[s] for s in f.source_ids]
        support = "\n".join(s["text"] for s in supports if set(f.source_ids) & set(s["source_ids"]))
        support += "\n" + "\n".join(s.get("title", "") for s in refs)
        local = details.local_evidence or f.evidence_quote
        if normalize(local) not in normalize(support):
            local = f.evidence_quote
        if normalize(location["name"]) not in normalize(local):
            continue
        posted = source_date(details.published_date if f.category == "safety_news" else details.date, support, refs)
        text = normalize(support)
        base = {"id": f"fact:{index+1}", "sources": refs, "date": posted}
        if f.category == "rent_cost" and details.amount_tl:
            if normalize(location["name"]) not in normalize(f.evidence_quote):
                continue  # A category page also contains recommendations in other localities.
            if re.search(r"ortalama|medyan|en ucuz|en pahali|en dusuk|en yuksek", normalize(f.text + " " + f.evidence_quote)):
                continue  # Category statistics are not individual listings.
            amount = details.amount_tl
            # The value must literally appear as a price, not an area/count/phone number.
            compact = f.evidence_quote.replace(".", "")
            price = rf"(?<!\d){int(amount)}(?:,00)?\s*(?:TL\b|₺|TRY\b)"
            if not re.search(price, compact, re.I):
                continue
            rooms = details.rooms if details.rooms and details.rooms in f.evidence_quote else "Belirtilmemiş"
            posted = source_date(details.date, f.evidence_quote, refs)
            monthly = details.payment_period == "month" and bool(re.search(r"aylık|/\s*ay\b|per month|monthly", f.evidence_quote, re.I))
            base["date"] = posted
            key = ("rent", tuple(sorted(f.source_ids)), amount, rooms)
            if key not in seen:
                record["rents"].append({**base, "amount": amount, "rooms": rooms,
                    "eligible": monthly and bool(posted), "lease": "monthly" if monthly else "unknown",
                    "description": f.text})
                seen.add(key)
        elif f.category == "transportation":
            official = any((urlparse(s["url"]).hostname or "").removeprefix("www.") in OFFICIAL_TRANSPORT for s in refs)
            code = details.route_code
            if not official or any("iptal" in normalize(s.get("title", "")) for s in refs):
                continue
            candidates = [(code, details.route_name or f.text)] if code else re.findall(
                r"\b(\d{1,3}[A-Z]{0,3})\s*/\s*(.*?)(?=\s+\d{1,3}[A-Z]{0,3}\s*/|$)", f.evidence_quote, re.S)
            for route_code, route_name in candidates:
                if not re.search(r"(?<!\w)" + re.escape(route_code) + r"(?!\w)", f.evidence_quote, re.I):
                    continue
                key = ("route", route_code.casefold())
                if key not in seen:
                    record["routes"].append({**base, "id": base["id"] + ":" + route_code, "code": route_code,
                        "route": route_name.strip(), "localEvidence": f.text, "officialHeadingVerified": True})
                    seen.add(key)
        elif f.category == "social_life" and details.name and (normalize(details.name) in text or
                re.sub(r"\W", "", normalize(details.name)) in re.sub(r"\W", "", text)):
            allowed = {"cafe", "restaurant", "fast_food", "bar", "pub", "nightclub", "live_music", "supermarket",
                "convenience", "marketplace", "park", "playground", "community_centre", "arts_centre", "cinema",
                "theatre", "library", "sports_centre", "fitness_centre"}
            if details.venue_type not in allowed:
                continue
            key = ("venue", normalize(details.name))
            if key not in seen:
                record["venues"].append({**base, "name": details.name, "type": details.venue_type,
                    "address": details.address if details.address and normalize(details.address) in text else None,
                    "scope": "reported_address"})
                seen.add(key)
        elif f.category == "safety_news":
            record["news"].append({**base, "summary": f.text,
                "date_basis": "publication_date",
                "type": "asayiş" if re.search("ölüm|öldür|silah|yarala|darp|hırsız|gasp", f.text, re.I) else "gündem"})
    return record
