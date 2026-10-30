"""
Live check of logging from chat against the real model.

Runs each message through the same extraction + proposal step the chat pipeline
uses and compares the result with what a person would expect. Needs the model
credentials the service uses (Vertex ADC or GROQ_API_KEY), so it is not part of
the unit tests.

    uv run python scripts/eval_log_extraction.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.actions.extractor import extract_logs  # noqa: E402
from app.actions.schemas import to_proposals  # noqa: E402

# (message, expected logTypes in order; "?" = Viva should ask for a missing value,
#  "past" = earlier day, [] = nothing to log)
CASES = [
    ("today my bp is 118/80", ["bp"]),
    ("bp 130/90", ["bp"]),
    ("आज मेरा बीपी 130/90 है", ["bp"]),
    ("mera bp aaj 125/85 aaya", ["bp"]),
    ("fasting sugar 92", ["sugar"]),
    ("sugar 140 after lunch", ["sugar"]),
    ("my sugar is 110", "?"),
    ("I weigh 61.5 kg", ["weight"]),
    ("weight 135 lbs", ["weight"]),
    ("hb 10.2", ["hb"]),
    ("my haemoglobin came 9.8 in the report", ["hb"]),
    ("I have fever 100.8", ["temperature"]),
    ("temperature 38.2 C", ["temperature"]),
    ("urine protein 1+", ["urine_protein"]),
    ("baby heartbeat was 142 at the clinic", ["fetal_heart_rate"]),
    ("drank 2 glasses of water", ["water"]),
    ("I've had 6 glasses of water today", ["water"]),
    ("maine 3 glass paani piya", ["water"]),
    ("baby kicked 10 times", ["kicks"]),
    ("took my iron and calcium", ["medicine_dose", "medicine_dose"]),
    ("aaj iron ki goli li", ["medicine_dose"]),
    ("pumped 15 min both sides, 60 ml", ["pumping"]),
    ("had dal roti for lunch", ["meal"]),
    ("nashte mein poha khaya", ["meal"]),
    ("bp 120/80 and sugar fasting 90", ["bp", "sugar"]),
    ("my bp is 150/100, is that dangerous?", ["bp"]),
    ("yesterday my bp was 120/80", "past"),
    ("is 140/90 high in pregnancy?", []),
    ("what should my sugar level be?", []),
    ("my husband's bp is 140/90", []),
    ("how much water should I drink?", []),
]


async def main() -> int:
    passed = 0
    for text, expected in CASES:
        result = await extract_logs(text, "eval")
        if result is None:
            got: object = "ERROR"
        else:
            proposals = to_proposals(result)
            if result.past_day and (proposals.logs or proposals.missing):
                got = "past"
            elif proposals.missing and not proposals.logs:
                got = "?"
            else:
                got = [p["logType"] for p in proposals.logs]
        ok = got == expected
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {text!r}\n      expected={expected} got={got}")
    print(f"\n{passed}/{len(CASES)} correct")
    return 0 if passed == len(CASES) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
