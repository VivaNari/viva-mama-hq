import logging
from typing import Any, Dict

from app.mcp.db_connection import get_experts_collection

logger = logging.getLogger(__name__)

def get_all_experts() -> Dict[str, Any]:
    """
    Fetch all active experts from MongoDB.
    
    Returns:
        Dict containing list of experts and status
    """
    try:
        experts_col = get_experts_collection()
        # Fetch active experts, name and speciality
        cursor = experts_col.find(
            {"isActive": True},
            {"_id": 0, "name": 1, "speciality": 1}
        )
        expert_list = list(cursor)
        
        return {
            "found": len(expert_list) > 0,
            "experts": expert_list,
            "count": len(expert_list)
        }
    except Exception as e:
        logger.error(f"Error fetching experts: {str(e)}")
        return {
            "found": False,
            "experts": [],
            "error": str(e)
        }

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
    
    for expert in experts:
        name = expert.get("name", "Unknown Expert")
        speciality = expert.get("speciality", "Expert Wellness Partner")
        prompt_lines.append(f"- {name}, {speciality}")
        
    return "\n".join(prompt_lines)
