"""
Viva Mama MCP Context Server

This MCP server exposes context-fetching tools to the chatbot, allowing it to
retrieve user profiles and recovery data from MongoDB during conversations.

The server implements the Model Context Protocol (MCP) which provides a standard
way for LLMs to access external tools and data sources.

Available Tools:
1. get_user_profile - Fetches user identity, her perinatal stage (pregnant /
   postpartum / not pregnant) and the week within that stage, plus delivery details
2. get_active_recommendations - Fetches recovery scores, recommendations, and ePHI data

Usage:
    This server is meant to be run as a subprocess by the chat pipeline.
    It communicates via stdio (standard input/output).

    from mcp.client.stdio import stdio_client

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("get_user_profile", {"user_id": "123"})
"""

import os
import sys

# CRITICAL: Add project root to Python path
# The test script passes the project root via PYTHONPATH environment variable
# But just in case, we also try to calculate it from __file__

# First, try to use PYTHONPATH if it's set
pythonpath = os.environ.get("PYTHONPATH")
if pythonpath and pythonpath not in sys.path:
    sys.path.insert(0, pythonpath)
    print(f"[MCP] Using PYTHONPATH: {pythonpath}", file=sys.stderr)

# If imports fail, we'll see an error and can debug further
print(f"[MCP] sys.path[0]: {sys.path[0]}", file=sys.stderr)

import json
from typing import Any, Dict, List

from app.mcp.tools.get_active_recommendations_tool import (
    format_recommendations_for_prompt,
    get_active_recommendations,
)
from app.mcp.tools.get_contents_tool import (
    format_contents_for_prompt,
    get_relevant_contents,
)
from app.mcp.tools.get_experts_tool import format_experts_for_prompt, get_all_experts
from app.mcp.tools.get_products_tool import format_products_for_prompt, get_all_products

# Import our context tools
from app.mcp.tools.get_user_profile_tool import format_profile_for_prompt, get_user_profile

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

# =========================================================
# MCP SERVER INITIALIZATION
# =========================================================

server = Server("viva-mama-context-server")

print("[MCP] Viva Mama Context Server starting...", file=sys.stderr)


# =========================================================
# TOOL DEFINITIONS
# =========================================================


@server.list_tools()
async def list_tools() -> List[types.Tool]:
    """
    List all available tools that the LLM can use.

    This function is called when the MCP client (chat pipeline) connects
    to discover what tools are available.

    Returns:
        List of Tool definitions with names, descriptions, and input schemas
    """
    return [
        types.Tool(
            name="get_user_profile",
            description=(
                "Fetch the user's profile: her name, her perinatal STAGE (pregnant, "
                "postpartum, or not currently pregnant) and the week within that stage, "
                "plus delivery details, breastfeeding status, medical history and support "
                "system. The week is a gestational week when she is pregnant and a "
                "postpartum week after she has delivered — always read the stage before "
                "the week. Use this to understand who the user is and to frame answers "
                "for the stage she is actually in."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's MongoDB ObjectId or integer user_id",
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": False,
                    },
                },
                "required": ["user_id"],
            },
        ),
        types.Tool(
            name="get_active_recommendations",
            description=(
                "Fetch the user's recent recovery recommendations (last 3 weeks) including "
                "overall scores, zone classification (RED/YELLOW/GREEN), category-specific "
                "recommendations (physical/lactation/emotional), recovery trend, and the latest "
                "weekly check-in answers (14 Q&A pairs with ePHI data like pain levels, sleep, "
                "mood, bleeding, etc.). Use this to understand how the user is recovering, what "
                "they should focus on, and what specific symptoms they've reported."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's MongoDB ObjectId or integer user_id",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent recommendations to fetch (default: 3)",
                        "default": 3,
                        "minimum": 1,
                        "maximum": 10,
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": False,
                    },
                },
                "required": ["user_id"],
            },
        ),
        types.Tool(
            name="get_all_experts",
            description=(
                "Fetch the directory of VivaMama experts this specific user is allowed to be "
                "recommended, with their specialities and categories. When a user_id is given "
                "the list is already scoped to her referral: if she signed up through an "
                "expert's referral code, that expert is the only one shown for her category. "
                "Treat the returned list as the ONLY valid source of expert names."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": (
                            "The user's MongoDB ObjectId. Required for referral scoping — "
                            "without it the full active directory is returned."
                        ),
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": True,
                    },
                },
            },
        ),
        types.Tool(
            name="get_all_products",
            description=(
                "Fetch the directory of VivaMama products this specific user is allowed to be "
                "recommended, with their details. When a user_id is given the list already "
                "honours her entitlements: some referral programs switch product "
                "recommendations off entirely, and those users come back with an empty list. "
                "An empty list means recommend NO products at all — do not fall back to "
                "general suggestions."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": (
                            "The user's MongoDB ObjectId. Required for entitlement scoping — "
                            "without it the full catalog is returned."
                        ),
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": True,
                    },
                },
            },
        ),
        types.Tool(
            name="get_relevant_contents",
            description=(
                "Search the curated `contents` articles for ones matching a query. "
                "Used as a fallback knowledge source when the vector index has no good "
                "match. Returns the most relevant articles (title + body)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search text (ideally the English-translated user query)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of articles to return",
                        "default": 3,
                        "minimum": 1,
                        "maximum": 10,
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return a formatted string instead of JSON",
                        "default": True,
                    },
                },
                "required": ["query"],
            },
        ),
    ]


# =========================================================
# TOOL EXECUTION
# =========================================================


@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Execute a tool and return its results.

    This function is called when the LLM (via the chat pipeline) invokes a tool.
    It routes the call to the appropriate Python function and returns the result
    in MCP format.

    Args:
        name: The tool name ("get_user_profile" or "get_active_recommendations")
        arguments: Dictionary of arguments passed by the LLM

    Returns:
        List containing a TextContent object with the tool's output
    """
    print(f"[MCP] Tool called: {name} with args: {arguments}", file=sys.stderr)

    try:
        if name == "get_user_profile":
            return await _handle_get_user_profile(arguments)

        elif name == "get_active_recommendations":
            return await _handle_get_active_recommendations(arguments)

        elif name == "get_all_experts":
            return await _handle_get_all_experts(arguments)

        elif name == "get_all_products":
            return await _handle_get_all_products(arguments)

        elif name == "get_relevant_contents":
            return await _handle_get_relevant_contents(arguments)

        else:
            # Unknown tool
            error_msg = f"Unknown tool: {name}"
            print(f"[MCP ERROR] {error_msg}", file=sys.stderr)
            return [types.TextContent(type="text", text=json.dumps({"error": error_msg}))]

    except Exception as e:
        # Handle any unexpected errors gracefully
        error_msg = f"Error executing tool {name}: {str(e)}"
        print(f"[MCP ERROR] {error_msg}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)

        return [types.TextContent(type="text", text=json.dumps({"error": error_msg}))]


# =========================================================
# TOOL HANDLERS
# =========================================================


async def _handle_get_user_profile(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Handle the get_user_profile tool call.

    Args:
        arguments: {"user_id": str, "format_for_prompt": bool}

    Returns:
        TextContent with either JSON profile data or formatted string
    """
    user_id = arguments.get("user_id")
    format_for_prompt = arguments.get("format_for_prompt", False)

    if not user_id:
        return [types.TextContent(type="text", text=json.dumps({"error": "user_id is required"}))]

    print(f"[MCP] Fetching profile for user_id: {user_id}", file=sys.stderr)

    # Call our existing tool
    profile = get_user_profile(user_id)

    # Return formatted or raw.
    #
    # The formatting step is wrapped because it used to be the only unguarded code
    # on this path: a null `delivery_type` raised inside format_profile_for_prompt,
    # the exception escaped to call_tool, and the pipeline received an error payload
    # and dropped the profile ENTIRELY — so a cosmetic formatting bug read to the
    # model as "this user has no profile". Degrade to the raw JSON instead: the
    # model still gets her name, stage and week.
    if format_for_prompt:
        try:
            result_text = format_profile_for_prompt(profile)
        except Exception as e:
            print(
                f"[MCP ERROR] format_profile_for_prompt failed ({type(e).__name__}: {e}); "
                f"falling back to raw JSON profile",
                file=sys.stderr,
            )
            result_text = json.dumps(profile, indent=2, default=str)
    else:
        result_text = json.dumps(profile, indent=2, default=str)

    print(
        f"[MCP] Profile fetched successfully (found={profile.get('found', False)})", file=sys.stderr
    )

    return [types.TextContent(type="text", text=result_text)]


async def _handle_get_active_recommendations(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Handle the get_active_recommendations tool call.

    Args:
        arguments: {"user_id": str, "limit": int, "format_for_prompt": bool}

    Returns:
        TextContent with either JSON recommendations data or formatted string
    """
    user_id = arguments.get("user_id")
    limit = arguments.get("limit", 3)
    format_for_prompt = arguments.get("format_for_prompt", False)

    if not user_id:
        return [types.TextContent(type="text", text=json.dumps({"error": "user_id is required"}))]

    print(f"[MCP] Fetching recommendations for user_id: {user_id}, limit: {limit}", file=sys.stderr)

    # Call our existing tool
    recommendations = get_active_recommendations(user_id, limit=limit)

    # Return formatted or raw
    if format_for_prompt:
        formatted = format_recommendations_for_prompt(recommendations)
        result_text = formatted
    else:
        result_text = json.dumps(recommendations, indent=2, default=str)

    print(
        f"[MCP] Recommendations fetched (found={recommendations.get('found', False)}, count={recommendations.get('count', 0)})",
        file=sys.stderr,
    )

    return [types.TextContent(type="text", text=result_text)]


async def _handle_get_all_experts(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Handle the get_all_experts tool call.

    Args:
        arguments: {"user_id": str, "format_for_prompt": bool}

    Returns:
        TextContent with either JSON experts data or formatted string
    """
    user_id = arguments.get("user_id")
    format_for_prompt = arguments.get("format_for_prompt", True)

    print(f"[MCP] Fetching experts for user_id: {user_id}", file=sys.stderr)

    # Referral scoping happens inside the tool — see get_experts_tool docstring.
    experts_data = get_all_experts(user_id)

    # Return formatted or raw
    if format_for_prompt:
        result_text = format_experts_for_prompt(experts_data)
    else:
        # default=str so a stray ObjectId can never break serialisation.
        result_text = json.dumps(experts_data, indent=2, default=str)

    print(
        f"[MCP] Experts fetched successfully "
        f"(count={experts_data.get('count', 0)}, "
        f"referral_filtered={experts_data.get('filtered_by_referral', False)})",
        file=sys.stderr,
    )

    return [types.TextContent(type="text", text=result_text)]


async def _handle_get_all_products(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Handle the get_all_products tool call.

    Args:
        arguments: {"user_id": str, "format_for_prompt": bool}

    Returns:
        TextContent with either JSON experts data or formatted string
    """
    user_id = arguments.get("user_id")
    format_for_prompt = arguments.get("format_for_prompt", True)

    print(f"[MCP] Fetching products for user_id: {user_id}", file=sys.stderr)

    # Entitlement scoping happens inside the tool — see get_products_tool docstring.
    products_data = get_all_products(user_id)

    # Return formatted or raw
    if format_for_prompt:
        result_text = format_products_for_prompt(products_data)
    else:
        result_text = json.dumps(products_data, indent=2)

    print(
        f"[MCP] Products fetched successfully (count={products_data.get('count', 0)})",
        file=sys.stderr,
    )

    return [types.TextContent(type="text", text=result_text)]


async def _handle_get_relevant_contents(arguments: Dict[str, Any]) -> List[types.TextContent]:
    """
    Handle the get_relevant_contents tool call.

    Args:
        arguments: {"query": str, "limit": int, "format_for_prompt": bool}

    Returns:
        TextContent with either the formatted content block or JSON.
    """
    query = arguments.get("query", "")
    limit = arguments.get("limit", 3)
    format_for_prompt = arguments.get("format_for_prompt", True)

    if not query:
        return [types.TextContent(type="text", text=json.dumps({"error": "query is required"}))]

    print(f"[MCP] Searching contents for query: {query[:80]!r}", file=sys.stderr)

    contents_data = get_relevant_contents(query, limit=limit)

    if format_for_prompt:
        result_text = format_contents_for_prompt(contents_data)
    else:
        result_text = json.dumps(contents_data, indent=2, default=str)

    print(f"[MCP] Contents matched (count={contents_data.get('count', 0)})", file=sys.stderr)

    return [types.TextContent(type="text", text=result_text)]


# =========================================================
# SERVER ENTRYPOINT
# =========================================================
async def main():
    """
    Start the MCP server.
    """
    print("[MCP] Server initialized, waiting for client connection...", file=sys.stderr)

    async with stdio_server() as (read_stream, write_stream):
        print("[MCP] Server running", file=sys.stderr)

        await server.run(read_stream, write_stream, server.create_initialization_options())

    print("[MCP] Server shutting down", file=sys.stderr)


if __name__ == "__main__":
    import asyncio

    print("[MCP] Starting Viva Mama Context Server", file=sys.stderr)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[MCP] Server interrupted by user", file=sys.stderr)
    except Exception as e:
        print(f"[MCP FATAL ERROR] {str(e)}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
