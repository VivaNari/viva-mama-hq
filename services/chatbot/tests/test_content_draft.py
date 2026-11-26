"""
Drafting content search profiles.

Only YouTube links reach the model, a video that cannot be read falls back to text and
says so, and nothing unusable is ever returned as a draft.
"""

from __future__ import annotations

import asyncio
import unittest
from unittest import mock

import app.api.main as api
import app.contents.draft as draft
from app.contents.schemas import ContentDraftRequest, ExampleQuestion, SearchProfileOutput
from fastapi.testclient import TestClient
from pydantic import ValidationError

VIDEO = "https://youtu.be/abc123"


def profile(**kw) -> SearchProfileOutput:
    base = dict(
        readable=True,
        summary="A summary.",
        one_liner="One line.",
        keywords_en=["latch", "Latch", " "],
        example_questions=[
            ExampleQuestion(text="how to latch?", language="en", timestamp="1:20"),
            ExampleQuestion(text="How to  latch?", language="en", timestamp="1:30"),
            ExampleQuestion(text="dard kyun?", language="hinglish", timestamp="soon"),
        ],
        suitable_for=["PP", "PP"],
    )
    return SearchProfileOutput(**{**base, **kw})


def req(**kw) -> ContentDraftRequest:
    return ContentDraftRequest(**{"content_id": "c1", "title": "T", "text": "Body", **kw})


def run(request, results):
    """Run a draft with `_call` returning/raising `results` in order."""
    call = mock.AsyncMock(side_effect=results)
    with (
        mock.patch.object(draft, "_call", call),
        mock.patch.object(draft, "supports_vision", return_value=True),
    ):
        return asyncio.run(draft.draft_content(request, "r")), call


class RequestValidation(unittest.TestCase):
    def test_only_https_youtube_links(self):
        for bad in (
            "http://youtu.be/a",
            "https://evil.com/a",
            "https://youtube.com.evil.com/a",
            "gs://bucket/a",
            "file:///etc/passwd",
        ):
            with self.assertRaises(ValidationError, msg=bad):
                req(video_urls=[bad])
        self.assertEqual(req(video_urls=[VIDEO]).video_urls, [VIDEO])


class Drafting(unittest.TestCase):
    def test_video_draft_is_marked_checked(self):
        res, call = run(req(video_urls=[VIDEO]), [profile()])
        self.assertEqual((res.status, res.video_checked), ("DRAFTED", True))
        self.assertEqual(call.await_count, 1)

    def test_unreadable_video_falls_back_to_text(self):
        res, _ = run(req(video_urls=[VIDEO]), [profile(readable=False), profile()])
        self.assertEqual((res.status, res.video_checked), ("DRAFTED", False))
        self.assertTrue(all(q.timestamp is None for q in res.profile.example_questions))

    def test_failed_video_call_falls_back_to_text(self):
        res, _ = run(req(video_urls=[VIDEO]), [RuntimeError("x"), profile()])
        self.assertEqual((res.status, res.video_checked), ("DRAFTED", False))

    def test_nothing_readable_needs_manual(self):
        res, _ = run(req(), [profile(readable=False)])
        self.assertEqual(res.status, "NEEDS_MANUAL")
        self.assertIsNone(res.profile)

    def test_empty_source_never_calls_the_model(self):
        res, call = run(req(text=" "), [])
        self.assertEqual(res.status, "NEEDS_MANUAL")
        call.assert_not_awaited()

    def test_total_failure_is_an_error_not_a_manual_item(self):
        with self.assertRaises(draft.DraftError):
            run(req(video_urls=[VIDEO]), [RuntimeError("a"), RuntimeError("b")])

    def test_cleaning(self):
        p = draft.clean_profile(profile(), with_video=True)
        self.assertEqual(p.keywords_en, ["latch"])
        self.assertEqual([q.text for q in p.example_questions], ["how to latch?", "dard kyun?"])
        self.assertEqual([q.timestamp for q in p.example_questions], ["1:20", None])
        self.assertEqual(p.suitable_for, ["PP"])

    def test_text_attempt_never_carries_the_video(self):
        r = req(video_urls=[VIDEO])
        kinds = lambda m: [p["type"] for p in m.content]  # noqa: E731
        self.assertIn("media", kinds(draft._message(r, True)))
        self.assertNotIn("media", kinds(draft._message(r, False)))


class Endpoint(unittest.TestCase):
    def test_requires_the_api_key(self):
        client = TestClient(api.app)
        with mock.patch.object(api, "API_KEY", "secret-key"):
            res = client.post("/v1/contents/draft", json={"content_id": "c", "title": "t"})
        self.assertEqual(res.status_code, 401)

    def test_failure_is_502(self):
        client = TestClient(api.app)
        with (
            mock.patch.object(api, "API_KEY", "secret-key"),
            mock.patch.object(api, "draft_content", side_effect=draft.DraftError("x")),
        ):
            res = client.post(
                "/v1/contents/draft",
                json={"content_id": "c", "title": "t"},
                headers={"X-API-Key": "secret-key"},
            )
        self.assertEqual(res.status_code, 502)


if __name__ == "__main__":
    unittest.main()
