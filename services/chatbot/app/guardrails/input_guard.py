# app/guardrails/input_guard.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# 1) Remove obvious private info from the user's message (privacy first).
# 2) Keep the chatbot in "wellness advice" mode (no diagnosis/prescriptions).
#
# HOW TO USE:
#   clean_text, redaction_report = redact(user_text)
#   safe_text, scope_notes      = enforce_scope(clean_text)
#
# Then pass `safe_text` forward to routing / RAG / LLM.
#
# DESIGN NOTES:
# - Redaction is conservative: we remove emails, phone-like numbers, and simple
#   "my name is X" patterns. (You can tighten/expand later.)
# - Scope enforcement does not "refuse". It gently rewrites the intent so the
#   bot gives general wellness education and suggests seeing a clinician for
#   personal care, keeping you compliant (wellness app, not diagnostic tool).
# ---------------------------------------------------------------------

from __future__ import annotations
import re
from typing import Tuple, Dict, Any

# -----------------------------
# 1) Simple PII/PHI patterns
# -----------------------------
# Matches basic emails like jane@example.com
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# Matches many phone-like patterns (international or local with separators)
# This is intentionally broad; better a few false-positives than leaks.
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,3}\d{3,4}"
)

# Matches "my name is John" or "I am Priya" at start of a phrase.
# We replace only the name word, not the whole sentence.
NAME_HINT_RE = re.compile(
    r"\b(?:my name is|i am|this is)\s+[A-Z][a-z]+", re.I
)

def redact(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    INPUT  : raw user text
    OUTPUT : (redacted_text, report_dict)

    WHAT IT DOES:
      - Replaces emails with [email_redacted]
      - Replaces phone numbers with [phone_redacted]
      - Replaces simple name-introductions with [name_redacted]
    """
    report = {"email": 0, "phone": 0, "name_hint": 0}

    # Replace emails
    new_text, c = EMAIL_RE.subn("[email_redacted]", text)
    if c: report["email"] += c
    text = new_text

    # Replace phone numbers
    new_text, c = PHONE_RE.subn("[phone_redacted]", text)
    if c: report["phone"] += c
    text = new_text

    # Replace "my name is X" → "I am [name_redacted]"
    def _name_sub(m: re.Match) -> str:
        # Whatever matched gets normalized to a safe template
        return "I am [name_redacted]"
    new_text, c = NAME_HINT_RE.subn(_name_sub, text)
    if c: report["name_hint"] += c
    text = new_text

    return text, report


# -----------------------------
# 2) Keep scope = wellness
# -----------------------------
# If the user asks for diagnosis, prescriptions, dosages, or treatment plans,
# we will *not* answer those directly. We rewrite the "intent" so the LLM
# provides general education + suggests seeing a clinician.

SCOPE_BLOCK_PATTERNS = [
    r"\bdiagnos(e|is|ing)\b",
    r"\bprescrib(e|ing|ed|ption)\b",
    r"\bdosage\b",
    r"\btreat(?:ment)?\b.*\bplan\b",
    r"\bantibiotic(s)?\b",
    r"\bprescription\b",
]

def enforce_scope(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    INPUT  : redacted user text
    OUTPUT : (safe_text_for_llm, notes)

    WHAT IT DOES:
      - Scans for medical-intent patterns (diagnosis/prescription)
      - If found, we don't refuse; we *reframe* the request:
        "User seeks medical diagnosis/prescription. Provide general postpartum
         wellness education and suggest consulting a clinician."
      - If not found, we pass the text unchanged.
    """
    notes = {"blocked": False, "matched": []}

    for p in SCOPE_BLOCK_PATTERNS:
        if re.search(p, text, re.I):
            notes["blocked"] = True
            notes["matched"].append(p)

    if notes["blocked"]:
        # Gentle steer instead of refusal: keeps UX smooth and compliant.
        rewritten = (
            "User is asking for medical diagnosis/prescription details. "
            "Respond with general postpartum wellness education, self-care tips, "
            "warning signs to watch for, and advise consulting a qualified clinician "
            "for personal medical advice."
        )
        return rewritten, notes

    # No risky medical intent detected → allow original text through
    return text, notes
