"""
Follow-up offer helpers.

Each answer ends with a short "Would you like to know more about X?" question
followed by a machine tag ``[[FOLLOWUP: X]]`` that the LLM writes in English.
The tag is stripped before the answer reaches the user and X is stored per
session, so a short affirmative reply ("yes", "haan", "tell me more") on the
next turn can be resolved to "explain X".
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

_FOLLOWUP_TAG = re.compile(r"\[\[\s*FOLLOWUP\s*:\s*(.*?)\s*\]\]", re.IGNORECASE | re.DOTALL)

# Topics longer than this are almost certainly a malformed tag.
_MAX_TOPIC_CHARS = 120

# Short replies that accept the previous offer. Matched after normalisation
# (lower-case, punctuation/emoji stripped), as whole phrases.
_AFFIRMATIVE_PHRASES = {
    # English
    "yes", "yeah", "yea", "yep", "yup", "ya", "y", "sure", "ok", "okay", "k",
    "please", "yes please", "sure please", "ok please", "okay please",
    "tell me more", "yes tell me more", "go on", "go ahead", "more",
    "of course", "definitely", "absolutely", "i would like that",
    "yes i would", "yes i do", "i do", "why not",
    # Hinglish
    "haan", "han", "ha", "haa", "hanji", "haanji", "haan ji", "han ji", "ha ji", "ji",
    "ji haan", "bilkul", "theek hai", "thik hai", "zaroor", "jarur", "jaroor",
    "batao", "bataiye", "bataye", "haan batao", "han batao", "haan bataiye",
    "aur batao", "or batao", "haan please",
    # Hindi (Devanagari)
    "हाँ", "हां", "हा", "जी", "जी हाँ", "जी हां", "हाँ जी", "हां जी", "ज़रूर", "जरूर",
    "बिल्कुल", "बताओ", "बताइए", "बताइये", "हाँ बताओ", "हां बताओ", "हाँ बताइए",
    "हां बताइए", "और बताओ", "ठीक है",
}

_MAX_AFFIRMATIVE_WORDS = 5

# History character budget per turn.
_ASSISTANT_HEAD_CHARS = 200
_USER_CHARS = 300


def extract_followup(answer: str) -> Tuple[str, Optional[str]]:
    """
    Remove every ``[[FOLLOWUP: ...]]`` tag from the answer.

    Returns ``(clean_answer, topic)``; topic is the last non-empty tag value,
    or None when the model offered nothing (or the tag was unusable).
    """
    if not answer:
        return answer, None

    topics = [t.strip() for t in _FOLLOWUP_TAG.findall(answer)]
    clean = _FOLLOWUP_TAG.sub("", answer)
    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()

    topic = next((t for t in reversed(topics) if t), None)
    if topic:
        topic = " ".join(topic.split()).strip(" \"'<>.?")
        if not topic or len(topic) > _MAX_TOPIC_CHARS:
            topic = None
    return clean, topic


# Last sentence of a line: everything after the final sentence terminator.
_LAST_SENTENCE = re.compile(r"^(.*[.!।…])\s+[^.!।…]+$", re.DOTALL)


def strip_offer_line(answer: str) -> str:
    """
    Drop the trailing follow-up question.

    Only the final question SENTENCE is removed: when the model writes the whole
    reply as one paragraph ending in "…?", deleting the last line deleted the
    entire answer. Never returns an empty string — if nothing would be left, the
    answer is returned unchanged.
    """
    original = answer.rstrip()
    lines = original.split("\n")
    if not lines or not _ends_with_question(lines[-1]):
        return original

    match = _LAST_SENTENCE.match(lines[-1].strip())
    if match and match.group(1).strip():
        lines[-1] = match.group(1)
    else:
        lines.pop()

    stripped = "\n".join(lines).rstrip()
    return stripped or original


def _ends_with_question(line: str) -> bool:
    stripped = "".join(
        ch for ch in line.strip() if not unicodedata.category(ch).startswith(("S", "Z"))
    )
    return stripped.endswith(("?", "？"))


def _normalise(text: str) -> str:
    # Keep letters, digits and combining marks (Devanagari vowel signs are
    # category M); everything else becomes a space.
    kept = [
        ch if unicodedata.category(ch)[0] in ("L", "N", "M") else " "
        for ch in text.lower()
    ]
    return " ".join("".join(kept).split())


def is_affirmative(text: str) -> bool:
    """True when the message is just a short acceptance of the previous offer."""
    if not text:
        return False
    norm = _normalise(text)
    if not norm or len(norm.split()) > _MAX_AFFIRMATIVE_WORDS:
        return False
    return norm in _AFFIRMATIVE_PHRASES


# Opening words that decline the previous offer ("No, I want to speak to an
# expert"). Matched as the first one or two normalised words, so the rest of the
# message is still answered as a fresh question.
_NEGATIVE_OPENERS = {
    "no", "nope", "nah", "no thanks", "no thank", "not now", "not really", "dont", "don t",
    "nahi", "nahin", "nhi", "na", "mat", "rehne do",
    "नहीं", "नही", "ना", "मत",
}

# Words that carry no topic meaning when comparing two offers.
_TOPIC_STOPWORDS = {
    "a", "an", "the", "of", "to", "for", "and", "or", "in", "on", "with", "about",
    "how", "what", "why", "when", "your", "you", "can", "more", "know", "help",
}


def is_negative(text: str) -> bool:
    """True when the message opens by declining ("no", "not now", "nahi", "नहीं" …)."""
    words = _normalise(text or "").split()
    if not words:
        return False
    return words[0] in _NEGATIVE_OPENERS or " ".join(words[:2]) in _NEGATIVE_OPENERS


def same_topic(a: Optional[str], b: Optional[str]) -> bool:
    """
    Whether two follow-up topics are effectively the same offer, so the bot does
    not ask "would you like to know more about X?" twice in a row.
    """
    if not a or not b:
        return False

    def tokens(t: str) -> set:
        # Crude singularisation so "consultants" ~ "consultant".
        return {w.rstrip("s") for w in _normalise(t).split() if w not in _TOPIC_STOPWORDS}

    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return _normalise(a) == _normalise(b)
    overlap = len(ta & tb) / min(len(ta), len(tb))
    return overlap >= 0.8


def build_declined_note(topic: str) -> str:
    """Appended to the prompt question when the user turned the last offer down."""
    return (
        f"\n(The user declined your previous offer to explain: {topic}. "
        "Do not offer that topic again; answer what they are asking now.)"
    )


def build_followup_query(user_text: str, topic: str) -> str:
    """Prompt-side question for a reply that accepts the previous offer."""
    return (
        f'"{user_text}" — the user is accepting your previous offer to explain: {topic}. '
        f"Answer about {topic}; do not repeat your previous answer. "
        "Skip the empathy sentence: open with one short lead-in line, then the bullets. "
        "Reply in the language the user has been writing in."
    )


# Last sentence of app.escalation.policy.format_escalation_banner; everything up
# to it in a saved assistant turn is banner, not answer.
BANNER_TAIL = "This assistant shares wellness information only and does not provide diagnosis."


def _strip_banner(content: str) -> str:
    """Drop a leading escalation banner from a saved assistant turn."""
    _, sep, rest = content.partition(BANNER_TAIL)
    return rest if sep else content


def format_history(prior_turns: List[Dict[str, object]]) -> str:
    """
    Render recent turns for the prompt.

    Assistant turns keep their opening and their LAST line, which holds the
    follow-up offer, so a short "yes" on the next turn can be understood.
    """
    history_block = ""
    for t in prior_turns[-3:]:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))
        if role == "ASSISTANT":
            content = _strip_banner(content).strip()
            lines = [ln for ln in content.split("\n") if ln.strip()]
            last = lines[-1].strip() if lines else ""
            if len(content) > _ASSISTANT_HEAD_CHARS + len(last) and _ends_with_question(last):
                content = content[:_ASSISTANT_HEAD_CHARS].rstrip() + " … " + last
            else:
                content = content[: _USER_CHARS]
        else:
            content = content[:_USER_CHARS]
        content = " ".join(content.split())
        history_block += f"- {role}: {content}\n"
    return history_block
