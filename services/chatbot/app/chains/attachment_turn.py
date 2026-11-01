"""
A chat turn that carries files: lab reports, scan reports, ultrasounds, prescriptions.

    caption guard -> load files -> triage -> policy (code) -> analysis -> lint
      -> critical-value banner -> render -> memory

Separate from the text pipeline on purpose. That pipeline answers from retrieved
content and forbids lab interpretation; here the content is her own document,
explained under a narrower policy (see app.attachments.analysis). The text
pipeline's log extraction never runs: "bp 120/80" in a caption is not a log.

Anything that is not an accepted health document of hers or her child's ends in a
canned reply with `quota_refund=True`, before a word is generated about the file.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from app.attachments.analysis import AnalysisError, analyze, lint, render, to_session_context
from app.attachments.classifier import ClassifierError, triage
from app.attachments.critical_values import evaluate
from app.attachments.loader import AttachmentLoadError, build_media_parts
from app.attachments.policy import Decision, decide, refusal_message
from app.attachments.schemas import AttachmentRef, Verdict
from app.chains.chat_pipeline_mcp import (
    ChatResponse,
    ServiceLevel,
    UserContextResult,
    _metrics,
    fetch_user_context,
)
from app.escalation.policy import format_escalation_banner, scan_for_red_flags
from app.guardrails.input_guard import enforce_scope, redact
from app.llm.factory import supports_vision
from app.memory.redis_memory import RedisSessionMemory

logger = logging.getLogger(__name__)

PROFILE_TIMEOUT_S = 4.0
MEMORY_ANSWER_CHARS = 3800

_INTENT = {
    Verdict.ANALYZED: "ATTACHMENT_ANALYSIS",
    Verdict.UNRELATED: "ATTACHMENT_REJECTED",
    Verdict.OTHER_PERSON: "ATTACHMENT_REJECTED",
    Verdict.CLINICAL_PHOTO: "ATTACHMENT_REJECTED",
    Verdict.UNREADABLE: "ATTACHMENT_UNREADABLE",
    Verdict.ERROR: "ATTACHMENT_ERROR",
}

_ORDER = {"NONE": 0, "MEDIUM": 1, "HIGH": 2}


def _empty_context(error: Optional[str] = None) -> UserContextResult:
    return UserContextResult(
        profile_context="",
        recovery_context="",
        expert_directory="",
        products_directory="",
        has_profile=False,
        has_recovery=False,
        error=error,
        fetch_time_ms=0.0,
    )


def _attachment_meta(decision: Decision, per_file: List[Decision], refs: List[AttachmentRef]):
    return {
        "verdict": decision.verdict.value,
        "category": decision.category,
        "subject": decision.subject,
        "reason_code": decision.reason_code,
        "per_item": [
            {"attachment_id": r.attachment_id, "verdict": d.verdict.value}
            for r, d in zip(refs, per_file)
        ],
    }


async def chat_once_with_attachments(
    caption: str,
    attachments: List[AttachmentRef],
    *,
    user_id: Optional[str],
    session_id: Optional[str],
    lang: Optional[str],
    request_id: str,
) -> ChatResponse:
    started = time.time()
    timings: Dict[str, float] = {}
    lang = lang if lang in ("en", "hi") else "en"
    memory = RedisSessionMemory(window_size=8)
    session_id = memory.ensure_session_id(session_id)
    loop = asyncio.get_event_loop()
    kinds = ",".join(a.kind for a in attachments)

    async def refuse(decision: Decision, per_file: List[Decision], scope: Dict[str, Any]):
        answer = refusal_message(decision.verdict, lang, len(attachments))
        # Memory gets that a file was shared, never anything about it.
        said = "" if scope.get("offtopic") else safe
        await loop.run_in_executor(
            None,
            memory.append,
            session_id,
            "user",
            "[Shared a file]" + (f" {said}" if said else ""),
        )
        await loop.run_in_executor(None, memory.append, session_id, "assistant", answer)
        await loop.run_in_executor(None, memory.clear_followup_topic, session_id)
        timings["total"] = (time.time() - started) * 1000
        _metrics.record_request(
            success=True, service_level=ServiceLevel.MINIMAL.value, timings=timings
        )
        logger.info(
            f"[{request_id}] attachment_verdict verdict={decision.verdict.value} "
            f"reason_code={decision.reason_code} category={decision.category} kinds={kinds} "
            f"latency_ms={timings['total']:.0f}"
        )
        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            answer=answer,
            intent=_INTENT[decision.verdict]
            if scope.get("offtopic") is not True
            else "OUT_OF_SCOPE",
            used_rag=False,
            rag_best_score=0.0,
            user_context=_empty_context(),
            redaction={},
            scope=scope,
            escalation_banner=None,
            memory_turns=[],
            timing=timings,
            service_level=ServiceLevel.MINIMAL.value,
            attachment=_attachment_meta(decision, per_file, attachments),
            quota_refund=True,
        )

    # ---- Caption: the same guard as any message ----
    redacted, _report = redact(caption or "")
    safe, scope = enforce_scope(redacted) if redacted.strip() else ("", {"offtopic": False})
    if scope.get("offtopic"):
        d = Decision(Verdict.UNRELATED, "CAPTION_INJECTION")
        resp = await refuse(d, [d] * len(attachments), scope)
        resp.answer = safe  # the existing injection refusal text
        return resp
    # A medical-scope rewrite of the caption is fine here: the analysis has its own
    # boundaries, and only her words (not the rewrite) are a question about the file.
    question = redacted.strip()
    caption_level, caption_matches = scan_for_red_flags(question)

    if not supports_vision():
        d = Decision(Verdict.ERROR, "NO_VISION_PROVIDER")
        return await refuse(d, [d] * len(attachments), {})

    # ---- Files ----
    t0 = time.time()
    try:
        media = await build_media_parts(attachments)
    except AttachmentLoadError as e:
        logger.warning(f"[{request_id}] Attachment load failed: {e}")
        d = Decision(Verdict.ERROR, "LOAD_FAILED")
        return await refuse(d, [d] * len(attachments), {})
    timings["load"] = (time.time() - t0) * 1000

    # ---- Triage, then the decision in code ----
    t0 = time.time()
    try:
        batch = await triage(question, media, request_id)
    except ClassifierError as e:
        d = Decision(Verdict.ERROR, f"TRIAGE_{e}".upper()[:40])
        return await refuse(d, [d] * len(attachments), {})
    timings["triage"] = (time.time() - t0) * 1000
    decision, per_file = decide(batch)
    if decision.verdict != Verdict.ANALYZED:
        return await refuse(decision, per_file, {})
    if decision.contains_ai_instructions:
        logger.warning(f"[{request_id}] attachment_contains_ai_instructions=true")

    # ---- Analysis ----
    profile = ""
    if user_id:
        try:
            ctx = await asyncio.wait_for(fetch_user_context(user_id, request_id), PROFILE_TIMEOUT_S)
            profile = ctx.profile_context or ""
        except Exception:  # noqa: BLE001 - her profile only sharpens the answer
            profile = ""
    t0 = time.time()
    try:
        analysis = await analyze(question, media, lang, profile, request_id)
    except AnalysisError as e:
        logger.warning(f"[{request_id}] Attachment analysis failed: {e}")
        d = Decision(Verdict.ERROR, "ANALYSIS_FAILED", decision.category, decision.subject)
        return await refuse(d, per_file, {})
    timings["analysis"] = (time.time() - t0) * 1000

    if analysis.out_of_scope:
        # The second reader disagreed with triage. Fail closed.
        d = Decision(
            Verdict.UNRELATED, "ANALYSIS_OUT_OF_SCOPE", decision.category, decision.subject
        )
        return await refuse(d, [d] * len(attachments), {})

    analysis, lint_hits = lint(analysis)
    if lint_hits:
        logger.warning(f"[{request_id}] analysis_lint_hit count={lint_hits}")

    # ---- Banner: fixed rules on the values, plus symptoms in her caption ----
    doc_level, doc_matches = evaluate(analysis)
    banners: List[str] = []
    if doc_level != "NONE":
        banners.append(format_escalation_banner(doc_level, doc_matches, source="document"))
    if caption_level != "NONE":
        banners.append(format_escalation_banner(caption_level, caption_matches, source="message"))
    severity = max((doc_level, caption_level), key=lambda s: _ORDER[s])
    banner = "\n\n".join(banners)

    body = render(analysis, lang)
    answer = (banner + "\n\n" if banner else "") + body

    # ---- Memory: enough for follow-ups, never the file ----
    title = analysis.document_title or decision.category or "health document"
    user_turn = f"[Shared: {decision.category} for {decision.subject} — {title}]"
    if question:
        user_turn += f" {safe}"
    await loop.run_in_executor(None, memory.append, session_id, "user", user_turn)
    await loop.run_in_executor(
        None, memory.append, session_id, "assistant", answer[:MEMORY_ANSWER_CHARS]
    )
    await loop.run_in_executor(
        None,
        memory.set_document_context,
        session_id,
        to_session_context(analysis, decision.category),
    )
    await loop.run_in_executor(None, memory.clear_followup_topic, session_id)

    timings["total"] = (time.time() - started) * 1000
    _metrics.record_request(success=True, service_level=ServiceLevel.FULL.value, timings=timings)
    logger.info(
        f"[{request_id}] attachment_verdict verdict=ANALYZED reason_code=OK "
        f"category={decision.category} subject={decision.subject} kinds={kinds} "
        f"findings={len(analysis.findings)} critical={severity} "
        f"latency_ms={timings['total']:.0f}"
    )
    return ChatResponse(
        request_id=request_id,
        session_id=session_id,
        answer=answer,
        intent="ATTACHMENT_ANALYSIS",
        used_rag=False,
        rag_best_score=0.0,
        user_context=_empty_context(),
        redaction={},
        scope=scope,
        escalation_banner=banner or None,
        memory_turns=[],
        timing=timings,
        service_level=ServiceLevel.FULL.value,
        final_prompt="[ATTACHMENT_ANALYSIS — prompt not retained]",
        attachment=_attachment_meta(decision, per_file, attachments),
        quota_refund=False,
    )


def document_context_block(memory: RedisSessionMemory, session_id: str) -> str:
    """The prompt block for a text follow-up about a document she shared, or ''."""
    text = memory.get_document_context(session_id)
    if not text:
        return ""
    return (
        "=== DOCUMENT SHE SHARED IN THIS CONVERSATION (already explained to her) ===\n"
        f"{text}\n"
        "You MAY explain the values above against the ranges shown with them. Still never "
        "diagnose, never suggest starting, stopping or changing a medicine, and send her "
        "to her doctor for what the results mean for her."
    )


__all__ = ["chat_once_with_attachments", "document_context_block"]
