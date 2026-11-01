"""
The logging step that runs before the answer pipeline.

It decides one of three things for a message (a reminder she asks for counts
as a log here: it is proposed and confirmed the same way):
- nothing to log: the normal pipeline answers it, untouched;
- a log and nothing else: a short templated reply plus proposals, no RAG or
  answer generation (`handled_fully`);
- a log and a question ("bp 150/100, is that high?"): proposals ride along with
  the normal answer.

When one value is missing ("sugar is 110" without fasting/after a meal) Viva asks
once and keeps her message in session memory; the next message is read together
with it. If the gap is still not filled she is not asked again.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.actions import replies
from app.actions.extractor import extract_logs
from app.actions.prefilter import may_contain_log
from app.actions.schemas import to_proposals
from app.attachments.critical_values import (
    bp_level,
    glucose_level,
    hb_level,
    urine_protein_level,
)
from app.escalation.policy import format_escalation_banner
from app.guardrails.input_guard import check_prompt_injection
from app.memory.redis_memory import RedisSessionMemory

logger = logging.getLogger(__name__)

# BP, Hb, sugar and urine protein use the same cut-offs as a report she uploads
# (app.attachments.critical_values). Fever has no report rule; to be confirmed
# with the clinical advisors.
FEVER_F = 100.4


@dataclass
class LogActionOutcome:
    proposals: List[Dict[str, Any]] = field(default_factory=list)
    # The reply to send when `handled_fully`; otherwise None.
    reply: Optional[str] = None
    handled_fully: bool = False
    # Escalation banner for a dangerous value, "" when none.
    banner: str = ""


def danger_banner(proposals: List[Dict[str, Any]]) -> str:
    """A red-flag banner for dangerous values she reported, or ""."""
    high: List[str] = []
    medium: List[str] = []

    def add(level: str, label: str) -> None:
        if level == "HIGH":
            high.append(label)
        elif level == "MEDIUM":
            medium.append(label)

    bp_raised = False
    for proposal in proposals:
        fields = proposal.get("fields", {})
        log_type = proposal.get("logType")
        if log_type == "bp" and "systolic" in fields and "diastolic" in fields:
            level = bp_level(fields["systolic"], fields["diastolic"])
            bp_raised = bp_raised or level != "NONE"
            add(level, f"blood pressure {fields['systolic']}/{fields['diastolic']}")
        elif log_type == "hb" and "value" in fields:
            add(hb_level(fields["value"]), f"haemoglobin {fields['value']} g/dL")
        elif log_type == "sugar" and "value" in fields:
            add(glucose_level(fields["value"]), f"blood sugar {fields['value']} mg/dL")
        elif log_type == "temperature" and fields.get("valueF", 0) >= FEVER_F:
            medium.append(f"fever {fields['valueF']}°F")
    # Protein in urine is graded against BP, as on a report: read it after BP.
    for proposal in proposals:
        fields = proposal.get("fields", {})
        if proposal.get("logType") == "urine_protein" and "value" in fields:
            add(
                urine_protein_level(int(fields["value"]), bp_raised),
                f"urine protein {fields['value']}+",
            )

    if high:
        return format_escalation_banner("HIGH", high + medium)
    if medium:
        return format_escalation_banner("MEDIUM", medium)
    return ""


async def run_log_actions(
    user_text: str,
    session_id: str,
    memory: RedisSessionMemory,
    request_id: str,
) -> LogActionOutcome:
    """Read `user_text` for loggable values and decide how to reply."""
    loop = asyncio.get_event_loop()
    pending = await loop.run_in_executor(None, memory.get_pending_log, session_id)

    if not pending and not may_contain_log(user_text):
        return LogActionOutcome()

    # The normal pipeline refuses injection attempts; never extract from one.
    is_injection, _ = check_prompt_injection(user_text)
    if is_injection:
        return LogActionOutcome()

    # A reply to "fasting or after a meal?" is read together with the message
    # that prompted the question.
    text = f"{pending}\n{user_text}" if pending else user_text
    result = await extract_logs(text, request_id)

    async def clear_pending() -> None:
        if pending:
            await loop.run_in_executor(None, memory.clear_pending_log, session_id)

    if result is None:
        await clear_pending()
        return LogActionOutcome()

    proposals = to_proposals(result)
    # Reminders are about the future; "yesterday" only ever closes logs.
    log_items = [p for p in proposals.logs if p["logType"] != "reminder"]
    log_missing = [m for m in proposals.missing if m[0] != "reminder"]
    reminders_only = bool(proposals.logs) and not log_items

    if result.past_day and (log_items or log_missing):
        await clear_pending()
        if result.has_question:
            return LogActionOutcome()
        return LogActionOutcome(reply=replies.past_day_reply(user_text), handled_fully=True)

    banner = danger_banner(proposals.logs)

    if proposals.missing:
        if pending:
            # Asked once already and still not filled: let it go and answer normally.
            await clear_pending()
            return LogActionOutcome(proposals=proposals.logs, banner=banner)
        kind, missing_field = proposals.missing[0]
        await loop.run_in_executor(None, memory.set_pending_log, session_id, user_text)
        question = replies.ask_reply(user_text, kind, missing_field)
        reply = (
            f"{replies.propose_reply(user_text, reminders_only)}\n\n{question}"
            if proposals.logs
            else question
        )
        return LogActionOutcome(
            proposals=proposals.logs, reply=reply, handled_fully=True, banner=banner
        )

    await clear_pending()

    if proposals.out_of_range and not proposals.logs:
        if result.has_question:
            return LogActionOutcome()
        return LogActionOutcome(
            reply=replies.recheck_reply(user_text, proposals.out_of_range[0]), handled_fully=True
        )

    if not proposals.logs:
        return LogActionOutcome()

    if result.has_question:
        return LogActionOutcome(proposals=proposals.logs, banner=banner)

    return LogActionOutcome(
        proposals=proposals.logs,
        reply=replies.propose_reply(user_text, reminders_only),
        handled_fully=True,
        banner=banner,
    )
