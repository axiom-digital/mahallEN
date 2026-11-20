import logging
from time import monotonic
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints

from app.core.config import settings
from app.services.report_chat import (
    answer_question, fallback_answer, is_report_question, load_report,
    mentioned_reports, other_neighborhood_venues, venue_matches, words,
)


router = APIRouter(prefix="/neighborhoods", tags=["Report Chat"])
logger = logging.getLogger(__name__)
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)]


class ChatTurn(BaseModel):
    question: Question
    answer: Answer


class ChatRequest(BaseModel):
    question: Question
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)


class ChatSource(BaseModel):
    id: str
    url: str
    label: str


class ChatResponse(BaseModel):
    answer: Answer
    sources: list[ChatSource]


@router.post("/{slug}/chat", response_model=ChatResponse)
async def chat_with_report(slug: str, body: ChatRequest, request: Request):
    previous_question = body.history[-1].question if body.history else ""
    try:
        report = load_report(slug)
        targets = mentioned_reports(body.question)
        if not targets and words(body.question) & {"orada", "orasi", "oranin", "peki"}:
            targets = mentioned_reports(previous_question)
        if len(targets) == 1 and slug not in targets:
            report = load_report(next(iter(targets)))
    except LookupError:
        raise HTTPException(404, "Mahalle raporu bulunamadı.") from None
    except (OSError, ValueError):
        raise HTTPException(503, "Mahalle raporuna şu anda ulaşılamıyor.") from None

    if alternatives := other_neighborhood_venues(report, body.question, previous_question):
        return alternatives
    state = request.app.state
    use_provider = False
    if settings.GROQ_API_KEY:
        with state.report_chat_lock:
            now = monotonic()
            requests = state.report_chat_requests
            while requests and now - requests[0] >= 60:
                requests.popleft()
            use_provider = len(requests) < 24 and now >= state.report_chat_not_before
            if use_provider:
                requests.append(now)

    if use_provider:
        try:
            return await answer_question(report, body.question, [turn.model_dump() for turn in body.history])
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.warning("Report chat provider returned HTTP %s", status)
            if status == 429:
                retry_after = exc.response.headers.get("Retry-After", "")
                delay = 10
                if len(retry_after) <= 4 and retry_after.isascii() and retry_after.isdecimal():
                    delay = min(60, max(1, int(retry_after)))
                with state.report_chat_lock:
                    state.report_chat_not_before = max(state.report_chat_not_before, monotonic() + delay)
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            logger.warning("Report chat provider reply unavailable (%s)", type(exc).__name__)

    if is_report_question(report, body.question, previous_question) or venue_matches(report, body.question, previous_question) is not None:
        return fallback_answer(report, body.question, previous_question)
    if settings.GROQ_API_KEY:
        with state.report_chat_lock:
            now = monotonic()
            available_at = state.report_chat_not_before
            if len(requests) >= 24:
                available_at = max(available_at, requests[0] + 60)
        if available_at > now:
            raise HTTPException(429, "Sohbet şu anda yoğun.",
                                headers={"Retry-After": str(int(available_at - now) + 1)})
    raise HTTPException(503, "Sohbete şu anda bağlanılamıyor.")
