"""Critical values on a report raise a banner by fixed rules, at their exact boundaries."""

from __future__ import annotations

import unittest

from app.attachments.critical_values import evaluate
from app.attachments.schemas import AnalysisOutput, Finding


def finding(name: str, value: str, unit: str | None = None) -> Finding:
    return Finding(
        name=name,
        value=value,
        unit=unit,
        reference_range=None,
        range_source="report",
        status="normal",
        plain_explanation="",
    )


def level(*findings: Finding, urgent: bool = False) -> str:
    return evaluate(AnalysisOutput(out_of_scope=False, findings=list(findings), urgent=urgent))[0]


class TestHaemoglobin(unittest.TestCase):
    def test_boundaries(self) -> None:
        self.assertEqual(level(finding("Haemoglobin", "6.9", "g/dL")), "HIGH")
        self.assertEqual(level(finding("Haemoglobin", "7.0", "g/dL")), "MEDIUM")
        self.assertEqual(level(finding("Haemoglobin", "8.9", "g/dL")), "MEDIUM")
        self.assertEqual(level(finding("Haemoglobin", "9.0", "g/dL")), "NONE")

    def test_aliases_and_units(self) -> None:
        self.assertEqual(level(finding("HGB", "6.8", "g/dl")), "HIGH")
        self.assertEqual(level(finding("Hb (Hemoglobin)", "65", "g/L")), "HIGH")
        self.assertEqual(level(finding("हीमोग्लोबिन", "6.5")), "HIGH")

    def test_mchc_is_not_haemoglobin(self) -> None:
        self.assertEqual(level(finding("MCHC", "3.2", "g/dL")), "NONE")


class TestPlatelets(unittest.TestCase):
    def test_units(self) -> None:
        self.assertEqual(level(finding("Platelet count", "45", "x10^3/µL")), "HIGH")
        self.assertEqual(level(finding("Platelet count", "45,000", "/µL")), "HIGH")
        self.assertEqual(level(finding("PLT", "0.9", "lakh/cumm")), "MEDIUM")
        self.assertEqual(level(finding("Platelet count", "1,50,000", "/cumm")), "NONE")


class TestBloodPressure(unittest.TestCase):
    def test_boundaries(self) -> None:
        self.assertEqual(level(finding("Blood pressure", "160/100", "mmHg")), "HIGH")
        self.assertEqual(level(finding("BP", "150/110")), "HIGH")
        self.assertEqual(level(finding("BP", "140/85")), "MEDIUM")
        self.assertEqual(level(finding("BP", "139/89")), "NONE")

    def test_protein_with_high_bp_is_high(self) -> None:
        self.assertEqual(level(finding("BP", "142/92"), finding("Urine albumin", "2+")), "HIGH")
        self.assertEqual(level(finding("Urine protein", "2+")), "MEDIUM")
        self.assertEqual(level(finding("Urine protein", "trace")), "NONE")


class TestGlucose(unittest.TestCase):
    def test_extremes(self) -> None:
        self.assertEqual(level(finding("Fasting blood sugar", "260", "mg/dL")), "HIGH")
        self.assertEqual(level(finding("RBS", "50", "mg/dL")), "HIGH")
        self.assertEqual(level(finding("Glucose", "14.5", "mmol/L")), "HIGH")
        self.assertEqual(level(finding("FBS", "95", "mg/dL")), "NONE")

    def test_urine_glucose_is_not_blood_glucose_by_accident(self) -> None:
        self.assertEqual(level(finding("Urine sugar", "nil")), "NONE")


class TestModelFlag(unittest.TestCase):
    def test_model_urgent_raises_to_medium_never_lowers(self) -> None:
        self.assertEqual(level(urgent=True), "MEDIUM")
        self.assertEqual(level(finding("Haemoglobin", "6.0", "g/dL"), urgent=True), "HIGH")

    def test_unparseable_values_raise_nothing(self) -> None:
        self.assertEqual(level(finding("Haemoglobin", "not clear")), "NONE")


if __name__ == "__main__":
    unittest.main()
