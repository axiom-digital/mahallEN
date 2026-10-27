import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import pytest

spec = importlib.util.spec_from_file_location('grounding_client', Path(__file__).resolve().parents[1] / 'scripts/grounding_client.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


def test_explicit_search_request_has_timeout_and_no_automatic_retry(monkeypatch):
    calls = {}
    class FakeClient:
        def __init__(self, **kwargs):
            calls['client'] = kwargs
            self.models = self
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def generate_content(self, **kwargs):
            calls['generate'] = kwargs
            return 'saved-response'
    constructors = {k: (lambda **kwargs: SimpleNamespace(**kwargs)) for k in [
        'HttpOptions', 'HttpRetryOptions', 'GenerateContentConfig', 'Tool', 'GoogleSearch', 'ThinkingConfig']}
    fake = SimpleNamespace(Client=FakeClient, types=SimpleNamespace(**constructors))
    import google
    monkeypatch.setattr(google, 'genai', fake, raising=False)
    monkeypatch.setitem(sys.modules, 'google.genai', fake)
    assert client.generate_research(api_key='test-only', model='test-model', prompt='Test evidence') == 'saved-response'
    assert calls['client']['http_options'].timeout == 90000
    assert calls['client']['http_options'].retry_options.attempts == 1
    config = calls['generate']['config']
    assert config.tools[0].google_search is not None
    assert config.thinking_config.thinking_budget == 0
    assert calls['generate']['model'] == 'test-model'


@pytest.mark.parametrize('prompt,tokens', [('', 4096), ('x' * 20001, 4096), ('test', 100000)])
def test_invalid_request_fails_before_network(prompt, tokens):
    with pytest.raises(ValueError):
        client.generate_research(api_key='test-only', model='test-model', prompt=prompt, max_output_tokens=tokens)
