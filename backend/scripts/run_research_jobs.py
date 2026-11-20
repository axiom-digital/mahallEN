"""Plan or execute a bounded list of geographic/category jobs. Default is read-only."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from research_spec import Target, specification, job_id

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--targets', type=Path, required=True, help='JSON array of country/province/district/neighborhood objects')
    parser.add_argument('--topics', nargs='+', choices=['safety', 'transport', 'social', 'rent'], required=True)
    parser.add_argument('--as-of', required=True)
    parser.add_argument('--max-jobs', type=int, default=1)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.max_jobs <= 100:
        parser.error('--max-jobs must be 1..100; each job can make up to four API attempts')
    raw = json.loads(args.targets.read_text(encoding='utf-8'))
    if not isinstance(raw, list) or not raw:
        parser.error('targets must be a nonempty JSON array')
    jobs = {}
    for row in raw:
        target = Target(**row)
        for topic in args.topics:
            spec = specification(target, topic, args.as_of)
            jobs.setdefault(job_id(spec), spec)
    print(json.dumps({'planned_jobs': len(jobs), 'run_job_cap': args.max_jobs,
                      'maximum_new_api_calls': min(len(jobs), args.max_jobs) * 4 if args.execute else 0,
                      'execute': args.execute}), flush=True)
    if not args.execute:
        return 0
    for identity, spec in list(jobs.items())[:args.max_jobs]:
        command = [sys.executable, str(ROOT / 'backend/scripts/try_two_stage_gemini.py'),
                   '--topic', spec['topic'], '--as-of', spec['as_of']]
        for key, value in spec['target'].items():
            command += ['--' + key, value]
        print(json.dumps({'job_id': identity, 'status': 'starting'}), flush=True)
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            print(json.dumps({'job_id': identity, 'status': 'stopped_on_failure',
                              'remaining_jobs_not_started': True}), flush=True)
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
