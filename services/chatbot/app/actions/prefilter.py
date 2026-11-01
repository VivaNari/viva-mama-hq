"""
Cheap gate in front of the extraction LLM call.

Most messages are questions, and they should not pay for an extra model call.
A message is worth extracting only if it mentions something loggable: a reading
word with a number, a daily-log phrase (water, kicks, medicine taken, pumping,
a meal), or a request for a reminder. English, Hindi (Devanagari) and
Roman-script Hinglish are covered.

False positives are cheap (one extra small call that returns no logs); false
negatives mean a log is missed, so the keyword lists lean inclusive.
"""

from __future__ import annotations

import re

_NUMBER = re.compile(r"\d")

# Reading words: only meaningful together with a number.
_READING_WORDS = re.compile(
    r"\b(bp|b\.p|blood\s*pressure|pressure|sugar|shugar|glucose|fasting|"
    r"weight|weigh|wajan|vajan|kg|kgs|kilo|hb|haemoglobin|hemoglobin|"
    r"temperature|temp|fever|bukhar|protein|urine|heart\s*beat|heartbeat|"
    r"heart\s*rate|fhr|bpm|mmhg|mg/?dl)\b"
    r"|बीपी|ब्लड\s*प्रेशर|प्रेशर|शुगर|वजन|वज़न|हीमोग्लोबिन|बुखार|तापमान|धड़कन",
    re.IGNORECASE,
)

# A blood-pressure shape on its own ("118/80") is a reading even without a word.
_BP_SHAPE = re.compile(r"\b\d{2,3}\s*/\s*\d{2,3}\b")

# Daily logs: these can be logged with or without a number ("took my iron").
_DAILY_WORDS = re.compile(
    r"\b(water|glass|glasses|paani|pani|kick|kicks|kicked|moved|movement|"
    r"took|taken|had|ate|eaten|li|le\s*li|kha\s*li|khaya|khayi|piya|pi\s*li|"
    r"pump|pumped|pumping|breast\s*milk|"
    r"iron|ifa|calcium|folic|vitamin|insulin|tablet|tablets|medicine|dawai|dawa|goli|"
    r"breakfast|lunch|dinner|snack|nashta|khana|dal|daal|roti|chapati|rice|chawal|"
    r"sabzi|curd|dahi|egg|anda|paneer|khichdi|poha|fruit)\b"
    r"|पानी|गिलास|किक|हलचल|दवा|दवाई|गोली|आयरन|कैल्शियम|पंप|नाश्ता|खाना|दाल|रोटी|चावल",
    re.IGNORECASE,
)


# Reminder requests: "remind me", "yaad dilana", "रिमाइंडर लगा दो".
_REMINDER_WORDS = re.compile(
    r"\b(remind|reminder|reminders|alarm|alert\s*me|yaad|yad\s*dila|notify\s*me)\b"
    r"|याद|रिमाइंडर|अलार्म",
    re.IGNORECASE,
)


def may_contain_log(text: str) -> bool:
    """True if `text` could hold a log or a reminder worth sending to the extractor."""
    if not text or not text.strip():
        return False
    if _REMINDER_WORDS.search(text):
        return True
    if _BP_SHAPE.search(text):
        return True
    if _NUMBER.search(text) and _READING_WORDS.search(text):
        return True
    return bool(_DAILY_WORDS.search(text))
