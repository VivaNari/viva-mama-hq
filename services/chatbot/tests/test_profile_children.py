"""
Unit tests: the baby (users.childs[]) reaches the chatbot's user profile.

Without it, postpartum answers could not mention the baby's age or how she feeds,
which is most of what makes a feeding / sleep / recovery answer personal.
"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.mcp.tools.get_user_profile_tool import (
    _format_children_sentence,
    format_profile_for_prompt,
    summarize_children,
)

NOW = datetime(2026, 10, 17, 6, 0, tzinfo=timezone.utc)


class TestSummarizeChildren(unittest.TestCase):
    def test_age_in_weeks_then_months(self) -> None:
        kids = summarize_children(
            [
                {"name": "Asha", "sex": "Female", "date_of_birth": datetime(2026, 9, 1),
                 "feeding_method": "only_breastmilk"},
                {"name": "Kabir", "sex": "Male", "date_of_birth": datetime(2026, 3, 1),
                 "feeding_method": "mixed"},
                {"name": "Tiny", "date_of_birth": datetime(2026, 10, 15)},
            ],
            NOW,
        )
        self.assertEqual([k["age_text"] for k in kids], ["6 weeks old", "7 months old", "2 days old"])
        self.assertEqual(kids[0]["sex"], "female")

    def test_bad_or_missing_dob_has_no_age(self) -> None:
        kids = summarize_children(
            [{"name": "X", "date_of_birth": None}, {"name": "Y", "date_of_birth": datetime(2027, 1, 1)}],
            NOW,
        )
        self.assertEqual([k["age_text"] for k in kids], ["", ""])

    def test_sentence(self) -> None:
        kids = summarize_children(
            [{"name": "Asha", "sex": "Female", "date_of_birth": datetime(2026, 9, 1),
              "feeding_method": "only_breastmilk"}],
            NOW,
        )
        self.assertEqual(
            _format_children_sentence(kids),
            "Her baby: Asha (girl), 6 weeks old, exclusively breastfed.",
        )
        self.assertEqual(_format_children_sentence([]), "")

    def test_profile_prompt_includes_baby(self) -> None:
        kids = summarize_children(
            [{"name": "Asha", "sex": "Female", "date_of_birth": datetime(2026, 9, 1),
              "feeding_method": "not_breastfeeding"}],
            NOW,
        )
        text = format_profile_for_prompt(
            {"found": True, "preferred_name": "Sumi", "stage": "postpartum", "week": 7,
             "days": 2, "children": kids, "is_breastfeeding": False}
        )
        self.assertIn("Her baby: Asha (girl), 6 weeks old, formula-fed (not breastfed).", text)
        self.assertIn("She is not currently breastfeeding.", text)


if __name__ == "__main__":
    unittest.main()
