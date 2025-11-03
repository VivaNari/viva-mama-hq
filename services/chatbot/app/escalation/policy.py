# app/escalation/policy.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Detect *red-flag* symptoms in the user's text (or in the drafted reply)
# and, if found, add a clear "please see a doctor" warning.
#
# HOW IT WORKS:
# - We keep a small list of red-flag phrases with a severity level.
# - We scan text; if any phrase is present, we mark the highest severity.
# - We return a banner message (or empty if nothing risky was found).
#
# You can expand the list anytime (ideally reviewed by clinicians).
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import Tuple, List

# Red-flag catalog:
# Each tuple is: (phrase_to_match, severity, human_message)
# - Keep phrases simple and specific to avoid false alarms.
# - Severity can be "HIGH" or "MEDIUM". (You can add "LOW" later if needed.)
RED_FLAGS: List[tuple[str, str, str]] = [
    ("soaking a pad an hour", "HIGH",   "Heavy bleeding can be dangerous after delivery."),
    ("passing large clots",    "HIGH",   "Heavy bleeding and clots need urgent assessment."),
    ("severe chest pain",      "HIGH",   "Chest pain can signal an emergency."),
    ("shortness of breath",    "HIGH",   "Sudden breathlessness needs urgent care."),
    ("fainting",               "HIGH",   "Fainting may indicate a serious condition."),
    ("thoughts of self-harm",  "HIGH",   "You deserve immediate mental health support."),
    ("vision changes",         "MEDIUM", "Vision issues can relate to high blood pressure."),
    ("severe headache",        "MEDIUM", "Severe headache may be a warning sign."),
    ("fever",                  "MEDIUM", "Fever could indicate infection."),
    ("calf pain",              "MEDIUM", "Calf pain/swelling can indicate a blood clot."),
]

# Helper to pick the worse of two severities.
def _max_severity(a: str, b: str) -> str:
    order = {"NONE": 0, "MEDIUM": 1, "HIGH": 2}
    return a if order[a] >= order[b] else b


def scan_for_red_flags(text: str) -> Tuple[str, List[str]]:
    """
    INPUT :
      text (string) - any user or assistant text to scan.
    OUTPUT:
      (level, matches)
        level   = "NONE" | "MEDIUM" | "HIGH"
        matches = list of phrases we detected
    SIMPLE IDEA:
      Look for any phrases from RED_FLAGS inside the text (case-insensitive).
      If multiple are found, we return the highest severity we saw.
    """
    if not text:
        return "NONE", []

    level = "NONE"
    matches: List[str] = []

    lowered = text.lower()
    for phrase, sev, _msg in RED_FLAGS:
        if phrase in lowered:
            matches.append(phrase)
            level = _max_severity(level, sev)

    return level, matches


def format_escalation_banner(level: str, matches: List[str]) -> str:
    """
    INPUT :
      level   = "NONE" | "MEDIUM" | "HIGH"
      matches = phrases that triggered the alert
    OUTPUT:
      banner string to prepend to the answer (or "" if no alert)

    HUMAN BEHAVIOR:
      - If HIGH: use an URGENT tone + tell user to seek immediate help.
      - If MEDIUM: recommend prompt medical appointment.
      - Always remind that the assistant gives wellness info only.
    """
    if level == "NONE":
        return ""

    # Make a human-readable list of what we detected.
    matched_text = ", ".join(matches) if matches else "red-flag symptoms"

    if level == "HIGH":
        title = "⚠️ **Urgent Care Advised**"
        next_steps = (
            "If you are in immediate danger, contact local emergency services right now. "
            "Please seek urgent medical attention."
        )
    else:  # MEDIUM
        title = "⚠️ **Medical Attention May Be Needed**"
        next_steps = "Please book an appointment with a qualified clinician as soon as possible."

    return (
        f"{title}\n\n"
        f"We detected {matched_text}. {next_steps}\n\n"
        "This assistant shares wellness information only and does not provide diagnosis."
    )
