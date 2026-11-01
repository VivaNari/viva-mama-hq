"""
Reference ranges Viva may use when a report prints none.

The analysis prompt allows exactly two sources for a range: the one printed on
her report, or a row of this table. Never the model's general knowledge. Each
row names its published source.

CLINICAL SIGN-OFF IS PENDING. `reviewed_by` stays None until a clinician has
checked the row; the release checklist requires every row reviewed before the
feature leaves the internal allowlist.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class ReferenceRow:
    analyte: str
    stage: str  # "pregnancy" | "postpartum" | "any"
    normal: str
    note: str
    source: str
    reviewed_by: Optional[str] = None
    reviewed_on: Optional[str] = None


REFERENCE_TABLE: List[ReferenceRow] = [
    ReferenceRow(
        "Haemoglobin (Hb)",
        "pregnancy",
        "11.0 g/dL or more",
        "10.0–10.9 mild, 7.0–9.9 moderate, below 7.0 severe anaemia",
        "WHO, Haemoglobin cut-offs to define anaemia (2024)",
    ),
    ReferenceRow(
        "Haemoglobin (Hb)",
        "postpartum",
        "12.0 g/dL or more",
        "cut-off for non-pregnant women",
        "WHO, Haemoglobin cut-offs to define anaemia (2024)",
    ),
    ReferenceRow(
        "Platelet count",
        "any",
        "150,000–450,000 per µL",
        "100,000–149,999 can be seen in normal pregnancy; below 100,000 needs review",
        "ACOG Practice Bulletin 207, Thrombocytopenia in Pregnancy",
    ),
    ReferenceRow(
        "Blood pressure",
        "pregnancy",
        "below 140/90 mmHg",
        "140/90 or more is high; 160/110 or more is severe",
        "ACOG Practice Bulletin 222, Gestational Hypertension and Preeclampsia",
    ),
    ReferenceRow(
        "Fasting plasma glucose (pregnancy, 75 g OGTT)",
        "pregnancy",
        "below 92 mg/dL",
        "1-hour below 180 mg/dL; 2-hour below 153 mg/dL",
        "IADPSG consensus criteria (2010)",
    ),
    ReferenceRow(
        "2-hour glucose after 75 g (non-fasting, DIPSI)",
        "pregnancy",
        "below 140 mg/dL",
        "140 mg/dL or more is used to diagnose GDM in India",
        "Govt. of India, National Guidelines for Diagnosis & Management of GDM (2018)",
    ),
    ReferenceRow(
        "TSH",
        "pregnancy",
        "upper limit about 4.0 mIU/L when the lab gives no trimester range",
        "lab trimester-specific ranges take priority",
        "ATA Guidelines for Thyroid Disease During Pregnancy (2017)",
    ),
    ReferenceRow(
        "Urine protein (dipstick)",
        "pregnancy",
        "nil or trace",
        "1+ or more should be discussed with the doctor",
        "ACOG Practice Bulletin 222",
    ),
]

CLINICAL_SIGNOFF_COMPLETE = all(r.reviewed_by for r in REFERENCE_TABLE)


def render_reference_table() -> str:
    lines = []
    for r in REFERENCE_TABLE:
        lines.append(f"- {r.analyte} [{r.stage}]: normal {r.normal}; {r.note}")
    return "\n".join(lines)
