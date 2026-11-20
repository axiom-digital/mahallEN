"""Bounded use of explicitly configured project credentials; no quota assumptions."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import tempfile
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from grounding_client import generate_research

STATE = Path(__file__).resolve().parents[2] / 'data/cache/provider_quota_state.json'


class DailyQuotaExhausted(RuntimeError):
    pass


class ModelAccessUnavailable(RuntimeError):
    pass


def configured_keys(values):
    raw = json.loads(values.get('GEMINI_API_KEYS') or '[]')
    if not isinstance(raw, list) or any(not isinstance(k, str) for k in raw):
        raise ValueError('GEMINI_API_KEYS must be a JSON string array')
    keys = list(dict.fromkeys(k.strip() for k in raw + [values.get('GEMINI_API_KEY') or ''] if k.strip()))
    if len(keys) > 8:
        raise ValueError('At most eight explicitly configured credentials are supported')
    return keys


def daily_limit(exc):
    message = str(getattr(exc, 'message', str(exc))).lower()
    return getattr(exc, 'code', None) == 429 and any(term in message for term in [
        'per_day', 'perday', 'daily', 'requests per day', 'rpd'])


def next_reset(now):
    try:
        local = datetime.fromtimestamp(now, ZoneInfo('America/Los_Angeles'))
        tomorrow = local.date() + timedelta(days=1)
        return datetime.combine(tomorrow, datetime.min.time(), tzinfo=local.tzinfo).timestamp()
    except ZoneInfoNotFoundError:
        # Conservative fallback on Windows without tzdata: never retry a spent quota early.
        return now + 86400


def generate_with_pool(values, *, model, prompt, max_output_tokens=4096, generate=generate_research,
                       state_path=STATE, now=None):
    keys = configured_keys(values)
    if not keys:
        raise ValueError('No Gemini credential configured')
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    try:
        state = json.loads(state_path.read_text(encoding='utf8'))
    except (FileNotFoundError, json.JSONDecodeError):
        state = {}
    daily_blocked = False
    for index, key in enumerate(keys):
        fingerprint = hashlib.sha256(key.encode()).hexdigest()[:16]
        if state.get(fingerprint, {}).get('blocked_until', 0) > now:
            daily_blocked = True
            continue
        if state.get(fingerprint, {}).get('unsupported_models', {}).get(model, 0) > now:
            continue
        try:
            response = generate(api_key=key, model=model, prompt=prompt, max_output_tokens=max_output_tokens)
            return response, f'credential-{index + 1}'
        except Exception as exc:
            unsupported = getattr(exc, 'code', None) == 404 and 'model' in str(getattr(exc, 'message', str(exc))).lower()
            if not daily_limit(exc) and not unsupported:
                # Minute limits, invalid requests, auth failures and 503s never rotate keys.
                raise
            if unsupported:
                state.setdefault(fingerprint, {}).setdefault('unsupported_models', {})[model] = next_reset(now)
            else:
                daily_blocked = True
                state.setdefault(fingerprint, {}).update({'blocked_until': next_reset(now), 'reason': 'provider_reported_daily_quota'})
            state_path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=state_path.parent, delete=False, suffix='.tmp') as handle:
                handle.write(json.dumps(state))
                temporary = Path(handle.name)
            temporary.replace(state_path)
    if daily_blocked:
        raise DailyQuotaExhausted('Daily quota exhausted for all usable configured credentials; stopped without looping.')
    raise ModelAccessUnavailable('The configured model is unavailable for the supplied credentials; no model was changed automatically.')
