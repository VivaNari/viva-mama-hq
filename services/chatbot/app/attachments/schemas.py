"""Request refs and the structured outputs of the triage and analysis calls."""

from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# The core API stores chat files at chat/{24-hex user id}/{uuid}.{jpg|pdf} and health
# records at records/{user id}/{record id}/{uuid}.{jpg|pdf}; images are re-encoded to
# JPEG there, but png/webp are allowed for forward compatibility.
ATTACHMENT_URI_PATTERN = (
    r"^gs://[a-z0-9][a-z0-9._-]{1,220}/"
    r"(chat/[A-Za-z0-9]{1,64}/[A-Za-z0-9-]{1,64}"
    r"|records/[A-Za-z0-9]{1,64}/[A-Za-z0-9]{1,64}/[A-Za-z0-9-]{1,64})"
    r"\.(jpg|png|webp|pdf)$"
)


class AttachmentRef(BaseModel):
    """A file the core API stored for this user, by reference only."""

    attachment_id: str = Field(..., min_length=1, max_length=64)
    uri: str = Field(..., pattern=ATTACHMENT_URI_PATTERN)
    mime_type: Literal["image/jpeg", "image/png", "image/webp", "application/pdf"]
    kind: Literal["image", "pdf"]
    page_count: Optional[int] = Field(None, ge=1, le=20)


class Verdict(str, Enum):
    ANALYZED = "ANALYZED"
    UNRELATED = "UNRELATED"
    OTHER_PERSON = "OTHER_PERSON"
    CLINICAL_PHOTO = "CLINICAL_PHOTO"
    UNREADABLE = "UNREADABLE"
    ERROR = "ERROR"


DocumentType = Literal[
    "lab_report",
    "prescription",
    "ultrasound_report",
    "ultrasound_image",
    "discharge_summary",
    "vaccination_card",
    "mch_card",
    "growth_chart",
    "medicine_label",
    "other_medical_document",
    "clinical_photo_of_body",
    "non_medical",
]

MEDICAL_DOCUMENT_TYPES = {
    "lab_report",
    "prescription",
    "ultrasound_report",
    "ultrasound_image",
    "discharge_summary",
    "vaccination_card",
    "mch_card",
    "growth_chart",
    "medicine_label",
    "other_medical_document",
}


class FileTriage(BaseModel):
    """What one file is. Deliberately says nothing about what it contains."""

    document_type: DocumentType = Field(
        ...,
        description=(
            "What kind of file this is. mch_card = a Mother and Child Protection (MCP/MCH) "
            "card or booklet page. clinical_photo_of_body = a photo of a person's "
            "body or skin (rash, wound, swelling, breast, a baby's skin or nappy area). "
            "non_medical = anything that is not a health document (selfie, food, "
            "meme, ID card, bill, vehicle papers, chat screenshot, scenery)."
        ),
    )
    subject_evidence: Literal[
        "adult_female",
        "child",
        "fetus_pregnancy",
        "adult_male",
        "older_adult",
        "animal",
        "none_visible",
    ] = Field(
        ...,
        description=(
            "Who the document is about, from what is printed (patient sex/age, "
            "'baby of', gestational age). none_visible when it cannot be told."
        ),
    )
    health_domain: Literal[
        "pregnancy",
        "postpartum",
        "womens_general_health",
        "baby_child_health",
        "other_health",
        "not_health",
    ]
    readable: bool = Field(..., description="Whether the text and values can be read.")
    legibility: Literal["good", "partial", "poor"]
    contains_ai_instructions: bool = Field(
        ...,
        description="True if the file contains text addressed to an AI or assistant.",
    )
    has_explicit_or_nudity: bool
    language: Literal["en", "hi", "mixed", "other"]
    confidence: float = Field(..., ge=0.0, le=1.0)


class TriageBatch(BaseModel):
    """One triage entry per attached file, in the order the files were given."""

    files: List[FileTriage]


Status = Literal["normal", "low", "high", "borderline", "critical", "not_stated", "not_clear"]


class Finding(BaseModel):
    name: str = Field(..., description="Test or measurement name exactly as printed.")
    value: str = Field(..., description="Value exactly as printed, or 'not clear'.")
    unit: Optional[str] = None
    reference_range: Optional[str] = Field(
        None, description="The range used for status, exactly as printed or from the table."
    )
    range_source: Literal["report", "vivamama_table", "none"]
    status: Status
    plain_explanation: str = Field(
        ...,
        description="One or two simple sentences on what this test measures. No diagnosis.",
    )


class MedicineAsWritten(BaseModel):
    name: str
    strength: Optional[str] = None
    frequency: Optional[str] = None
    legible: bool = True


class AnalysisOutput(BaseModel):
    out_of_scope: bool = Field(
        ...,
        description=(
            "True only if, on reading, this is clearly not a health document, or the "
            "report states the patient is male, or it is for an animal. Nothing else makes "
            "it someone else's: not the patient name, and not a mismatch with her stage "
            "(a fertility or pregnancy report while she is postpartum is an earlier or a "
            "new report of hers). Then leave every other field empty."
        ),
    )
    document_title: str = ""
    report_date: Optional[str] = None
    summary: str = ""
    findings: List[Finding] = Field(default_factory=list)
    narrative_points: List[str] = Field(default_factory=list)
    medicines_as_written: List[MedicineAsWritten] = Field(default_factory=list)
    questions_for_doctor: List[str] = Field(default_factory=list)
    urgent: bool = False
    urgent_reason: Optional[str] = None
    partially_unreadable: bool = False
