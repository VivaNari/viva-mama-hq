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


# Specialists a mother can book in the app (and the words she uses for them).
_SPECIALIST = (
    r"(experts?|doctors?|dr|specialists?|physicians?|consultants?|"
    r"gyn(a)?ec(o|h)?log(y|ist|ists)?|gynae|gyno|ob-?gyn|obstetric(ian|ians)?|"
    r"lactation|breastfeeding (expert|counsell?or|consultant)|"
    r"psycholog(ist|ists)?|psychiatr(ist|ists)?|counsell?ors?|counsell?ing|therapists?|"
    r"p(a)?ediatric(ian|ians)?|child specialist|"
    r"dieti(t|c)ians?|nutritionists?|yoga (instructor|teacher|expert))"
)

# The user wants to reach / book / find one of our experts — answered from the
# expert directory, not the knowledge base. Deliberately framed as a request so
# that "when should I see a doctor about X?" stays a wellness question.
EXPERT_REQUEST_HINTS = [
    # "I want to speak with an expert", "help me connect with a lactation expert"
    r"\b(i want|i wanna|i'?d like|i would like|i need|can i|could i|help me|how (can|do|should) i|"
    r"how to|let me|please|pls|want to|need to)\b.{0,25}\b(speak|talk|connect|consult|book|meet|chat|"
    r"get in touch|reach)\b.{0,40}\b" + _SPECIALIST + r"\b",
    # "book an appointment / consultation"
    r"\bbook(ing)?\b.{0,20}\b(appointment|consultation|session|call)\b",
    # "which gynaecologist do you have in this app", "what experts are available"
    r"\b(which|what|any|list|show)\b.{0,25}\b" + _SPECIALIST + r"\b.{0,30}"
    r"\b(do you have|you have|are available|available|in (this|the|your) app|on (this|the|your) app|"
    r"on viva ?mama|in viva ?mama|there)\b",
    # "do you have a lactation consultant?"
    r"\bdo you have (a|an|any)?\s*.{0,20}\b" + _SPECIALIST + r"\b",
    # "I need a gynaecologist", "recommend a lactation expert", "lactation expert please"
    r"\b(i want|i need|looking for|find me|suggest|recommend)\s+(a|an|some|the)?\s*.{0,15}\b"
    + _SPECIALIST + r"\b",
    # Hinglish: "doctor se baat karni hai", "expert se milna hai"
    r"\b(doctor|expert|specialist|gynae|gynaecologist|counsell?or)\s+(se|say|sy)\s+"
    r"(baat|milna|milwa|milao|connect|consult|appointment)",
    # Hindi: "डॉक्टर से बात करनी है"
    r"(डॉक्टर|विशेषज्ञ|एक्सपर्ट|स्त्री रोग विशेषज्ञ)\s*से\s*(बात|मिल|संपर्क)",
]


def route_intent(text: str) -> str:
    """
    INPUT:
      text - already redacted & scope-checked user message.

    OUTPUT:
      "EXPERT_REQUEST", "SELF_QUERY", "PRODUCT_QUERY", or "WELLNESS_INFO"

    LOGIC:
      1. If the user asks to reach / book / find one of our experts → EXPERT_REQUEST.
      2. If the text is asking about Viva's identity/capabilities → SELF_QUERY.
      3. If the text contains product keywords → PRODUCT_QUERY.
      4. Otherwise → WELLNESS_INFO.
    """
    # Expert requests first: "can you help me connect with a lactation expert"
    # would otherwise trip the "can you help" self-query hints.
    for pattern in EXPERT_REQUEST_HINTS:
        if re.search(pattern, text, re.I):
            return "EXPERT_REQUEST"

    # Then SELF_QUERY.
    for pattern in SELF_QUERY_HINTS:
        if re.search(pattern, text, re.I):
            return "SELF_QUERY"

    for pattern in PRODUCT_HINTS:
        if re.search(pattern, text, re.I):
            return "PRODUCT_QUERY"

    return "WELLNESS_INFO"
