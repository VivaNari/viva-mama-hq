"""
Viva Mama MCP Context Server

This MCP server exposes context-fetching tools to the chatbot, allowing it to
retrieve user profiles and recovery data from MongoDB during conversations.

The server implements the Model Context Protocol (MCP) which provides a standard
way for LLMs to access external tools and data sources.

Available Tools:
1. get_user_profile - Fetches user identity, delivery details, current postpartum week
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

import sys
import os

import sys
import os
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

from typing import Any, Dict, List
import json

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

# Import our context tools
from app.mcp.tools.get_user_profile_tool import (
    get_user_profile,
    format_profile_for_prompt
)
from app.mcp.tools.get_active_recommendations_tool import (
    get_active_recommendations,
    format_recommendations_for_prompt
)


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
                "Fetch the user's profile information including their name, delivery details, "
                "current postpartum week, breastfeeding status, medical history, and support system. "
                "Use this to understand who the user is and personalize responses with their name, "
                "delivery type, and current recovery stage."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The user's MongoDB ObjectId or integer user_id"
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": False
                    }
                },
                "required": ["user_id"]
            }
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
                        "description": "The user's MongoDB ObjectId or integer user_id"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent recommendations to fetch (default: 3)",
                        "default": 3,
                        "minimum": 1,
                        "maximum": 10
                    },
                    "format_for_prompt": {
                        "type": "boolean",
                        "description": "If true, return formatted natural language string instead of JSON",
                        "default": False
                    }
                },
                "required": ["user_id"]
            }
        ),
    ]


# =========================================================
# TOOL EXECUTION
# =========================================================

@server.call_tool()
async def call_tool(
    name: str,
    arguments: Dict[str, Any]
) -> List[types.TextContent]:
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
        
        else:
            # Unknown tool
            error_msg = f"Unknown tool: {name}"
            print(f"[MCP ERROR] {error_msg}", file=sys.stderr)
            return [types.TextContent(
                type="text",
                text=json.dumps({"error": error_msg})
            )]
    
    except Exception as e:
        # Handle any unexpected errors gracefully
        error_msg = f"Error executing tool {name}: {str(e)}"
        print(f"[MCP ERROR] {error_msg}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        return [types.TextContent(
            type="text",
            text=json.dumps({"error": error_msg})
        )]


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
        return [types.TextContent(
            type="text",
            text=json.dumps({"error": "user_id is required"})
        )]
    
    print(f"[MCP] Fetching profile for user_id: {user_id}", file=sys.stderr)
    
    # Call our existing tool
    profile = get_user_profile(user_id)
    
    # Return formatted or raw
    if format_for_prompt:
        formatted = format_profile_for_prompt(profile)
        result_text = formatted
    else:
        result_text = json.dumps(profile, indent=2)
    
    print(f"[MCP] Profile fetched successfully (found={profile.get('found', False)})", file=sys.stderr)
    
    return [types.TextContent(
        type="text",
        text=result_text
    )]


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
        return [types.TextContent(
            type="text",
            text=json.dumps({"error": "user_id is required"})
        )]
    
    print(f"[MCP] Fetching recommendations for user_id: {user_id}, limit: {limit}", file=sys.stderr)
    
    # Call our existing tool
    recommendations = get_active_recommendations(user_id, limit=limit)
    
    # Return formatted or raw
    if format_for_prompt:
        formatted = format_recommendations_for_prompt(recommendations)
        result_text = formatted
    else:
        result_text = json.dumps(recommendations, indent=2, default=str)
    
    print(f"[MCP] Recommendations fetched (found={recommendations.get('found', False)}, count={recommendations.get('count', 0)})", file=sys.stderr)
    
    return [types.TextContent(
        type="text",
        text=result_text
    )]


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
        
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )
    
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