"""Build the ten-neighborhood data handoff offline, without generating reports.

--record-review records short evidence receipts from explicitly fetched pages.
The default build uses committed receipts and audit metadata, so a fresh checkout
does not need private caches, keys, a provider or access to the original pages.
"""
import argparse
from collections import Counter
from copy import deepcopy
from datetime import date
import hashlib
import json
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/issue32"
CATEGORIES = ("rent_cost", "safety_news", "transportation", "social_life", "earthquake_hazard")
AS_OF = "2026-11-06"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")


def digest(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def norm(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def geo_key(target):
    def slug(value):
        value = unicodedata.normalize("NFKD", value.lower().replace("ı", "i"))
        return "".join(c for c in value if c.isascii() and c.isalnum())
    return "/".join(["tr", slug(target["city"]), slug(target["district"]), target["id"]])


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inputs():
    targets, reviewed = read(BASE / "targets.json"), read(BASE / "reviewed_claims.json")
    rents, geo = read(BASE / "rental_samples.json"), read(BASE / "geography.json")
    sources = {s["id"]: s for group in (reviewed, rents, geo) for s in group["sources"]}
    claims = reviewed["claims"] + rents["claims"]
    for target in targets:
        claims.append({"id": target["id"] + "-identity", "target_id": target["id"], "category": "identity",
            "source_id": target["identity_source_id"], "evidence_quotes": [reviewed["identity_quotes"][target["id"]]],
            "text": f"{target['city']} / {target['district']} / {target['name']}",
            "location_basis": "Target-specific municipal/operator address or neighborhood inventory, separately checked against OSM administrative locality."})
    return targets, sources, claims, rents, geo


def record_review(sources, claims):
    receipts, failed = {}, []
    for claim in claims:
        if claim.get("decision") == "exclude":
            continue
        checks = [(claim["source_id"], claim["evidence_quotes"])]
        if claim.get("location_source_id"):
            checks.append((claim["location_source_id"], [claim["location_quote"]]))
        receipt = {"claim_sha256": digest(claim), "checks": [],
                   "review_method": "Assistant page review of the stated narrow claim; not independent field verification."}
        for sid, quotes in checks:
            url = sources[sid]["url"]
            path = ROOT / "data/cache/issue32-pages" / (hashlib.sha256(url.encode()).hexdigest() + ".json")
            page = read(path)
            body = norm(page["text"])
            # Requiring a body prevents a 200 homepage, title-only result or
            # challenge screen from silently qualifying as claim evidence.
            if page["status"] != "page_read" or not all(norm(q) in body for q in quotes):
                failed.append({"claim": claim["id"], "source": sid, "status": page["status"],
                               "missing_quotes": [q for q in quotes if norm(q) not in body]})
                continue
            receipt["checks"].append({"source_id": sid, "quotes": quotes,
                "response_sha256": page["response_sha256"], "text_sha256": page["text_sha256"],
                "checked_at": page["checked_at"], "match": "exact_after_unicode_and_whitespace_normalization"})
        receipts[claim["id"]] = receipt
    if failed:
        raise ValueError(json.dumps(failed, ensure_ascii=False, indent=2))
    save(BASE / "review_receipts.json", receipts)


def validate_receipt(claim, receipts, sources, audit):
    receipt = receipts[claim["id"]]
    require(receipt["claim_sha256"] == digest(claim), f"Review is stale: {claim['id']}")
    expected = {claim["source_id"]}
    if claim.get("location_source_id"):
        expected.add(claim["location_source_id"])
    require({c["source_id"] for c in receipt["checks"]} == expected, "Incomplete source receipt")
    for check in receipt["checks"]:
        status = audit[sources[check["source_id"]]["url"]]
        require(status["status"] == "page_read" and status["http_status"] == 200, "Source is not readable")
        require(status["response_sha256"] == check["response_sha256"], "Source response changed since review")
    return receipt


def build():
    targets, sources, claims, rents, geo = inputs()
    audit_doc, receipts = read(BASE / "source_audit.json"), read(BASE / "review_receipts.json")
    audit = {s["requested_url"]: s for s in audit_doc["checks"]}
    records, entries = [], []
    for target in targets:
        key = target["id"]
        selected, excluded, used = [], [], set()
        for claim in claims:
            if claim["target_id"] != key:
                continue
            if claim.get("decision") == "exclude":
                excluded.append({"id": claim["id"], "reason": claim["reason"]})
                continue
            receipt = validate_receipt(claim, receipts, sources, audit)
            item = deepcopy(claim)
            item.pop("source_id")
            item["source_ids"] = [c["source_id"] for c in receipt["checks"]]
            item["verification"] = "source_page_read_narrow_claim_checked"
            item["review_receipt_id"] = claim["id"]
            used.update(item["source_ids"])
            item["event_date"] = claim.get("event_date")
            item["publication_date"] = claim.get("publication_date") or (claim.get("date") if claim.get("date_basis") == "publication_date" else None)
            selected.append(item)
        categories = {}
        for category in CATEGORIES:
            observations = [c for c in selected if c["category"] == category]
            categories[category] = {"status": "partial_snapshot" if observations else "missing", "score": None,
                "observations": observations, "missing_reason": None if observations else
                "Bu taramada mahalleye açıkça bağlanan ve gövdesi okunarak denetlenen uygun kayıt elde edilmedi; hizmet/olay yokluğu anlamına gelmez."}
        categories["rent_cost"].update(average_rent_tl=None, median_rent_tl=None,
            comparison_missing_reason="Sınırlı, temsili olmayan ilan örnekleri; kontrat süreleri bilinmiyor. Mahalle ortalaması/medyanı hesaplanmadı.")
        point = geo["records"][key]
        if point["location"]:
            used.add(point["location"]["source_id"])
        hazard = point["hazard"]
        if hazard and hazard["value"] is not None:
            used.update(["aperta-metadata", "aperta-record"])
            categories["earthquake_hazard"].update(status="research_point_estimate", value=hazard["value"],
                unit="g", observations=[], missing_reason=None, research=hazard,
                source_ids=["aperta-metadata", "aperta-record"], score=None)
        else:
            categories["earthquake_hazard"].update(value=None, unit="g")
        archive = ROOT / f"data/neighborhoods/{key}.json"
        if archive.exists():
            old = read(archive)
            for category in CATEGORIES:
                for candidate in old["categories"][category].get("observations", []):
                    excluded.append({"id": "legacy-" + candidate["id"], "category": category,
                        "archive_file": archive.relative_to(ROOT).as_posix(),
                        "reason": "Legacy search-supported candidate is not automatically promoted; only newly checked narrow claims are admitted."})
        excluded.extend({"id": "rental-reject-" + str(i), **r} for i, r in enumerate(rents["rejected"]) if r["target_id"] == key)
        public_sources = []
        for sid in sorted(used):
            source = sources[sid]
            check = audit[source["url"]]
            require(check["http_status"] == 200 and check["status"] in {"page_read", "data_read"}, f"Source is not readable: {sid}")
            require(check["final_url"].startswith("https://"), f"Non-HTTPS destination: {sid}")
            public_sources.append({"id": sid, "url": source["url"], "final_url": check["final_url"],
                "publisher": check.get("title") or source["url"].split("/")[2], "checked_at": check["checked_at"],
                "http_status": check["http_status"], "access_status": check["status"],
                "response_sha256": check["response_sha256"]})
        record = {"schema_version": "2.0.0", "id": key, "geo_key": geo_key(target), "country": "Türkiye",
            "name": target["name"], "district": target["district"], "city": target["city"], "reference_date": AS_OF,
            "dataset_status": "reviewed_evidence_handoff", "factual_review_status": "source_page_review_limited_scope",
            "identity": next(c for c in selected if c["category"] == "identity"),
            "location": point["location"], "location_missing_reason": point["missing_reason"],
            "categories": categories, "sources": public_sources, "excluded_observations": excluded,
            "missing_values": {"overall_score": None, "soil_class": None, "building_safety": None,
                "crime_rate": None, "bus_frequency_minutes": None, "campus_commute_minutes": None,
                "reason": "Bu değişkenler için doğrudan mahalle ölçümü/uygun veri yok; sıfır veya başka mahalle değeriyle doldurulmadı."},
            "provenance": {"reviewed_claims": "data/issue32/reviewed_claims.json", "rental_samples": "data/issue32/rental_samples.json",
                "source_audit": "data/issue32/source_audit.json", "review_receipts": "data/issue32/review_receipts.json"},
            "limitations": ["Açıkça kaynakta bildirilen sınırlı örneklerdir; tüm ilan, işletme veya olayların envanteri değildir.",
                "Sayfanın açılması iddianın bağımsız doğrulandığı anlamına gelmez; kaynak ve erişim tarihiyle birlikte aktarılmalıdır.",
                "Tarihsiz haberler güncel sayılmaz; yayın ve olay tarihi ayrıdır. Eksik haberden güvenli mahalle sonucu çıkarılamaz.",
                "PGA akademik araştırma gridindeki temsil noktasına aittir; resmî AFAD TDTH, bina sağlamlığı veya mahalle geneli risk puanı değildir.",
                "LLM raporu üretimi ve önbellek hazırlama bu veri tesliminin ayrı entegrasyon adımıdır."]}
        path = BASE / f"neighborhoods/{key}.json"
        save(path, record)
        entries.append({"id": key, "geo_key": record["geo_key"], "city": target["city"], "district": target["district"],
            "file": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "observation_counts": {k: len(v["observations"]) for k, v in categories.items()},
            "source_count": len(public_sources)})
        records.append(record)
    used_urls = {s["url"] for r in records for s in r["sources"]}
    manifest = {"schema_version": "2.0.0", "reference_date": AS_OF, "expected_pilot_count": 10, "actual_pilot_count": len(records),
        "neighborhoods": entries, "active_unique_source_urls": len(used_urls), "active_source_urls_checked": len(used_urls),
        "active_source_urls_http_200": len(used_urls), "audit_total_urls_attempted": len(audit),
        "audit_status_counts": dict(Counter(s["status"] for s in audit.values())),
        "scope_corrections": ["Yeniköy yerine Akyaka/Ula/Muğla.", "Kullanıcı onayıyla Bornova/Kültür yerine Konak/Kültür/İzmir."],
        "missing_value_policy": "Unknown is null with a reason, never zero or borrowed from another locality.",
        "llm_reports_generated": False, "cache_prewarmed": False}
    save(BASE / "manifest.json", manifest)
    save(ROOT / "data/pilot_neighborhoods.json", {"schema_version": "2.0.0", "reference_date": AS_OF,
        "dataset_status": "reviewed_evidence_handoff", "neighborhoods": records})
    print(json.dumps({"neighborhoods": len(records), "observations": sum(len(c["observations"]) for r in records for c in r["categories"].values()),
        "active_unique_source_urls": len(used_urls), "audited_urls": len(audit)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record-review", action="store_true")
    args = parser.parse_args()
    if args.record_review:
        _, sources, claims, _, _ = inputs()
        record_review(sources, claims)
    build()
