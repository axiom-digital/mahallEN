"""One explicit Google Search grounding experiment. Never runs at app startup."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROMPT = ROOT / "docs/prompts/kotekli_grounding_v3.md"
DEFAULT_OUTPUT = ROOT / "data/research/kotekli_2026-10-28_v3"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--neighborhood", default="kotekli")
    parser.add_argument("--prompt", type=Path, default=DEFAULT_PROMPT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-output-tokens", type=int, default=2048)
    args = parser.parse_args()

    # Explicitly use backend/.env; do not print credentials or provider tracebacks.
    values = dotenv_values(ROOT / "backend/.env")
    api_key = values.get("GEMINI_API_KEY")
    if not api_key:
        print("Missing GEMINI_API_KEY in backend/.env", file=sys.stderr)
        return 2
    if args.output.exists():
        print("Output directory already exists; choose a new --output for an intentional new request.")
        return 2
    prompt_document = args.prompt.read_text(encoding="utf-8")
    marker = "## PROMPT\n"
    if marker not in prompt_document:
        print("Prompt file must contain a ## PROMPT section.")
        return 2
    prompt = prompt_document.split(marker, 1)[1].strip()
    args.output.mkdir(parents=True)
    (args.output / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    started_at = datetime.now(timezone.utc).isoformat()
    print(json.dumps({"status": "request_started", "model": args.model, "google_search": True}), flush=True)

    try:
        from grounding_client import generate_research
        from google.genai import types
        response = generate_research(api_key=api_key, model=args.model, prompt=prompt,
                                     max_output_tokens=args.max_output_tokens)
        candidate = response.candidates[0] if response.candidates else None
        grounding = candidate.grounding_metadata if candidate else None
        metadata = grounding.model_dump(mode="json", exclude_none=True) if grounding else {}
        sources = [
            {"url": chunk.web.uri, "title": chunk.web.title}
            for chunk in (grounding.grounding_chunks or [])
            if chunk.web and chunk.web.uri
        ] if grounding else []
        queries = list(grounding.web_search_queries or []) if grounding else []
        supports = list(grounding.grounding_supports or []) if grounding else []
        text = response.text or ""
        finish_reason = str(candidate.finish_reason) if candidate else None
        search_confirmed = bool(queries and sources)
        complete = bool(candidate and candidate.finish_reason == types.FinishReason.STOP)
        parsed = None
        validation_errors = []
        if len(text) > 20000:
            validation_errors.append("Research response exceeds the text limit")
        if "grounding-api-redirect/" in text:
            validation_errors.append("Provider redirect URLs were copied into prose")
        if not supports:
            validation_errors.append("No claim-to-source grounding supports returned")
        accepted_for_review = bool(search_confirmed and complete and text and not validation_errors)
        result = {
            "experiment": "issue-9-google-search-grounding",
            "neighborhood": args.neighborhood,
            "model_requested": args.model,
            "model_returned": response.model_version,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "review_status": "unreviewed_research_candidate",
            "not_a_verified_dataset": True,
            "category_scope": [key for heading, key in {
                "KİRA:": "rent_cost", "HABER:": "safety_news", "GÜVENLİK:": "safety_news",
                "ULAŞIM:": "transportation", "SOSYAL YAŞAM:": "social_life"}.items() if heading in prompt],
            "complete": complete,
            "accepted_for_review": accepted_for_review,
            "validation_errors": validation_errors,
            "structured_candidate": parsed if accepted_for_review else None,
            "google_search_requested": True,
            "google_search_confirmed": search_confirmed,
            "finish_reason": finish_reason,
            "queries": queries,
            "sources": sources,
            "grounding_support_count": len(supports),
            "grounding_metadata": metadata,
            "usage": response.usage_metadata.model_dump(mode="json", exclude_none=True) if response.usage_metadata else {},
            "text": text,
        }
        (args.output / "result.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (args.output / "report.md").write_text(text + "\n", encoding="utf-8")
        if grounding and grounding.search_entry_point and grounding.search_entry_point.rendered_content:
            (args.output / "search_suggestions.html").write_text(
                grounding.search_entry_point.rendered_content, encoding="utf-8"
            )
        print(json.dumps({
            "status": "completed",
            "google_search_confirmed": search_confirmed,
            "source_count": len(sources),
            "query_count": len(queries),
            "grounding_support_count": len(supports),
            "finish_reason": finish_reason,
            "accepted_for_review": accepted_for_review,
            "validation_errors": validation_errors,
            "output": str(args.output),
        }, ensure_ascii=False), flush=True)
        return 0 if accepted_for_review else 1
    except Exception as exc:
        safe_message = str(getattr(exc, "message", "Provider or SDK request failed")).replace(api_key, "[REDACTED]")
        error = {
            "status": "failed",
            "error_type": type(exc).__name__,
            "http_code": getattr(exc, "code", None),
            "message": safe_message[:1600],
            "started_at": started_at,
            "automatic_retry": False,
        }
        (args.output / "error.json").write_text(
            json.dumps(error, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps(error, ensure_ascii=False), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
