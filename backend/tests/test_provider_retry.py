import sys
from pathlib import Path
import unittest
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from provider_retry import transient_retry, safe_error


class ProviderError(Exception):
    def __init__(self, code, message='provider error', headers=None):
        super().__init__(message)
        self.code, self.message = code, message
        self.response = SimpleNamespace(headers=headers or {})


class RetryTests(unittest.TestCase):
    def test_503_then_success_has_increasing_bounded_waits(self):
        calls, waits, events = [], [], []
        def call():
            calls.append(1)
            if len(calls) < 3: raise ProviderError(503)
            return 'ok'
        self.assertEqual(transient_retry(call, sleep=waits.append, jitter=lambda: 0, on_event=events.append), 'ok')
        self.assertEqual(waits, [10, 20])
        self.assertEqual(len(calls), 3)
        self.assertEqual(events[-1]['event'], 'attempt_succeeded')

    def test_persistent_503_stops_after_three_attempts(self):
        calls, waits = [], []
        def call():
            calls.append(1)
            raise ProviderError(503)
        with self.assertRaises(ProviderError): transient_retry(call, sleep=waits.append, jitter=lambda: 0)
        self.assertEqual(len(calls), 3)
        self.assertEqual(len(waits), 2)

    def test_quota_and_auth_errors_never_retry(self):
        for code in [400, 403, 404, 429]:
            calls, waits = [], []
            def call():
                calls.append(1)
                raise ProviderError(code)
            with self.assertRaises(ProviderError): transient_retry(call, sleep=waits.append)
            self.assertEqual(len(calls), 1)
            self.assertFalse(waits)

    def test_long_retry_after_defers_without_early_retry(self):
        waits = []
        def call(): raise ProviderError(503, headers={'retry-after': '120'})
        with self.assertRaises(ProviderError): transient_retry(call, sleep=waits.append)
        self.assertFalse(waits)

    def test_provider_message_masks_credentials(self):
        error = safe_error(ProviderError(503, 'test-secret https://x/?key=another-secret'), ['test-secret'])
        self.assertNotIn('test-secret', error['message'])
        self.assertNotIn('another-secret', error['message'])


if __name__ == '__main__': unittest.main()
