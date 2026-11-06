"""
Hinglish replies rewritten in Devanagari for read-aloud: what comes back must be safe
to speak as health advice, and anything else must be refused rather than read out.
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest import mock

import app.api.main as api
import app.speech.transliterate as tr
from fastapi.testclient import TestClient

SOURCE = "Aapko din mein 2 baar 500 mg iron leni chahiye"
GOOD = "आपको दिन में 2 बार 500 मिलीग्राम आयरन लेनी चाहिए।"


def _llm(content: object) -> SimpleNamespace:
    return SimpleNamespace(invoke=lambda _prompt: SimpleNamespace(content=content))


class TestValidation(unittest.TestCase):
    def test_accepts_a_faithful_conversion(self) -> None:
        self.assertEqual(tr.validate_transliteration(SOURCE, GOOD), GOOD)

    def test_devanagari_digits_count_as_the_same_number(self) -> None:
        output = "आपको दिन में २ बार ५०० मिलीग्राम आयरन लेनी चाहिए।"
        self.assertEqual(tr.validate_transliteration(SOURCE, output), GOOD)

    def test_rejects_a_changed_number(self) -> None:
        with self.assertRaisesRegex(tr.TransliterationError, "numbers"):
            tr.validate_transliteration(SOURCE, GOOD.replace("500", "50"))

    def test_rejects_a_dropped_number(self) -> None:
        with self.assertRaisesRegex(tr.TransliterationError, "numbers"):
            tr.validate_transliteration(SOURCE, GOOD.replace("2 ", ""))

    def test_rejects_output_without_devanagari(self) -> None:
        with self.assertRaisesRegex(tr.TransliterationError, "Devanagari"):
            tr.validate_transliteration(SOURCE, SOURCE)

    def test_rejects_output_mostly_in_roman_script(self) -> None:
        output = "आपको din mein 2 baar 500 mg iron leni chahiye"
        with self.assertRaisesRegex(tr.TransliterationError, "Roman"):
            tr.validate_transliteration(SOURCE, output)

    def test_rejects_a_summary(self) -> None:
        source = " ".join([SOURCE] * 5)
        with self.assertRaisesRegex(tr.TransliterationError, "length"):
            tr.validate_transliteration(source, "आयरन लें।")

    def test_rejects_added_content(self) -> None:
        with self.assertRaisesRegex(tr.TransliterationError, "length"):
            tr.validate_transliteration(SOURCE, GOOD * 5)


class TestEndpoint(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(api.app)
        self.headers = {"X-API-Key": api.API_KEY or "unused"}

    def _post(self, text: str = SOURCE):
        return self.client.post(
            "/v1/speech/transliterate", json={"text": text}, headers=self.headers
        )

    def test_the_prompt_says_how_our_name_is_pronounced(self) -> None:
        self.assertIn("Viva -> वीवा", tr._PROMPT)
        self.assertIn("VivaMama -> वीवामामा", tr._PROMPT)

    def test_returns_the_devanagari_copy(self) -> None:
        with mock.patch.object(tr, "get_llm", return_value=_llm(GOOD)) as get_llm:
            res = self._post()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["text"], GOOD)
        self.assertTrue(get_llm.call_args.kwargs["transliterator"])

    def test_reads_content_returned_as_parts(self) -> None:
        with mock.patch.object(tr, "get_llm", return_value=_llm([{"text": GOOD}])):
            res = self._post()
        self.assertEqual(res.json()["text"], GOOD)

    def test_an_unsafe_conversion_is_a_502_and_is_not_returned(self) -> None:
        wrong = GOOD.replace("500", "5000")
        with mock.patch.object(tr, "get_llm", return_value=_llm(wrong)):
            res = self._post()
        self.assertEqual(res.status_code, 502)
        self.assertNotIn("text", res.json())

    def test_a_provider_failure_does_not_leak_the_reply(self) -> None:
        def boom(_prompt: str) -> None:
            raise RuntimeError(f"failed on {SOURCE}")

        with (
            mock.patch.object(tr, "get_llm", return_value=SimpleNamespace(invoke=boom)),
            self.assertLogs("app.api.main", level="ERROR") as logs,
        ):
            res = self._post()
        self.assertEqual(res.status_code, 500)
        self.assertNotIn("Aapko", "".join(logs.output))
        self.assertNotIn("Aapko", res.text)

    def test_rejects_empty_and_oversized_text(self) -> None:
        self.assertEqual(self._post("").status_code, 422)
        self.assertEqual(self._post("a" * 10001).status_code, 422)


if __name__ == "__main__":
    unittest.main()
