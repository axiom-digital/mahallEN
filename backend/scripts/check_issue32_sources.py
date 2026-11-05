"""Explicit HTTP audit for issue #32. No LLM calls and no credentials required.

HTTP success is NOT claim verification. Full text stays in ignored data/cache;
the deliverable contains response hashes and short, separately reviewed evidence.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/cache/issue32-pages"


def norm(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")


def cache_path(url):
    return CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".json")


def fetch(url, refresh=False):
    path = cache_path(url)
    if path.exists() and not refresh:
        return read_json(path)
    result = {"requested_url": url, "checked_at": datetime.now(timezone.utc).isoformat(),
              "http_status": None, "final_url": None, "status": "unavailable", "text": ""}
    try:
        if urlparse(url).scheme != "https":
            raise ValueError("HTTPS required")
        response = requests.get(url, timeout=(8, 18), headers={"User-Agent": "MahallEN-SourceReview/1.0"})
        result.update(http_status=response.status_code, final_url=response.url,
                      redirects=[{"status": r.status_code, "url": r.url} for r in response.history],
                      content_type=response.headers.get("Content-Type", ""),
                      response_sha256=hashlib.sha256(response.content).hexdigest())
        if response.status_code == 200 and "html" in result["content_type"]:
            # Honor declared UTF-8; requests otherwise defaults text/html to Latin-1.
            soup = BeautifulSoup(response.content, "html.parser")
            result["title"] = norm(soup.title.get_text(" ")) if soup.title else ""
            result["published_at"] = None
            for attrs in ({"property": "article:published_time"}, {"itemprop": "datePublished"}):
                node = soup.find("meta", attrs=attrs)
                if node:
                    result["published_at"] = node.get("content")
            for node in soup.find_all("script", attrs={"type": "application/ld+json"}):
                try:
                    structured = json.loads(node.string or node.get_text())
                except (json.JSONDecodeError, TypeError):
                    continue
                pending = structured if isinstance(structured, list) else [structured]
                while pending:
                    item = pending.pop()
                    if not isinstance(item, dict):
                        continue
                    pending.extend(item.get("@graph", []))
                    kind = item.get("@type", "")
                    if "Article" in str(kind) and item.get("datePublished"):
                        result["published_at"] = item["datePublished"]
            # ASP.NET public sites wrap the entire article in <form runat=server>.
            # Removing forms would incorrectly turn readable sources into empty pages.
            for node in soup(["script", "style", "nav", "header", "footer", "aside", "noscript"]):
                node.decompose()
            articles = soup.find_all("article")
            # A search result may have thirty articles. Reading only the first
            # listing would silently discard the rest of that page.
            body = (articles[0] if len(articles) == 1 else None) or soup.find("main") or soup.body or soup
            if urlparse(response.url).hostname == "www.emlakjet.com":
                result["listing_cards"] = [{"id": a.get("data-listing-id"),
                    "text": norm(a.get_text(" ", strip=True)),
                    "url": "https://www.emlakjet.com" + a.find("a", href=True)["href"]}
                    for a in articles if a.get("data-listing-id") and a.find("a", href=True)]
            result["text"] = norm(body.get_text(" ", strip=True))
            result["text_sha256"] = hashlib.sha256(result["text"].encode()).hexdigest()
            blocked = re.search(r"access denied|just a moment|verify you are human|robot olmadığ|captcha", result["title"], re.I)
            result["status"] = "blocked" if blocked else "page_read" if len(result["text"]) > 80 else "empty_or_script_only"
        elif response.status_code == 200 and "json" in result["content_type"]:
            result["payload"] = response.json()
            result["text"] = norm(json.dumps(result["payload"], ensure_ascii=False))
            result["text_sha256"] = hashlib.sha256(result["text"].encode()).hexdigest()
            result["status"] = "data_read"
        elif response.status_code == 200:
            result["status"] = "non_html_requires_review"
    except (requests.RequestException, ValueError) as error:
        result["error_type"] = type(error).__name__
    write_json(path, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Explicitly recheck saved pages")
    args = parser.parse_args()
    urls = set()
    for path in (ROOT / "data/neighborhoods").glob("*.json"):
        urls.update(s["url"] for s in read_json(path)["sources"])
    seed = ROOT / "data/issue32/reviewed_claims.json"
    if seed.exists():
        urls.update(s["url"] for s in read_json(seed)["sources"])
    for name in ("rental_samples.json", "geography.json"):
        extra = ROOT / "data/issue32" / name
        if extra.exists():
            urls.update(s["url"] for s in read_json(extra)["sources"])
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(lambda url: fetch(url, args.refresh), sorted(urls)))
    # Never publish copied page bodies or treat an HTTP response as factual approval.
    public = [{k: v for k, v in item.items() if k not in {"text", "listing_cards", "payload"}} for item in results]
    write_json(ROOT / "data/issue32/source_audit.json", {"schema_version": "1.0", "checks": public,
        "meaning": "All listed URLs attempted. HTTP reachability and claim correctness are separate checks."})
    from collections import Counter
    print(json.dumps(dict(Counter(r["status"] for r in results))))


if __name__ == "__main__":
    main()
