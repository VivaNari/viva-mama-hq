from typing import Any, Dict, List
import logging
from app.mcp.db_connection import get_products_collection

logger = logging.getLogger(__name__)

def get_all_products() -> Dict[str, Any]:
    """
    Fetch all active experts from MongoDB.
    
    Returns:
        Dict containing list of prduct name, price range and safety flag
    """
    try:
        products_col = get_products_collection()
        cursor = products_col.find(
            {},
            {
                "_id": 0, 
                "productName": 1, 
                "productPriceRange": 1, 
                "safetyFlag": 1,
                "validWeekStart": 1,
                "validWeekEnd": 1
            }
        )
        product_list = list(cursor)
        
        return {
            "found": len(product_list) > 0,
            "products": product_list,
            "count": len(product_list)
        }
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        return {
            "found": False,
            "products": [],
            "error": str(e)
        }

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
        prompt_lines.append(f"- {name}, {price_range}, {safety_flag}, (Valid: Week {week_start}-{week_end})")
        
    return "\n".join(prompt_lines)
