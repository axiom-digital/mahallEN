"""Explicit bounded job queue. Reuses successes and stops when all daily quotas expire."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--max-requests', type=int, default=8)
    args = parser.parse_args()
    jobs = json.loads((ROOT / 'data/research/focused_jobs.json').read_text(encoding='utf8'))
    if not args.execute:
        print(json.dumps({'planned_jobs': len(jobs), 'external_requests': 0})); raise SystemExit(0)
    count = 0
    for job in jobs:
        prefix = ROOT / f'data/research/focused_{job["id"]}'
        successes = [p for p in prefix.parent.glob(prefix.name + '*/result.json')
                     if json.loads(p.read_text(encoding='utf8')).get('accepted_for_review')]
        if successes:
            print(json.dumps({'job': job['id'], 'status': 'using_saved_success'}), flush=True); continue
        if count >= max(0, min(args.max_requests, 8)):
            break
        attempt = 1
        while Path(str(prefix) + f'_attempt{attempt}').exists():
            attempt += 1
        output = Path(str(prefix) + f'_attempt{attempt}')
        print(json.dumps({'job': job['id'], 'status': 'starting', 'request': count + 1}), flush=True)
        subprocess.run([sys.executable, str(ROOT / 'backend/scripts/try_grounding.py'), '--model', 'gemini-2.5-flash',
            '--neighborhood', job['neighborhood'], '--prompt', str(ROOT / job['prompt']), '--output', str(output),
            '--max-output-tokens', '6000'], cwd=ROOT, check=False)
        count += 1
        if (output / 'error.json').exists():
            error = json.loads((output / 'error.json').read_text(encoding='utf8'))
            if error.get('error_type') in ['DailyQuotaExhausted', 'ModelAccessUnavailable'] or error.get('http_code') == 429:
                print(json.dumps({'status': 'paused_for_quota', 'completed_attempts': count}), flush=True); break
        time.sleep(3)
    print(json.dumps({'status': 'queue_stopped', 'new_requests': count}), flush=True)


if __name__ == '__main__':
    main()
