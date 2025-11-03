# app/product/repo.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# A simple, in-memory product catalog so you can develop and test
# immediately in Jupyter — no real DB or MCP server required yet.
#
# LATER:
# - Replace these functions with calls to your DB or MCP product server.
# - Keep the function names the same so nothing else in your app changes.
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import List
from app.products.models import Product

# ---------------------------------------------------------------------
# Seed catalog (safe postpartum wellness examples).
# Replace or extend these with your real products as you go.
# ---------------------------------------------------------------------
DEMO_PRODUCTS: List[Product] = [
    Product(
        id="p1",
        name="GentleFlow Electric Breast Pump",
        tags=["breast-pump", "lactation", "postpartum"],
        in_stock=True,
        partner="preferred",  # <- preferred partners rank higher
        benefits="Closed system, adjustable suction, multiple flange sizes.",
        usage_note="Start on low suction; ensure correct flange size.",
        contraindications="Stop if pain persists; consult a lactation consultant.",
        url="https://example.com/products/gentleflow",
    ),
    Product(
        id="p2",
        name="Comfort Nipple Cream",
        tags=["nipple-cream", "lactation", "postpartum"],
        in_stock=True,
        partner="standard",
        benefits="Lanolin-free soothing formula for sore nipples.",
        usage_note="Apply a small amount after each feed.",
        url="https://example.com/products/comfort-cream",
    ),
    Product(
        id="p3",
        name="Reusable Nursing Pads",
        tags=["nursing-pads", "breastfeeding", "postpartum"],
        in_stock=True,
        partner="standard",
        benefits="Soft, washable pads to manage leakage.",
        usage_note="Replace when damp; wash with mild detergent.",
        url="https://example.com/products/nursing-pads",
    ),
]


# ---------------------------------------------------------------------
# Query API (used by the tool wrapper)
# ---------------------------------------------------------------------
def search_local_products(query: str, limit: int = 3) -> List[Product]:
    """
    INPUT:
      query: user text like "best breast pump"
      limit: max number of products to return

    OUTPUT:
      A ranked list of Product objects.

    SIMPLE RANKING:
      1) Basic match if any query token appears in product name or tags.
      2) Rank "preferred" partners first.
      3) Among equals, show in-stock before out-of-stock.
    """
    if not query:
        return []

    q = query.lower().split()  # naive tokenization
    hits: List[Product] = []

    for p in DEMO_PRODUCTS:
        hay = " ".join([p.name] + p.tags).lower()
        if any(tok in hay for tok in q):
            hits.append(p)

    # Sort by partner preference & stock.
    # (False < True) so we invert conditions to push preferred/in-stock to the front.
    hits.sort(key=lambda x: (x.partner != "preferred", not x.in_stock))

    return hits[:limit]


# ---------------------------------------------------------------------
# Optional helpers (handy for notebooks while iterating)
# ---------------------------------------------------------------------
def upsert_product(product: Product) -> None:
    """
    Add a product or replace it if the ID already exists.
    This helps you quickly tweak catalog items in notebooks.
    """
    global DEMO_PRODUCTS
    DEMO_PRODUCTS = [p for p in DEMO_PRODUCTS if p.id != product.id] + [product]


def list_products() -> List[Product]:
    """Return all products (useful for smoke tests in notebooks)."""
    return list(DEMO_PRODUCTS)
