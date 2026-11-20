"""Read explicitly supplied credentials from stdin into ignored backend/.env."""
import json
import sys
from pathlib import Path
from dotenv import set_key

def main():
    path = Path(__file__).resolve().parents[1] / '.env'
    keys = list(dict.fromkeys(k.strip() for k in json.load(sys.stdin) if isinstance(k, str) and k.strip()))
    if not keys:
        raise SystemExit('No credentials supplied')
    set_key(path, 'GEMINI_API_KEYS', json.dumps(keys))
    print(f'Configured {len(keys)} unique local credentials. Values hidden.')


if __name__ == '__main__':
    main()
