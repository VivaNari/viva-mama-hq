"""
Expert Directory Tool for Viva Mama Chatbot

Fetches the experts the chatbot is allowed to recommend to a specific user.

IMPORTANT — visibility:
    Two rules narrow the directory, and both are owned by the Node server
    (ExpertService.getVisibleExperts) and mirrored here so the chatbot's prompt
    directory matches the expert list the user can actually see in the app. Keep
    the two in step.

    1. In-person-only experts (`remuneration` of 0) are visible to their own referred
       patients and to nobody else. They take no bookings through the app at all —
       they see their patients at their own clinic — so recommending one to anyone
       else offers a consultation that cannot be arranged.
    2. A user who signed up through an expert's referral code has that expert stored
       on `users.referred_by_expert_id`. For the *category* that expert belongs to,
       she may only ever be shown her own referrer — the app never lists a competing
       expert in that category. Every other category stays fully visible.
"""

import logging
from typing import Any, Dict, List, Optional

from app.experts.formatting import format_experts_for_prompt
from app.mcp.db_connection import (
    get_expert_categories_collection,
    get_experts_collection,
    get_users_collection,
)
from bson import ObjectId

# Re-exported so existing callers keep importing it from here; the implementation
# lives in app.experts.formatting, which has no DB import.
__all__ = ["get_all_experts", "format_experts_for_prompt"]

logger = logging.getLogger(__name__)


def _resolve_referred_expert_id(user_id: Optional[str]) -> Optional[str]:
    """
    Look up the expert whose referral code this user signed up with.

    Returns the id as a string, or None when there is no user, no referral, or
    the lookup fails — every one of which means "apply no filtering".
    """
    if not user_id:
        return None

    try:
        object_id = ObjectId(user_id)
    except Exception:
        logger.warning("Expert directory: malformed user_id, serving unfiltered")
        return None

    try:
        users = get_users_collection()
        user_doc = users.find_one({"_id": object_id}, {"referred_by_expert_id": 1})
    except Exception as e:
        logger.error(f"Expert directory: user lookup failed ({e}), serving unfiltered")
        return None

    referred_id = (user_doc or {}).get("referred_by_expert_id")
    return str(referred_id) if referred_id else None


def _is_in_person_only(expert: Dict[str, Any]) -> bool:
    """
    Whether this expert consults in person only and can never be booked in the app.

    Mirrors ExpertService.isInPersonOnlyExpert on the Node side, including its
    defensiveness: a missing or non-numeric remuneration is as unbookable as an
    explicit zero.
    """
    try:
        return float(expert.get("remuneration")) <= 0
    except (TypeError, ValueError):
        return True


def _apply_in_person_visibility(
    experts: List[Dict[str, Any]],
    referred_expert_id: Optional[str],
) -> List[Dict[str, Any]]:
    """
    Drop in-person-only experts, keeping the user's own referring doctor.

    Applied before the category rule and to every user, including those with no
    referral — an in-person-only doctor must never surface as a stranger's suggestion.
    """
    return [
        e for e in experts if not _is_in_person_only(e) or str(e.get("_id")) == referred_expert_id
    ]


def _apply_referral_visibility(
    experts: List[Dict[str, Any]],
    referred_expert_id: Optional[str],
) -> tuple[List[Dict[str, Any]], bool]:
    """
    Keep the referring expert, and drop every *other* expert sharing her category.

    Mirrors expert.controller.ts. The `if not referred` guard matters: when the
    referring expert is inactive or deleted she is absent from the active list, and
    the app then falls back to showing everyone — so we must too, or the chatbot
    would offer a narrower set than the screen the user is looking at.
    """
    if not referred_expert_id:
        return experts, False

    referred = next(
        (e for e in experts if str(e.get("_id")) == referred_expert_id),
        None,
    )
    if not referred:
        return experts, False

    referred_category = str(referred.get("category"))
    filtered = [
        e
        for e in experts
        if str(e.get("_id")) == referred_expert_id or str(e.get("category")) != referred_category
    ]
    return filtered, True


def _category_names(experts: List[Dict[str, Any]]) -> Dict[str, str]:
    """Map category ObjectId (as string) → display name, in one round trip."""
    category_ids = {e.get("category") for e in experts if e.get("category")}
    if not category_ids:
        return {}

    try:
        categories = get_expert_categories_collection().find(
            {"_id": {"$in": list(category_ids)}},
            {"_id": 1, "name": 1},
        )
        return {str(c["_id"]): c.get("name", "") for c in categories}
    except Exception as e:
        # A missing category name only costs the prompt a hint; never fail the call.
        logger.warning(f"Expert directory: category lookup failed ({e})")
        return {}


def _name_variants(expert: Dict[str, Any]) -> List[str]:
    """
    Every spelling of this expert's name we might have to recognise in an answer.

    The assistant replies in the user's language, so a Hindi turn can name the
    expert using her `translations.hi.name`. Collecting the variants here lets the
    suggestion matcher (app/experts/suggestion.py) work in any language without
    knowing which one the reply used.
    """
    variants = []
    base_name = expert.get("name")
    if base_name:
        variants.append(base_name)

    translations = expert.get("translations") or {}
    if isinstance(translations, dict):
        for bundle in translations.values():
            if isinstance(bundle, dict):
                translated = bundle.get("name")
                if translated and translated not in variants:
                    variants.append(translated)

    return variants


def get_all_experts(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch the active experts this user is allowed to be recommended.

    Args:
        user_id: The user's MongoDB ObjectId as a string. When omitted the full
            active directory is returned (no referral scoping possible).

    Returns:
        Dict with:
            found: bool
            experts: list of {id, name, speciality, category_name, name_variants}
            count: int
            filtered_by_referral: bool — whether the referral rule narrowed the list
    """
    try:
        experts_col = get_experts_collection()
        # `isActive: True` exactly, matching the app's own expert list — an expert
        # document missing the field is invisible in both places.
        cursor = experts_col.find(
            {"isActive": True},
            {
                "_id": 1,
                "name": 1,
                "speciality": 1,
                "category": 1,
                "translations": 1,
                # Not shown to the model; read only to decide visibility.
                "remuneration": 1,
            },
        )
        experts = list(cursor)

        referred_expert_id = _resolve_referred_expert_id(user_id)
        experts = _apply_in_person_visibility(experts, referred_expert_id)
        experts, filtered_by_referral = _apply_referral_visibility(experts, referred_expert_id)

        if filtered_by_referral:
            logger.info(
                f"Expert directory scoped to referral for user {user_id}: "
                f"{len(experts)} experts visible"
            )

        category_names = _category_names(experts)

        # ObjectIds are stringified here: the MCP layer JSON-serialises this dict.
        expert_list = [
            {
                "id": str(e["_id"]),
                "name": e.get("name", ""),
                "speciality": e.get("speciality", ""),
                "category_name": category_names.get(str(e.get("category")), ""),
                "name_variants": _name_variants(e),
            }
            for e in experts
        ]

        return {
            "found": len(expert_list) > 0,
            "experts": expert_list,
            "count": len(expert_list),
            "filtered_by_referral": filtered_by_referral,
        }
    except Exception as e:
        logger.error(f"Error fetching experts: {str(e)}")
        return {
            "found": False,
            "experts": [],
            "error": str(e),
        }
