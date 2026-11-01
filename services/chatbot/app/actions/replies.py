"""
Short, fixed replies for logging turns.

Templated rather than generated: these turns are about a number she gave, the
card under the reply carries the detail, and a fixed reply costs no extra call.
Hindi when she wrote in Devanagari, English otherwise (Roman-script Hinglish
reads English fine).
"""

from __future__ import annotations

from typing import Dict, Tuple


def is_devanagari(text: str) -> bool:
    return any("ऀ" <= ch <= "ॿ" for ch in text)


_PROPOSE = {
    "en": "Got it. Shall I save this for today? Tap **Yes, save** on the card below.",
    "hi": "समझ गई। क्या मैं इसे आज के लिए सहेज दूँ? नीचे कार्ड पर **हाँ, सहेजें** दबाएँ।",
}

_PROPOSE_REMINDER = {
    "en": "Sure. Shall I set this reminder? Tap **Yes, set** on the card below.",
    "hi": "ज़रूर। क्या मैं यह रिमाइंडर सेट कर दूँ? नीचे कार्ड पर **हाँ, सेट करें** दबाएँ।",
}

_PAST_DAY = {
    "en": (
        "I can only save readings and logs for today. When you have today's, just tell me "
        "and I'll add it for you."
    ),
    "hi": "मैं सिर्फ़ आज की रीडिंग और लॉग सहेज सकती हूँ। आज की रीडिंग हो तो बताइए, मैं जोड़ दूँगी।",
}

_REMINDER_PAST = {
    "en": "That time has already passed. When should I remind you?",
    "hi": "यह समय निकल चुका है। मैं आपको कब याद दिलाऊँ?",
}

_RECHECK = {
    "en": "That number looks unusual for {what}. Could you check it and send it again?",
    "hi": "{what} के लिए यह नंबर असामान्य लग रहा है। कृपया एक बार जाँच कर दोबारा भेजें।",
}

# What to ask when one field is missing, keyed by (kind, field).
_ASK: Dict[Tuple[str, str], Dict[str, str]] = {
    ("sugar", "timing"): {
        "en": "Was that sugar reading **fasting** or **after a meal**?",
        "hi": "यह शुगर रीडिंग **खाली पेट** थी या **खाने के बाद**?",
    },
    ("meal", "meal_time"): {
        "en": "Was that **breakfast, lunch, an evening snack or dinner**?",
        "hi": "यह **नाश्ता, दोपहर का खाना, शाम का नाश्ता या रात का खाना** था?",
    },
    ("meal", "foods"): {
        "en": "What did you eat? For example dal, roti, rice, vegetables or curd.",
        "hi": "आपने क्या खाया? जैसे दाल, रोटी, चावल, सब्ज़ी या दही।",
    },
    ("pumping", "minutes"): {
        "en": "How many minutes did you pump for?",
        "hi": "आपने कितने मिनट पंप किया?",
    },
    ("reminder", "time"): {
        "en": "Sure. **What time** should I remind you?",
        "hi": "ज़रूर। मैं आपको **किस समय** याद दिलाऊँ?",
    },
    ("medicine", "name"): {
        "en": "Which medicine or supplement did you take?",
        "hi": "आपने कौन-सी दवा या सप्लीमेंट ली?",
    },
}

_ASK_VALUE = {
    "en": "What was the {what} reading?",
    "hi": "{what} की रीडिंग कितनी थी?",
}

_WHAT = {
    "bp": {"en": "blood pressure", "hi": "बीपी"},
    "sugar": {"en": "sugar", "hi": "शुगर"},
    "weight": {"en": "weight", "hi": "वज़न"},
    "hb": {"en": "haemoglobin", "hi": "हीमोग्लोबिन"},
    "temperature": {"en": "temperature", "hi": "तापमान"},
    "urine_protein": {"en": "urine protein", "hi": "पेशाब में प्रोटीन"},
    "fetal_heart_rate": {"en": "baby's heartbeat", "hi": "शिशु की धड़कन"},
    "water": {"en": "water", "hi": "पानी"},
    "kicks": {"en": "kicks", "hi": "किक"},
    "pumping": {"en": "pumping", "hi": "पंपिंग"},
    "meal": {"en": "meal", "hi": "भोजन"},
    "medicine": {"en": "medicine", "hi": "दवा"},
}


def _lang(text: str) -> str:
    return "hi" if is_devanagari(text) else "en"


def propose_reply(text: str, reminders_only: bool = False) -> str:
    return (_PROPOSE_REMINDER if reminders_only else _PROPOSE)[_lang(text)]


def past_day_reply(text: str) -> str:
    return _PAST_DAY[_lang(text)]


def recheck_reply(text: str, kind: str) -> str:
    lang = _lang(text)
    if kind == "reminder":
        return _REMINDER_PAST[lang]
    return _RECHECK[lang].format(what=_WHAT.get(kind, _WHAT["bp"])[lang])


def ask_reply(text: str, kind: str, field: str) -> str:
    lang = _lang(text)
    template = _ASK.get((kind, field))
    if template:
        return template[lang]
    return _ASK_VALUE[lang].format(what=_WHAT.get(kind, _WHAT["bp"])[lang])
