"""
/v1/chat with attachments: the request contract and the scope check.

A file may only be read from the attachments bucket, under the requesting user's
prefix, whatever the caller sends.
"""

from __future__ import annotations

import types
import unittest
from unittest import mock

import app.api.main as api
from app.attachments.schemas import AttachmentRef
from app.settings import settings
from fastapi.testclient import TestClient
from pydantic import ValidationError

USER = "6a9f23daf4324a08644d1e4e"
BUCKET = "vm-test-chat-attachments"


def ref(user: str = USER, ext: str = "jpg", bucket: str = BUCKET, kind: str = "image") -> dict:
    return {
        "attachment_id": "a1",
        "uri": f"gs://{bucket}/chat/{user}/3f1c2b7a-1111-4a2b-9c3d-123456789abc.{ext}",
        "mime_type": "application/pdf" if kind == "pdf" else "image/jpeg",
        "kind": kind,
    }


class TestRequestModel(unittest.TestCase):
    def test_needs_query_or_attachments(self) -> None:
        with self.assertRaises(ValidationError):
            api.ChatRequest(query="  ")
        api.ChatRequest(query="", user_id=USER, attachments=[ref()])

    def test_attachments_need_a_user(self) -> None:
        with self.assertRaises(ValidationError):
            api.ChatRequest(attachments=[ref()])

    def test_one_pdf_or_up_to_three_images(self) -> None:
        api.ChatRequest(user_id=USER, attachments=[ref(), ref(), ref()])
        with self.assertRaises(ValidationError):
            api.ChatRequest(user_id=USER, attachments=[ref()] * 4)
        with self.assertRaises(ValidationError):
            api.ChatRequest(user_id=USER, attachments=[ref(), ref(ext="pdf", kind="pdf")])

    def test_uri_shape_is_enforced(self) -> None:
        for bad in (
            "https://evil.example/x.jpg",
            f"gs://{BUCKET}/rag/index.faiss",
            f"gs://{BUCKET}/chat/{USER}/../other/x.jpg",
            f"gs://{BUCKET}/chat/{USER}/x.exe",
        ):
            with self.assertRaises(ValidationError, msg=bad):
                AttachmentRef(attachment_id="a", uri=bad, mime_type="image/jpeg", kind="image")


class TestEndpointScope(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(api.app)
        self.headers = {"X-API-Key": api.API_KEY or "unused"}
        self.calls: list = []
        test = self

        async def fake_chat_once(text, **kwargs):
            test.calls.append(kwargs)
            return types.SimpleNamespace(
                session_id="s1",
                answer="ok",
                intent="ATTACHMENT_ANALYSIS",
                used_rag=False,
                rag_best_score=0.0,
                escalation_banner=None,
                final_prompt="SECRET PROMPT",
                attachment={"verdict": "ANALYZED"},
                quota_refund=False,
            )

        self.patches = [
            mock.patch.object(api, "chat_once", fake_chat_once),
            mock.patch.object(settings, "attachments_enabled", True),
            mock.patch.object(settings, "attachments_bucket", BUCKET),
            # Deployed behaviour: the prompt is only returned in development.
            mock.patch.object(
                type(settings), "is_development", new_callable=mock.PropertyMock, return_value=False
            ),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self) -> None:
        for p in self.patches:
            p.stop()

    def post(self, body: dict):
        return self.client.post("/v1/chat", json=body, headers=self.headers)

    def test_her_own_file_goes_through_without_the_prompt(self) -> None:
        res = self.post({"user_id": USER, "attachments": [ref()], "lang": "hi"})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["attachment"], {"verdict": "ANALYZED"})
        self.assertNotEqual(res.json().get("final_prompt"), "SECRET PROMPT")
        self.assertEqual(self.calls[0]["lang"], "hi")
        self.assertEqual(len(self.calls[0]["attachments"]), 1)

    def test_another_users_file_is_refused(self) -> None:
        res = self.post({"user_id": USER, "attachments": [ref(user="6a9f23daf4324a08644d1e4f")]})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(self.calls, [])

    def test_another_bucket_is_refused(self) -> None:
        res = self.post({"user_id": USER, "attachments": [ref(bucket="vivamama-rag-docs")]})
        self.assertEqual(res.status_code, 422)

    def test_refused_when_the_feature_is_off(self) -> None:
        with mock.patch.object(settings, "attachments_enabled", False):
            res = self.post({"user_id": USER, "attachments": [ref()]})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(self.calls, [])

    def test_text_turns_are_unchanged(self) -> None:
        res = self.post({"query": "is walking safe?", "user_id": USER})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(self.calls[0]["attachments"])


if __name__ == "__main__":
    unittest.main()
