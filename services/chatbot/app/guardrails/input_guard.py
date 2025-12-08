from __future__ import annotations
import re
from typing import Tuple, Dict, Any
from app.llm.groq_client import get_classifier_llm


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,3}\d{3,4}"
)

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

    new_text, c = EMAIL_RE.subn("[email_redacted]", text)
    if c: report["email"] += c
    text = new_text

    new_text, c = PHONE_RE.subn("[phone_redacted]", text)
    if c: report["phone"] += c
    text = new_text

    def _name_sub(m: re.Match) -> str:
        return "I am [name_redacted]"
    new_text, c = NAME_HINT_RE.subn(_name_sub, text)
    if c: report["name_hint"] += c
    text = new_text

    return text, report



SCOPE_BLOCK_PATTERNS = [
    r"\bdiagnos(e|is|ing)\b",
    r"\bprescrib(e|ing|ed|ption)\b",
    r"\bdosage\b",
    r"\btreat(?:ment)?\b.*\bplan\b",
    r"\bantibiotic(s)?\b",
    r"\bprescription\b",
]

PROMPT_INJECTION_PATTERNS = [
    r"\b(ignore\s+(previous|all)\s+(rules|instructions))\b",
    r"\b(disable|bypass)\s+(guardrails|filters|safety)\b",
    r"\b(reveal|show)\s+(system|hidden|prompt|policy)\b",
    r"\b(act\s+as|pretend\s+to\s+be)\b",
    r"\b(run|execute|print)\s+(code|python|script)\b",
    r"\b(change|modify)\s+(your|the)\s+(instructions|rules)\b",
    r"\bfrom\s+now\s+on\b",
]




def check_with_llm_scope(text: str) -> bool:
    """
    Ask the LLM if the query is related to postpartum wellness.
    Returns True if within scope, False otherwise.
    """
    prompt = f"""
    You are a scope classifier for a postpartum wellness assistant.
    Decide if the following user question is related to postpartum care, recovery, lactation, emotional health, nutrition, or wellness.

    Question: "{text}"

    Respond only with "IN_SCOPE" or "OUT_OF_SCOPE".
    """
    # result = resp.choices[0].message.content.strip().upper()
    # if "OUT" in result:
    #     return False
    # elif "IN" in result:
    #     return True
    # else:
    #     return False
    llm = get_classifier_llm()
    
    llm_response = llm.invoke(prompt)

    print("llm_response------->", llm_response.content)
        # 🔒 Added strong normalization & safeguard
    if "OUT_OF_SCOPE" in llm_response.content:
        return False
    elif "IN_SCOPE" in llm_response.content:
        return True
    else:
        # Default fail-safe — treat as OUT_OF_SCOPE if unclear
        return False

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
    notes = {"blocked": False, "offtopic": False, "matched": []}

    for p in SCOPE_BLOCK_PATTERNS:
        if re.search(p, text, re.I):
            notes["blocked"] = True
            notes["matched"].append(p)

    if notes["blocked"]:
        rewritten = (
            "User is asking for medical diagnosis/prescription details. "
            "Respond with general postpartum wellness education, self-care tips, "
            "warning signs to watch for, and advise consulting a qualified clinician "
            "for personal medical advice."
        )
        return rewritten, notes
    
    # ✅ Use LLM to classify scope

        
    for p in PROMPT_INJECTION_PATTERNS:
            if re.search(p, text, re.I):
                notes["offtopic"] = True
                notes["matched"].append(p)
                refusal = (
                    "Sorry, I can’t change my safety instructions or perform code execution. "
                    "I can only discuss postpartum wellness topics.\n\n"
                    "— *Wellness information only; not medical advice.*"
                )
                return refusal, notes
            

    in_scope = check_with_llm_scope(text)
    print("llm_response-2232333------>",in_scope)

    if not in_scope:
        notes["offtopic"] = True
        refusal = (
            "I'm sorry, but I'm a postpartum wellness assistant. "
            "I can only help with questions related to postpartum care, recovery, and wellness.\n\n"
            "— *Wellness information only; not medical advice.*"
        )
        return refusal, notes
    return text, notes
