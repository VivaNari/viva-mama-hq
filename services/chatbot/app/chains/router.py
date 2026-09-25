# app/chains/router.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Decide what kind of question the user is asking:
#  - "SELF_QUERY"   if they are asking who Viva is or what it can do.
#  - "PRODUCT_QUERY" if they are looking for a postpartum product.
#  - "WELLNESS_INFO" for everything else.
#
# HOW WE DO IT:
# For now, we use simple keywords. This is reliable for early versions and
# extremely easy to expand.
#
# Later (when your dataset grows), we can replace this with ML intent classification.
# But this simple approach works well and is very understandable.
# ---------------------------------------------------------------------

from __future__ import annotations

import re

# Words / phrases that signal the user is asking about Viva's identity or capabilities.
SELF_QUERY_HINTS = [
    r"\bwho are you\b",
    r"\bwhat are you\b",
    r"\btell me about yourself\b",
    r"\bintroduce yourself\b",
    r"\bwhat can you do\b",
    r"\bwhat do you do\b",
    r"\bwhat can you help\b",
    r"\bhow can you help\b",
    r"\bwhat is viva\b",
    r"\bwhat is viva ai\b",
    r"\babout viva\b",
    r"\bwho is viva\b",
    r"\bare you an ai\b",
    r"\bare you a bot\b",
    r"\bare you a robot\b",
    r"\bwhat topics\b",
    r"\bwhat subjects\b",
    r"\byour purpose\b",
    r"\bwhat do you know\b",
    r"\bwhat help\b.*\bprovide\b",
    r"\bwhat kind of (questions|things)\b",
    r"\bwhat are your capabilities\b",
    r"\bcan you tell me about yourself\b",
    r"\btell me what you can do\b",
]

# Words / phrases that usually mean the user is asking about products.
# You can add many more over time.
PRODUCT_HINTS = [
    r"\bbreast pump\b",
    r"\bnipple cream\b",
    r"\bnursing pads?\b",
    r"\bmilk storage\b",
    r"\bpump\b",
    r"\bcatch milk\b",
    r"\bbottle sterilizer\b",
    r"\bfeeding pillow\b",
]


def route_intent(text: str) -> str:
    """
    INPUT:
      text - already redacted & scope-checked user message.

    OUTPUT:
      "SELF_QUERY", "PRODUCT_QUERY", or "WELLNESS_INFO"

    LOGIC:
      1. If the text is asking about Viva's identity/capabilities → SELF_QUERY.
      2. If the text contains product keywords → PRODUCT_QUERY.
      3. Otherwise → WELLNESS_INFO.
    """
    # Check SELF_QUERY first — highest priority.
    for pattern in SELF_QUERY_HINTS:
        if re.search(pattern, text, re.I):
            return "SELF_QUERY"

    for pattern in PRODUCT_HINTS:
        if re.search(pattern, text, re.I):
            return "PRODUCT_QUERY"

    return "WELLNESS_INFO"
