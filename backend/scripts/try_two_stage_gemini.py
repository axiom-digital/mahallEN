"""Explicit 2.5 Search -> 3.5 Flash-Lite report experiment; isolated from app data."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re

from dotenv import dotenv_values
from google import genai
from google.genai import types
from grounding_client import generate_research
from research_spec import Target, specification, prompts, job_id, check_records, SEARCH_MODEL, REPORT_MODEL
from provider_retry import transient_retry, safe_error

ROOT = Path(__file__).resolve().parents[2]

def save(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--topic', choices=['transport', 'safety', 'social', 'rent'], required=True)
    parser.add_argument('--province', required=True)
    parser.add_argument('--district', required=True)
    parser.add_argument('--neighborhood', required=True)
    parser.add_argument('--country', default='Türkiye')
    parser.add_argument('--as-of', required=True, help='Explicit YYYY-MM-DD research reference date')
    parser.add_argument('--plan-only', action='store_true')
    args = parser.parse_args()
    spec = specification(Target(args.province, args.district, args.neighborhood, args.country), args.topic, args.as_of)
    identity = job_id(spec)
    if args.plan_only:
        print(json.dumps({'job_id': identity, 'specification': spec, 'max_new_calls': 4, 'requests_sent': 0}, ensure_ascii=True))
        return 0
    out = args.output or ROOT / 'data/cache/research-jobs' / identity
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / 'specification.json'
    if manifest_path.exists():
        if json.loads(manifest_path.read_text(encoding='utf-8')) != spec:
            raise ValueError('Output belongs to another location, date, model or prompt version')
    elif any(out.iterdir()):
        raise ValueError('Legacy/unidentified cache: select a new output directory')
    else:
        save(manifest_path, spec)
    research_instruction, report_instruction = prompts(spec)
    values = {**dotenv_values(ROOT / 'backend/.env'), **os.environ}
    key = values.get('GEMINI_API_KEY')
    if not key:
        print('Missing GEMINI_API_KEY; no requests sent.')
        return 2
    if (out / 'result.json').exists():
        existing = json.loads((out / 'result.json').read_text(encoding='utf-8'))
        print('Cached result exists; no requests sent.')
        return 0 if existing.get('complete') else 2
    lock = out / 'run.lock'
    try:
        with lock.open('x', encoding='utf-8') as handle:
            handle.write(str(os.getpid()))
    except FileExistsError:
        print('Job locked; inspect active/interrupted run before resuming.')
        return 2
    try:
        stage = 'research'
        research_path = out / 'research.json'
        if research_path.exists():
            research = json.loads(research_path.read_text(encoding='utf-8'))
        else:
            (out / 'research-prompt.txt').write_text(research_instruction, encoding='utf-8')
            print('Starting ' + SEARCH_MODEL + ' + Google Search (one request).', flush=True)
            response = generate_research(api_key=key, model=SEARCH_MODEL,
                                         prompt=research_instruction, max_output_tokens=8192)
            save(out / 'research-response.json', response.model_dump(mode='json', exclude_none=True))
            candidate = response.candidates[0] if response.candidates else None
            metadata = candidate.grounding_metadata if candidate else None
            complete = bool(candidate and candidate.finish_reason == types.FinishReason.STOP)
            sources = [{'id': f'S{i+1}', 'url': chunk.web.uri, 'title': chunk.web.title}
                       for i, chunk in enumerate(metadata.grounding_chunks or []) if chunk.web] if metadata else []
            research = {'model': response.model_version, 'text': response.text or '', 'complete': complete,
                        'sources': sources, 'metadata': metadata.model_dump(mode='json', exclude_none=True) if metadata else {},
                        'observed_at': datetime.now(timezone.utc).isoformat(),
                        'usage': response.usage_metadata.model_dump(mode='json') if response.usage_metadata else {}}
            save(research_path, research)
        if not research['complete'] or not research['metadata'].get('web_search_queries') or not research['metadata'].get('grounding_supports'):
            print('Research incomplete or no confirmed search/support metadata; synthesis stopped.')
            return 2
        # Preserve claim-to-source support text and indices for the second model.
        package = {k: research[k] for k in ['text', 'sources', 'observed_at']}
        package['grounding_supports'] = research['metadata'].get('grounding_supports', [])
        prompt = json.dumps(package, ensure_ascii=False)
        (out / 'report-prompt.txt').write_text(report_instruction + '\n\n' + prompt, encoding='utf-8')
        print(json.dumps({'stage': 'research_complete', 'sources': len(research['sources']),
                          'queries': research['metadata'].get('web_search_queries'),
                          'usage': research['usage']}, ensure_ascii=True), flush=True)
        with genai.Client(api_key=key, http_options=types.HttpOptions(
                timeout=90000, retry_options=types.HttpRetryOptions(attempts=1))) as client:
            stage = 'report'
            def record_attempt(event):
                event = dict(event)
                exc = event.pop('exception', None)
                if exc is not None:
                    event['error'] = safe_error(exc, [key])
                event.update({'stage': stage, 'at': datetime.now(timezone.utc).isoformat()})
                with (out / 'attempts.jsonl').open('a', encoding='utf-8') as handle:
                    handle.write(json.dumps(event, ensure_ascii=False) + '\n')
                print(json.dumps(event, ensure_ascii=True), flush=True)
            response = transient_retry(lambda: client.models.generate_content(
                model=REPORT_MODEL, contents=prompt,
                config=types.GenerateContentConfig(system_instruction=report_instruction,
                    max_output_tokens=7000, response_mime_type='application/json')),
                on_event=record_attempt)
        stage = 'validation'
        save(out / 'report-response.json', response.model_dump(mode='json', exclude_none=True))
        text = response.text or ''
        structured = json.loads(text)
        save(out / 'candidate.json', structured)
        validated = check_records(structured, research, spec)
        save(out / 'records-reviewed.json', validated)
        ids = set(re.findall(r'\[S(\d+)\]', text))
        known = {s['id'][1:] for s in research['sources']}
        complete = bool(response.candidates and response.candidates[0].finish_reason == types.FinishReason.STOP)
        result = {'job_id': identity, 'specification': spec,
                  'research_model': research['model'], 'report_model': response.model_version,
                  'complete': complete, 'unknown_source_ids': sorted(ids - known),
                  'record_count': len(validated['records']), 'rejected_count': len(validated['rejected']),
                  'review_status': 'unreviewed_research_candidate',
                  'usage_research': research['usage'],
                  'usage_report': response.usage_metadata.model_dump(mode='json') if response.usage_metadata else {}}
        save(out / 'result.json', result)
        text = '# ' + args.neighborhood + ' · ' + args.topic + '\n\n' + validated['summary'] + '\n\n' + '\n\n'.join(
            '## ' + record['title'] + '\n\n' + record['summary'] + '\n\n' + ', '.join(record['source_ids'])
            for record in validated['records'])
        text += '\n\n## Kaynaklar\n' + '\n'.join(f"- [{s['id']}] [{s['title']}]({s['url']})" for s in research['sources'])
        (out / 'report.md').write_text(text, encoding='utf-8')
        print(json.dumps(result, ensure_ascii=True))
        return 0 if complete and not result['unknown_source_ids'] else 2
    except Exception as exc:
        error = {'status': 'deferred' if getattr(exc, 'code', None) in {500, 502, 503, 504} else 'failed',
                 **safe_error(exc, [key]), 'stage': stage, 'retry_policy': 'up_to_3_report_attempts',
                 'research_preserved': (out / 'research.json').exists()}
        save(out / 'error.json', error)
        print(json.dumps(error))
        return 2
    finally:
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
