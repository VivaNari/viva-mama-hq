"""
LLM replies come back as a string (Gemini 2.5) or a list of parts (Gemini 3.x).
Every reader must get the same answer text from both, and nothing that isn't text
(thought signatures, thinking parts) may reach the user.

Also pins the per-role request deadlines the factory sets on Vertex clients.
"""

from __future__ import annotations

import sys
import types
import unittest
from types import SimpleNamespace
from unittest import mock

import app.chains.chat_pipeline_mcp as pipeline
import app.llm.factory as factory
from app.llm.response import response_text

ANSWER = "Postpartum bleeding (lochia) usually lasts for about four to six weeks."
SIGNATURE = "AY89a1+Aymgj7V2wMFeXOUDYrdd7oBJqBEavAqtF"

# The exact shape gemini-3.5-flash-lite returned through ChatVertexAI (Nov 2026).
GEMINI_3_CONTENT = [{"type": "text", "text": ANSWER, "thought_signature": SIGNATURE}]


def _reply(content: object) -> SimpleNamespace:
    return SimpleNamespace(content=content)


def _llm(content: object) -> SimpleNamespace:
    return SimpleNamespace(invoke=lambda _prompt: _reply(content))


class TestResponseText(unittest.TestCase):
    def test_string_content_is_returned_as_is(self) -> None:
        self.assertEqual(response_text(_reply(ANSWER + " \n")), ANSWER + " \n")

    def test_gemini_3_part_gives_its_text_without_the_signature(self) -> None:
        text = response_text(_reply(GEMINI_3_CONTENT))
        self.assertEqual(text, ANSWER)
        self.assertNotIn(SIGNATURE, text)

    def test_several_text_parts_are_joined_in_order(self) -> None:
        content = [
            {"type": "text", "text": "Lochia lasts "},
            {"type": "text", "text": "4-6 weeks.", "thought_signature": SIGNATURE},
        ]
        self.assertEqual(response_text(_reply(content)), "Lochia lasts 4-6 weeks.")

    def test_thinking_parts_are_left_out(self) -> None:
        content = [
            {"type": "thinking", "thinking": "She is 12 days postpartum, so..."},
            {"type": "text", "text": ANSWER},
        ]
        self.assertEqual(response_text(_reply(content)), ANSWER)

    def test_signature_only_part_adds_nothing(self) -> None:
        content = [{"type": "text", "text": ANSWER}, {"thought_signature": SIGNATURE}]
        self.assertEqual(response_text(_reply(content)), ANSWER)

    def test_untyped_text_parts_and_plain_strings_count_as_text(self) -> None:
        self.assertEqual(response_text(_reply([{"text": "a"}, "b"])), "ab")

    def test_empty_or_missing_content_is_empty_text(self) -> None:
        self.assertEqual(response_text(_reply([])), "")
        self.assertEqual(response_text(_reply(None)), "")
        self.assertEqual(response_text(None), "")

    def test_bare_content_without_a_message_wrapper(self) -> None:
        self.assertEqual(response_text(ANSWER), ANSWER)
        self.assertEqual(response_text(GEMINI_3_CONTENT), ANSWER)


class TestPipelineReadsBothShapes(unittest.TestCase):
    """The sites that failed silently on a list reply."""

    def _grounded(self, content: object) -> bool:
        with mock.patch.object(pipeline, "get_llm", return_value=_llm(content)):
            return pipeline.check_context_grounding(
                "How long does bleeding last?",
                rag_context_block="Lochia lasts 4-6 weeks.",
                profile_context="",
                recovery_context="",
                products_directory="",
                request_id="t",
                rag_best_score=0.6,
            )

    def test_grounding_gate_reads_a_gemini_3_yes(self) -> None:
        # A list reply used to raise in .strip() and fail closed: nothing grounded.
        self.assertTrue(self._grounded([{"type": "text", "text": "YES", "thought_signature": SIGNATURE}]))
        self.assertTrue(self._grounded("YES"))
        self.assertFalse(self._grounded([{"type": "text", "text": "NO"}]))

    def test_translation_reads_a_gemini_3_reply(self) -> None:
        # A list reply used to raise, so Hinglish queries reached RAG untranslated.
        english = "How long does bleeding last after delivery?"
        content = [{"type": "text", "text": english, "thought_signature": SIGNATURE}]
        with mock.patch.object(pipeline, "get_llm", return_value=_llm(content)):
            self.assertEqual(
                pipeline.translate_query_for_rag("Delivery ke baad bleeding kitne din?", "t"),
                english,
            )


class _FakeChatVertexAI:
    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs


class TestFactoryDeadlines(unittest.TestCase):
    """Every Vertex client gets a per-attempt deadline and a short retry back-off."""

    def setUp(self) -> None:
        fake = types.ModuleType("langchain_google_vertexai")
        fake.ChatVertexAI = _FakeChatVertexAI
        fake.HarmBlockThreshold = SimpleNamespace(BLOCK_ONLY_HIGH="BLOCK_ONLY_HIGH")
        fake.HarmCategory = SimpleNamespace(
            HARM_CATEGORY_DANGEROUS_CONTENT="d",
            HARM_CATEGORY_HARASSMENT="h",
            HARM_CATEGORY_HATE_SPEECH="s",
            HARM_CATEGORY_SEXUALLY_EXPLICIT="x",
        )
        patches = [
            mock.patch.dict(sys.modules, {"langchain_google_vertexai": fake}),
            mock.patch.dict(factory._clients, clear=True),
            mock.patch.object(factory.settings, "llm_provider", "vertex"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def _kwargs(self, **role: bool) -> dict:
        return factory.get_llm("gemini-3.5-flash-lite", **role).kwargs

    def test_deadline_per_role(self) -> None:
        s = factory.settings
        expected = {
            (): 20.0,
            ("classifier",): 8.0,
            ("extractor",): 8.0,
            ("transliterator",): 30.0,
            ("vision_classifier",): s.attachment_classifier_timeout_s,
            ("analyzer",): s.attachment_analysis_timeout_s,
            ("summarizer",): s.health_summary_timeout_s,
        }
        for flags, timeout in expected.items():
            with self.subTest(role=flags or "main"):
                self.assertEqual(self._kwargs(**{f: True for f in flags})["timeout"], timeout)

    def test_one_turn_stays_under_the_core_api_deadline_even_if_every_call_stalls(self) -> None:
        # langchain-google-vertexai counts max_retries as TOTAL attempts (2 = one retry).
        def worst(kwargs: dict) -> float:
            attempts = max(kwargs["max_retries"], 1)
            return attempts * kwargs["timeout"] + (attempts - 1) * kwargs["wait_exponential_kwargs"]["max"]

        main = self._kwargs()
        self.assertEqual(main["max_retries"], 2)
        # A chat turn makes three calls in sequence: translation + gate + main answer.
        turn = worst(main) + worst(self._kwargs(classifier=True)) + worst(main)
        self.assertLess(turn, 150)  # core API gives up on the chatbot at 150 s

    def test_retry_back_off_is_short_and_thinking_stays_off(self) -> None:
        kwargs = self._kwargs()
        self.assertEqual(kwargs["wait_exponential_kwargs"], {"multiplier": 1.0, "min": 1.0, "max": 4.0})
        self.assertEqual(kwargs["thinking_budget"], 0)
        self.assertEqual(kwargs["location"], factory.settings.vertex_location)


if __name__ == "__main__":
    unittest.main()
