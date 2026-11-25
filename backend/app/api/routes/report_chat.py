import logging
from time import monotonic
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report_cache import ReportCache
from app.services import place_assessment, rule_scoring
from pydantic import BaseModel, Field, StringConstraints

from app.core.config import settings
from app.services.report_chat import conversational_reply, offline_reply


router = APIRouter(prefix="/places", tags=["Report Chat"])
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
async def chat_with_report(slug: str, body: ChatRequest, request: Request, db: Session = Depends(get_db)):
    entry = db.query(ReportCache).filter_by(slug="place:" + slug).first()
    if entry is None or not entry.report_data.get("assessment"):
        raise HTTPException(404, "Sohbete başlamak için önce mahalle raporunu aç.")
    report = place_assessment.with_score_summary(entry.report_data)
    assessment = report["assessment"]
    record = {**rule_scoring.record_for(report), "id": slug}
    history = [turn.model_dump() for turn in body.history]
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
            return await conversational_reply(record, assessment, body.question, history)
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
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            logger.warning("Report chat provider reply unavailable (%s)", type(exc).__name__)

    return offline_reply(record, assessment, body.question, history)
