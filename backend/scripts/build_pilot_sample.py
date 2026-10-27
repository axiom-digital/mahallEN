"""Combine saved source results without spending another Gemini request."""

from datetime import datetime, timezone
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
GROUNDING = ROOT / "data/research/kotekli_2026-10-28_v3/result.json"
DIRECT = ROOT / "data/pilot/kotekli_direct_sample.json"
OUTPUT = ROOT / "data/pilot/kotekli.v0.1.json"
HEADINGS = {"KİRA": "rent_cost", "HABER": "safety_news", "ULAŞIM": "transportation"}
OFFICIAL_TRANSPORT_PUBLISHERS = {"muttas.com.tr", "ulasim.muttas.com.tr", "mugla.bel.tr"}


def build_grounded_categories(result):
    if not result.get("accepted_for_review"):
        raise ValueError("Grounding experiment did not finish with usable source metadata")
    text = result["text"]
    chunks = result["grounding_metadata"].get("grounding_chunks", [])
    sources = [{"id": f"gemini-{i}", "url": c["web"]["uri"],
                "provider_reported_publisher": c["web"].get("title"),
                "method": "Gemini Google Search grounding metadata"}
               for i, c in enumerate(chunks) if c.get("web")]
    matches = list(re.finditer(r"(?m)^(KİRA|HABER|ULAŞIM):\s*", text))
    if {m[1] for m in matches} != set(HEADINGS) or len(matches) != 3:
        raise ValueError("Expected exactly the three approved grounding sections")
    categories, excluded = {}, []
    for index, match in enumerate(matches):
        category = HEADINGS[match[1]]
        body = text[match.end():matches[index+1].start() if index+1 < len(matches) else len(text)]
        observations = []
        for line in body.splitlines():
            line = line.strip()
            if not line.startswith(("*", "-")):
                continue
            claim = line.lstrip("*- ")
            supports, ids = [], set()
            for support in result["grounding_metadata"].get("grounding_supports", []):
                segment = support.get("segment", {}).get("text", "")
                if segment and segment in claim:
                    indices = support.get("grounding_chunk_indices", [])
                    ids.update(indices)
                    supports.append({"supported_text_segment": segment,
                                     "source_ids": [f"gemini-{i}" for i in indices]})
            if not ids:
                excluded.append({"category": category, "reason": "No explicit grounding support attached to this observation"})
                continue
            publishers = {chunks[i].get("web", {}).get("title", "").lower().removeprefix("www.") for i in ids}
            if category == "transportation" and not publishers.issubset(OFFICIAL_TRANSPORT_PUBLISHERS):
                excluded.append({"category": category, "reason": "Non-official transport publisher", "source_ids": [f"gemini-{i}" for i in sorted(ids)]})
                continue
            if re.search(r"(?<!\w)(?:[A-ZÇĞİÖŞÜ]\.){2,}(?!\w)", claim):
                excluded.append({"category": category, "reason": "Personal identifiers in model text require manual redaction", "source_ids": [f"gemini-{i}" for i in sorted(ids)]})
                continue
            observations.append({"text": claim, "source_ids": [f"gemini-{i}" for i in sorted(ids)],
                                 "grounding_supports": supports,
                                 "review_status": "requires_human_source_check",
                                 "coverage_note": "Metadata supports the quoted segments; it does not verify every assertion in the complete observation."})
        categories[category] = {
            "collection_method": "gemini_google_search", "status": "research_candidate",
            "model": result["model_returned"], "reference_date": "2026-10-28",
            "observations": observations, "score": None,
        }
    return categories, sources, excluded


def main():
    grounding = json.loads(GROUNDING.read_text(encoding="utf-8"))
    direct = json.loads(DIRECT.read_text(encoding="utf-8"))
    categories, sources, excluded = build_grounded_categories(grounding)
    categories.update(direct["categories"])
    result = {
        "schema_version": "0.1.0", "dataset_status": "draft_requires_review",
        "assembled_at": datetime.now(timezone.utc).isoformat(),
        "neighborhood": "Kötekli", "district": "Menteşe", "city": "Muğla",
        "location": direct["location"], "categories": categories,
        "grounding_sources": sources, "excluded_observations": excluded,
        "scores": {"overall": None, "student": None, "family": None, "professional": None},
        "provenance": {"grounding_result": str(GROUNDING.relative_to(ROOT)),
                       "direct_data_result": str(DIRECT.relative_to(ROOT))},
        "limitations": [
            "Source collection prototype; no calibrated score or verified final report is produced.",
            "Research hazard grid is not the official AFAD TDTH product.",
            "Social-life sample radius is not an administrative neighborhood boundary.",
            "Grounding confirms that search was used; factual claims still require review.",
        ],
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "categories": list(categories),
                      "grounded_observations": {k: len(v.get("observations", [])) for k, v in categories.items() if k in HEADINGS.values()},
                      "excluded_observations": len(excluded)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
