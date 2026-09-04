"""
Detect which expert an assistant answer recommended.

The answer is free-form markdown, so the recommended expert has to be recovered
after generation to render a "Connect" button in the app. We do that by matching
the answer against the names in the user's own expert directory rather than asking
the model to emit a machine-readable marker: the model can misformat a marker or
invent an id, but it cannot make us match a name that isn't in the list we were
handed.

That list is already scoped to the user's referral (see get_experts_tool), so a
suggestion can only ever point at an expert this user is allowed to see.

Failure mode by design: if nothing matches, no button is rendered. Never a wrong one.
"""

import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Stripped before matching so "Dr. Anita Rao" in the answer still matches the
# stored "Anita Rao" (and vice versa).
_HONORIFICS = (
    "dr.",
    "dr",
    "doctor",
    "डॉ.",
    "डॉ",
    "डॉक्टर",
)

# Markdown emphasis around a name — **Anita Rao**, *Anita Rao*, _Anita Rao_ — is
# stripped so bold referrals (which the system prompt actively asks for) match.
_MARKDOWN_NOISE = re.compile(r"[*_`]+")

_WHITESPACE = re.compile(r"\s+")


def _normalise(text: str) -> str:
    """Casefold, drop markdown emphasis and honorifics, collapse whitespace."""
    if not text:
        return ""

    # NFKC first so visually identical Devanagari spellings compare equal.
    text = unicodedata.normalize("NFKC", text)
    text = _MARKDOWN_NOISE.sub("", text)
    text = text.casefold()
    text = _WHITESPACE.sub(" ", text).strip()

    for honorific in _HONORIFICS:
        if text.startswith(honorific + " "):
            text = text[len(honorific) + 1 :].strip()
            break

    return text


def _find_offset(haystack: str, needle: str) -> Optional[int]:
    """
    Offset of `needle` in `haystack` on a word boundary, or None.

    Boundaries keep a short name from matching inside a longer unrelated word.
    `\\b` is unreliable next to Devanagari, so we assert on "not a word character"
    directly and treat the string edges as boundaries.
    """
    if not needle:
        return None

    pattern = re.compile(
        r"(?<![^\W\d_])" + re.escape(needle) + r"(?![^\W\d_])",
        re.UNICODE,
    )
    match = pattern.search(haystack)
    return match.start() if match else None


def detect_suggested_experts(
    answer: str,
    experts: List[Dict[str, Any]],
    limit: int = 1,
) -> List[Dict[str, Any]]:
    """
    Find the experts named in an answer, earliest mention first.

    Args:
        answer: The assistant's reply. Pass the draft answer, not the version with
            an escalation banner prepended — the banner is not the model's referral.
        experts: The user's scoped directory, as returned by get_all_experts():
            each needs `id`, `name`, and ideally `name_variants` (translated
            spellings, so a Hindi reply still matches).
        limit: How many to return. One expert, one button — a reply that also names
            a second expert for product clearance keeps that one as plain text.

    Returns:
        List of {id, name, speciality}, at most `limit` long.
    """
    if not answer or not experts:
        return []

    haystack = _normalise(answer)
    if not haystack:
        return []

    matches = []

    for expert in experts:
        expert_id = expert.get("id")
        if not expert_id:
            continue

        variants = expert.get("name_variants") or []
        if not variants and expert.get("name"):
            variants = [expert["name"]]

        # Earliest offset across every spelling of this expert's name.
        offsets = [
            offset
            for offset in (_find_offset(haystack, _normalise(v)) for v in variants)
            if offset is not None
        ]
        if not offsets:
            continue

        matches.append(
            (
                min(offsets),
                {
                    "id": str(expert_id),
                    "name": expert.get("name", ""),
                    "speciality": expert.get("speciality", ""),
                },
            )
        )

    matches.sort(key=lambda m: m[0])
    suggested = [m[1] for m in matches[:limit]]

    if suggested:
        logger.debug(
            f"Suggested experts detected: {[s['name'] for s in suggested]} "
            f"(of {len(matches)} named)"
        )

    return suggested
