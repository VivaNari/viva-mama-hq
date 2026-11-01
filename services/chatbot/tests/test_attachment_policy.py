"""
The attachment guardrail: which files Viva answers about, decided in code.

One case per rule. The property that matters most: anything that is not clearly a
health document of the mother or her child is refused, and the refusal says
nothing about what the file contains.
"""

from __future__ import annotations

import unittest

from app.attachments.policy import decide, decide_file, refusal_message
from app.attachments.schemas import FileTriage, TriageBatch, Verdict


def triage(**overrides) -> FileTriage:
    base = dict(
        document_type="lab_report",
        subject_evidence="adult_female",
        health_domain="pregnancy",
        readable=True,
        legibility="good",
        contains_ai_instructions=False,
        has_explicit_or_nudity=False,
        language="en",
        confidence=0.95,
    )
    base.update(overrides)
    return FileTriage(**base)


class TestDecideFile(unittest.TestCase):
    def assertVerdict(self, verdict: Verdict, **overrides) -> None:
        self.assertEqual(decide_file(triage(**overrides)).verdict, verdict, overrides)

    def test_her_pregnancy_lab_report_is_analyzed(self) -> None:
        self.assertVerdict(Verdict.ANALYZED)

    def test_her_general_health_report_is_analyzed(self) -> None:
        self.assertVerdict(Verdict.ANALYZED, health_domain="womens_general_health")
        self.assertVerdict(Verdict.ANALYZED, health_domain="other_health")

    def test_cropped_name_is_not_someone_else(self) -> None:
        self.assertVerdict(Verdict.ANALYZED, subject_evidence="none_visible")

    def test_baby_documents_are_analyzed(self) -> None:
        for doc in ("vaccination_card", "growth_chart", "lab_report"):
            self.assertVerdict(
                Verdict.ANALYZED,
                document_type=doc,
                subject_evidence="child",
                health_domain="baby_child_health",
            )

    def test_prescriptions_and_ultrasounds_are_analyzed(self) -> None:
        self.assertVerdict(Verdict.ANALYZED, document_type="prescription")
        self.assertVerdict(
            Verdict.ANALYZED, document_type="ultrasound_report", subject_evidence="fetus_pregnancy"
        )

    def test_non_medical_files_are_refused(self) -> None:
        self.assertVerdict(
            Verdict.UNRELATED, document_type="non_medical", health_domain="not_health"
        )
        self.assertVerdict(Verdict.UNRELATED, health_domain="not_health")
        self.assertVerdict(Verdict.UNRELATED, document_type="non_medical")

    def test_someone_elses_report_is_refused(self) -> None:
        self.assertVerdict(Verdict.OTHER_PERSON, subject_evidence="adult_male")
        self.assertVerdict(Verdict.OTHER_PERSON, subject_evidence="older_adult")

    def test_an_animals_report_is_refused(self) -> None:
        self.assertVerdict(Verdict.UNRELATED, subject_evidence="animal")

    def test_an_ultrasound_is_never_someone_elses(self) -> None:
        # The patient field on a scan is sometimes the husband's name.
        self.assertVerdict(
            Verdict.ANALYZED, document_type="ultrasound_image", subject_evidence="adult_male"
        )

    def test_body_photos_and_nudity_are_refused_first(self) -> None:
        self.assertVerdict(Verdict.CLINICAL_PHOTO, document_type="clinical_photo_of_body")
        self.assertVerdict(Verdict.CLINICAL_PHOTO, has_explicit_or_nudity=True)
        # Even when everything else looks like a valid report.
        self.assertVerdict(Verdict.CLINICAL_PHOTO, has_explicit_or_nudity=True, confidence=0.1)

    def test_low_confidence_fails_closed(self) -> None:
        self.assertVerdict(Verdict.UNRELATED, confidence=0.3)

    def test_unreadable_asks_for_a_retake(self) -> None:
        self.assertVerdict(Verdict.UNREADABLE, readable=False)
        self.assertVerdict(Verdict.UNREADABLE, legibility="poor")

    def test_partial_legibility_is_still_analyzed(self) -> None:
        self.assertVerdict(Verdict.ANALYZED, legibility="partial")


class TestDecideTurn(unittest.TestCase):
    def test_no_usable_triage_is_a_refusal(self) -> None:
        self.assertEqual(decide(None)[0].verdict, Verdict.UNRELATED)
        self.assertEqual(decide(TriageBatch(files=[]))[0].verdict, Verdict.UNRELATED)

    def test_one_unrelated_file_refuses_the_turn(self) -> None:
        decision, per_file = decide(
            TriageBatch(files=[triage(), triage(document_type="non_medical")])
        )
        self.assertEqual(decision.verdict, Verdict.UNRELATED)
        self.assertEqual([d.verdict for d in per_file], [Verdict.ANALYZED, Verdict.UNRELATED])

    def test_a_body_photo_outranks_everything(self) -> None:
        decision, _ = decide(
            TriageBatch(
                files=[triage(document_type="non_medical"), triage(has_explicit_or_nudity=True)]
            )
        )
        self.assertEqual(decision.verdict, Verdict.CLINICAL_PHOTO)

    def test_injected_instructions_are_flagged_not_obeyed(self) -> None:
        decision, _ = decide(TriageBatch(files=[triage(contains_ai_instructions=True)]))
        self.assertEqual(decision.verdict, Verdict.ANALYZED)
        self.assertTrue(decision.contains_ai_instructions)

    def test_subject_label(self) -> None:
        decision, _ = decide(
            TriageBatch(files=[triage(subject_evidence="child", health_domain="baby_child_health")])
        )
        self.assertEqual(decision.subject, "baby_child")


class TestRefusalMessages(unittest.TestCase):
    def test_every_refusal_has_english_and_hindi(self) -> None:
        for verdict in Verdict:
            if verdict == Verdict.ANALYZED:
                continue
            for lang in ("en", "hi"):
                text = refusal_message(verdict, lang)
                self.assertTrue(text.strip())
                self.assertNotIn("{", text)

    def test_refusals_promise_no_quota_was_used(self) -> None:
        self.assertIn("didn't use up your daily question", refusal_message(Verdict.UNRELATED, "en"))
        self.assertIn("ख़र्च नहीं हुआ", refusal_message(Verdict.UNRELATED, "hi"))

    def test_unknown_language_falls_back_to_english(self) -> None:
        self.assertEqual(
            refusal_message(Verdict.OTHER_PERSON, "ta"), refusal_message(Verdict.OTHER_PERSON, "en")
        )

    def test_plural_for_several_files(self) -> None:
        self.assertIn("these files", refusal_message(Verdict.UNRELATED, "en", 3))


if __name__ == "__main__":
    unittest.main()
