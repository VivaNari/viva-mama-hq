"""
What happens to an attachment turn, decided in code from the triage output.

The model only labels the file; whether Viva answers is this module's call, so it
can be tested row by row and cannot be talked out of by text inside the file.
Every uncertain case fails closed (no analysis, no description of the file).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional

from app.attachments.schemas import MEDICAL_DOCUMENT_TYPES, FileTriage, TriageBatch, Verdict
from app.settings import settings

_OTHER_PEOPLE = {"adult_male", "older_adult"}

# Who a health record was filed for. Chat turns are "any": hers or her child's.
ExpectedSubject = Literal["any", "mother", "child"]


@dataclass
class Decision:
    verdict: Verdict
    reason_code: str
    category: Optional[str] = None
    subject: Optional[str] = None
    contains_ai_instructions: bool = False


def decide_file(t: FileTriage, expected_subject: ExpectedSubject = "any") -> Decision:
    category, subject = t.document_type, t.subject_evidence
    if t.has_explicit_or_nudity or t.document_type == "clinical_photo_of_body":
        return Decision(Verdict.CLINICAL_PHOTO, "CLINICAL_PHOTO", category, subject)
    if t.confidence < settings.attachment_classifier_min_confidence:
        return Decision(Verdict.UNRELATED, "LOW_CONFIDENCE", category, subject)
    if t.document_type not in MEDICAL_DOCUMENT_TYPES or t.health_domain == "not_health":
        return Decision(Verdict.UNRELATED, "NOT_HEALTH", category, subject)
    if t.subject_evidence == "animal":
        return Decision(Verdict.UNRELATED, "ANIMAL", category, subject)
    # An ultrasound shows a pregnancy whatever the patient field says.
    if t.subject_evidence in _OTHER_PEOPLE and not category.startswith("ultrasound"):
        return Decision(Verdict.OTHER_PERSON, "OTHER_PERSON", category, subject)
    # A record filed under her baby must not be her own report, and the other way
    # round. The MCH card covers both, and an unclear subject is given the benefit
    # of the doubt (names are often cropped off).
    if category != "mch_card":
        if expected_subject == "child" and subject in ("adult_female", "fetus_pregnancy"):
            return Decision(Verdict.OTHER_PERSON, "SUBJECT_MISMATCH", category, subject)
        if expected_subject == "mother" and subject == "child":
            return Decision(Verdict.OTHER_PERSON, "SUBJECT_MISMATCH", category, subject)
    if not t.readable or t.legibility == "poor":
        return Decision(Verdict.UNREADABLE, "UNREADABLE", category, subject)
    return Decision(
        Verdict.ANALYZED,
        "OK",
        category,
        _subject_label(subject, t.health_domain),
        t.contains_ai_instructions,
    )


def _subject_label(subject: str, domain: str) -> str:
    if subject == "child" or domain == "baby_child_health":
        return "baby_child"
    return "mother"


# Most restrictive first: one refused file refuses the turn.
_PRECEDENCE = [
    Verdict.CLINICAL_PHOTO,
    Verdict.UNRELATED,
    Verdict.OTHER_PERSON,
    Verdict.UNREADABLE,
    Verdict.ANALYZED,
]


def decide(
    batch: Optional[TriageBatch], expected_subject: ExpectedSubject = "any"
) -> tuple[Decision, List[Decision]]:
    """The turn's decision and each file's. No usable triage is a refusal."""
    if batch is None or not batch.files:
        d = Decision(Verdict.UNRELATED, "NO_TRIAGE")
        return d, [d]
    per_file = [decide_file(f, expected_subject) for f in batch.files]
    turn = min(per_file, key=lambda d: _PRECEDENCE.index(d.verdict))
    if turn.verdict == Verdict.ANALYZED:
        turn.contains_ai_instructions = any(d.contains_ai_instructions for d in per_file)
    return turn, per_file


# Canned replies. None of them says anything about what the file contains.
_MESSAGES = {
    "en": {
        Verdict.UNRELATED: (
            "I can only help with health documents about your pregnancy, your recovery or "
            "your baby — like lab reports, scan reports or prescriptions. I can't help with "
            "{this_file}. This didn't use up your daily question."
        ),
        Verdict.OTHER_PERSON: (
            "This looks like a report for someone else. I can only explain reports for you "
            "or your child. This didn't use up your daily question."
        ),
        Verdict.CLINICAL_PHOTO: (
            "I can't assess photos of the body or of symptoms — please show this to your "
            "doctor. If there is heavy bleeding, high fever, severe pain, or your baby seems "
            "unwell, please seek care right away. This didn't use up your daily question."
        ),
        Verdict.UNREADABLE: (
            "I couldn't read {this_file} clearly. Please place the page flat in good light, "
            "make sure all the values are in the photo, and try again. This didn't use up "
            "your daily question."
        ),
        Verdict.ERROR: (
            "Sorry, I couldn't read your file just now. Please try again in a moment. This "
            "didn't use up your daily question."
        ),
    },
    "hi": {
        Verdict.UNRELATED: (
            "मैं केवल आपकी प्रेग्नेंसी, रिकवरी या बच्चे से जुड़े स्वास्थ्य दस्तावेज़ों — जैसे लैब "
            "रिपोर्ट, स्कैन रिपोर्ट या डॉक्टर की पर्ची — में मदद कर सकती हूँ। {this_file} में मैं "
            "मदद नहीं कर सकती। इससे आपका आज का सवाल ख़र्च नहीं हुआ।"
        ),
        Verdict.OTHER_PERSON: (
            "यह किसी और की रिपोर्ट लगती है। मैं केवल आपकी या आपके बच्चे की रिपोर्ट समझा सकती "
            "हूँ। इससे आपका आज का सवाल ख़र्च नहीं हुआ।"
        ),
        Verdict.CLINICAL_PHOTO: (
            "मैं शरीर या लक्षणों की फ़ोटो नहीं देख सकती — कृपया यह अपने डॉक्टर को दिखाएँ। अगर बहुत "
            "ज़्यादा ब्लीडिंग, तेज़ बुखार, बहुत दर्द हो या बच्चा ठीक न लगे, तो तुरंत डॉक्टर से "
            "मिलें। इससे आपका आज का सवाल ख़र्च नहीं हुआ।"
        ),
        Verdict.UNREADABLE: (
            "मैं {this_file} साफ़ नहीं पढ़ पाई। कृपया पन्ने को अच्छी रोशनी में सीधा रखें, सभी "
            "वैल्यू फ़ोटो में आएँ, और दोबारा भेजें। इससे आपका आज का सवाल ख़र्च नहीं हुआ।"
        ),
        Verdict.ERROR: (
            "माफ़ कीजिए, अभी मैं आपकी फ़ाइल नहीं पढ़ पाई। कृपया थोड़ी देर में दोबारा कोशिश करें। "
            "इससे आपका आज का सवाल ख़र्च नहीं हुआ।"
        ),
    },
}

_THIS_FILE = {
    "en": ("this file", "these files"),
    "hi": ("इस फ़ाइल", "इन फ़ाइलों"),
}


def refusal_message(verdict: Verdict, lang: str, file_count: int = 1) -> str:
    lang = lang if lang in _MESSAGES else "en"
    this_file = _THIS_FILE[lang][0 if file_count <= 1 else 1]
    return _MESSAGES[lang][verdict].format(this_file=this_file)


# Health records: the same refusals, without the chat-only line about her daily question.
_RECORD_MESSAGES = {
    "en": {
        Verdict.UNRELATED: (
            "This doesn't look like a health record for you or your baby, so it wasn't "
            "saved. You can add lab reports, scan reports, prescriptions or your MCH card."
        ),
        Verdict.OTHER_PERSON: (
            "This looks like a report for someone else, so it wasn't saved. You can only "
            "add records for yourself or your baby."
        ),
        Verdict.CLINICAL_PHOTO: (
            "Photos of the body or of symptoms can't be saved as records — please show "
            "this to your doctor. If there is heavy bleeding, high fever, severe pain, or "
            "your baby seems unwell, please seek care right away."
        ),
        Verdict.UNREADABLE: (
            "The pages couldn't be read clearly, so the record wasn't saved. Place each "
            "page flat in good light, make sure all the values are in the photo, and try "
            "again."
        ),
        Verdict.ERROR: "Sorry, your record couldn't be read just now. Please try again.",
    },
    "hi": {
        Verdict.UNRELATED: (
            "यह आपका या आपके बच्चे का स्वास्थ्य रिकॉर्ड नहीं लगता, इसलिए इसे सेव नहीं किया गया। "
            "आप लैब रिपोर्ट, स्कैन रिपोर्ट, डॉक्टर की पर्ची या MCH कार्ड जोड़ सकती हैं।"
        ),
        Verdict.OTHER_PERSON: (
            "यह किसी और की रिपोर्ट लगती है, इसलिए इसे सेव नहीं किया गया। आप केवल अपने या "
            "अपने बच्चे के रिकॉर्ड जोड़ सकती हैं।"
        ),
        Verdict.CLINICAL_PHOTO: (
            "शरीर या लक्षणों की फ़ोटो रिकॉर्ड में सेव नहीं की जा सकती — कृपया यह अपने डॉक्टर को "
            "दिखाएँ। अगर बहुत ज़्यादा ब्लीडिंग, तेज़ बुखार, बहुत दर्द हो या बच्चा ठीक न लगे, तो "
            "तुरंत डॉक्टर से मिलें।"
        ),
        Verdict.UNREADABLE: (
            "पन्ने साफ़ नहीं पढ़े जा सके, इसलिए रिकॉर्ड सेव नहीं हुआ। हर पन्ने को अच्छी रोशनी में "
            "सीधा रखें, सभी वैल्यू फ़ोटो में आएँ, और दोबारा कोशिश करें।"
        ),
        Verdict.ERROR: "माफ़ कीजिए, अभी आपका रिकॉर्ड नहीं पढ़ा जा सका। कृपया दोबारा कोशिश करें।",
    },
}


def record_refusal_message(verdict: Verdict, lang: str) -> str:
    return _RECORD_MESSAGES.get(lang, _RECORD_MESSAGES["en"])[verdict]
