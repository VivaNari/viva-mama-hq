"""
Unit tests: concise answers + "Would you like to know more about X?" follow-up.

The tag extraction, affirmative-reply detection, history formatting and the
per-session topic store are exercised directly; no LLM or Redis needed.
"""

from __future__ import annotations

import unittest

from app.chains.followup import (
    build_followup_query,
    extract_followup,
    format_history,
    is_affirmative,
    strip_offer_line,
)
from app.escalation.policy import format_escalation_banner
from app.memory.redis_memory import RedisSessionMemory, _InProcessStore

ANSWER = (
    "It's completely understandable to feel this way, Sp. 💖\n\n"
    "* 🧠 **Brain rewiring:** Your brain adapts to your new role.\n"
    "* 📉 **Hormonal shifts:** Oestrogen and progesterone drop after birth.\n\n"
    "Connect with our VivaMama expert **Ms Kavya Rao, Counselling Psychologist**, "
    "for personalized guidance.\n\n"
    "Would you like to know more about ways to rebuild your sense of self? 💬\n"
    "[[FOLLOWUP: ways to rebuild your sense of self]]"
)


class TestExtractFollowup(unittest.TestCase):
    def test_tag_is_removed_and_topic_returned(self) -> None:
        clean, topic = extract_followup(ANSWER)
        self.assertEqual(topic, "ways to rebuild your sense of self")
        self.assertNotIn("[[", clean)
        self.assertTrue(clean.endswith("sense of self? 💬"))

    def test_no_tag_means_no_topic(self) -> None:
        clean, topic = extract_followup("Just an answer.")
        self.assertEqual(clean, "Just an answer.")
        self.assertIsNone(topic)

    def test_hindi_answer_with_english_tag(self) -> None:
        clean, topic = extract_followup(
            "क्या आप नींद के बारे में और जानना चाहेंगी?\n[[FOLLOWUP: newborn sleep patterns]]"
        )
        self.assertEqual(topic, "newborn sleep patterns")
        self.assertEqual(clean, "क्या आप नींद के बारे में और जानना चाहेंगी?")

    def test_tag_spread_over_lines_and_case(self) -> None:
        clean, topic = extract_followup("Answer\n[[ followup :\n  baby-led weaning ]]")
        self.assertEqual(topic, "baby-led weaning")
        self.assertEqual(clean, "Answer")

    def test_empty_tag_is_stripped_without_topic(self) -> None:
        clean, topic = extract_followup("Answer\n[[FOLLOWUP: ]]")
        self.assertEqual(clean, "Answer")
        self.assertIsNone(topic)


class TestStripOfferLine(unittest.TestCase):
    def test_trailing_question_removed(self) -> None:
        clean, _ = extract_followup(ANSWER)
        stripped = strip_offer_line(clean)
        self.assertNotIn("Would you like", stripped)
        self.assertIn("Kavya Rao", stripped)

    def test_non_question_kept(self) -> None:
        self.assertEqual(strip_offer_line("Line one\nGo to hospital."), "Line one\nGo to hospital.")


class TestIsAffirmative(unittest.TestCase):
    def test_accepts_short_replies(self) -> None:
        for text in ["yes", "Yes!", "ok", "sure 😊", "tell me more", "haan", "Haan ji",
                     "bilkul", "हाँ", "जी हां", "ज़रूर", "बताइए"]:
            with self.subTest(text=text):
                self.assertTrue(is_affirmative(text))

    def test_rejects_new_questions(self) -> None:
        for text in ["yes but my baby has fever 39", "no", "what about sleep?",
                     "is it safe to take paracetamol", ""]:
            with self.subTest(text=text):
                self.assertFalse(is_affirmative(text))

    def test_followup_query_names_topic_and_keeps_reply(self) -> None:
        q = build_followup_query("haan", "newborn sleep patterns")
        self.assertIn('"haan"', q)
        self.assertIn("newborn sleep patterns", q)


class TestFormatHistory(unittest.TestCase):
    def test_long_assistant_turn_keeps_offer(self) -> None:
        long_answer = ANSWER.split("\n[[")[0].replace("Sp.", "Sp. " + "word " * 80)
        block = format_history(
            [{"role": "user", "content": "I don't recognise myself"},
             {"role": "assistant", "content": long_answer}]
        )
        self.assertIn("USER: I don't recognise myself", block)
        self.assertIn("Would you like to know more about ways to rebuild your sense of self?", block)
        self.assertIn(" … ", block)

    def test_banner_is_dropped_from_assistant_turn(self) -> None:
        banner = format_escalation_banner("MEDIUM", ["fever"])
        block = format_history([{"role": "assistant", "content": banner + "\n\nShort answer?"}])
        self.assertNotIn("Medical Attention", block)
        self.assertIn("ASSISTANT: Short answer?", block)

    def test_only_last_three_turns(self) -> None:
        turns = [{"role": "user", "content": f"q{i}"} for i in range(5)]
        block = format_history(turns)
        self.assertNotIn("q1", block)
        self.assertIn("q4", block)

    def test_user_turn_capped(self) -> None:
        block = format_history([{"role": "user", "content": "a" * 1000}])
        self.assertLessEqual(len(block), 300 + len("- USER: \n"))


class TestFollowupTopicStore(unittest.TestCase):
    def setUp(self) -> None:
        self.memory = RedisSessionMemory(window_size=4)
        self.memory._is_fallback = True
        self.memory._r = _InProcessStore(window_size=4)

    def test_round_trip_and_clear(self) -> None:
        self.assertIsNone(self.memory.get_followup_topic("s1"))
        self.memory.set_followup_topic("s1", "newborn sleep")
        self.assertEqual(self.memory.get_followup_topic("s1"), "newborn sleep")
        self.assertIsNone(self.memory.get_followup_topic("s2"))
        self.memory.set_followup_topic("s1", None)
        self.assertIsNone(self.memory.get_followup_topic("s1"))

    def test_reset_clears_topic(self) -> None:
        self.memory.set_followup_topic("s1", "newborn sleep")
        self.memory.reset("s1")
        self.assertIsNone(self.memory.get_followup_topic("s1"))

    def test_key_is_outside_the_session_namespace(self) -> None:
        self.assertFalse(self.memory._followup_key("s1").startswith("chat:session:"))


if __name__ == "__main__":
    unittest.main()
