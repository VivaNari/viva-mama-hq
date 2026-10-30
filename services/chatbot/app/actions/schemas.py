"""
What the extraction model returns, and the proposals built from it.

The model fills a deliberately flat schema (one optional slot per value) because
flat schemas are what small structured-output calls get right. `to_proposals`
then turns that into the backend's `{logType, fields}` shape and applies the same
ranges the backend validator uses (services/backend/src/api/v1/validators/
mother-log/mother-log.validator.ts). The backend re-validates everything; these
checks only decide whether to propose or to ask her to re-check a number.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

LogKind = Literal[
    "bp",
    "sugar",
    "weight",
    "hb",
    "temperature",
    "urine_protein",
    "fetal_heart_rate",
    "water",
    "kicks",
    "medicine",
    "pumping",
    "meal",
]


class ExtractedLog(BaseModel):
    """One thing she reported. Only the slots for its `kind` are filled."""

    kind: LogKind
    systolic: Optional[int] = Field(None, description="bp: upper number")
    diastolic: Optional[int] = Field(None, description="bp: lower number")
    value: Optional[float] = Field(
        None, description="sugar in mg/dL, hb in g/dL, urine_protein as 0-4 (plus signs)"
    )
    timing: Optional[Literal["fasting", "post_meal"]] = Field(
        None, description="sugar only: fasting, or after a meal"
    )
    weight_kg: Optional[float] = Field(None, description="weight in kg")
    temperature: Optional[float] = Field(None, description="body temperature as she said it")
    temperature_unit: Optional[Literal["F", "C"]] = None
    bpm: Optional[int] = Field(None, description="fetal_heart_rate: baby's heartbeat per minute")
    count: Optional[int] = Field(None, description="water: glasses; kicks: movements felt")
    mode: Optional[Literal["add", "set"]] = Field(
        None,
        description="water/kicks: 'add' when she reports more since last time "
        "('drank 2 glasses'), 'set' when she reports the day's total ('6 glasses today')",
    )
    medicine: Optional[str] = Field(None, description="medicine: the name as she said it")
    side: Optional[Literal["left", "right", "both"]] = Field(None, description="pumping")
    minutes: Optional[int] = Field(None, description="pumping duration")
    ml: Optional[int] = Field(None, description="pumping quantity in ml")
    meal_time: Optional[Literal["breakfast", "lunch", "evening_snack", "dinner"]] = None
    foods: List[str] = Field(default_factory=list, description="meal: foods as she said them")


class ExtractionResult(BaseModel):
    """Everything loggable in one message."""

    logs: List[ExtractedLog] = Field(default_factory=list)
    past_day: bool = Field(
        False, description="true if she is reporting an earlier day (yesterday, last week)"
    )
    has_question: bool = Field(
        False, description="true if the message also asks Viva something to answer"
    )


# ── Normalisation ─────────────────────────────────────────────────────────────

_MEDICINE_PRESETS = [
    ("iron_folic_acid", re.compile(r"iron|ifa|folic|आयरन|लौह", re.I)),
    ("calcium", re.compile(r"calcium|कैल्शियम", re.I)),
    ("vitamin_d", re.compile(r"vitamin\s*d|vit\s*d|विटामिन\s*डी", re.I)),
    ("insulin", re.compile(r"insulin|इंसुलिन", re.I)),
]

_FOODS = {
    "dal": ["dal", "daal", "dhal", "lentil", "दाल"],
    "rice": ["rice", "chawal", "chaawal", "चावल"],
    "vegetables": ["vegetable", "veg", "sabzi", "sabji", "subzi", "सब्ज़ी", "सब्जी"],
    "roti": ["roti", "chapati", "chapatti", "phulka", "paratha", "रोटी"],
    "curd": ["curd", "dahi", "yogurt", "yoghurt", "raita", "दही"],
    "fruit": ["fruit", "fal", "banana", "apple", "फल"],
    "egg": ["egg", "anda", "अंडा"],
    "paneer": ["paneer", "पनीर"],
    "khichdi": ["khichdi", "khichri", "खिचड़ी"],
    "poha": ["poha", "पोहा"],
    "nuts": ["nut", "nuts", "badam", "almond", "seeds", "dry fruit", "मेवा", "बादाम"],
}

# Backend ranges (mother-log.validator.ts).
_RANGES = {
    "systolic": (60, 250),
    "diastolic": (40, 150),
    "sugar": (20, 500),
    "weight": (30, 200),
    "hb": (2, 20),
    "temperature_f": (90, 110),
    "urine_protein": (0, 4),
    "bpm": (60, 220),
    "glasses": (0, 30),
    "kicks": (0, 200),
    "minutes": (1, 120),
    "ml": (0, 500),
}


def _in_range(value: Optional[float], key: str) -> bool:
    if value is None:
        return False
    low, high = _RANGES[key]
    return low <= value <= high


def medicine_ref(name: str) -> Dict[str, str]:
    """A preset key when the name is a known one, else the name as she said it."""
    for preset, pattern in _MEDICINE_PRESETS:
        if pattern.search(name):
            return {"presetKey": preset}
    return {"name": name.strip()[:60]}


def map_foods(foods: List[str]) -> List[str]:
    """Her words for foods to the meal log's food keys; unknown foods are dropped."""
    keys: List[str] = []
    for food in foods:
        lowered = food.lower()
        for key, words in _FOODS.items():
            if key not in keys and any(word in lowered for word in words):
                keys.append(key)
    return keys


@dataclass
class Proposals:
    """The backend-shaped proposals, plus what is missing or looks wrong."""

    logs: List[Dict[str, Any]] = field(default_factory=list)
    # (kind, field) pairs she still has to tell us, e.g. ("sugar", "timing").
    missing: List[Tuple[str, str]] = field(default_factory=list)
    # Kinds whose number is outside the accepted range.
    out_of_range: List[str] = field(default_factory=list)


def to_proposals(result: ExtractionResult) -> Proposals:
    """Turn extracted logs into backend proposals, or note what is missing."""
    out = Proposals()

    for log in result.logs:
        kind = log.kind

        if kind == "bp":
            if log.systolic is None or log.diastolic is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.systolic, "systolic") and _in_range(log.diastolic, "diastolic"):
                out.logs.append(
                    {
                        "logType": "bp",
                        "fields": {"systolic": log.systolic, "diastolic": log.diastolic},
                    }
                )
            else:
                out.out_of_range.append(kind)

        elif kind == "sugar":
            if log.value is None:
                out.missing.append((kind, "value"))
            elif not _in_range(log.value, "sugar"):
                out.out_of_range.append(kind)
            elif log.timing is None:
                out.missing.append((kind, "timing"))
            else:
                out.logs.append(
                    {
                        "logType": "sugar",
                        "fields": {"value": int(round(log.value)), "timing": log.timing},
                    }
                )

        elif kind == "weight":
            if log.weight_kg is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.weight_kg, "weight"):
                out.logs.append(
                    {"logType": "weight", "fields": {"weightKg": round(log.weight_kg, 1)}}
                )
            else:
                out.out_of_range.append(kind)

        elif kind == "hb":
            if log.value is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.value, "hb"):
                out.logs.append({"logType": "hb", "fields": {"value": round(log.value, 1)}})
            else:
                out.out_of_range.append(kind)

        elif kind == "temperature":
            if log.temperature is None:
                out.missing.append((kind, "value"))
                continue
            # A number under 50 can only be Celsius, whatever she called it.
            celsius = log.temperature_unit == "C" or log.temperature < 50
            value_f = log.temperature * 9 / 5 + 32 if celsius else log.temperature
            if _in_range(value_f, "temperature_f"):
                out.logs.append({"logType": "temperature", "fields": {"valueF": round(value_f, 1)}})
            else:
                out.out_of_range.append(kind)

        elif kind == "urine_protein":
            if log.value is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.value, "urine_protein"):
                out.logs.append(
                    {"logType": "urine_protein", "fields": {"value": int(round(log.value))}}
                )
            else:
                out.out_of_range.append(kind)

        elif kind == "fetal_heart_rate":
            if log.bpm is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.bpm, "bpm"):
                out.logs.append({"logType": "fetal_heart_rate", "fields": {"bpm": log.bpm}})
            else:
                out.out_of_range.append(kind)

        elif kind in ("water", "kicks"):
            key = "glasses" if kind == "water" else "count"
            if log.count is None:
                out.missing.append((kind, "value"))
            elif _in_range(log.count, "glasses" if kind == "water" else "kicks"):
                out.logs.append(
                    {"logType": kind, "fields": {key: log.count}, "mode": log.mode or "add"}
                )
            else:
                out.out_of_range.append(kind)

        elif kind == "medicine":
            if not log.medicine or not log.medicine.strip():
                out.missing.append((kind, "name"))
            else:
                out.logs.append(
                    {
                        "logType": "medicine_dose",
                        "fields": {},
                        "medicineRef": medicine_ref(log.medicine),
                    }
                )

        elif kind == "pumping":
            if log.minutes is None:
                out.missing.append((kind, "minutes"))
            elif not _in_range(log.minutes, "minutes") or (
                log.ml is not None and not _in_range(log.ml, "ml")
            ):
                out.out_of_range.append(kind)
            else:
                out.logs.append(
                    {
                        "logType": "pumping",
                        "fields": {
                            # Both sides unless she named one; volume 0 when not measured.
                            "side": log.side or "both",
                            "minutes": log.minutes,
                            "ml": log.ml if log.ml is not None else 0,
                        },
                    }
                )

        elif kind == "meal":
            foods = map_foods(log.foods)
            if not foods:
                out.missing.append((kind, "foods"))
            elif log.meal_time is None:
                out.missing.append((kind, "meal_time"))
            else:
                out.logs.append(
                    {"logType": "meal", "fields": {"mealTime": log.meal_time, "foods": foods}}
                )

    return out
