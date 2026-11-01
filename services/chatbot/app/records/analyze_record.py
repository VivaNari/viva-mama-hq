"""
Reading one saved health record (1 PDF or up to 5 photos of one document).

    load files -> triage -> policy (code, with who she filed it for) -> analysis
      -> lint -> critical-value banner -> render + digest

The same steps and guardrails as a chat attachment turn, without a conversation:
nothing is written to memory, and the core API stores what this returns. Anything
that is not a health document of hers (or of the baby she filed it under) is
refused before a word is generated about the file.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from app.attachments.analysis import AnalysisError, analyze, lint, render, to_session_context
from app.attachments.classifier import ClassifierError, triage
from app.attachments.critical_values import evaluate
from app.attachments.loader import AttachmentLoadError, build_media_parts
from app.attachments.policy import Decision, decide, record_refusal_message
from app.attachments.schemas import Verdict
from app.chains.chat_pipeline_mcp import fetch_user_context
from app.escalation.policy import format_escalation_banner
from app.llm.factory import supports_vision
from app.records.dates import parse_report_date
from app.records.schemas import RecordAnalyzeRequest, RecordAnalyzeResponse

logger = logging.getLogger(__name__)

PROFILE_TIMEOUT_S = 4.0

_CATEGORY_LABEL = {
    "scan": "a pregnancy scan report",
    "lab": "a lab report",
    "prescription": "a prescription",
    "mch": "her MCH (Mother and Child Protection) card",
}
_SCAN_LABEL = {"dating": "dating scan", "anomaly": "anomaly scan", "growth": "growth scan"}


def record_hint(req: RecordAnalyzeRequest) -> str:
    """What she said this record is, for the analysis prompt. Built from enums only."""
    what = _CATEGORY_LABEL[req.category]
    if req.category == "scan" and req.scan_type:
        what += f" ({_SCAN_LABEL[req.scan_type]})"
    if req.subject.type == "child":
        baby = "her baby"
        if req.subject.child_name:
            baby += f" {req.subject.child_name}"
        if req.subject.child_age_text:
            baby += f", {req.subject.child_age_text}"
        return f"{what}, filed under {baby}"
    return f"{what}, filed as her own record"


async def analyze_record(req: RecordAnalyzeRequest, request_id: str) -> RecordAnalyzeResponse:
    started = time.time()
    lang = req.lang
    kinds = ",".join(f.kind for f in req.files)

    def done(decision: Decision, **fields) -> RecordAnalyzeResponse:
        logger.info(
            f"[{request_id}] record_verdict verdict={decision.verdict.value} "
            f"reason_code={decision.reason_code} category={req.category} "
            f"subject={req.subject.type} document_type={decision.category} kinds={kinds} "
            f"files={len(req.files)} severity={fields.get('severity', 'NONE')} "
            f"latency_ms={(time.time() - started) * 1000:.0f}"
        )
        message = None
        if decision.verdict != Verdict.ANALYZED:
            message = record_refusal_message(decision.verdict, lang)
        return RecordAnalyzeResponse(
            request_id=request_id,
            verdict=decision.verdict.value,
            reason_code=decision.reason_code,
            document_type=decision.category,
            message=message,
            **fields,
        )

    if not supports_vision():
        return done(Decision(Verdict.ERROR, "NO_VISION_PROVIDER"))

    try:
        media = await build_media_parts(req.files)
    except AttachmentLoadError as e:
        logger.warning(f"[{request_id}] Record load failed: {e}")
        return done(Decision(Verdict.ERROR, "LOAD_FAILED"))

    try:
        batch = await triage("", media, request_id)
    except ClassifierError as e:
        return done(Decision(Verdict.ERROR, f"TRIAGE_{e}".upper()[:40]))
    decision, _per_file = decide(batch, req.subject.type)
    if decision.verdict != Verdict.ANALYZED:
        return done(decision)
    if decision.contains_ai_instructions:
        logger.warning(f"[{request_id}] record_contains_ai_instructions=true")

    profile = ""
    try:
        ctx = await asyncio.wait_for(fetch_user_context(req.user_id, request_id), PROFILE_TIMEOUT_S)
        profile = ctx.profile_context or ""
    except Exception:  # noqa: BLE001 - her profile only sharpens the reading
        profile = ""

    try:
        analysis = await analyze("", media, lang, profile, request_id, record_hint(req))
    except AnalysisError as e:
        logger.warning(f"[{request_id}] Record analysis failed: {e}")
        return done(Decision(Verdict.ERROR, "ANALYSIS_FAILED", decision.category))
    if analysis.out_of_scope:
        # The second reader disagreed with triage. Fail closed.
        return done(Decision(Verdict.UNRELATED, "ANALYSIS_OUT_OF_SCOPE", decision.category))

    analysis, lint_hits = lint(analysis)
    if lint_hits:
        logger.warning(f"[{request_id}] record_lint_hit count={lint_hits}")

    severity, matches = evaluate(analysis)
    banner = format_escalation_banner(severity, matches, source="record")
    body = render(analysis, lang)
    title: Optional[str] = analysis.document_title.strip() or None
    return done(
        decision,
        title=title,
        report_date=parse_report_date(analysis.report_date),
        analysis=analysis,
        summary_markdown=(banner + "\n\n" if banner else "") + body,
        digest=to_session_context(analysis, decision.category),
        severity=severity,
        critical_matches=matches,
    )


__all__ = ["analyze_record", "record_hint"]
