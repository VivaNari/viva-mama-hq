# app/mcp/adapter.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Let the product search "tool" talk to an MCP server *when available*.
# For now, we return local results so your notebook works today.
#
# HOW IT FITS:
#   app/product/tool.py -> (if PRODUCTS_SOURCE=mcp) -> mcp_search_products()
#   This function then tries MCP. If MCP isn't ready, it quietly uses local repo.
#
# WHEN YOU LATER ADD A REAL MCP SERVER:
#   1) Implement the "REAL MCP CALL" block below.
#   2) Keep the function signature the same.
#   3) No other file needs to change.
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import List
from app.products.models import Product
from app.products.repo import search_local_products

# Optional: you can bring in the mcp client when ready
# from mcp import Client  # <-- uncomment when you actually integrate MCP


def mcp_search_products(query: str, limit: int = 3) -> List[Product]:
    """
    INPUT:
      query: user text (e.g., "best breast pump for returning to work")
      limit: how many products to fetch

    OUTPUT:
      A list of Product objects (same model as local repo).
    """

    # ---------------------------------------------------------------
    # REAL MCP CALL (to implement later)
    # ---------------------------------------------------------------
    # Pseudocode (kept here as a guide):
    #
    # client = Client()                         # create MCP client
    # await client.add_server( ... )            # point to your products MCP server
    # await client.start()
    #
    # # Invoke a tool exposed by your MCP server, e.g., "products.search_products"
    # # The return should be a JSON array of product dicts.
    # resp = await client.call_tool(
    #     server_name="products",
    #     tool_name="search_products",
    #     arguments={"query": query, "limit": limit}
    # )
    #
    # # Map JSON -> Product objects
    # products = [Product(**item) for item in resp["items"]]
    #
    # return products
    #
    # Notes:
    # - Apply allowlists/rate-limits in your MCP server.
    # - Ensure your server never returns PHI/PII.
    # - Only include fields defined in Product model.

    # ---------------------------------------------------------------
    # TEMPORARY FALLBACK (works today without MCP)
    # ---------------------------------------------------------------
    # Until your MCP server is live, we reuse the local repo search.
    products = search_local_products(query, limit=limit)
    return products
