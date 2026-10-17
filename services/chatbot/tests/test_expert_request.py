"""
Expert requests and answer-quality guards.

Covers the failures seen in production screenshots: "I want to speak with an
expert" answered with knowledge-base trivia, researchers from the knowledge base
listed as "gynaecologists in this app", and the same follow-up offered again after
the user said "No". The pipeline runs end to end with the LLM, retrieval and the
MCP user-context fetch replaced by fakes; memory uses the in-process fallback.
"""

from __future__ import annotations

import asyncio
import types
import unittest
from unittest import mock

import app.chains.chat_pipeline_mcp as pipeline
from app.chains.followup import is_negative, same_topic
from app.chains.router import route_intent
from app.experts.formatting import format_experts_for_prompt
from app.experts.suggestion import find_unlisted_expert_names
from app.memory.redis_memory import RedisSessionMemory, _InProcessStore

USER_ID = "6a9f23daf4324a08644d1e4e"

EXPERTS = [
    {
        "id": "e1",
        "name": "Dr Vibha Bansal",
        "speciality": "Gynaecologist and Obstetrician",
        "years_of_experience": 28,
        "name_variants": ["Dr Vibha Bansal"],
    },
    {
        "id": "e2",
        "name": "Ms Pooja Marathe",
        "speciality": "Lactation, Maternal and Infant Nutrition Specialist",
        "years_of_experience": 15,
        "name_variants": ["Ms Pooja Marathe"],
    },
]


class TestRouter(unittest.TestCase):
    def test_screenshot_messages_are_expert_requests(self) -> None:
        for text in [
            "I want to speak with an expert",
            "No I want to speak to an expert.Can you help me connect with one share lactation , expert",
            "How can I connect with a viva mama lactation expert",
            "Which gynaecologist do you have in this app",
            "doctor se baat karni hai",
            "मुझे डॉक्टर से बात करनी है",
        ]:
            with self.subTest(text=text):
                self.assertEqual(route_intent(text), "EXPERT_REQUEST")

    def test_wellness_questions_are_not(self) -> None:
        for text in [
            "when should I see a doctor about heavy bleeding?",
            "why do I feel low after delivery",
            "should I consult a doctor if my baby has fever",
            "how can you help me",
        ]:
            with self.subTest(text=text):
                self.assertNotEqual(route_intent(text), "EXPERT_REQUEST")


class TestGuards(unittest.TestCase):
    def test_unlisted_names_are_found(self) -> None:
        answer = (
            "* Dr. Vidushi Kulshreshtha is an Assistant Professor.\n"
            "* **Dr Vibha Bansal, Gynaecologist and Obstetrician**"
        )
        self.assertEqual(find_unlisted_expert_names(answer, EXPERTS), ["Vidushi Kulshreshtha"])

    def test_directory_line_has_years(self) -> None:
        block = format_experts_for_prompt({"found": True, "experts": EXPERTS})
        self.assertIn("Dr Vibha Bansal, Gynaecologist and Obstetrician — 28 yrs experience", block)

    def test_negative_and_same_topic(self) -> None:
        self.assertTrue(is_negative("No I want to speak to an expert"))
        self.assertTrue(is_negative("नहीं"))
        self.assertFalse(is_negative("Noted"))
        self.assertTrue(same_topic("how lactation consultants can help", "How lactation consultants can help"))
        self.assertFalse(same_topic("baby sleep patterns", "postpartum diet"))


def _context(experts):
    return pipeline.UserContextResult(
        profile_context="You are assisting Sumi, who is in postpartum week 7.",
        recovery_context="",
        expert_directory=format_experts_for_prompt({"found": bool(experts), "experts": experts}),
        products_directory="",
        has_profile=True,
        has_recovery=False,
        experts=experts,
    )


class PipelineTestCase(unittest.TestCase):
    """Runs chat_once with fake LLM / retrieval / MCP and in-process memory."""

    def setUp(self) -> None:
        self.store = _InProcessStore(window_size=8)
        store = self.store
        original_init = RedisSessionMemory.__init__

        def init(mem, window_size=8):
            original_init(mem, window_size)
            mem._is_fallback = True
            mem._r = store

        self.replies: list = []
        self.prompts: list = []
        self.rag_calls: list = []
        self.experts = EXPERTS

        test = self

        class FakeLLM:
            def invoke(self, prompt):
                test.prompts.append(prompt)
                return types.SimpleNamespace(content=test.replies.pop(0))

        async def fake_rag(query, request_id, retriever):
            test.rag_calls.append(query)
            return [], False, 0.0

        async def fake_content(query, request_id):
            return ""

        async def fake_context(user_id, request_id):
            return _context(test.experts)

        self.patches = [
            mock.patch.object(RedisSessionMemory, "__init__", init),
            mock.patch.object(pipeline, "get_llm", lambda model=None: FakeLLM()),
            mock.patch.object(pipeline, "fetch_rag_context", fake_rag),
            mock.patch.object(pipeline, "fetch_content_context", fake_content),
            mock.patch.object(pipeline, "get_shared_retriever", lambda: None),
            mock.patch.object(pipeline, "fetch_user_context", fake_context),
            # Weak retrieval triggers a translation LLM call; keep the fake LLM for answers.
            mock.patch.object(pipeline, "translate_query_for_rag", lambda q, rid: q),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self) -> None:
        for p in self.patches:
            p.stop()

    def chat(self, text: str, session: str = "s1"):
        return asyncio.run(pipeline.chat_once(text, user_id=USER_ID, session_id=session))


class TestExpertRequestPipeline(PipelineTestCase):
    def test_expert_request_uses_directory_not_rag(self) -> None:
        self.replies = [
            "Of course — for breastfeeding support you can consult **Ms Pooja Marathe, "
            "Lactation, Maternal and Infant Nutrition Specialist** (15 years). To book, open "
            "**Experts**, tap her name and choose **Book**.\n"
            "Would you like to know more about latch problems? 💬\n[[FOLLOWUP: latch problems]]"
        ]
        r = self.chat("How can I connect with a viva mama lactation expert")
        self.assertEqual(r.intent, "EXPERT_REQUEST")
        self.assertEqual(self.rag_calls, [])
        self.assertIn("EXPERT REQUEST MODE", self.prompts[0])
        self.assertNotIn("Would you like to know more", r.answer)
        self.assertNotIn("[[", r.answer)
        self.assertEqual([e["name"] for e in r.suggested_experts], ["Ms Pooja Marathe"])

    def test_single_paragraph_reply_with_stray_tag_is_kept(self) -> None:
        # Production bug: a one-line expert reply ending in "?" plus a stray
        # [[FOLLOWUP]] tag was stripped to an empty answer.
        reply = (
            "Of course, Sobhika — you can book **Ms Pooja Marathe, Lactation, Maternal and "
            "Infant Nutrition Specialist** (15 years) in the **Experts** section. "
            "What would you like help with first?"
        )
        self.replies = [reply + "\n[[FOLLOWUP: breastfeeding support]]"]
        r = self.chat("I want to speak with an expert.")
        self.assertEqual(r.answer, reply)
        self.assertEqual([e["name"] for e in r.suggested_experts], ["Ms Pooja Marathe"])

    def test_empty_directory_gets_canned_reply_without_llm(self) -> None:
        self.experts = []
        r = self.chat("Which gynaecologist do you have in this app")
        self.assertEqual(r.intent, "EXPERT_REQUEST")
        self.assertEqual(self.prompts, [])
        self.assertIn("**Experts**", r.answer)
        self.assertNotIn("Dr", r.answer)

    def test_unlisted_names_replaced_with_directory(self) -> None:
        self.replies = [
            "* Dr. Vidushi Kulshreshtha is an Assistant Professor of Obstetrics.\n"
            "* Dr. Reeta Mahey is an Associate Professor."
        ]
        r = self.chat("Which gynaecologist do you have in this app")
        self.assertNotIn("Kulshreshtha", r.answer)
        self.assertIn("Dr Vibha Bansal, Gynaecologist and Obstetrician", r.answer)
        self.assertIn("28 years", r.answer)

    def test_declined_offer_is_not_repeated(self) -> None:
        self.replies = [
            "Answer one.\nWould you like to know more about how lactation consultants can help? 💬\n"
            "[[FOLLOWUP: how lactation consultants can help]]",
            "Answer two about feeds.\nWould you like to know more about how lactation consultants "
            "can help? 💬\n[[FOLLOWUP: How lactation consultants can help]]",
        ]
        self.chat("my baby is not latching well")
        r = self.chat("no, my nipples are also sore")
        self.assertIn("declined your previous offer", self.prompts[1])
        self.assertNotIn("Would you like to know more", r.answer)


if __name__ == "__main__":
    unittest.main()
