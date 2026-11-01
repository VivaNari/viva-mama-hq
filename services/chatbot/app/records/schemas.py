"""Requests and responses of the /v1/records endpoints, and the summarizer's output."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from app.attachments.schemas import AnalysisOutput, AttachmentRef
from pydantic import BaseModel, Field, model_validator

MAX_RECORD_FILES = 5
MAX_SUMMARY_RECORDS = 30

Category = Literal["scan", "lab", "prescription", "mch"]
ScanType = Literal["dating", "anomaly", "growth"]


class RecordSubject(BaseModel):
    """Who she filed the record for. The child's name and age come from her profile."""

    type: Literal["mother", "child"]
    child_name: Optional[str] = Field(None, max_length=80)
    child_age_text: Optional[str] = Field(None, max_length=40)


class RecordAnalyzeRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    record_id: str = Field(..., min_length=1, max_length=64)
    category: Category
    scan_type: Optional[ScanType] = None
    subject: RecordSubject
    files: List[AttachmentRef] = Field(..., min_length=1, max_length=MAX_RECORD_FILES)
    lang: Literal["en", "hi"] = "en"

    @model_validator(mode="after")
    def _one_pdf_or_photos(self) -> "RecordAnalyzeRequest":
        pdfs = sum(1 for f in self.files if f.kind == "pdf")
        if pdfs and len(self.files) > 1:
            raise ValueError(f"send one PDF, or up to {MAX_RECORD_FILES} photos")
        return self


class RecordAnalyzeResponse(BaseModel):
    request_id: str
    # ANALYZED -> the record is saved; ERROR -> it may be retried; anything else is a
    # refusal and the core API deletes the files.
    verdict: str
    reason_code: str
    document_type: Optional[str] = None
    # The refusal or error text, in her language. Never describes a refused file.
    message: Optional[str] = None
    title: Optional[str] = None
    report_date: Optional[str] = Field(None, description="ISO date read off the report.")
    analysis: Optional[AnalysisOutput] = None
    summary_markdown: Optional[str] = None
    # Compact text record of what was read; the input to the overall summary.
    digest: Optional[str] = None
    severity: Literal["NONE", "MEDIUM", "HIGH"] = "NONE"
    critical_matches: List[str] = Field(default_factory=list)


class OutOfRangeValue(BaseModel):
    name: str = Field(..., max_length=120)
    value: str = Field(..., max_length=60)
    unit: Optional[str] = Field(None, max_length=30)
    reference_range: Optional[str] = Field(None, max_length=80)
    status: str = Field(..., max_length=20)


class SummaryRecordIn(BaseModel):
    record_id: str = Field(..., max_length=64)
    record_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    category: Category
    scan_type: Optional[ScanType] = None
    subject: RecordSubject
    title: Optional[str] = Field(None, max_length=200)
    digest: str = Field(..., max_length=3000)
    severity: Literal["NONE", "MEDIUM", "HIGH"] = "NONE"
    critical_matches: List[str] = Field(default_factory=list, max_length=10)
    out_of_range: List[OutOfRangeValue] = Field(default_factory=list, max_length=25)


class VitalIn(BaseModel):
    type: Literal["bp", "sugar", "hb", "weight"]
    value: str = Field(..., max_length=40, description="Already formatted, e.g. '118/76'.")
    unit: Optional[str] = Field(None, max_length=20)
    note: Optional[str] = Field(None, max_length=40, description="e.g. 'fasting'")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class MedicineIn(BaseModel):
    name: str = Field(..., max_length=120)
    dose: Optional[str] = Field(None, max_length=60)
    frequency: Optional[str] = Field(None, max_length=60)


class HealthSummaryRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    lang: Literal["en", "hi"] = "en"
    records: List[SummaryRecordIn] = Field(..., min_length=1, max_length=MAX_SUMMARY_RECORDS)
    vitals: List[VitalIn] = Field(default_factory=list, max_length=20)
    medicines: List[MedicineIn] = Field(default_factory=list, max_length=20)
    # Names of the babies she has finished adding; draft children are left out.
    child_names: List[str] = Field(default_factory=list, max_length=10)


class BabyPoints(BaseModel):
    child_name: str
    points: List[str] = Field(default_factory=list)


class HealthSummaryOutput(BaseModel):
    """What the model writes. Facts about her (name, week, ages) are never in here."""

    overview: str = Field(
        "", description="At most 3 short sentences on what her records show overall."
    )
    mother_points: List[str] = Field(
        default_factory=list, description="Key points from her own records, max 6."
    )
    baby_points: List[BabyPoints] = Field(
        default_factory=list, description="Key points from each baby's records, max 4 each."
    )
    trends: List[str] = Field(
        default_factory=list,
        description=(
            "A value seen on more than one dated record, oldest to newest, e.g. "
            "'Haemoglobin: 9.8 g/dL (12 Jun 2026) → 11.2 g/dL (3 Sep 2026)'. Max 5."
        ),
    )
    questions_for_doctor: List[str] = Field(default_factory=list, description="Max 5.")


class HealthSummaryResponse(BaseModel):
    request_id: str
    content: Dict[str, Any]
    share_text: str
