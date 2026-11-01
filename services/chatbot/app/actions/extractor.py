"""
Structured extraction of logs and reminder requests from one message, with the main model in a
deterministic, JSON-only role (`get_llm(..., extractor=True)`).

Any failure here (timeout, provider error, schema the model could not fill) is
swallowed and returns None: logging is an extra, and a mother asking a question
must still get her answer.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.actions.schemas import IST, ExtractionResult
from app.llm.factory import get_llm
from app.settings import settings

logger = logging.getLogger(__name__)

EXTRACTION_TIMEOUT_S = 8.0

_PROMPT = """You read messages a pregnant or postpartum mother sends to her health
assistant and pull out anything she is reporting about HERSELF (or her baby's
kicks/heartbeat) that can be saved as a log. Messages may be English, Hindi or
Hinglish.

Kinds you can return:
- bp: blood pressure "118/80" -> systolic 118, diastolic 80
- sugar: blood sugar in mg/dL; timing "fasting" (empty stomach, morning before
  food) or "post_meal" (after food / after lunch / PP). Leave timing empty if she
  does not say.
- weight: in kg (convert pounds: kg = lb / 2.2046)
- hb: haemoglobin in g/dL
- temperature: the number she gives, with unit F or C if she says it
- urine_protein: 0 for nil/negative, 1 for "1+" or trace, 2 for "2+", etc.
- fetal_heart_rate: baby's heartbeat per minute (from a doppler or clinic)
- water: glasses of water. mode "add" for more since last time ("drank 2
  glasses"), "set" for today's total ("6 glasses today")
- kicks: baby movements she counted. mode "add" or "set" as for water
- medicine: one entry per medicine or supplement she says she took ("took my
  iron and calcium" -> two entries: "iron", "calcium")
- pumping: breast pumping session; side left/right/both, minutes, ml
- meal: what she ate; meal_time breakfast/lunch/evening_snack/dinner if she
  says or it is obvious ("for lunch"); foods as she named them

Rules:
- Only report values she actually states. Never guess, never fill a number she
  did not give. A question ABOUT a value ("is 140/90 high?", "what should my sugar
  be?") is not a report: return no logs for it.
- A value she reports about someone else is not hers: ignore it.
- past_day = true if she says the values are from an earlier day (yesterday,
  last week, kal raat).
- has_question = true if, besides reporting, she asks something Viva should
  answer ("my bp is 150/100, is that dangerous?").
- If nothing can be logged, return an empty logs list.

Reminders: if she asks Viva to remind her of something ("remind me to take iron
at 9 pm", "kal subah 10 baje doctor ko call karne ka yaad dilana", "हर रोज़ शाम
को पानी पीने का रिमाइंडर लगा दो"), return it in `reminders`, not in `logs`.
- Right now it is {weekday}, {today} {now_time} (India time). Use this to turn
  "today", "tomorrow"/"kal", weekday names and "in 2 hours" into a date and a
  24-hour time.
- time: only if she gives a clock time or a relative one. If she only says
  morning/subah, afternoon/dopahar, evening/shaam or night/raat, fill
  part_of_day instead. If she gives neither, leave both empty.
- frequency: daily for "every day"/"roz"/"daily"; once for a single occasion
  ("tomorrow at 10", "on Friday"); custom with weekdays for named days ("every
  Monday"); alternateDays for "every other day"; weekly for "once a week".
  "Remind me to take iron at 9 pm" with no day named is daily.
- Only set reminders she asks for herself; a question about reminders is not a
  request. Never change what she wants reminding about (no doses or advice of
  your own). past_day does not apply to reminders.

Message:
{message}
"""


def build_prompt(text: str, now: datetime) -> str:
    return _PROMPT.format(
        message=text,
        weekday=now.strftime("%A"),
        today=now.strftime("%Y-%m-%d"),
        now_time=now.strftime("%H:%M"),
    )


async def extract_logs(
    text: str, request_id: str, now: Optional[datetime] = None
) -> Optional[ExtractionResult]:
    """Extract loggable values and reminder requests from `text`, or None if extraction failed."""
    try:
        llm = get_llm(settings.llm_model, extractor=True).with_structured_output(ExtractionResult)
        loop = asyncio.get_event_loop()
        prompt = build_prompt(text, now or datetime.now(IST))
        result = await asyncio.wait_for(
            loop.run_in_executor(None, llm.invoke, prompt),
            timeout=EXTRACTION_TIMEOUT_S,
        )
        if isinstance(result, dict):
            result = ExtractionResult.model_validate(result)
        if not isinstance(result, ExtractionResult):
            logger.warning(f"[{request_id}] Log extraction returned {type(result).__name__}")
            return None
        logger.info(
            f"[{request_id}] Log extraction: {len(result.logs)} log(s), "
            f"{len(result.reminders)} reminder(s), "
            f"past_day={result.past_day}, has_question={result.has_question}"
        )
        return result
    except asyncio.TimeoutError:
        logger.warning(f"[{request_id}] Log extraction timed out")
    except Exception as e:  # noqa: BLE001 - logging must never cost her the answer
        logger.warning(f"[{request_id}] Log extraction failed: {type(e).__name__}: {e}")
    return None
