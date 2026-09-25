"""
User Profile Context Tool for Viva Mama Chatbot

Fetches a user's profile from MongoDB and formats it for the chatbot prompt.

STAGE IS THE POINT. VivaMama serves women across the whole perinatal arc, and the
server stores ONE `current_weekdays.weeks` field that means two different things:

    user_category "NP"  ->  gestational week — how many weeks PREGNANT she is
    user_category "PP"  ->  postpartum week, 1-INDEXED (delivery day is week 1)
    user_category "NN"  ->  meaningless; the schema default

Reading that number without its stage is how a 35-weeks-pregnant user came to be
described to the LLM as "postpartum week 35, day 4 (249 days after delivery)".
Everything below is written so a week can never be printed without its stage.

A second trap, which took down the whole pregnant-user path in production: fields
like `delivery_type` are declared `default: null` in the server's user schema, so
the key EXISTS holding None. `dict.get(key, "")` returns that None — the default
only fires for a MISSING key — and `None.lower()` raised, which crashed the tool
and left the model with no profile at all. Normalise with `or ""`, never a
`.get()` default, before any string operation.

Mirrors `calculatePostpartumState` in the core server
(src/utils/functions/postpartumWeek.ts) — keep the two in step.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.mcp.db_connection import get_users_collection
from bson import ObjectId

logger = logging.getLogger(__name__)

# --- Stage vocabulary -------------------------------------------------------

STAGE_PREGNANCY = "pregnancy"
STAGE_POSTPARTUM = "postpartum"
STAGE_NOT_PREGNANT = "not_pregnant"

_CATEGORY_TO_STAGE = {
    "NP": STAGE_PREGNANCY,
    "PP": STAGE_POSTPARTUM,
    "NN": STAGE_NOT_PREGNANT,
}

# Naegele's rule: a full-term pregnancy is 40 weeks from the last menstrual period.
FULL_TERM_DAYS = 280
DAYS_PER_WEEK = 7

# The server measures week boundaries on IST calendar days, not elapsed milliseconds.
IST = timezone(timedelta(hours=5, minutes=30))


def _to_utc(value: datetime) -> datetime:
    """
    Normalise a datetime to aware UTC. pymongo hands back NAIVE datetimes that are
    already UTC, so a missing tzinfo is stamped rather than converted.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _ist_calendar_days_between(start: datetime, end: datetime) -> int:
    """
    Whole IST calendar days from `start` to `end`, mirroring the server's
    `istCalendarDaysBetween`. A user who delivered "yesterday" is 1 day postpartum
    from IST midnight regardless of the clock time either value carries.
    """
    start_day = _to_utc(start).astimezone(IST).date()
    end_day = _to_utc(end).astimezone(IST).date()
    return (end_day - start_day).days


def calculate_postpartum_days(
    delivery_date: Optional[datetime],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Derive stage, week and day-in-week from a delivery date.

    This is the FALLBACK, used only when the server has not persisted
    `current_weekdays` yet. It deliberately reproduces `calculatePostpartumState`:
    postpartum weeks are 1-indexed (delivery day is week 1) and a future delivery
    date yields a gestational week, not zero.

    Args:
        delivery_date: The user's delivery date (past = delivered, future = due)
        now: Injectable clock, for tests

    Returns:
        dict: {"stage": str, "weeks": int, "days": int}

    Example:
        Delivered 30 days ago -> {"stage": "postpartum", "weeks": 5, "days": 2}
        Due in 35 days        -> {"stage": "pregnancy",  "weeks": 35, "days": 0}
    """
    # A non-datetime here (legacy string rows) is unusable for arithmetic — say so
    # rather than raising, which is the failure mode that took this tool down before.
    if not isinstance(delivery_date, datetime):
        return {"stage": STAGE_NOT_PREGNANT, "weeks": 0, "days": 0}

    now = now or datetime.now(timezone.utc)
    days_since_delivery = _ist_calendar_days_between(delivery_date, now)

    if days_since_delivery < 0:
        days_until_delivery = -days_since_delivery
        # Clamp: a due date more than 40 weeks out would otherwise go negative.
        gestational_days = max(0, FULL_TERM_DAYS - days_until_delivery)
        return {
            "stage": STAGE_PREGNANCY,
            "weeks": gestational_days // DAYS_PER_WEEK,
            "days": gestational_days % DAYS_PER_WEEK,
        }

    return {
        "stage": STAGE_POSTPARTUM,
        # 1-indexed, matching the server: the delivery day itself is week 1.
        "weeks": (days_since_delivery // DAYS_PER_WEEK) + 1,
        "days": days_since_delivery % DAYS_PER_WEEK,
    }


def resolve_stage(
    user_category: Optional[str],
    delivery_date: Optional[datetime],
    now: Optional[datetime] = None,
) -> str:
    """
    Decide which stage the user is in, from her category cross-checked against her
    delivery date.

    `user_category` is the server's own label and is normally authoritative, but it
    is flipped NP->PP by a nightly cron at 00:05 IST while the week numbers are
    rewritten at 00:15. Inside that ten-minute window the two disagree. The week
    number derives from the delivery date, so when category and date conflict we
    follow the DATE — that keeps the stage label and the number it labels
    consistent by construction.

    NN is the exception: it wins outright. A woman who delivered two years ago and
    is no longer pregnant has a long-past delivery date, and trusting the date
    there would wrongly reopen her postpartum window.
    """
    category_stage = _CATEGORY_TO_STAGE.get((user_category or "").strip().upper())

    if category_stage == STAGE_NOT_PREGNANT:
        return STAGE_NOT_PREGNANT

    # No usable date to cross-check against — the category is all we have.
    if not isinstance(delivery_date, datetime):
        return category_stage or STAGE_NOT_PREGNANT

    date_stage = calculate_postpartum_days(delivery_date, now)["stage"]

    if category_stage and category_stage != date_stage:
        logger.warning(
            "user_category=%s disagrees with delivery_date (implies %s); "
            "trusting the date so the stage matches the week number",
            user_category,
            date_stage,
        )

    return date_stage


def _text(value: Any) -> str:
    """
    Coerce a possibly-null Mongo field to a safe string.

    Never use `.get(key, "")` for this: the server declares these fields
    `default: null`, so the key exists holding None and the default never fires.
    """
    if value is None:
        return ""
    return str(value).strip()


def _format_date(value: Any) -> str:
    """Render a date for the prompt as plain YYYY-MM-DD."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    text = _text(value)
    return text[:10] if len(text) >= 10 else text


def get_user_profile(user_id: str) -> Dict[str, Any]:
    """
    Fetch user profile data from MongoDB and format it for the chatbot.

    Args:
        user_id: The MongoDB ObjectId of the user (as string)

    Returns:
        dict: Formatted user profile data with these keys:
            - user_id: str
            - found: bool (whether user exists)
            - preferred_name: str
            - user_category: str ("PP" | "NP" | "NN")
            - stage: str ("postpartum" | "pregnancy" | "not_pregnant")
            - week: int (postpartum week if PP, gestational week if NP, 0 if NN)
            - days: int (day index inside that week, 0-6)
            - delivery_date: str (ISO date; the date she DELIVERED, PP only)
            - due_date: str (ISO date; the date she is EXPECTED to deliver, NP only)
            - postpartum_week / postpartum_days: int — legacy aliases, populated
              ONLY when stage is postpartum so a gestational number can never be
              read out of a postpartum-named field
            - delivery_type, delivery_outcome, is_breastfeeding, location,
              social_support, current_medications, past_medications,
              pregnancy_conditions, conception_method, parity, tobacco_use,
              alcohol_use

        If user not found:
            {"user_id": user_id, "found": False, "error": "..."}

    Example:
        >>> profile = get_user_profile("507f1f77bcf86cd799439011")
        >>> profile["stage"], profile["week"]
        ('pregnancy', 35)
    """
    try:
        # Convert string user_id to ObjectId for MongoDB query
        try:
            object_id = ObjectId(user_id)
        except Exception:
            # If conversion fails, try using user_id as is (might be an integer)
            object_id = user_id

        users = get_users_collection()

        user_doc = users.find_one(
            {
                "$or": [
                    {"_id": object_id if isinstance(object_id, ObjectId) else None},
                ]
            }
        )

        if not user_doc:
            return {"user_id": user_id, "found": False, "error": "User not found in database"}

        # Extract onboarding data (this is where most profile info lives)
        onboarding = user_doc.get("onboarding_data") or {}

        # For a PP user this is when she delivered; for an NP user it is when she
        # is DUE. One field, two meanings — hence the stage resolution below.
        delivery_date = onboarding.get("delivery_date")

        user_category = _text(user_doc.get("user_category")).upper()
        stage = resolve_stage(user_category, delivery_date)

        # Prefer the server's persisted numbers — they are the same values the app
        # shows her, so the chatbot and the UI agree. Fall back to local derivation
        # only when the week cron has not run for this user yet.
        current_weekdays = user_doc.get("current_weekdays") or {}

        if current_weekdays.get("weeks") is not None:
            week = current_weekdays.get("weeks") or 0
            days = current_weekdays.get("days") or 0
        elif delivery_date:
            derived = calculate_postpartum_days(delivery_date)
            week = derived["weeks"]
            days = derived["days"]
        else:
            week = 0
            days = 0

        # An NN user's week is the schema default and means nothing — do not carry
        # it forward, or it will be printed as though it did.
        if stage == STAGE_NOT_PREGNANT:
            week = 0
            days = 0

        date_str = _format_date(delivery_date) if delivery_date else None

        profile = {
            "user_id": str(user_doc.get("_id")),
            "found": True,
            # Basic identity
            "preferred_name": _text(onboarding.get("preferred_name")),
            # Perinatal timeline — always read `stage` before `week`
            "user_category": user_category,
            "stage": stage,
            "week": week,
            "days": days,
            "delivery_date": date_str if stage == STAGE_POSTPARTUM else None,
            "due_date": date_str if stage == STAGE_PREGNANCY else None,
            # Legacy aliases, postpartum-only by construction
            "postpartum_week": week if stage == STAGE_POSTPARTUM else None,
            "postpartum_days": days if stage == STAGE_POSTPARTUM else None,
            # Delivery details
            "delivery_type": _text(onboarding.get("delivery_type")),
            "delivery_outcome": _text(onboarding.get("delivery_outcome")),
            # Current status
            "is_breastfeeding": user_doc.get("is_breastfeeding_currently", None),
            # Demographics and support
            "location": _text(onboarding.get("location")),
            "social_support": _text(onboarding.get("social_support")),
            # Medical history
            "current_medications": onboarding.get("current_medications") or [],
            "past_medications": onboarding.get("past_medications") or [],
            "pregnancy_conditions": onboarding.get("pregnancy_conditions") or [],
            # Reproductive history
            "conception_method": _text(onboarding.get("conception_method")),
            "parity": _text(onboarding.get("parity")),
            # Lifestyle factors (relevant for recommendations)
            "tobacco_use": _text(onboarding.get("tobacco_use")),
            "alcohol_use": _text(onboarding.get("alcohol_use")),
        }

        return profile

    except Exception as e:
        logger.error("Failed to fetch user profile for user_id=%s: %s", user_id, e)
        return {"user_id": user_id, "found": False, "error": f"Error fetching profile: {str(e)}"}


def _format_stage_sentence(profile: Dict[str, Any], name: str) -> str:
    """
    The opening sentence, branched on stage.

    This is the sentence the model reasons from when a user asks "what's happening
    this week", so it states the stage explicitly and, for a pregnant user, says
    outright that postpartum guidance does not apply. A bare stage label is too
    easy to skim past.
    """
    stage = profile.get("stage")
    week = profile.get("week") or 0
    days = profile.get("days") or 0

    if stage == STAGE_PREGNANCY:
        due_date = _text(profile.get("due_date"))
        due_clause = f", with an expected delivery date of {due_date}" if due_date else ""
        return (
            f"You are assisting {name}, who is currently PREGNANT: she is in week {week} "
            f"of pregnancy ({week} weeks and {days} days gestation){due_clause}. "
            f"She has NOT delivered yet — postpartum recovery and newborn-care guidance "
            f"do not apply to her."
        )

    if stage == STAGE_POSTPARTUM:
        # The stored week is 1-indexed (delivery day is week 1), so elapsed time is
        # one week less than the label. Give both: the label matches what the app
        # shows her, the elapsed figure is what clinical guidance keys off.
        elapsed_weeks = max(0, week - 1)
        delivery_date = _text(profile.get("delivery_date"))
        delivered_clause = f", having delivered on {delivery_date}" if delivery_date else ""
        return (
            f"You are assisting {name}, who is in postpartum week {week} "
            f"({elapsed_weeks} weeks and {days} days since delivery){delivered_clause}."
        )

    return (
        f"You are assisting {name}. She is not currently pregnant and has no active "
        f"pregnancy or postpartum week."
    )


def format_profile_for_prompt(profile: Dict[str, Any]) -> str:
    """
    Format the user profile into a natural language string for the LLM prompt.

    Every field is read through `_text`/truthiness guards: the server declares most
    onboarding fields `default: null`, and NP users legitimately have null delivery
    details, so any unguarded string operation here takes down the whole profile.

    Args:
        profile: The profile dict returned by get_user_profile()

    Returns:
        str: Natural language description of the user

    Example:
        >>> format_profile_for_prompt(get_user_profile("123"))
        "You are assisting Priya, who is in postpartum week 5 (4 weeks and 2 days
        since delivery), having delivered on 2026-08-02. She had a vaginal delivery..."
    """
    if not profile.get("found"):
        return "No user profile information available."

    parts = []

    name = _text(profile.get("preferred_name")) or "the user"
    stage = profile.get("stage")

    parts.append(_format_stage_sentence(profile, name))

    # Delivery details. All null for a pregnant user, so these drop out on their own.
    delivery_type = _text(profile.get("delivery_type")).lower()
    if delivery_type:
        if delivery_type == "c-section":
            parts.append("She had a cesarean section delivery.")
        elif delivery_type == "vaginal":
            parts.append("She had a vaginal delivery.")
        else:
            parts.append(f"Delivery type: {delivery_type}.")

    delivery_outcome = _text(profile.get("delivery_outcome"))
    if delivery_outcome == "still_birth":
        parts.append("The delivery resulted in a stillbirth.")
    elif delivery_outcome == "live_birth":
        parts.append("The delivery resulted in a live birth.")

    # Breastfeeding status
    is_bf = profile.get("is_breastfeeding")
    if is_bf is True:
        parts.append("She is currently breastfeeding.")
    elif is_bf is False:
        parts.append("She is not currently breastfeeding.")

    # Support system
    social_support = _text(profile.get("social_support"))
    if social_support:
        parts.append(f"Social support: {social_support}.")

    # Medical considerations
    conditions = profile.get("pregnancy_conditions") or []
    if conditions:
        parts.append(f"Pregnancy conditions: {', '.join(str(c) for c in conditions)}.")

    # Parity is the LAST onboarding question, so an empty value means "not asked
    # yet" — never "first birth". Asserting either way here fabricated a fact for
    # every user who had not finished onboarding.
    parity = _text(profile.get("parity"))
    if parity == "multiparous":
        parts.append("She has had a child before.")
    elif parity == "first_time":
        parts.append(
            "This is her first pregnancy."
            if stage == STAGE_PREGNANCY
            else "This is her first birth."
        )

    medications = profile.get("current_medications") or []
    if medications:
        parts.append(f"Current medications: {', '.join(str(m) for m in medications)}.")

    past_medications = profile.get("past_medications") or []
    if past_medications:
        parts.append(f"Past medications: {', '.join(str(m) for m in past_medications)}.")

    tobacco_use = _text(profile.get("tobacco_use"))
    if tobacco_use:
        parts.append(f"Tobacco use: {tobacco_use}.")

    alcohol_use = _text(profile.get("alcohol_use"))
    if alcohol_use:
        parts.append(f"Alcohol use: {alcohol_use}.")

    # Location (useful for cultural context)
    location = _text(profile.get("location"))
    if location:
        parts.append(f"Location: {location}.")

    return " ".join(parts)


# Convenience function for quick testing
def print_user_profile(user_id: str) -> None:
    """
    Fetch and print a user's profile in a readable format.
    Useful for testing and debugging.

    Args:
        user_id: The user's MongoDB ObjectId or user_id
    """
    profile = get_user_profile(user_id)

    if not profile.get("found"):
        print(f"❌ User {user_id} not found")
        print(f"   Error: {profile.get('error', 'Unknown error')}")
        return

    print(f"\n{'=' * 60}")
    print(f"User Profile: {profile.get('preferred_name') or 'Unknown'}")
    print(f"{'=' * 60}\n")

    print(f"User ID: {profile['user_id']}")
    print(f"Category: {profile.get('user_category') or 'N/A'}  ->  stage: {profile['stage']}")

    if profile["stage"] == STAGE_PREGNANCY:
        print(f"Pregnancy: week {profile['week']}, day {profile['days']}")
        print(f"Due date: {profile.get('due_date') or 'N/A'}")
    elif profile["stage"] == STAGE_POSTPARTUM:
        print(f"Postpartum: week {profile['week']}, day {profile['days']}")
        print(f"Delivered: {profile.get('delivery_date') or 'N/A'}")
        print(f"Delivery: {profile.get('delivery_type') or 'N/A'}")
    else:
        print("Not currently pregnant — no week applies.")

    print(f"Breastfeeding: {profile.get('is_breastfeeding', 'N/A')}")
    print(f"Location: {profile.get('location') or 'N/A'}")
    print(f"Support: {profile.get('social_support') or 'N/A'}")

    if profile.get("pregnancy_conditions"):
        print(f"Conditions: {', '.join(profile['pregnancy_conditions'])}")

    if profile.get("current_medications"):
        print(f"Medications: {', '.join(profile['current_medications'])}")

    print(f"\n{'=' * 60}")
    print("Formatted for LLM:")
    print(f"{'=' * 60}\n")
    print(format_profile_for_prompt(profile))
    print()
