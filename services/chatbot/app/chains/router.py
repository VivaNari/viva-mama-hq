# app/chains/router.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Decide what kind of question the user is asking:
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
      "PRODUCT_QUERY" or "WELLNESS_INFO"

    LOGIC:
      If the text contains ANY of the product keywords → PRODUCT_QUERY.
      Otherwise → WELLNESS_INFO.
    """
    for pattern in PRODUCT_HINTS:
        if re.search(pattern, text, re.I):
            return "PRODUCT_QUERY"

    return "WELLNESS_INFO"


                              