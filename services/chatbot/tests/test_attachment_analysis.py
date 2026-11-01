"""Lint (no diagnosis, no medicine changes), rendering, and the reference table."""

from __future__ import annotations

import unittest

from app.attachments.analysis import lint, render, to_session_context
from app.attachments.reference_table import REFERENCE_TABLE
from app.attachments.schemas import AnalysisOutput, Finding, MedicineAsWritten


def analysis(**overrides) -> AnalysisOutput:
    base = dict(
        out_of_scope=False,
        document_title="Complete Blood Count",
        report_date="2026-10-28",
        summary="This is a blood test that checks your blood cells.",
        findings=[
            Finding(
                name="Haemoglobin",
                value="9.8",
                unit="g/dL",
                reference_range="11.0–15.0",
                range_source="report",
                status="low",
                plain_explanation="Haemoglobin carries oxygen in your blood.",
            ),
            Finding(
                name="WBC",
                value="8,200",
                unit="/µL",
                reference_range="4,000–11,000",
                range_source="report",
                status="normal",
                plain_explanation="White cells fight infection.",
            ),
        ],
        questions_for_doctor=["Do I need any change in my diet or supplements?"],
    )
    base.update(overrides)
    return AnalysisOutput(**base)


class TestLint(unittest.TestCase):
    def test_removes_diagnosis_sentences(self) -> None:
        a, hits = lint(
            analysis(
                summary="This checks your blood. This means you have anaemia. Ask your doctor."
            )
        )
        self.assertNotIn("anaemia", a.summary)
        self.assertIn("Ask your doctor", a.summary)
        self.assertEqual(hits, 1)

    def test_removes_medicine_changes(self) -> None:
        a, hits = lint(
            analysis(
                questions_for_doctor=[
                    "Should I increase my iron tablets to 2 a day?",
                    "Is my result okay?",
                ],
                narrative_points=["Stop taking the thyroid medicine.", "Repeat test in 4 weeks."],
            )
        )
        self.assertEqual(a.questions_for_doctor, ["Is my result okay?"])
        self.assertEqual(a.narrative_points, ["Repeat test in 4 weeks."])
        self.assertEqual(hits, 2)

    def test_hindi(self) -> None:
        a, hits = lint(analysis(summary="यह खून की जाँच है। आयरन की दवा बंद कर दें।"))
        self.assertEqual(hits, 1)
        self.assertNotIn("बंद", a.summary)

    def test_keeps_harmless_sentences(self) -> None:
        text = "Your baby has received the BCG vaccine. You have two values outside the range."
        a, hits = lint(analysis(summary=text))
        self.assertEqual(hits, 0)
        self.assertEqual(a.summary, text)

    def test_caps_lists(self) -> None:
        a, _ = lint(analysis(questions_for_doctor=[f"Question {i}?" for i in range(9)]))
        self.assertEqual(len(a.questions_for_doctor), 4)


class TestRender(unittest.TestCase):
    def test_sections_and_disclaimer(self) -> None:
        text = render(analysis(), "en")
        self.assertIn("**What this is**", text)
        self.assertIn("Complete Blood Count (2026-10-28)", text)
        self.assertIn("**Haemoglobin**: 9.8 g/dL (range: 11.0–15.0) — lower than the range.", text)
        self.assertIn("1 other value(s) are within the range", text)
        self.assertNotIn("WBC", text)  # normal values are folded into one line
        self.assertIn("**Questions to ask your doctor**", text)
        self.assertTrue(text.endswith("go over these results with your doctor._"))

    def test_prescription_lists_medicines_as_written(self) -> None:
        text = render(
            analysis(
                findings=[],
                medicines_as_written=[
                    MedicineAsWritten(
                        name="Tab Ferrous sulphate", strength="100 mg", frequency="OD"
                    ),
                    MedicineAsWritten(name="", legible=False),
                ],
            ),
            "en",
        )
        self.assertIn("- Tab Ferrous sulphate — 100 mg, OD", text)
        self.assertIn("not clear — please confirm with your doctor or pharmacist", text)

    def test_hindi_headings(self) -> None:
        text = render(analysis(), "hi")
        self.assertIn("**यह क्या है**", text)
        self.assertIn("डायग्नोसिस नहीं", text)

    def test_session_context_is_compact_text(self) -> None:
        ctx = to_session_context(analysis(), "lab_report")
        self.assertIn("Haemoglobin: 9.8 g/dL, range 11.0–15.0 (report); status low", ctx)
        self.assertLessEqual(
            len(to_session_context(analysis(findings=[analysis().findings[0]] * 200), None)), 3000
        )


class TestReferenceTable(unittest.TestCase):
    def test_every_row_names_its_source(self) -> None:
        for row in REFERENCE_TABLE:
            self.assertTrue(row.source.strip(), row.analyte)
            self.assertIn(row.stage, ("pregnancy", "postpartum", "any"))


if __name__ == "__main__":
    unittest.main()
