"""
Product Directory Tool for Viva Mama Chatbot

Fetches the products the chatbot is allowed to recommend to a specific user.

IMPORTANT — product suppression:
    Some referral programs do not want product recommendations shown to the mothers
    they refer at all. When a user redeems such a code, the Node server writes a
    `products.view` / `LOCKED` entry onto `users.entitlement_overrides`, hides the
    Products tab in the app, and returns an empty list from GET /api/v1/products.

    This tool has to honour the same flag. Without it "hide products" is not true:
    the tab is gone and the API is empty, but Viva AI would still recommend products
    in conversation, which is the one surface the referrer actually notices.

    The rule is owned by the Node server
    (src/services/entitlements/entitlement.config.ts → resolveRule, and
    src/services/products/product-access.service.ts) and mirrored here. Keep the two
    in step.
"""

import logging
from typing import Any, Dict, Optional

from app.mcp.db_connection import get_products_collection, get_users_collection
from bson import ObjectId

logger = logging.getLogger(__name__)

PRODUCTS_VIEW_CAPABILITY = "products.view"
ACCESS_LOCKED = "LOCKED"


def _products_suppressed(user_id: Optional[str]) -> bool:
    """
    Has this user's referral program switched product recommendations off?

    Fails OPEN on every uncertainty — no user id, a malformed one, a lookup error —
    matching `_resolve_referred_expert_id` in get_experts_tool.py. A database blip
    should degrade to the normal experience, not silently strip a feature from
    everyone.
    """
    if not user_id:
        return False

    try:
        object_id = ObjectId(user_id)
    except Exception:
        logger.warning("Product directory: malformed user_id, serving unfiltered")
        return False

    try:
        users = get_users_collection()
        user_doc = users.find_one({"_id": object_id}, {"entitlement_overrides": 1})
    except Exception as e:
        logger.error(f"Product directory: user lookup failed ({e}), serving unfiltered")
        return False

    overrides = (user_doc or {}).get("entitlement_overrides") or []
    return any(
        o.get("capability") == PRODUCTS_VIEW_CAPABILITY and o.get("access") == ACCESS_LOCKED
        for o in overrides
    )


def get_all_products(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch the products this user may be recommended.

    Args:
        user_id: The user's Mongo _id as a string. Omitted means no suppression
                 check — kept optional so existing callers keep working.

    Returns:
        Dict containing list of product name, price range and safety flag
    """
    try:
        if _products_suppressed(user_id):
            logger.info("Product directory: suppressed for this user, returning none")
            return {"found": False, "products": [], "count": 0, "suppressed": True}

        products_col = get_products_collection()
        cursor = products_col.find(
            {},
            {
                "_id": 0,
                "productName": 1,
                "productPriceRange": 1,
                "safetyFlag": 1,
                "validWeekStart": 1,
                "validWeekEnd": 1,
            },
        )
        product_list = list(cursor)

        return {
            "found": len(product_list) > 0,
            "products": product_list,
            "count": len(product_list),
        }
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        return {"found": False, "products": [], "error": str(e)}


def format_products_for_prompt(products_data: Dict[str, Any]) -> str:
    """
    Format the product list into a single string for the prompt.

    Args:
        products_data: Dict returned by get_all_products()

    Returns:
        Formatted string for injection into the system prompt
    """
    if not products_data.get("found"):
        return ""

    products = products_data.get("products", [])
    if not products:
        return ""

    prompt_lines = []

    for product in products:
        name = product.get("productName", "Unknown Product")
        price_range = product.get("productPriceRange", "Unknown Price Range")
        safety_flag = product.get("safetyFlag", "Unknown Safety Flag")
        week_start = product.get("validWeekStart", 0)
        week_end = product.get("validWeekEnd", 52)
        prompt_lines.append(
            f"- {name}, {price_range}, {safety_flag}, (Valid: Week {week_start}-{week_end})"
        )

    return "\n".join(prompt_lines)
