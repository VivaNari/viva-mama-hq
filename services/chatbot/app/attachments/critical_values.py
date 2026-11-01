"""
Which findings warrant an urgent banner, decided by fixed rules, not by the model.

The model reads the values off the report; whether a value is dangerous is
decided here, so the same Hb of 6.5 always raises the same banner and the rule
can be tested at its boundaries. The model's own `urgent` flag (for things only
prose can say, like "absent cardiac activity") can raise severity, never lower it.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from app.attachments.schemas import AnalysisOutput, Finding

_ORDER = {"NONE": 0, "MEDIUM": 1, "HIGH": 2}

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
        if _ORDER[new] > _ORDER[level]:
            level = new
        matches.append(label)

    for f in analysis.findings:
        kind = _analyte(f.name)
        shown = f"{f.name} {f.value}{(' ' + f.unit) if f.unit else ''}".strip()
        if kind == "hb":
            v = _hb_g_dl(f)
            if v is not None and v < 7.0:
                raise_to("HIGH", shown)
            elif v is not None and v < 9.0:
                raise_to("MEDIUM", shown)
        elif kind == "platelets":
            v = _platelets_per_ul(f)
            if v is not None and v < 50_000:
                raise_to("HIGH", shown)
            elif v is not None and v < 100_000:
                raise_to("MEDIUM", shown)
        elif kind == "bp":
            bp = _bp(f.value)
            if bp and (bp[0] >= 160 or bp[1] >= 110):
                high_bp = True
                raise_to("HIGH", shown)
            elif bp and (bp[0] >= 140 or bp[1] >= 90):
                high_bp = True
                raise_to("MEDIUM", shown)
        elif kind == "glucose":
            v = _glucose_mg_dl(f)
            if v is not None and (v >= 250 or v <= 54):
                raise_to("HIGH", shown)

    for f in analysis.findings:
        if _analyte(f.name) == "urine_protein" and _plus_grade(f.value) >= 2:
            raise_to("HIGH" if high_bp else "MEDIUM", f"{f.name} {f.value}")

    if analysis.urgent and _ORDER[level] < _ORDER["MEDIUM"]:
        level = "MEDIUM"
        matches.append("a finding your doctor should review soon")
    return level, matches
