from __future__ import annotations

from typing import List

from app.products.models import Product
from app.products.repo import search_local_products


def mcp_search_products(query: str, limit: int = 3) -> List[Product]:
    """
    INPUT:
      query: user text (e.g., "best breast pump for returning to work")
      limit: how many products to fetch

    OUTPUT:
      A list of Product objects (same model as local repo).
    """

    products = search_local_products(query, limit=limit)
    return products
