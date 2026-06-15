from __future__ import annotations

from typing import Any, Dict, List

import httpx

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

# =========================================================
# MCP SERVER SETUP
# =========================================================

server = Server("product-management-server")

PRODUCT_API_URL = "http://localhost:8000/api/products"


# =========================================================
# API HELPERS
# =========================================================

async def search_products_api(name: str, limit: int = 3) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(
            f"{PRODUCT_API_URL}/search",
            params={"name": name, "limit": limit}
        )
        return res.json() if res.status_code == 200 else []


async def delete_product_api(name: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.delete(
            f"{PRODUCT_API_URL}/delete",
            params={"name": name}
        )
        if res.status_code == 200:
            return {"success": True, "message": f"Product '{name}' deleted"}
        return {"success": False, "message": "Delete failed"}


async def add_product_api(product: Dict[str, Any]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{PRODUCT_API_URL}/add",
            json=product
        )
        if res.status_code == 200:
            return {"success": True, "message": "Product added", "data": res.json()}
        return {"success": False, "message": "Add failed"}


# =========================================================
# MCP TOOL REGISTRATION
# =========================================================

@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """
    The LLM sees these tools and decides which one to call.
    """
    return [
        types.Tool(
            name="search_products",
            description=(
                "Search postpartum wellness products. "
                "Use when the user asks which product is best, recommendations, or comparisons."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "limit": {"type": "integer", "default": 3}
                },
                "required": ["name"]
            }
        ),
        types.Tool(
            name="delete_product",
            description=(
                "Delete a product from the catalog. "
                "Use when the user says delete, remove, or get rid of a product."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"}
                },
                "required": ["name"]
            }
        ),
        types.Tool(
            name="add_product",
            description=(
                "Add a new product to the catalog. "
                "Use when the user wants to add or create a new product."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "product": {"type": "object"}
                },
                "required": ["product"]
            }
        ),
    ]


# =========================================================
# MCP TOOL EXECUTION (NO LOGIC HERE)
# =========================================================

@server.call_tool()
async def call_tool(
    name: str,
    arguments: Dict[str, Any]
) -> list[types.TextContent]:
    """
    MCP calls this AFTER the LLM has already selected the tool.
    """

    if name == "search_products":
        products = await search_products_api(
            arguments["name"],
            arguments.get("limit", 3)
        )
        return [
            types.TextContent(
                type="text",
                text=str({
                    "tool": "search_products",
                    "products": products,
                    "count": len(products)
                })
            )
        ]

    if name == "delete_product":
        result = await delete_product_api(arguments["name"])
        return [
            types.TextContent(type="text", text=str(result))
        ]

    if name == "add_product":
        result = await add_product_api(arguments["product"])
        return [
            types.TextContent(type="text", text=str(result))
        ]

    raise ValueError(f"Unknown tool: {name}")


# =========================================================
# SERVER ENTRYPOINT
# =========================================================

async def main():
    async with stdio_server(server):
        await server.wait_closed()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
