"""
Which findings warrant an urgent banner, decided by fixed rules, not by the model.

The model reads the values off the report; whether a value is dangerous is
decided here, so the same Hb of 6.5 always raises the same banner and the rule
can be tested at its boundaries. The model's own `urgent` flag (for things only
prose can say, like "absent cardiac activity") can raise severity, never lower it.

The cut-offs are shared with logging from chat (app.actions.pipeline), so a value
she types and the same value on a report raise the same banner.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.attachments.schemas import AnalysisOutput, Finding

_ORDER = {"NONE": 0, "MEDIUM": 1, "HIGH": 2}

# Cut-offs (clinical sign-off pending, with the reference table).
BP_HIGH = (160, 110)  # systolic or diastolic at or above
BP_MEDIUM = (140, 90)
HB_HIGH_BELOW = 7.0  # g/dL
HB_MEDIUM_BELOW = 9.0
PLATELETS_HIGH_BELOW = 50_000  # per µL
PLATELETS_MEDIUM_BELOW = 100_000
GLUCOSE_HIGH_AT_OR_ABOVE = 250.0  # mg/dL
GLUCOSE_HIGH_AT_OR_BELOW = 54.0
URINE_PROTEIN_FLAG_FROM = 2  # plus signs; HIGH when BP is raised too


def bp_level(systolic: float, diastolic: float) -> str:
    if systolic >= BP_HIGH[0] or diastolic >= BP_HIGH[1]:
        return "HIGH"
    if systolic >= BP_MEDIUM[0] or diastolic >= BP_MEDIUM[1]:
        return "MEDIUM"
    return "NONE"


def hb_level(g_dl: float) -> str:
    if g_dl < HB_HIGH_BELOW:
        return "HIGH"
    if g_dl < HB_MEDIUM_BELOW:
        return "MEDIUM"
    return "NONE"


def glucose_level(mg_dl: float) -> str:
    if mg_dl >= GLUCOSE_HIGH_AT_OR_ABOVE or mg_dl <= GLUCOSE_HIGH_AT_OR_BELOW:
        return "HIGH"
    return "NONE"


def urine_protein_level(plus_grade: int, bp_raised: bool) -> str:
    if plus_grade >= URINE_PROTEIN_FLAG_FROM:
        return "HIGH" if bp_raised else "MEDIUM"
    return "NONE"


_ALIASES = {
    "hb": ("haemoglobin", "hemoglobin", "hb", "hgb", "हीमोग्लोबिन"),
    "platelets": ("platelet", "plt", "प्लेटलेट"),
    "bp": ("blood pressure", "bp", "b.p", "रक्तचाप"),
    "glucose": ("glucose", "sugar", "fbs", "ppbs", "rbs", "ogtt", "शुगर"),
    "urine_protein": ("urine protein", "albumin", "proteinuria"),
}


def _analyte(name: str) -> Optional[str]:
    lowered = name.lower()
    # Urine albumin before glucose/others: "urine albumin" is not a blood test.
    if "urine" in lowered and ("protein" in lowered or "albumin" in lowered):
        return "urine_protein"
    for key, words in _ALIASES.items():
        if key == "urine_protein":
            continue
        for w in words:
            if re.search(rf"(?<![a-z]){re.escape(w)}(?![a-z])", lowered):
                return key
    return None


def _number(value: str) -> Optional[float]:
    # Thousands separators, Indian (1,50,000) or western (150,000).
    cleaned = re.sub(r"(?<=\d),(?=\d{2,3}\b)", "", value)
    m = re.search(r"\d+(?:\.\d+)?", cleaned)
    return float(m.group(0)) if m else None


def _bp(value: str) -> Optional[Tuple[float, float]]:
    m = re.search(r"(\d{2,3})\s*/\s*(\d{2,3})", value)
    return (float(m.group(1)), float(m.group(2))) if m else None


def _hb_g_dl(f: Finding) -> Optional[float]:
    v = _number(f.value)
    if v is None:
        return None
    unit = (f.unit or "").lower().replace(" ", "")
    if "g/l" in unit and "dl" not in unit or v > 30:
        v = v / 10.0
    return v


def _platelets_per_ul(f: Finding) -> Optional[float]:
    v = _number(f.value)
    if v is None:
        return None
    unit = (f.unit or "").lower() + " " + f.value.lower()
    if "lakh" in unit or "lac" in unit:
        return v * 100_000
    if v < 1_000:  # reported in thousands (x10^3/µL, x10^9/L)
        return v * 1_000
    return v


def _glucose_mg_dl(f: Finding) -> Optional[float]:
    v = _number(f.value)
    if v is None:
        return None
    if "mmol" in (f.unit or "").lower():
        v = v * 18.0
    return v


def _plus_grade(value: str) -> int:
    m = re.search(r"([1-4])\s*\+", value)
    return int(m.group(1)) if m else 0


def evaluate(analysis: AnalysisOutput) -> Tuple[str, List[str]]:
    """(severity, matched descriptions) for the findings on one document."""
    level = "NONE"
    matches: List[str] = []
    high_bp = False

    def raise_to(new: str, label: str) -> None:
        nonlocal level
        if new == "NONE":
            return
        if _ORDER[new] > _ORDER[level]:
            level = new
        matches.append(label)

    for f in analysis.findings:
        kind = _analyte(f.name)
        shown = f"{f.name} {f.value}{(' ' + f.unit) if f.unit else ''}".strip()
        if kind == "hb":
            v = _hb_g_dl(f)
            if v is not None:
                raise_to(hb_level(v), shown)
        elif kind == "platelets":
            v = _platelets_per_ul(f)
            if v is not None and v < PLATELETS_HIGH_BELOW:
                raise_to("HIGH", shown)
            elif v is not None and v < PLATELETS_MEDIUM_BELOW:
                raise_to("MEDIUM", shown)
        elif kind == "bp":
            bp = _bp(f.value)
            if bp:
                bp_lvl = bp_level(*bp)
                high_bp = high_bp or bp_lvl != "NONE"
                raise_to(bp_lvl, shown)
        elif kind == "glucose":
            v = _glucose_mg_dl(f)
            if v is not None:
                raise_to(glucose_level(v), shown)

    for f in analysis.findings:
        if _analyte(f.name) == "urine_protein":
            raise_to(urine_protein_level(_plus_grade(f.value), high_bp), f"{f.name} {f.value}")

    if analysis.urgent and _ORDER[level] < _ORDER["MEDIUM"]:
        level = "MEDIUM"
        matches.append("a finding your doctor should review soon")
    return level, matches
