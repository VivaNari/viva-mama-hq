"""
Unit tests: perinatal stage handling in the user-profile MCP tool.

These are pure-function tests over `format_profile_for_prompt`, `resolve_stage` and
`calculate_postpartum_days` — no database, no MCP subprocess.

Two production incidents are pinned here:

1. `format_profile_for_prompt` raised `'NoneType' object has no attribute 'lower'`
   for every pregnant user, because `delivery_type` is stored as null and
   `.get(key, "")` returns the stored None. The exception escaped to the MCP
   `call_tool` wrapper, the pipeline saw an error payload, and the model was given
   NO profile at all — so Viva told a 35-weeks-pregnant woman it did not know her
   week.

2. The same function labelled every user's week "postpartum week N", including
   women who had not delivered, and inflated the day count by a week for those who
   had (the server's postpartum week is 1-indexed).
"""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from app.mcp.tools.get_user_profile_tool import (
    STAGE_NOT_PREGNANT,
    STAGE_POSTPARTUM,
    STAGE_PREGNANCY,
    calculate_postpartum_days,
    format_profile_for_prompt,
    resolve_stage,
)


def pregnant_profile(**overrides):
    """A 35-weeks-pregnant NP user: every delivery field is null, as the server stores it."""
    profile = {
        "found": True,
        "preferred_name": "Suryanshi",
        "user_category": "NP",
        "stage": STAGE_PREGNANCY,
        "week": 35,
        "days": 4,
        "delivery_date": None,
        "due_date": "2026-10-01",
        "postpartum_week": None,
        "postpartum_days": None,
        "delivery_type": None,
        "delivery_outcome": None,
        "is_breastfeeding": None,
        "location": None,
        "social_support": None,
        "current_medications": [],
        "past_medications": [],
        "pregnancy_conditions": [],
        "conception_method": None,
        "parity": None,
        "tobacco_use": None,
        "alcohol_use": None,
    }
    profile.update(overrides)
    return profile


def postpartum_profile(**overrides):
    """Ziva from the production logs: postpartum week 5, day 2."""
    profile = {
        "found": True,
        "preferred_name": "Ziva",
        "user_category": "PP",
        "stage": STAGE_POSTPARTUM,
        "week": 5,
        "days": 2,
        "delivery_date": "2026-08-02",
        "due_date": None,
        "postpartum_week": 5,
        "postpartum_days": 2,
        "delivery_type": "vaginal",
        "delivery_outcome": "live_birth",
        "is_breastfeeding": True,
        "location": "Hyderabad",
        "social_support": "family_help",
        "current_medications": ["meds_bp"],
        "past_medications": [],
        "pregnancy_conditions": ["thyroid"],
        "conception_method": None,
        "parity": "multiparous",
        "tobacco_use": "never",
        "alcohol_use": "never",
    }
    profile.update(overrides)
    return profile


class NullFieldSafety(unittest.TestCase):
    """Regression for the outage: null onboarding fields must not raise."""

    def test_all_null_delivery_fields_do_not_raise(self):
        text = format_profile_for_prompt(pregnant_profile())
        self.assertIsInstance(text, str)
        self.assertTrue(text)

    def test_every_optional_field_null_at_once(self):
        profile = pregnant_profile(
            preferred_name=None,
            current_medications=None,
            past_medications=None,
            pregnancy_conditions=None,
        )
        text = format_profile_for_prompt(profile)
        self.assertIn("the user", text)

    def test_profile_not_found_is_reported_not_raised(self):
        self.assertEqual(
            format_profile_for_prompt({"found": False, "error": "nope"}),
            "No user profile information available.",
        )


class PregnantFraming(unittest.TestCase):
    def test_states_she_is_pregnant_with_her_week(self):
        text = format_profile_for_prompt(pregnant_profile())
        self.assertIn("PREGNANT", text)
        self.assertIn("week 35 of pregnancy", text)
        self.assertIn("2026-10-01", text)

    def test_never_calls_a_gestational_week_postpartum(self):
        text = format_profile_for_prompt(pregnant_profile())
        self.assertNotIn("postpartum week", text)
        self.assertNotIn("days after delivery", text)

    def test_says_outright_she_has_not_delivered(self):
        # The clause that actually changes model behaviour — a bare stage label is
        # too easy to skim past.
        self.assertIn("NOT delivered yet", format_profile_for_prompt(pregnant_profile()))

    def test_first_time_parity_reads_as_pregnancy_not_birth(self):
        text = format_profile_for_prompt(pregnant_profile(parity="first_time"))
        self.assertIn("first pregnancy", text)


class PostpartumFraming(unittest.TestCase):
    def test_keeps_the_week_label_the_app_shows_her(self):
        self.assertIn("postpartum week 5", format_profile_for_prompt(postpartum_profile()))

    def test_elapsed_time_no_longer_over_counts_by_a_week(self):
        # Week 5 is 1-indexed, so 4 weeks and 2 days have elapsed (~30 days).
        # The old code printed "(37 days after delivery)".
        text = format_profile_for_prompt(postpartum_profile())
        self.assertIn("4 weeks and 2 days since delivery", text)
        self.assertNotIn("37 days", text)

    def test_names_the_delivery_date(self):
        self.assertIn("2026-08-02", format_profile_for_prompt(postpartum_profile()))

    def test_delivery_details_still_render(self):
        text = format_profile_for_prompt(postpartum_profile())
        self.assertIn("vaginal delivery", text)
        self.assertIn("live birth", text)
        self.assertIn("currently breastfeeding", text)

    def test_week_one_does_not_go_negative(self):
        text = format_profile_for_prompt(postpartum_profile(week=1, days=3))
        self.assertIn("0 weeks and 3 days since delivery", text)


class NotPregnantFraming(unittest.TestCase):
    def test_no_week_is_claimed(self):
        profile = pregnant_profile(
            user_category="NN", stage=STAGE_NOT_PREGNANT, week=0, days=0, due_date=None
        )
        text = format_profile_for_prompt(profile)
        self.assertIn("not currently pregnant", text)
        self.assertNotIn("week 0", text)


class ParityIsNeverFabricated(unittest.TestCase):
    def test_unanswered_parity_asserts_nothing(self):
        # Parity is the LAST onboarding question, so empty means "not asked yet".
        # The old `else` branch claimed "This is her first birth." for everyone
        # mid-onboarding.
        text = format_profile_for_prompt(postpartum_profile(parity=None))
        self.assertNotIn("first birth", text)
        self.assertNotIn("first pregnancy", text)
        self.assertNotIn("child before", text)

    def test_multiparous_is_reported(self):
        self.assertIn("child before", format_profile_for_prompt(postpartum_profile()))


class StageResolution(unittest.TestCase):
    """`user_category` cross-checked against the delivery date."""

    def setUp(self):
        self.now = datetime(2026, 9, 1, 5, 0, tzinfo=timezone.utc)

    def test_np_with_future_date_is_pregnancy(self):
        due = self.now + timedelta(days=30)
        self.assertEqual(resolve_stage("NP", due, self.now), STAGE_PREGNANCY)

    def test_pp_with_past_date_is_postpartum(self):
        delivered = self.now - timedelta(days=30)
        self.assertEqual(resolve_stage("PP", delivered, self.now), STAGE_POSTPARTUM)

    def test_date_wins_when_category_is_stale(self):
        # The nightly NP->PP cron runs at 00:05 IST and the week job at 00:15; in
        # that window the category lags the date. The week number derives from the
        # date, so the date decides — otherwise the label and the number disagree.
        delivered = self.now - timedelta(days=1)
        self.assertEqual(resolve_stage("NP", delivered, self.now), STAGE_POSTPARTUM)

    def test_nn_wins_outright_over_an_old_delivery_date(self):
        # A woman who delivered two years ago and is no longer pregnant must not be
        # dragged back into a postpartum window by her historic date.
        long_ago = self.now - timedelta(days=730)
        self.assertEqual(resolve_stage("NN", long_ago, self.now), STAGE_NOT_PREGNANT)

    def test_missing_category_falls_back_to_the_date(self):
        due = self.now + timedelta(days=30)
        self.assertEqual(resolve_stage(None, due, self.now), STAGE_PREGNANCY)

    def test_missing_date_falls_back_to_the_category(self):
        self.assertEqual(resolve_stage("NP", None, self.now), STAGE_PREGNANCY)

    def test_non_datetime_date_does_not_raise(self):
        self.assertEqual(resolve_stage("PP", "2026-08-02", self.now), STAGE_POSTPARTUM)


class WeekArithmeticMatchesTheServer(unittest.TestCase):
    """Mirrors `calculatePostpartumState` in src/utils/functions/postpartumWeek.ts."""

    def setUp(self):
        self.now = datetime(2026, 9, 1, 5, 0, tzinfo=timezone.utc)

    def test_delivery_day_is_postpartum_week_one(self):
        result = calculate_postpartum_days(self.now, self.now)
        self.assertEqual(
            (result["stage"], result["weeks"], result["days"]), (STAGE_POSTPARTUM, 1, 0)
        )

    def test_postpartum_weeks_are_one_indexed(self):
        # 30 days out is week 5, day 2 — matching Ziva in the production logs.
        result = calculate_postpartum_days(self.now - timedelta(days=30), self.now)
        self.assertEqual((result["weeks"], result["days"]), (5, 2))

    def test_future_date_yields_a_gestational_week_not_zero(self):
        # 280 - 35 = 245 days gestation = week 35.
        result = calculate_postpartum_days(self.now + timedelta(days=35), self.now)
        self.assertEqual((result["stage"], result["weeks"]), (STAGE_PREGNANCY, 35))

    def test_absurdly_distant_due_date_clamps_at_zero(self):
        result = calculate_postpartum_days(self.now + timedelta(days=400), self.now)
        self.assertEqual(
            (result["stage"], result["weeks"], result["days"]), (STAGE_PREGNANCY, 0, 0)
        )

    def test_missing_date_is_not_pregnant(self):
        self.assertEqual(calculate_postpartum_days(None)["stage"], STAGE_NOT_PREGNANT)


if __name__ == "__main__":
    unittest.main()
