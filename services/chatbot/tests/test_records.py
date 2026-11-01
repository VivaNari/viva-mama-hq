"""
Health records: reading one saved record, and the overall summary built from them.

A record is refused, without a word about the file, unless it is a health document
of hers or of the baby she filed it under. The overall summary states facts about
her only from her profile and stored records, never from the model.
"""

from __future__ import annotations

import asyncio
import unittest
from datetime import date
from unittest import mock

import app.api.main as api
import app.attachments.analysis as analysis
import app.records.analyze_record as rec
import app.records.health_summary as hs
from app.attachments.policy import decide, record_refusal_message
from app.attachments.schemas import (
    AnalysisOutput,
    AttachmentRef,
    FileTriage,
    Finding,
    TriageBatch,
    Verdict,
)
from app.records.dates import format_date, parse_report_date
from app.records.schemas import (
    BabyPoints,
    HealthSummaryOutput,
    HealthSummaryRequest,
    RecordAnalyzeRequest,
)
from app.settings import settings
from fastapi.testclient import TestClient
from pydantic import ValidationError

USER = "6a9f23daf4324a08644d1e4e"
RECORD = "6a9f23daf4324a08644d1e99"
BUCKET = "vm-health-records"


def uri(user: str = USER, record: str = RECORD, n: int = 0, ext: str = "jpg") -> str:
    return f"gs://{BUCKET}/records/{user}/{record}/3f1c2b7a-1111-4a2b-9c3d-12345678900{n}.{ext}"


def file_ref(n: int = 0, kind: str = "image", **kw) -> dict:
    return {
        "attachment_id": f"{RECORD}:{n}",
        "uri": kw.get("uri") or uri(n=n, ext="pdf" if kind == "pdf" else "jpg"),
        "mime_type": "application/pdf" if kind == "pdf" else "image/jpeg",
        "kind": kind,
    }


def analyze_req(subject: str = "mother", files=None, **kw) -> RecordAnalyzeRequest:
    return RecordAnalyzeRequest(
        user_id=USER,
        record_id=RECORD,
        category=kw.get("category", "lab"),
        subject={"type": subject, "child_name": "Asha" if subject == "child" else None},
        files=files or [file_ref()],
        lang=kw.get("lang", "en"),
    )


def triage_file(**overrides) -> FileTriage:
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


def cbc(hb: str = "9.8") -> AnalysisOutput:
    return AnalysisOutput(
        out_of_scope=False,
        document_title="Complete Blood Count",
        report_date="12/06/2026",
        summary="A blood test that checks your blood cells.",
        findings=[
            Finding(
                name="Haemoglobin",
                value=hb,
                unit="g/dL",
                reference_range="11.0-15.0",
                range_source="report",
                status="low",
                plain_explanation="Haemoglobin carries oxygen in the blood.",
            )
        ],
        questions_for_doctor=["What does my Hb mean for me?"],
    )


class TestRequestShape(unittest.TestCase):
    def test_record_uris_are_accepted_and_traversal_is_not(self) -> None:
        AttachmentRef(attachment_id="a", uri=uri(), mime_type="image/jpeg", kind="image")
        for bad in (
            f"gs://{BUCKET}/records/{USER}/../x/0.jpg",
            f"gs://{BUCKET}/records/{USER}/{RECORD}/a.b.jpg",
            f"gs://{BUCKET}/records/{USER}/0.jpg",
        ):
            with self.assertRaises(ValidationError, msg=bad):
                AttachmentRef(attachment_id="a", uri=bad, mime_type="image/jpeg", kind="image")

    def test_one_pdf_or_up_to_five_photos(self) -> None:
        analyze_req(files=[file_ref(i) for i in range(5)])
        with self.assertRaises(ValidationError):
            analyze_req(files=[file_ref(i) for i in range(6)])
        with self.assertRaises(ValidationError):
            analyze_req(files=[file_ref(0), file_ref(1, kind="pdf")])


class TestSubjectRule(unittest.TestCase):
    def verdict(self, expected: str, **triage) -> str:
        decision, _ = decide(TriageBatch(files=[triage_file(**triage)]), expected)
        return decision.reason_code

    def test_her_report_under_a_baby_is_refused(self) -> None:
        self.assertEqual(self.verdict("child", subject_evidence="adult_female"), "SUBJECT_MISMATCH")

    def test_a_babys_report_under_me_is_refused(self) -> None:
        self.assertEqual(
            self.verdict("mother", subject_evidence="child", health_domain="baby_child_health"),
            "SUBJECT_MISMATCH",
        )

    def test_unclear_subject_and_the_mch_card_are_accepted(self) -> None:
        self.assertEqual(self.verdict("child", subject_evidence="none_visible"), "OK")
        self.assertEqual(
            self.verdict("child", subject_evidence="adult_female", document_type="mch_card"), "OK"
        )

    def test_her_fertility_and_general_health_reports_are_in_scope(self) -> None:
        # An HSG (trying to conceive) or a thyroid test is hers, not pregnancy-specific.
        for expected in ("any", "mother"):
            self.assertEqual(
                self.verdict(
                    expected,
                    document_type="other_medical_document",
                    health_domain="womens_general_health",
                ),
                "OK",
            )
        prompt = analysis.ANALYSIS_PROMPT
        for phrase in ("trying to conceive", "HSG", "her own health", "out_of_scope=true"):
            self.assertIn(phrase, prompt)
        # A different patient name (nickname, married surname) never makes it someone else's.
        self.assertIn("NEVER decide who it belongs to from the\npatient NAME", prompt)

    def test_chat_turns_are_unchanged(self) -> None:
        self.assertEqual(self.verdict("any", subject_evidence="child"), "OK")
        self.assertEqual(self.verdict("any", subject_evidence="adult_male"), "OTHER_PERSON")

    def test_record_refusals_do_not_mention_the_chat_quota(self) -> None:
        for lang in ("en", "hi"):
            for v in (Verdict.UNRELATED, Verdict.OTHER_PERSON, Verdict.UNREADABLE):
                text = record_refusal_message(v, lang)
                self.assertNotIn("daily question", text)
                self.assertNotIn("सवाल ख़र्च", text)


class TestDates(unittest.TestCase):
    TODAY = date(2026, 11, 1)

    def test_formats_printed_on_indian_reports(self) -> None:
        for text, iso in (
            ("12/06/2026", "2026-06-12"),
            ("Date: 03-09-26", "2026-09-03"),
            ("3rd Sep 2026", "2026-09-03"),
            ("September 3, 2026", "2026-09-03"),
            ("2026-09-03", "2026-09-03"),
        ):
            self.assertEqual(parse_report_date(text, self.TODAY), iso, text)

    def test_future_or_unreadable_dates_are_not_trusted(self) -> None:
        for text in ("12/06/2027", "31/02/2026", "not clear", None, "1998-01-01"):
            self.assertIsNone(parse_report_date(text, self.TODAY), text)

    def test_format(self) -> None:
        self.assertEqual(format_date("2026-09-03", "en"), "3 Sep 2026")
        self.assertEqual(format_date("2026-09-03", "hi"), "3 सितंबर 2026")


class TestAnalyzeRecord(unittest.TestCase):
    def run_with(self, triage_batch, analysis=None, subject="mother"):
        calls = {"analyze": 0}

        async def fake_analyze(*a, **kw):
            calls["analyze"] += 1
            calls["hint"] = a[5] if len(a) > 5 else kw.get("record_hint")
            return analysis or cbc()

        async def fake_triage(*a, **kw):
            return triage_batch

        async def fake_media(refs):
            return [{"type": "media", "data": b"x", "mime_type": "image/jpeg"} for _ in refs]

        async def fake_ctx(*a, **kw):
            raise RuntimeError("no mcp in tests")

        with (
            mock.patch.object(rec, "supports_vision", lambda: True),
            mock.patch.object(rec, "build_media_parts", fake_media),
            mock.patch.object(rec, "triage", fake_triage),
            mock.patch.object(rec, "analyze", fake_analyze),
            mock.patch.object(rec, "fetch_user_context", fake_ctx),
        ):
            res = asyncio.run(rec.analyze_record(analyze_req(subject), "r1"))
        return res, calls

    def test_an_accepted_record_is_summarised(self) -> None:
        res, calls = self.run_with(TriageBatch(files=[triage_file()]), cbc("6.5"))
        self.assertEqual(res.verdict, "ANALYZED")
        self.assertEqual(res.report_date, "2026-06-12")
        self.assertEqual(res.title, "Complete Blood Count")
        self.assertEqual(res.severity, "HIGH")
        self.assertIn("This record shows", res.summary_markdown)
        self.assertIn("Haemoglobin: 6.5 g/dL", res.digest)
        self.assertIn("filed as her own record", calls["hint"])

    def test_a_refused_record_is_never_read(self) -> None:
        res, calls = self.run_with(
            TriageBatch(
                files=[triage_file(document_type="non_medical", health_domain="not_health")]
            )
        )
        self.assertEqual(res.verdict, "UNRELATED")
        self.assertEqual(calls["analyze"], 0)
        self.assertIsNone(res.analysis)
        self.assertIsNone(res.summary_markdown)
        self.assertIn("wasn't saved", res.message)

    def test_a_storage_failure_is_retryable(self) -> None:
        async def broken(refs):
            raise rec.AttachmentLoadError("TimeoutError")

        with (
            mock.patch.object(rec, "supports_vision", lambda: True),
            mock.patch.object(rec, "build_media_parts", broken),
        ):
            res = asyncio.run(rec.analyze_record(analyze_req(), "r1"))
        self.assertEqual((res.verdict, res.reason_code), ("ERROR", "LOAD_FAILED"))


class TestRecordEndpointScope(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(api.app)
        self.headers = {"X-API-Key": api.API_KEY or "unused"}
        self.calls: list = []

        async def fake(req, request_id):
            self.calls.append(req)
            return rec.RecordAnalyzeResponse(
                request_id=request_id, verdict="ANALYZED", reason_code="OK"
            )

        self.patches = [
            mock.patch.object(api, "analyze_record", fake),
            mock.patch.object(settings, "health_records_bucket", BUCKET),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self) -> None:
        for p in self.patches:
            p.stop()

    def post(self, files):
        body = {
            "user_id": USER,
            "record_id": RECORD,
            "category": "lab",
            "subject": {"type": "mother"},
            "files": files,
        }
        return self.client.post("/v1/records/analyze", json=body, headers=self.headers)

    def test_her_own_record_goes_through(self) -> None:
        res = self.post([file_ref()])
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(len(self.calls), 1)

    def test_another_users_or_records_files_are_refused(self) -> None:
        other_user = "6a9f23daf4324a08644d1e4f"
        for bad in (
            uri(user=other_user),
            uri(record="6a9f23daf4324a08644d1e98"),
            f"gs://{BUCKET}/chat/{USER}/3f1c2b7a-1111-4a2b-9c3d-123456789abc.jpg",
            f"gs://vivamama-rag-docs/records/{USER}/{RECORD}/0.jpg",
        ):
            res = self.post([file_ref(uri=bad)])
            self.assertEqual(res.status_code, 422, bad)
        self.assertEqual(self.calls, [])

    def test_refused_when_the_bucket_is_not_configured(self) -> None:
        with mock.patch.object(settings, "health_records_bucket", ""):
            self.assertEqual(self.post([file_ref()]).status_code, 422)


PROFILE = {
    "found": True,
    "preferred_name": "Priya",
    "stage": "pregnancy",
    "week": 24,
    "due_date": "2027-02-12",
    "pregnancy_conditions": ["anemia", "none"],
    "current_medications": ["meds_thyroid"],
    "children": [
        {"name": "Asha", "sex": "female", "age_days": 45, "age_text": "6 weeks old"},
        {"name": "Draft", "sex": "", "age_days": None, "age_text": ""},
    ],
}


def summary_req(lang: str = "en") -> HealthSummaryRequest:
    return HealthSummaryRequest(
        user_id=USER,
        lang=lang,
        child_names=["Asha"],
        records=[
            {
                "record_id": "r1",
                "record_date": "2026-06-12",
                "category": "lab",
                "subject": {"type": "mother"},
                "title": "Complete Blood Count",
                "digest": "Document: CBC\n- Haemoglobin: 6.5 g/dL; status low",
                "severity": "HIGH",
                "critical_matches": ["Haemoglobin 6.5 g/dL"],
                "out_of_range": [
                    {"name": "Haemoglobin", "value": "6.5", "unit": "g/dL", "status": "low"}
                ],
            },
            {
                "record_id": "r2",
                "record_date": "2026-09-03",
                "category": "mch",
                "subject": {"type": "child", "child_name": "Asha"},
                "digest": "Document: MCH card\n- BCG given",
                "out_of_range": [
                    {
                        "name": "Bilirubin",
                        "value": "14",
                        "unit": "mg/dL",
                        "reference_range": "<12",
                        "status": "high",
                    }
                ],
            },
        ],
        vitals=[{"type": "bp", "value": "118/76", "unit": "mmHg", "date": "2026-10-30"}],
        medicines=[{"name": "Iron tablet", "dose": "100 mg", "frequency": "once a day"}],
    )


SYNTHESIS = HealthSummaryOutput(
    overview="My records show a low haemoglobin in June. You have anaemia.",
    mother_points=["My haemoglobin was below the range in June.", "Stop taking iron tablets."],
    baby_points=[
        BabyPoints(child_name="asha", points=["Her BCG vaccine is recorded."]),
        BabyPoints(child_name="Ravi", points=["Invented baby."]),
    ],
    trends=[],
    questions_for_doctor=["Is my haemoglobin better now?"],
)


class TestHealthSummary(unittest.TestCase):
    def build(self, lang: str = "en", profile=None):
        async def fake_synth(req, lang, request_id):
            return SYNTHESIS

        with (
            mock.patch.object(hs, "get_user_profile", lambda uid: profile or PROFILE),
            mock.patch.object(hs, "synthesize", fake_synth),
        ):
            return asyncio.run(hs.build_health_summary(summary_req(lang), "r1"))

    def test_facts_come_from_her_profile(self) -> None:
        content, text = self.build()
        facts = content["facts"]
        self.assertEqual(facts["name"], "Priya")
        self.assertEqual(facts["stage_line"], "Pregnant · week 24 · due 12 Feb 2027")
        self.assertEqual(facts["conditions"], ["Anaemia"])
        self.assertEqual(
            facts["medicines"], ["Thyroid medicine", "Iron tablet (100 mg, once a day)"]
        )
        # Only babies she finished adding.
        self.assertEqual([c["name"] for c in facts["children"]], ["Asha"])
        self.assertIn("- Asha (girl, 6 weeks old)", text)

    def test_model_sentences_are_linted_and_unknown_babies_dropped(self) -> None:
        content, _ = self.build()
        self.assertNotIn("anaemia", content["overview"].lower())
        self.assertEqual(content["mother_points"], ["My haemoglobin was below the range in June."])
        self.assertEqual([b["child_name"] for b in content["baby_points"]], ["Asha"])

    def test_values_to_discuss_are_from_the_records_urgent_first(self) -> None:
        content, text = self.build()
        values = content["values_to_discuss"]
        self.assertEqual([v["name"] for v in values], ["Haemoglobin", "Bilirubin"])
        self.assertTrue(values[0]["urgent"])
        self.assertEqual(values[1]["subject"], "Asha")
        self.assertIn("Bilirubin: 14 mg/dL (range <12), higher than the range", text)

    def test_share_text_is_plain_and_ends_with_the_disclaimer(self) -> None:
        _, text = self.build()
        self.assertNotIn("**", text)
        self.assertTrue(text.startswith("VivaMama health summary — Priya"))
        self.assertTrue(text.endswith("please go through it with my doctor."))
        self.assertIn("Blood pressure: 118/76 mmHg · 30 Oct 2026", text)
        self.assertIn("12 Jun 2026 · Complete Blood Count (me)", text)

    def test_hindi(self) -> None:
        content, text = self.build("hi")
        self.assertTrue(text.startswith("VivaMama स्वास्थ्य सारांश — Priya"))
        self.assertIn("सप्ताह 24", content["facts"]["stage_line"])
        self.assertIn("6 सप्ताह का", text)

    def test_no_profile_still_summarises_the_records(self) -> None:
        content, text = self.build(profile={"found": False})
        self.assertEqual(content["facts"]["name"], "")
        self.assertTrue(text.startswith("VivaMama health summary\n"))
        self.assertEqual(len(content["records"]), 2)

    def test_endpoint_maps_a_failed_synthesis_to_502(self) -> None:
        async def fail(req, request_id):
            raise hs.SummaryError("timeout")

        client = TestClient(api.app)
        with mock.patch.object(api, "build_health_summary", fail):
            res = client.post(
                "/v1/records/summary",
                json=summary_req().model_dump(),
                headers={"X-API-Key": api.API_KEY or "unused"},
            )
        self.assertEqual(res.status_code, 502)


if __name__ == "__main__":
    unittest.main()
