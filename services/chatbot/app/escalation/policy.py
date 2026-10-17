from __future__ import annotations

from typing import List, Tuple

RED_FLAGS: List[tuple[str, str, str]] = [
    ("soaking a pad an hour", "HIGH", "Heavy bleeding can be dangerous after delivery."),
    ("passing large clots", "HIGH", "Heavy bleeding and clots need urgent assessment."),
    ("severe chest pain", "HIGH", "Chest pain can signal an emergency."),
    ("shortness of breath", "HIGH", "Sudden breathlessness needs urgent care."),
    ("fainting", "HIGH", "Fainting may indicate a serious condition."),
    ("thoughts of self-harm", "HIGH", "You deserve immediate mental health support."),
    ("vision changes", "MEDIUM", "Vision issues can relate to high blood pressure."),
    ("severe headache", "MEDIUM", "Severe headache may be a warning sign."),
    ("fever", "MEDIUM", "Fever could indicate infection."),
    ("calf pain", "MEDIUM", "Calf pain/swelling can indicate a blood clot."),
]


def _max_severity(a: str, b: str) -> str:
    order = {"NONE": 0, "MEDIUM": 1, "HIGH": 2}
    return a if order[a] >= order[b] else b


def severity_for(matches: List[str]) -> str:
    """
    INPUT : matches - phrases already known to come from RED_FLAGS.
    OUTPUT: "NONE" | "MEDIUM" | "HIGH"
    WHY   : a banner is sometimes built from a SUBSET of what we matched
            (e.g. only the check-in symptoms we have not announced yet),
            so its severity must be recomputed from that subset.
    """
    severity_by_phrase = {phrase: sev for phrase, sev, _msg in RED_FLAGS}

    level = "NONE"
    for phrase in matches:
        sev = severity_by_phrase.get(phrase)
        if sev:
            level = _max_severity(level, sev)

    return level


_NEGATION_PREFIXES = ("no ", "not ", "none ", "never ", "normal", "no,", "no.")


def extract_affirmative_recovery_answers(recovery_text: str) -> str:
    """
    From the recovery check-in block, return only the user's affirmative
    'A:' answers — skipping system questions (Q: lines) and answers that
    start with a clear negation ("No fever", "Not applicable", etc.).
    This prevents keyword matches on question text or denied symptoms.
    """
    lines = []
    for line in recovery_text.split("\n"):
        stripped = line.strip()
        if not stripped.startswith("A:"):
            continue
        answer = stripped[2:].strip()
        if any(answer.lower().startswith(p) for p in _NEGATION_PREFIXES):
            continue
        lines.append(answer)
    return "\n".join(lines)


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


# Where the red flag came from decides how we open the banner. Naming the
# source matters: a symptom pulled from a check-in she logged days ago must
# not read as if we just diagnosed her mid-conversation.
_SOURCE_LEADINS = {
    "message": "We detected {matches}.",
    "checkin": "As per your recently logged recovery check-in, we noticed {matches}.",
    "profile": "Based on your health profile, we noticed {matches}.",
}


def format_escalation_banner(
    level: str,
    matches: List[str],
    source: str = "message",
) -> str:
    """
    INPUT :
      level   = "NONE" | "MEDIUM" | "HIGH"
      matches = phrases that triggered the alert
      source  = "message" (her current message) | "checkin" (recovery
                check-in answers) | "profile" (stored health profile)
    OUTPUT:
      banner string to prepend to the answer (or "" if no alert)

    HUMAN BEHAVIOR:
      - If HIGH: use an URGENT tone + tell user to seek immediate help.
      - If MEDIUM: recommend prompt medical appointment.
      - Say where the symptom came from, so context-derived alerts are
        never mistaken for something she just told us.
      - Always remind that the assistant gives wellness info only.
    """
    if level == "NONE":
        return ""

    matched_text = ", ".join(matches) if matches else "red-flag symptoms"
    leadin = _SOURCE_LEADINS.get(source, _SOURCE_LEADINS["message"]).format(matches=matched_text)

    if level == "HIGH":
        title = "**Urgent Care Advised**"
        next_steps = (
            "If you are in immediate danger, contact local emergency services right now. "
            "Please seek urgent medical attention."
        )
    else:
        title = " **Medical Attention May Be Needed**"
        next_steps = "Please book an appointment with a qualified clinician as soon as possible."

    return (
        f"{title}\n\n"
        f"{leadin} {next_steps}\n\n"
        "This assistant shares wellness information only and does not provide diagnosis."
    )
