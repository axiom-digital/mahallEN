"""Bounded retries for transient provider errors; never rotates keys or models."""
import random
import re
import time

TRANSIENT_CODES = {500, 502, 503, 504}


def safe_error(exc, secrets=()):
    message = str(getattr(exc, 'message', None) or str(exc))
    for secret in secrets:
        if secret:
            message = message.replace(secret, '[REDACTED]')
    message = re.sub(r'(?i)(key|api_key|x-goog-api-key)=([^\s&]+)', r'\1=[REDACTED]', message)
    return {'type': type(exc).__name__, 'code': getattr(exc, 'code', None), 'message': message[:1200]}


def transient_retry(call, *, max_attempts=3, base_delay=10, max_delay=45,
                    on_event=lambda event: None, sleep=time.sleep, jitter=None):
    if not 1 <= max_attempts <= 5 or base_delay < 0 or not 0 <= max_delay <= 60:
        raise ValueError('Invalid retry bounds')
    jitter = jitter or (lambda: random.uniform(0, 3))
    for attempt in range(1, max_attempts + 1):
        on_event({'event': 'attempt_started', 'attempt': attempt, 'max_attempts': max_attempts})
        try:
            result = call()
            on_event({'event': 'attempt_succeeded', 'attempt': attempt})
            return result
        except Exception as exc:
            code = getattr(exc, 'code', None)
            retry = code in TRANSIENT_CODES and attempt < max_attempts
            delay = min(max_delay, base_delay * 2 ** (attempt - 1) + jitter()) if retry else None
            # If the server demands a longer wait, defer instead of retrying early.
            response = getattr(exc, 'response', None)
            headers = getattr(response, 'headers', {}) or {}
            try:
                required = float(headers.get('retry-after', 0))
            except (TypeError, ValueError):
                required = 0
            if retry and required > max_delay:
                retry, delay = False, None
            elif retry:
                delay = max(delay, required)
            on_event({'event': 'attempt_failed', 'attempt': attempt, 'code': code,
                      'will_retry': retry, 'delay_seconds': round(delay, 2) if retry else None,
                      'exception': exc})
            if not retry:
                raise
            sleep(delay)
