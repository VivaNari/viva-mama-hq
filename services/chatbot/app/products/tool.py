# app/product/tool.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# This is the function the chatbot will call to get product suggestions.
#
# Right now:
#   - It uses the local in-memory product list (fast + simple).
#
# Later:
#   - When your MCP product server is ready, you will just flip one
#     setting (PRODUCTS_SOURCE=mcp) in the .env file.
#   - No changes anywhere else.
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import List, Dict, Any
from app.settings import settings
from app.products.repo import search_local_products


def search_products_tool(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """
    INPUT:
      query: user question text — example: "Which breast pump should I use?"
      limit: how many products to return (default = 3)

    OUTPUT:
      A list of product dictionaries, safe to return directly to:
      - The LLM
      - A UI layer
      - An API response
      (Because .model_dump() makes them clean JSON objects)

    HOW IT BEHAVES TODAY (local mode):
      - Searches our DEMO_PRODUCTS list with smart ranking.
      - Returns the best matching products.

    HOW IT WILL BEHAVE LATER (MCP mode):
      - It will call your MCP product service.
      - No code changes — only a config switch.
    """

    # If later you set PRODUCTS_SOURCE=mcp in .env,
    # this automatically routes to MCP instead of local.
    if settings.products_source == "mcp":
        from app.mcp.adapter import mcp_search_products  # lazy import to avoid dependency issues
        products = mcp_search_products(query, limit=limit)
    else:
        products = search_local_products(query, limit=limit)

    # Convert Product objects → dictionaries so LLM/UI can read them
    return [p.model_dump() for p in products]
