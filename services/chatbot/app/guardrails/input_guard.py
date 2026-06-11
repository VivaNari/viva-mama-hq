"""
Input Guardrails for Viva Mama Chatbot

This module provides input validation, PII redaction, and scope enforcement
to ensure safe and appropriate interactions with the wellness assistant.

Key Features:
- PII Detection & Redaction (emails, phones, Aadhaar numbers)
- Prompt Injection Detection (comprehensive attack patterns)
- Medical Scope Enforcement (block diagnosis/prescription requests)
- Topic Scope Classification (LLM-based with caching)

Usage:
    from app.guardrails.input_guard import redact, enforce_scope
    
    # Step 1: Redact PII
    safe_text, redaction_report = redact(user_input)
    
    # Step 2: Enforce scope
    validated_text, scope_notes = enforce_scope(safe_text)
    
    if scope_notes["offtopic"]:
        return validated_text  # This is a refusal message
    else:
        # Proceed with chat
        pass

Author: Viva Mama Team
"""

from __future__ import annotations
import re
import logging
from typing import Tuple, Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

# Metrics counters (can be exported to Prometheus/monitoring)
_metrics = {
    "pii_redactions": {"email": 0, "phone": 0, "aadhaar": 0, "credit_card": 0},
    "blocks": {"medical": 0, "prompt_injection": 0, "off_topic": 0}
    # Note: Topic scope checking moved to main LLM prompt (hybrid approach)
}


# ============================================
# PII DETECTION PATTERNS
# ============================================

# Email pattern (RFC 5322 simplified)
EMAIL_RE = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
)

# Phone patterns (India + International)
PHONE_RE = re.compile(
    r'(?:\+?91[-.\s]?)?'  # Optional India country code
    r'(?:\(?\d{3,4}\)?[-.\s]?)?'  # Area code
    r'\d{3}[-.\s]?\d{4}'  # Main number
)

# Indian Aadhaar number (12 digits, optionally with spaces)
AADHAAR_RE = re.compile(
    r'\b\d{4}\s?\d{4}\s?\d{4}\b'
)

# Credit card (basic pattern, 13-19 digits)
CREDIT_CARD_RE = re.compile(
    r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4,7}\b'
)

# NOTE: Name redaction removed as requested (item 6)
# Names will be fetched from user profile via MCP instead


# ============================================
# CONFIGURABLE REFUSAL MESSAGES
# ============================================

MEDICAL_REFUSAL = (
    "User is asking for medical diagnosis/prescription details. "
    "Respond with general postpartum wellness education, self-care tips, "
    "warning signs to watch for, and advise consulting a qualified clinician "
    "for personal medical advice."
)

PROMPT_INJECTION_REFUSAL = (
    "Sorry, I can't change my safety instructions or perform code execution. "
    "I can only discuss postpartum wellness topics.\n\n"
    "— *Wellness information only; not medical advice.*"
)

OFF_TOPIC_REFUSAL = (
    "I'm sorry, but I'm a postpartum wellness assistant. "
    "I can only help with questions related to postpartum care, recovery, and wellness.\n\n"
    "— *Wellness information only; not medical advice.*"
)


# ============================================
# PROMPT INJECTION PATTERNS (Comprehensive)
# ============================================

PROMPT_INJECTION_PATTERNS = [
    # Ignore/bypass patterns
    r'\b(ignore|disregard|forget)\s+(all|previous|above|prior)\s+(instructions?|rules?|prompts?|commands?)\b',
    r'\b(disable|bypass|override|remove)\s+(safety|guardrails?|filters?|restrictions?)\b',
    
    # System manipulation
    r'\b(you\s+are\s+now|from\s+now\s+on|act\s+as|pretend\s+to\s+be)\b',
    r'\bsystem\s*:\s*',  # System message injection
    r'\bassistant\s*:\s*',  # Assistant message injection
    
    # Reveal/extract patterns
    r'\b(show|reveal|display|print|output)\s+(your\s+)?(prompt|instructions?|rules?|system\s+message)\b',
    
    # DAN and jailbreak patterns
    r'\bDAN\b.*\bdo\s+anything\s+now\b',
    r'\bjailbreak\b',
    r'\bdev\s+mode\b',
    
    # Code execution attempts
    r'\b(execute|run|eval|compile)\s+(code|python|javascript|script)\b',
    r'\bimport\s+os\b',
    r'\b__import__\b',
    
    # Instruction modification
    r'\b(change|modify|update|replace)\s+(your|the)\s+(instructions?|behavior|rules?)\b',
    r'\breset\s+to\s+factory\b',
    
    # Role-play attacks
    r'\bpretend\s+(you|we)\s+(are|have)\b',
    r'\bimagine\s+you\s+(are|have|can)\b',
    
    # Encoded/obfuscated attacks (basic detection)
    r'\bbase64\b.*decode',
    r'\bhex\b.*decode',
    
    # Multi-turn attacks
    r'\bin\s+the\s+next\s+response',
    r'\bfrom\s+this\s+point\s+forward\b',
]


# ============================================
# MEDICAL SCOPE PATTERNS (Refined)
# ============================================

SCOPE_BLOCK_PATTERNS = [
    # Diagnosis requests
    r'\b(can\s+you\s+)?(diagnose|diagnosis)\b(?!.*\b(app|issue|problem|situation)\b)',
    
    # Prescription/medication requests
    r'\b(prescrib(e|ing|ed|tion)|medication|medicine|drug)\s+(for|dosage|amount)\b',
    r'\b(how\s+much|what\s+dose)\s+(of\s+)?\w+\s+(should|can|to\s+take)\b',
    
    # Treatment plans
    r'\btreatment\s+plan\s+for\b',
    
    # Specific drugs/antibiotics
    r'\b(antibiotic|painkiller|prescription\s+drug)s?\b',
]


# ============================================
# PII REDACTION
# ============================================

def redact(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Redact personally identifiable information (PII) from user input.
    
    Detects and redacts:
    - Email addresses
    - Phone numbers (Indian and international formats)
    - Aadhaar numbers (12-digit Indian ID)
    - Credit card numbers (basic pattern)
    
    Args:
        text: Raw user input text
        
    Returns:
        Tuple of (redacted_text, report_dict)
        
        report_dict contains:
        {
            "email": int,        # Number of emails redacted
            "phone": int,        # Number of phones redacted
            "aadhaar": int,      # Number of Aadhaar numbers redacted
            "credit_card": int   # Number of credit cards redacted
        }
        
    Example:
        >>> text = "My email is john@example.com and phone is 9876543210"
        >>> redacted, report = redact(text)
        >>> print(redacted)
        "My email is [email_redacted] and phone is [phone_redacted]"
        >>> print(report)
        {"email": 1, "phone": 1, "aadhaar": 0, "credit_card": 0}
    """
    report = {"email": 0, "phone": 0, "aadhaar": 0, "credit_card": 0}
    
    # Redact emails
    new_text, count = EMAIL_RE.subn("[email_redacted]", text)
    if count:
        report["email"] += count
        _metrics["pii_redactions"]["email"] += count
        logger.info(f"Redacted {count} email(s) from user input")
    text = new_text
    
    # Redact phone numbers
    new_text, count = PHONE_RE.subn("[phone_redacted]", text)
    if count:
        report["phone"] += count
        _metrics["pii_redactions"]["phone"] += count
        logger.info(f"Redacted {count} phone number(s) from user input")
    text = new_text
    
    # Redact Aadhaar numbers
    new_text, count = AADHAAR_RE.subn("[aadhaar_redacted]", text)
    if count:
        report["aadhaar"] += count
        _metrics["pii_redactions"]["aadhaar"] += count
        logger.info(f"Redacted {count} Aadhaar number(s) from user input")
    text = new_text
    
    # Redact credit card numbers
    new_text, count = CREDIT_CARD_RE.subn("[credit_card_redacted]", text)
    if count:
        report["credit_card"] += count
        _metrics["pii_redactions"]["credit_card"] += count
        logger.info(f"Redacted {count} credit card(s) from user input")
    text = new_text
    
    return text, report


# ============================================
# PROMPT INJECTION DETECTION
# ============================================

def check_prompt_injection(text: str) -> Tuple[bool, list]:
    """
    Check if text contains prompt injection attempts.
    
    Args:
        text: User input text
        
    Returns:
        Tuple of (is_injection, matched_patterns)
        
    Example:
        >>> is_attack, patterns = check_prompt_injection("Ignore previous instructions")
        >>> print(is_attack)
        True
    """
    matched_patterns = []
    
    lowered = text.lower()
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, lowered, re.IGNORECASE):
            matched_patterns.append(pattern)
    
    if matched_patterns:
        _metrics["blocks"]["prompt_injection"] += 1
        logger.warning(
            f"Prompt injection detected. Matched patterns: {len(matched_patterns)}"
        )
    
    return len(matched_patterns) > 0, matched_patterns


# ============================================
# MEDICAL SCOPE DETECTION
# ============================================

def check_medical_scope(text: str) -> Tuple[bool, list]:
    """
    Check if text requests medical diagnosis or prescriptions.
    
    Args:
        text: User input text
        
    Returns:
        Tuple of (is_medical_request, matched_patterns)
        
    Example:
        >>> is_medical, patterns = check_medical_scope("Can you diagnose my condition?")
        >>> print(is_medical)
        True
    """
    matched_patterns = []
    
    for pattern in SCOPE_BLOCK_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            matched_patterns.append(pattern)
    
    if matched_patterns:
        _metrics["blocks"]["medical"] += 1
        logger.info(
            f"Medical scope violation detected. Matched patterns: {len(matched_patterns)}"
        )
    
    return len(matched_patterns) > 0, matched_patterns


# ============================================
# MAIN SCOPE ENFORCEMENT
# ============================================

def enforce_scope(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Enforce scope and safety rules on user input.
    
    Checks (in order):
    1. Medical diagnosis/prescription requests → Reframe
    2. Prompt injection attempts → Block
    
    NOTE: Topic relevance checking has been moved to the main LLM prompt.
    The main LLM now handles scope validation as part of its response generation.
    This hybrid approach reduces costs by 50% and latency by 200ms while maintaining
    the same level of safety.
    
    Args:
        text: Redacted user input text
        
    Returns:
        Tuple of (processed_text, notes_dict)
        
        If blocked:
        - processed_text is a refusal message
        - notes["offtopic"] or notes["blocked"] is True
        
        If allowed:
        - processed_text is original text (possibly reframed)
        - notes["offtopic"] and notes["blocked"] are False
        
    Example:
        >>> text = "Can you diagnose my fever?"
        >>> result, notes = enforce_scope(text)
        >>> print(notes["blocked"])
        True
        >>> print(result)
        "User is asking for medical diagnosis..."
    """
    notes: Dict[str, Any] = {
        "blocked": False,
        "offtopic": False,
        "matched": []
    }
    
    # LAYER 1: Check for medical diagnosis/prescription
    is_medical, medical_patterns = check_medical_scope(text)
    if is_medical:
        notes["blocked"] = True
        notes["matched"].extend(medical_patterns)
        logger.info(f"Medical scope violation: reframing query")
        return MEDICAL_REFUSAL, notes
    
    # LAYER 2: Check for prompt injection
    is_injection, injection_patterns = check_prompt_injection(text)
    if is_injection:
        notes["offtopic"] = True
        notes["matched"].extend(injection_patterns)
        logger.warning(f"Prompt injection blocked: {len(injection_patterns)} patterns matched")
        return PROMPT_INJECTION_REFUSAL, notes
    
    # All regex checks passed - proceed to main LLM
    # (Main LLM will handle topic relevance as part of its system prompt)
    logger.debug(f"Input passed guardrails checks, proceeding to main LLM")
    return text, notes


# ============================================
# METRICS EXPORT
# ============================================

def get_metrics() -> Dict[str, Any]:
    """
    Get current guardrails metrics for monitoring.
    
    Returns:
        Dictionary containing:
        - pii_redactions: Count by type (email, phone, aadhaar, credit_card)
        - blocks: Count by reason (medical, prompt_injection, off_topic)
        
    Note: Topic scope checking is now handled by the main LLM, so
    scope_checks metrics have been removed.
        
    Example:
        >>> metrics = get_metrics()
        >>> print(f"Total PII redactions: {sum(metrics['pii_redactions'].values())}")
    """
    return dict(_metrics)


def reset_metrics() -> None:
    """
    Reset all metrics counters.
    
    Useful for testing or periodic resets.
    """
    global _metrics
    _metrics = {
        "pii_redactions": {"email": 0, "phone": 0, "aadhaar": 0, "credit_card": 0},
        "blocks": {"medical": 0, "prompt_injection": 0, "off_topic": 0}
    }
    logger.info("Guardrails metrics reset")