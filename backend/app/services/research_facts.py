"""Typed, source-grounded observations shared by the writer, UI and scoring."""
import re
from datetime import date
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field
from app.services.place_service import normalize

RESEARCH_VERSION = 5
OFFICIAL_TRANSPORT = {"ulasim.muttas.com.tr", "eshot.gov.tr", "iett.istanbul", "iett.istanbul.tr",
    "ego.gov.tr", "metro.istanbul", "izmir.bel.tr", "izdeniz.com.tr", "sehirhatlari.istanbul",
    "ulasim.istanbul", "burulas.com.tr", "estram.com.tr", "ulasim.mersin.bel.tr"}
PORTAL_RENT_HOSTS = ("emlakjet.com", "hepsiemlak.com", "sahibinden.com")
ALLOWED_ROOMS = {"1+0", "1+1", "2+0", "2+1", "3+1", "4+1"}


def _norm_portal_room(raw_room):
    s = str(raw_room or "").strip().lower().replace(",", ".")
    if s in {"stüdyo", "studyo", "1+0"}:
        return "1+0"
    if s == "3.5+1":
        return "3+1"
    return s if s in ALLOWED_ROOMS else None


def _extract_portal_rents(location, sources, supports, existing_pairs):
    """Deterministically capture verified multi-room listings from portal category pages."""
    place_name = location.get("name") or ""
    if not place_name:
        return []
    norm_name = normalize(place_name)
    slug_name = norm_name.replace(" ", "-")
    compact_name = norm_name.replace(" ", "")
    seen_pairs = set(existing_pairs)
    extracted = []

    for sup in supports:
        if len(seen_pairs) >= 20:
            break
        if sup.get("category") not in (None, "rent_cost"):
            continue
        refs = [sources[sid] for sid in sup.get("source_ids", []) if sid in sources]
        scoped_refs = []
        for ref in refs:
            url = str(ref.get("url") or "")
            url_lower = url.lower()
            if "satilik" in url_lower or "satılık" in url_lower:
                continue
            host = (urlparse(url).hostname or "").removeprefix("www.")
            if not any(host == dom or host.endswith("." + dom) for dom in PORTAL_RENT_HOSTS):
                continue
            scope_text = normalize(url + " " + str(ref.get("title") or ""))
            if (normalize(location["district"]) in scope_text
                    and any(re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", scope_text)
                            for name in (norm_name, slug_name, compact_name))):
                scoped_refs.append(ref)
        if not scoped_refs:
            continue

        text = str(sup.get("text") or "")
        if not text:
            continue
        candidates = []
        price_pat = r"(?:\d{1,3}(?:[.,]\d{3})+\s*(?:TL\b|₺|TRY\b))"
        for m in re.finditer(r"\b([1-4]\+[01]|3[.,]5\+1|stüdyo)\b(.{0,180}?)(\d{1,3}(?:[.,]\d{3})+)\s*(?:TL\b|₺|TRY\b)", text, re.I | re.S):
            between = m.group(2)
            if re.search(r"\b(?:[1-4]\+[01]|3[.,]5\+1|stüdyo)\b", between, re.I) or re.search(price_pat, between, re.I):
                continue
            candidates.append((m.group(1), m.group(3), m.start(3), m.end(), m.group()))
        matched_price_starts = {c[2] for c in candidates}
        for m in re.finditer(r"(\d{1,3}(?:[.,]\d{3})+)\s*(?:TL\b|₺|TRY\b)(.{0,120}?)\b([1-4]\+[01]|3[.,]5\+1|stüdyo)\b", text, re.I | re.S):
            if m.start(1) in matched_price_starts:
                continue
            between = m.group(2)
            if re.search(price_pat, between, re.I):
                continue
            candidates.append((m.group(3), m.group(1), m.start(1), m.start(2), m.group()))

        for raw_room, raw_price, p_start, p_end, listing in candidates:
            # A date elsewhere on a portal results page can belong to a different home.
            posted = None
            dates = re.findall(r"\b(20\d\d-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]20\d\d)\b", listing)
            if len(dates) == 1:
                raw = dates[0]
                if "-" not in raw:
                    d, m, y = map(int, re.split(r"[./]", raw))
                    raw = f"{y:04}-{m:02}-{d:02}"
                posted = iso_date(raw)
            if len(seen_pairs) >= 20:
                break
            after = text[p_end:min(len(text), p_end + 20)].lower()
            before = text[max(0, p_start - 20):p_start].lower()
            window = normalize(text[max(0, p_start - 60):min(len(text), p_end + 60)])
            if re.search(r"^\s*(?:/\s*m|m2|metrekare|satılık)", after) or re.search(r"(?:depozito|aidat)\s*[:=-]?\s*$", before):
                continue
            if re.search(r"ortalama|medyan|endeks|gunluk|haftalik|sezonluk|gecelik|satilik", window):
                continue
            room = _norm_portal_room(raw_room)
            amount = int(re.sub(r"[.,]", "", raw_price))
            if not room or not (8000 <= amount <= 180000):
                continue
            if (room, amount) in seen_pairs:
                continue
            seen_pairs.add((room, amount))
            extracted.append({
                "id": f"portal-r:{len(extracted)+1}",
                "sources": scoped_refs[:1],
                "date": posted,
                "amount": amount,
                "rooms": room,
                "eligible": bool(posted),
                "lease": "monthly",
                "description": f"{scoped_refs[0].get('title') or place_name} ({room})",
            })
    return extracted


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


def finding_date(finding, support, refs):
    if finding.category != "safety_news":
        return source_date(finding.details.date, support, refs)
    posted = source_date(finding.details.published_date, support, refs)
    if posted:
        return posted
    dates = {iso_date((ref.get("published_date") or "")[:10]) for ref in refs}
    return dates.pop() if len(dates) == 1 else None


def grounded_record(location, reference_date, findings, sources, supports):
    record = {**location, "asOf": reference_date, "rents": [], "rent_benchmarks": [], "routes": [], "venues": [],
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
        posted = finding_date(f, support, refs)
        text = normalize(support)
        base = {"id": f"fact:{index+1}", "sources": refs, "date": posted}
        if f.category == "rent_cost" and details.amount_tl:
            if normalize(location["name"]) not in normalize(f.evidence_quote):
                continue  # A category page also contains recommendations in other localities.
            amount = details.amount_tl
            # The value must literally appear as a price, not an area/count/phone number.
            compact = re.sub(r"[.,](?=\d{3}\b)", "", f.evidence_quote)
            price = rf"(?<!\d){int(amount)}(?:,00)?\s*(?:TL\b|₺|TRY\b)"
            if not re.search(price, compact, re.I):
                continue
            combined_norm = normalize(f.text + " " + f.evidence_quote)
            if re.search(r"ortalama|medyan|en ucuz|en pahali|en dusuk|en yuksek|endeks", combined_norm):
                if 5000 <= amount <= 500000 and re.search(r"ortalama|medyan|endeks", combined_norm):
                    b_key = ("benchmark", tuple(sorted(f.source_ids)), amount)
                    if b_key not in seen:
                        record["rent_benchmarks"].append({
                            **base,
                            "amount": amount,
                            "rooms": details.rooms or "genel",
                            "basis": "market_index",
                            "description": f.text,
                        })
                        seen.add(b_key)
                continue  # Category/market statistics never enter individual listings.
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
                "convenience", "marketplace", "bakery", "park", "playground", "community_centre", "arts_centre", "cinema",
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
    existing_pairs = {(r.get("rooms"), int(r["amount"])) for r in record["rents"] if r.get("amount")}
    record["rents"].extend(_extract_portal_rents(location, sources, supports, existing_pairs))
    return record
