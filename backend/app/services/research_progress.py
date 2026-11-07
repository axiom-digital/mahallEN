"""Request-local progress reporting; concurrent localities never share a phase."""
from contextlib import contextmanager
from contextvars import ContextVar

_listener = ContextVar("research_progress", default=None)


def phase(value):
    listener = _listener.get()
    if listener:
        listener(value)


@contextmanager
def track(listener):
    token = _listener.set(listener)
    try:
        yield
    finally:
        _listener.reset(token)
