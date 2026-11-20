"""Enrich the five multi-city pilot neighborhoods with verified OSM geography and Tavily web sources.

Reads data/pilot_neighborhoods.json read-only and outputs data/scoring_research/multicity_enriched.json.
Requires TAVILY_API_KEY in environment (does not call an LLM and never modifies SHA-256 pilot files).
"""
from datetime import date, datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import settings
from app.services.place_geography import osm_geography
from app.services.place_service import normalize
from app.services.rule_scoring import OFFICIAL_HOSTS, ROOM_FACTORS, VENUE_PATTERNS, _parse_price_tl

PILOTS_PATH = ROOT / "data/pilot_neighborhoods.json"
OUT_PATH = ROOT / "data/scoring_research/multicity_enriched.json"

MONTHS_TR = {
    "ocak": 1, "subat": 2, "mart": 3, "nisan": 4, "mayis": 5, "haziran": 6,
    "temmuz": 7, "agustos": 8, "eylul": 9, "ekim": 10, "kasim": 11, "aralik": 12,
}
NEWS_EXCLUDED_HOSTS = {
    "sahibinden.com", "emlakjet.com", "hepsiemlak.com", "endeksa.com", "zingat.com",
    "trovit.com.tr", "tapu.com", "rocketreach.co", "yelp.com", "mapquest.com",
    "x.com", "twitter.com", "instagram.com", "facebook.com", "youtube.com",
    "tripadvisor.com", "sikayetvar.com", "wikipedia.org", "linkedin.com",
}
OFFICIAL_CITY_DOMAINS = {
    "İstanbul": ["iett.istanbul", "metro.istanbul", "sehirhatlari.istanbul"],
    "Ankara": ["ego.gov.tr"],
    "İzmir": ["eshot.gov.tr", "izmir.bel.tr", "izdeniz.com.tr"],
    "Eskişehir": ["estram.com.tr", "eskisehir.bel.tr"],
    "Bursa": ["burulas.com.tr", "bursa.bel.tr"],
}
BOGUS_ROUTE_NUMS = {"153", "444", "112", "155", "185", "2024", "2025", "2026"}


def _parse_single_date(raw, today_iso):
    if not raw:
        return None
    s = str(raw).strip()
    iso = re.search(r"\b(202[4-6]-\d{2}-\d{2})\b", s)
    if iso and "2024-01-01" <= iso.group(1) <= today_iso:
        return iso.group(1)
    try:
        dt = parsedate_to_datetime(s)
        cand = dt.date().isoformat()
        if "2024-01-01" <= cand <= today_iso:
            return cand
    except (TypeError, ValueError, OverflowError):
        pass
    return None


def _extract_date(text, published_date=None, url=None, today_iso="2026-11-20"):
    for candidate in (published_date, url):
        parsed = _parse_single_date(candidate, today_iso)
        if parsed:
            return parsed
        if candidate:
            slash_iso = re.search(r"/(202[4-6])/(\d{2})/(\d{2})(?:/|$)", str(candidate))
            if slash_iso:
                cand = f"{slash_iso.group(1)}-{slash_iso.group(2)}-{slash_iso.group(3)}"
                if "2024-01-01" <= cand <= today_iso:
                    return cand

    raw_text = str(text or "")
    iso = re.search(r"\b(202[4-6]-\d{2}-\d{2})\b", raw_text)
    if iso and "2024-01-01" <= iso.group(1) <= today_iso:
        return iso.group(1)
    dmy = re.search(r"\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](202[4-6])\b", raw_text)
    if dmy:
        cand = f"{int(dmy.group(3)):04d}-{int(dmy.group(2)):02d}-{int(dmy.group(1)):02d}"
        if cand <= today_iso:
            return cand
    norm = normalize(raw_text)
    tr_m = re.search(r"\b(0?[1-9]|[12]\d|3[01])\s+(" + "|".join(MONTHS_TR) + r")\s+(202[4-6])\b", norm)
    if tr_m:
        cand = f"{int(tr_m.group(3)):04d}-{MONTHS_TR[tr_m.group(2)]:02d}-{int(tr_m.group(1)):02d}"
        if cand <= today_iso:
            return cand
    return None


def _fetch_html_date(client, url, today_iso):
    try:
        resp = client.get(
            url,
            timeout=5,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MahallEN/1.0)"},
        )
        if resp.status_code != 200:
            return None
        html = resp.text[:50000]
    except (httpx.HTTPError, ValueError):
        return None

    m = re.search(
        r'(?:datePublished|article:published_time|pubdate|published_time|publish_date)["\'\s:=]+(202[4-6]-\d{2}-\d{2})',
        html,
        re.I,
    )
    if not m:
        m = re.search(r'<time[^>]+datetime=["\'](202[4-6]-\d{2}-\d{2})', html, re.I)
    cand = m.group(1) if m else _extract_date(html[:15000], today_iso=today_iso)
    if not cand or not ("2024-01-01" <= cand <= today_iso):
        return None
    try:
        age_days = (date.fromisoformat(today_iso) - date.fromisoformat(cand)).days
        return cand if 0 <= age_days <= 365 else None
    except ValueError:
        return None


def _clean_text(value):
    return " ".join(str(value or "").split())


def _norm_room(raw_room):
    s = str(raw_room or "").strip().lower().replace(",", ".")
    if s in {"stüdyo", "studyo", "stüdyo daire", "1+0"}:
        return "1+0"
    if s == "3.5+1":
        return "3+1"
    return s if s in ROOM_FACTORS else None


def _extract_route_code(title, content=""):
    for segment in (title, content[:180]):
        if not segment:
            continue
        m_pref = re.search(r"\b([TM]\d{1,2}|[AB]\d{1,2}|\d{1,3}[A-Z]{1,3})\b", segment)
        if m_pref and m_pref.group(1) not in BOGUS_ROUTE_NUMS:
            return m_pref.group(1)
        m_ctx = re.search(
            r"(?:hat|hattı|numaralı|ego|iett|eshot|estram|burulaş)\s*[:#-]?\s*(\d{1,3}(?:-\d+)?)\b"
            r"|\b(\d{1,3}(?:-\d+)?)\s*(?:no'?lu|numaralı)?\s*(?:hat|hattı|otobüs|tramvay|metro)\b",
            segment,
            re.I,
        )
        if m_ctx:
            code = m_ctx.group(1) or m_ctx.group(2)
            if code and code not in BOGUS_ROUTE_NUMS:
                return code
    return ""


def _baseline_from_pilot(pilot):
    smap = {s["id"]: s for s in pilot["sources"]}
    rec = {
        "name": pilot["name"],
        "district": pilot["district"],
        "city": pilot["city"],
        "asOf": date.today().isoformat(),
        "rents": [],
        "rent_benchmarks": [],
        "routes": [],
        "venues": [],
        "news": [],
        "transportAlerts": [],
        "hazard": {},
    }
    for cid, cat in pilot["categories"].items():
        for idx, obs in enumerate(cat.get("observations", [])):
            text = obs["text"]
            srcs = [{"id": s["id"], "publisher": s.get("publisher", "Kaynak"), "url": s["url"]}
                    for sid in obs.get("source_ids", []) if (s := smap.get(sid))]
            posted = obs.get("date") or obs.get("publication_date") or _extract_date(text)
            if cid == "rent_cost":
                amt = _parse_price_tl(text)
                rm = re.search(r"\b(\d(?:\.5)?\+\d|stüdyo)\b", text, re.I)
                room = _norm_room(rm.group(1)) if rm else None
                if amt and room and re.search(r"aylık|/\s*ay\b|kiralık|kira", text, re.I):
                    rec["rents"].append({
                        "id": f"base-r:{idx+1}", "amount": amt, "rooms": room,
                        "date": posted, "eligible": bool(posted), "lease": "monthly", "sources": srcs,
                    })
            elif cid == "transportation":
                hosts = {(urlparse(s["url"]).hostname or "").removeprefix("www.") for s in srcs}
                if hosts & OFFICIAL_HOSTS:
                    code = _extract_route_code(text)
                    if not code and not re.search(r"metro|tramvay|vapur|feribot|raylı|otobüs", text, re.I):
                        continue
                    rec["routes"].append({
                        "id": f"base-t:{idx+1}",
                        "code": code or "Hat",
                        "route": text, "localEvidence": text,
                        "officialHeadingVerified": True, "sources": srcs,
                    })
                else:
                    rec["transportAlerts"].append({"summary": text, "date": posted, "sources": srcs, "status": "reported"})
            elif cid == "social_life":
                for kind, pat in VENUE_PATTERNS:
                    found = re.findall(pat, text)
                    if found:
                        for vname in found:
                            rec["venues"].append({
                                "id": f"base-v:{idx+1}", "name": vname, "type": kind,
                                "scope": "reported_address", "sources": srcs,
                            })
                        break
            elif cid == "safety_news":
                rec["news"].append({
                    "id": f"base-n:{idx+1}", "date": posted, "summary": text,
                    "type": "asayiş" if re.search(r"ölüm|öldür|silah|yarala|darp|hırsız|gasp|soygun|ateş", text, re.I) else "gündem",
                    "sources": srcs,
                })
    h = pilot["categories"]["earthquake_hazard"].get("research", {})
    rec["hazard"] = {
        "value": h.get("value"),
        "gridDistance": h.get("distance_to_grid_point_km", 999),
        "url": h.get("source_url"),
        "title": h.get("source_title", "Jeodezik Deprem Tehlike Haritası"),
    }
    return rec


def _tavily_search(
    client,
    query,
    max_results=8,
    time_range=None,
    include_raw_content=False,
    topic=None,
    include_domains=None,
    exclude_domains=None,
    days=None,
):
    base_excluded = ["rocketreach.co", "yelp.com", "mapquest.com"]
    merged_excluded = list(dict.fromkeys([*base_excluded, *(exclude_domains or [])]))
    payload = {
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": "text" if include_raw_content else False,
        "auto_parameters": False,
        "exclude_domains": merged_excluded,
    }
    if topic == "news":
        payload["topic"] = "news"
        if days:
            payload["days"] = days
    else:
        payload["country"] = "turkey"
        if time_range:
            payload["time_range"] = time_range
    if include_domains:
        payload["include_domains"] = include_domains
    response = client.post(
        "https://api.tavily.com/search",
        headers={"Authorization": f"Bearer {settings.TAVILY_API_KEY}"},
        json=payload,
    )
    response.raise_for_status()
    return [r for r in response.json().get("results", []) if str(r.get("url", "")).startswith("https://")]


def enrich_pilot(pilot, client, today_iso):
    rec = _baseline_from_pilot(pilot)
    name, district, city = pilot["name"], pilot["district"], pilot["city"]
    norm_name = normalize(name)
    slug_name = norm_name.replace(" ", "-")

    # 1. Real coordinate-mapped OSM venues & OSM transit routes
    try:
        osm_venues, osm_routes = osm_geography(pilot, pilot["location"])
    except Exception as exc:
        print(f"  [WARN] {name} OSM geography failed: {type(exc).__name__}: {exc}", flush=True)
        osm_venues, osm_routes = [], []

    seen_venues = {" ".join(v["name"].casefold().split()) for v in rec["venues"]}
    for v in osm_venues:
        vkey = " ".join(v["name"].casefold().split())
        if vkey not in seen_venues:
            rec["venues"].append(v)
            seen_venues.add(vkey)

    seen_codes = {str(r.get("code", "")).casefold() for r in rec["routes"] if r.get("code")}
    seen_route_titles = {str(r.get("route", "")).casefold() for r in rec["routes"]}
    for rt in osm_routes:
        cc = str(rt.get("code", "")).casefold()
        tt = str(rt.get("route", "")).casefold()
        if (cc and cc in seen_codes) or tt in seen_route_titles:
            continue
        rec["routes"].append(rt)
        if cc:
            seen_codes.add(cc)
        seen_route_titles.add(tt)

    # 2. Dated local news (4 general Turkish web queries + HTML metadata fallback)
    seen_news_urls = {s["url"] for n in rec["news"] for s in n.get("sources", [])}
    seen_news_titles = {normalize(n["summary"])[:70] for n in rec["news"] if n.get("summary")}
    dated_news, undated_news = [], []

    news_spec = [
        (f"{name} Mahallesi {district} {city} haber", "year"),
        (f"{name} {district} {city} son dakika asayiş", "year"),
        (f"{name} Mahallesi {city} belediye altyapı haber", None),
        (f"{name} {city} yerel haber gündem", None),
    ]
    news_excl = list(NEWS_EXCLUDED_HOSTS)
    for q, trange in news_spec:
        if len(dated_news) >= 8:
            break
        results = _tavily_search(
            client,
            q,
            max_results=8,
            time_range=trange,
            include_raw_content=False,
            exclude_domains=news_excl,
        )
        for item in results:
            if len(dated_news) >= 8:
                break
            url = item["url"]
            host = (urlparse(url).hostname or "").removeprefix("www.")
            if url in seen_news_urls or any(host.endswith(ex) for ex in NEWS_EXCLUDED_HOSTS):
                continue
            title = _clean_text(item.get("title", ""))
            content = _clean_text(item.get("content", ""))
            combined = f"{title}. {content}".strip()
            if norm_name not in normalize(combined) or len(content) < 40:
                continue
            tkey = normalize(title)[:70]
            if tkey and tkey in seen_news_titles:
                continue
            posted = _extract_date(combined, item.get("published_date"), url, today_iso)
            if not posted:
                posted = _fetch_html_date(client, url, today_iso)
            summary = f"{title} — {content}" if title and title.lower() not in content.lower() else content
            if len(summary) > 320:
                summary = summary[:317].rsplit(" ", 1)[0] + "…"
            is_crime = bool(re.search(r"ölüm|öldür|silah|yarala|darp|hırsız|gasp|soygun|ateş|tutuk|gözaltı|cinayet|bıçak", combined, re.I))
            entry = {
                "id": f"tavily-n:{len(rec['news']) + len(dated_news) + len(undated_news) + 1}",
                "date": posted,
                "date_basis": "publication_date",
                "summary": summary,
                "type": "asayiş" if is_crime else "gündem",
                "sources": [{"id": f"news:{len(seen_news_urls)+1}", "publisher": host, "url": url}],
            }
            seen_news_urls.add(url)
            if tkey:
                seen_news_titles.add(tkey)
            if posted:
                dated_news.append(entry)
            else:
                undated_news.append(entry)

    # Keep dated articles first; if fewer than 4 dated exist, top up to 4 with undated
    existing_dated = [n for n in rec["news"] if n.get("date")]
    existing_undated = [n for n in rec["news"] if not n.get("date")]
    combined_dated = (existing_dated + dated_news)[:10]
    if len(combined_dated) < 4:
        rec["news"] = (combined_dated + (undated_news + existing_undated)[: 4 - len(combined_dated)])[:10]
    else:
        rec["news"] = combined_dated

    # 3. Deep rental listings from property portals (raw_content when URL slug matches neighborhood)
    seen_room_amount = {(r["rooms"], r["amount"]) for r in rec["rents"]}
    seen_rent_urls = {s["url"] for r in rec["rents"] for s in r.get("sources", [])}
    portal_domains = ["emlakjet.com", "hepsiemlak.com", "sahibinden.com"]
    rent_queries = [
        (f"{name} {district} {city} kiralık daire 1+1 TL", 8, portal_domains),
        (f"{name} {district} {city} kiralık daire 2+1 3+1 TL", 8, portal_domains),
        (f'"{name} Mahallesi" {district} "Kiralık Daire" TL', 10, portal_domains),
        (f"{name} {district} {city} kiralık daire 1+1 2+1 3+1 fiyat TL", 8, None),
    ]
    for q, max_res, domains in rent_queries:
        if len(rec["rents"]) >= 25:
            break
        results = _tavily_search(
            client,
            q,
            max_results=max_res,
            include_raw_content=True,
            include_domains=domains,
        )
        for item in results:
            if len(rec["rents"]) >= 25:
                break
            url = item["url"]
            if "satilik" in url.lower() or "satılık" in url.lower():
                continue
            host = (urlparse(url).hostname or "").removeprefix("www.")
            title = _clean_text(item.get("title", ""))
            content = _clean_text(item.get("content", ""))
            raw = item.get("raw_content") or ""
            url_norm = normalize(url)
            slug_match = slug_name in url_norm or norm_name.replace(" ", "") in url_norm
            if slug_match and len(raw) > 300:
                posted = _extract_date(f"{title} {content}", item.get("published_date"), url, today_iso)
                pairs = re.findall(r"\b([1-4]\+[01]|3\.5\+1|Stüdyo)\b.{0,180}?(\d{1,3}(?:[.,]\d{3})+)\s*(?:TL|₺)", raw, re.I | re.S)
                pairs += [
                    (rm, pr)
                    for pr, rm in re.findall(r"(\d{1,3}(?:[.,]\d{3})+)\s*(?:TL|₺).{0,120}?\b([1-4]\+[01]|3\.5\+1|Stüdyo)\b", raw, re.I | re.S)
                ]
                for raw_room, raw_price in pairs:
                    if len(rec["rents"]) >= 25:
                        break
                    room = _norm_room(raw_room)
                    amount = int(re.sub(r"[.,]", "", raw_price))
                    if not room or not (8000 <= amount <= 180000):
                        continue
                    if (room, amount) in seen_room_amount:
                        continue
                    seen_room_amount.add((room, amount))
                    rec["rents"].append({
                        "id": f"tavily-r:{len(rec['rents'])+1}",
                        "amount": amount,
                        "rooms": room,
                        "date": posted,
                        "eligible": bool(posted),
                        "lease": "monthly",
                        "description": f"{title[:90]} ({room})",
                        "sources": [{"id": f"rr:{len(rec['rents'])+1}", "publisher": host, "url": url}],
                    })
                continue

            combined = f"{title} {content}"
            if norm_name not in normalize(combined) or url in seen_rent_urls:
                continue
            posted = _extract_date(combined, item.get("published_date"), url, today_iso)
            snippet_hits = 0
            for match in re.finditer(r"(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*(?:TL|₺|TRY)\b", combined, re.I):
                after = combined[match.end():match.end() + 20].lower()
                if re.search(r"^\s*(?:/\s*m|m2|metrekare|satılık|depozito|aidat)", after):
                    continue
                amount = int(re.sub(r"[.,]", "", match.group(1)))
                if not (8000 <= amount <= 180000):
                    continue
                window = combined[max(0, match.start() - 90):min(len(combined), match.end() + 90)]
                rm = re.search(r"\b([1-4]\+[01]|3\.5\+1|stüdyo)\b", window, re.I)
                room = _norm_room(rm.group(1)) if rm else None
                if not room or (room, amount) in seen_room_amount:
                    continue
                seen_room_amount.add((room, amount))
                rec["rents"].append({
                    "id": f"tavily-r:{len(rec['rents'])+1}",
                    "amount": amount,
                    "rooms": room,
                    "date": posted,
                    "eligible": bool(posted),
                    "lease": "monthly",
                    "description": f"{title[:100]}",
                    "sources": [{"id": f"rr:{len(rec['rents'])+1}", "publisher": host, "url": url}],
                })
                seen_rent_urls.add(url)
                snippet_hits += 1
                if snippet_hits >= 2 or len(rec["rents"]) >= 25:
                    break

    # 4. Strict market rent index benchmarks (strictly endeksa.com / zingat.com only)
    seen_bench_urls = set()
    bench_results = _tavily_search(
        client,
        f"{name} {district} {city} kiralık daire ortalama fiyat endeks",
        max_results=8,
        include_raw_content=True,
    )
    for item in bench_results:
        if len(rec["rent_benchmarks"]) >= 3:
            break
        url = item["url"]
        host = (urlparse(url).hostname or "").removeprefix("www.")
        if not any(host.endswith(dom) for dom in ("endeksa.com", "zingat.com")) or url in seen_bench_urls:
            continue
        title = _clean_text(item.get("title", ""))
        content = _clean_text(item.get("content", ""))
        raw = _clean_text(item.get("raw_content") or "")
        if len(raw) < 200:
            try:
                html_res = client.get(
                    url,
                    timeout=5,
                    follow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; MahallEN/1.0)"},
                )
                if html_res.status_code == 200:
                    raw = _clean_text(re.sub(r"<[^>]+>", " ", html_res.text))[:15000]
            except (httpx.HTTPError, ValueError):
                pass
        body = f"{title} {content} {raw[:5000]}"
        if norm_name not in normalize(body):
            continue
        posted = _extract_date(body, item.get("published_date"), url, today_iso)
        for match in re.finditer(r"(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*(?:TL|₺|TRY)\b", body, re.I):
            after = body[match.end():match.end() + 20].lower()
            if re.search(r"^\s*(?:/\s*m|m2|metrekare|satılık)", after):
                continue
            amount = int(re.sub(r"[.,]", "", match.group(1)))
            if not (8000 <= amount <= 180000):
                continue
            window = normalize(body[max(0, match.start() - 100):min(len(body), match.end() + 100)])
            if not re.search(r"ortalama|medyan|endeks|kira", window):
                continue
            rec["rent_benchmarks"].append({
                "id": f"bench:{len(rec['rent_benchmarks'])+1}",
                "amount": amount,
                "rooms": "genel",
                "date": posted,
                "basis": "market_index",
                "description": f"{host} mahalle kira endeksi / piyasa ortalaması: {title[:110]}",
                "sources": [{"id": f"rb:{len(rec['rent_benchmarks'])+1}", "publisher": host, "url": url}],
            })
            seen_bench_urls.add(url)
            break

    # 5. Supplementary official transit domains ONLY if OSM+baseline yielded < 5 routes
    if len(rec["routes"]) < 5 and city in OFFICIAL_CITY_DOMAINS:
        seen_route_urls = {s["url"] for r in rec["routes"] for s in r.get("sources", [])}
        res_official = _tavily_search(
            client,
            f"{name} {district} hat durak otobüs metro tramvay",
            max_results=6,
            include_domains=OFFICIAL_CITY_DOMAINS[city],
        )
        for item in res_official:
            if len(rec["routes"]) >= 25:
                break
            url = item["url"]
            host = (urlparse(url).hostname or "").removeprefix("www.")
            if host not in OFFICIAL_HOSTS or url in seen_route_urls:
                continue
            title = _clean_text(item.get("title", ""))
            content = _clean_text(item.get("content", ""))
            combined = f"{title} {content}"
            if norm_name not in normalize(combined) or "iptal" in normalize(title):
                continue
            code = _extract_route_code(title, content)
            has_mode_word = bool(re.search(r"metro|tramvay|vapur|feribot|otobüs.*hat|raylı sistem", combined, re.I))
            if not code and not has_mode_word:
                continue
            if code and code.casefold() in seen_codes:
                continue
            rec["routes"].append({
                "id": f"tavily-t:{len(rec['routes'])+1}",
                "code": code or "Resmî",
                "route": title or f"{name} resmî ulaşım hattı",
                "localEvidence": content[:240] or title,
                "officialHeadingVerified": True,
                "sources": [{"id": f"rt:{len(rec['routes'])+1}", "publisher": host, "url": url}],
            })
            seen_route_urls.add(url)
            if code:
                seen_codes.add(code.casefold())

    return rec


def main():
    if not settings.TAVILY_API_KEY:
        raise SystemExit("TAVILY_API_KEY gerekli.")
    pilots = json.loads(PILOTS_PATH.read_text(encoding="utf-8"))["neighborhoods"][5:]
    today_iso = datetime.now(timezone(timedelta(hours=3))).date().isoformat()
    reports = []
    with httpx.Client(timeout=25) as client:
        for pilot in pilots:
            print(f"Enriching {pilot['name']}...", flush=True)
            rec = enrich_pilot(pilot, client, today_iso)
            reports.append(rec)
            dated_cnt = sum(1 for n in rec["news"] if n.get("date"))
            print(
                f"{rec['name']:14s} | rents={len(rec['rents']):2d} | bench={len(rec['rent_benchmarks']):2d} | "
                f"venues={len(rec['venues']):3d} | routes={len(rec['routes']):2d} | news={len(rec['news']):2d} (dated={dated_cnt}) | pga={rec['hazard'].get('value')}",
                flush=True,
            )
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"schema_version": "1.0", "generated_at": datetime.now(timezone.utc).isoformat(), "reports": reports}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Saved {len(reports)} enriched multi-city pilots -> {OUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
