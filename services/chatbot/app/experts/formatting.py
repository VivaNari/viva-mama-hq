"""
Expert directory formatting.

Deliberately free of database imports: the chat pipeline renders the prompt block
from the payload the MCP server hands back, and `app.mcp.db_connection` opens a
MongoDB connection at import time. Keeping this pure means the API process can
format an expert directory without acquiring a Mongo connection of its own.
"""

from typing import Any, Dict


def format_experts_for_prompt(experts_data: Dict[str, Any]) -> str:
    """
    Format the expert list into a single string for the prompt.

    Args:
        experts_data: Dict returned by get_all_experts()

    Returns:
        Formatted string for injection into the system prompt
    """
    if not experts_data.get("found"):
        return ""

    experts = experts_data.get("experts", [])
    if not experts:
        return ""

    prompt_lines = []

    # Only display fields go into the prompt — `id` and `name_variants` are internal
    # plumbing for the suggestion matcher and would just be hallucination bait here.
    for expert in experts:
        name = expert.get("name", "Unknown Expert")
        speciality = expert.get("speciality", "Expert Wellness Partner")
        category = expert.get("category_name", "")
        line = f"- {name}, {speciality}"
        if category:
            line += f" ({category})"
        prompt_lines.append(line)

    return "\n".join(prompt_lines)
