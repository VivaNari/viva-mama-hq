"""
User Profile Context Tool for Viva Mama Chatbot

This module provides functions to fetch and format user profile data
from MongoDB for use in personalized chatbot responses.

The profile data includes:
- User's preferred name
- Delivery date and type
- Current postpartum week/days
- Breastfeeding status
- Medical history and conditions
- Support system information

This data allows the chatbot to:
- Address users by name
- Provide week-specific advice
- Consider delivery type in recommendations
- Tailor responses to their specific situation
"""

from datetime import datetime
from typing import Any, Dict

from app.mcp.db_connection import get_users_collection
from bson import ObjectId


def calculate_postpartum_days(delivery_date: datetime) -> Dict[str, int]:
    """
    Calculate how many weeks and days postpartum the user is.
    
    Args:
        delivery_date: The date the user gave birth
        
    Returns:
        dict: {"weeks": int, "days": int}
        
    Example:
        If user delivered 25 days ago:
        Returns: {"weeks": 3, "days": 4}
    """
    if not delivery_date:
        return {"weeks": 0, "days": 0}
    
    # Make both dates timezone-naive for comparison
    if delivery_date.tzinfo is not None:
        delivery_date = delivery_date.replace(tzinfo=None)
    
    now = datetime.now()
    days_since_delivery = (now - delivery_date).days
    
    # Ensure we don't return negative values
    days_since_delivery = max(0, days_since_delivery)
    
    weeks = days_since_delivery // 7
    remaining_days = days_since_delivery % 7
    
    return {
        "weeks": weeks,
        "days": remaining_days
    }


def get_user_profile(user_id: str) -> Dict[str, Any]:
    """
    Fetch user profile data from MongoDB and format it for the chatbot.
    
    This is the primary function that MCP tools and the chat pipeline will call
    to get user context for personalization.
    
    Args:
        user_id: The MongoDB ObjectId of the user (as string)
        
    Returns:
        dict: Formatted user profile data with these keys:
            - user_id: str
            - found: bool (whether user exists)
            - preferred_name: str
            - postpartum_week: int
            - postpartum_days: int
            - total_postpartum_days: int
            - delivery_date: str (ISO format)
            - delivery_type: str ("vaginal" or "cesarean")
            - delivery_outcome: str
            - is_breastfeeding: bool
            - location: str
            - social_support: str
            - current_medications: list[str]
            - pregnancy_conditions: list[str]
            - conception_method: str
            - parity: str (number of previous births)
            
        If user not found, returns:
            {"user_id": user_id, "found": False, "error": "User not found"}
            
    Example:
        >>> profile = get_user_profile("507f1f77bcf86cd799439011")
        >>> print(profile["preferred_name"])
        "Priya"
        >>> print(f"Week {profile['postpartum_week']}")
        "Week 3"
    """
    try:
        # Convert string user_id to ObjectId for MongoDB query
        try:
            object_id = ObjectId(user_id)
        except Exception:
            # If conversion fails, try using user_id as is (might be an integer)
            object_id = user_id
        
        # Get the users collection
        users = get_users_collection()
        
        # Query the database
        # We search by both _id (ObjectId) and user_id (integer) to cover both cases
        user_doc = users.find_one({
            "$or": [
                {"_id": object_id if isinstance(object_id, ObjectId) else None},
            ]
        })
        
        if not user_doc:
            return {
                "user_id": user_id,
                "found": False,
                "error": "User not found in database"
            }
        
        # Extract onboarding data (this is where most profile info lives)
        onboarding = user_doc.get("onboarding_data", {})
        
        # Get the delivery date and calculate current postpartum week/days
        delivery_date = onboarding.get("delivery_date")
        
        # Check if current_weekdays is already calculated in the database
        current_weekdays = user_doc.get("current_weekdays", {})
        
        if current_weekdays and current_weekdays.get("weeks") is not None:
            # Use the pre-calculated values from the database
            postpartum_week = current_weekdays.get("weeks", 0)
            postpartum_days = current_weekdays.get("days", 0)
        elif delivery_date:
            # Calculate it ourselves
            calculated = calculate_postpartum_days(delivery_date)
            postpartum_week = calculated["weeks"]
            postpartum_days = calculated["days"]
        else:
            # No delivery date available
            postpartum_week = 0
            postpartum_days = 0
        
        # Calculate total days for convenience
        total_postpartum_days = (postpartum_week * 7) + postpartum_days
        
        # Format the delivery date as ISO string for LLM consumption
        delivery_date_str = None
        if delivery_date:
            if isinstance(delivery_date, datetime):
                delivery_date_str = delivery_date.isoformat()
            else:
                delivery_date_str = str(delivery_date)
        
        # Build the formatted profile
        profile = {
            "user_id": str(user_doc.get("_id")),
            "found": True,
            
            # Basic identity
            "preferred_name": onboarding.get("preferred_name", ""),
            
            # Postpartum timeline
            "postpartum_week": postpartum_week,
            "postpartum_days": postpartum_days,
            "total_postpartum_days": total_postpartum_days,
            "delivery_date": delivery_date_str,
            
            # Delivery details
            "delivery_type": onboarding.get("delivery_type", ""),
            "delivery_outcome": onboarding.get("delivery_outcome", ""),
            
            # Current status
            "is_breastfeeding": user_doc.get("is_breastfeeding_currently", None),
            
            # Demographics and support
            "location": onboarding.get("location", ""),
            "social_support": onboarding.get("social_support", ""),
            
            # Medical history
            "current_medications": onboarding.get("current_medications", []),
            "past_medications": onboarding.get("past_medications", []),
            "pregnancy_conditions": onboarding.get("pregnancy_conditions", []),
            
            # Reproductive history
            "conception_method": onboarding.get("conception_method", ""),
            "parity": onboarding.get("parity", ""),  # Number of previous births
            
            # Lifestyle factors (relevant for recommendations)
            "tobacco_use": onboarding.get("tobacco_use", ""),
            "alcohol_use": onboarding.get("alcohol_use", ""),
        }
        
        return profile
        
    except Exception as e:
        # Log the error and return a safe error response
        print(f"[ERROR] Failed to fetch user profile for user_id={user_id}: {str(e)}")
        return {
            "user_id": user_id,
            "found": False,
            "error": f"Error fetching profile: {str(e)}"
        }


def format_profile_for_prompt(profile: Dict[str, Any]) -> str:
    """
    Format the user profile into a natural language string for the LLM prompt.
    
    This converts the structured profile data into readable sentences that
    provide context to the chatbot without overwhelming the prompt with JSON.
    
    Args:
        profile: The profile dict returned by get_user_profile()
        
    Returns:
        str: Natural language description of the user
        
    Example:
        >>> profile = get_user_profile("123")
        >>> context = format_profile_for_prompt(profile)
        >>> print(context)
        "You are assisting Priya, who is in postpartum week 3, day 4 
        (25 days after a vaginal delivery). She is currently breastfeeding..."
    """
    if not profile.get("found"):
        return "No user profile information available."
    
    # Build the context string piece by piece
    parts = []
    
    # Name and timeline
    name = profile.get("preferred_name", "the user")
    week = profile.get("postpartum_week", 0)
    days = profile.get("postpartum_days", 0)
    total_days = profile.get("total_postpartum_days", 0)
    
    parts.append(f"You are assisting {name}, who is in postpartum week {week}, day {days} ({total_days} days after delivery).")
    
    # Delivery details
    delivery_type = profile.get("delivery_type", "").lower()
    if delivery_type:
        if delivery_type == "c-section":
            parts.append("She had a cesarean section delivery.")
        elif delivery_type == "vaginal":
            parts.append("She had a vaginal delivery.")
        else:
            parts.append(f"Delivery type: {delivery_type}.")
    
    delivery_outcome = profile.get("delivery_outcome", "")
    if delivery_outcome == "still_birth":
        parts.append("The delivery resulted in a stillbirth.")
    elif delivery_outcome == "live_birth":
        parts.append("The delivery resulted in a live birth.")

    # Breastfeeding status
    is_bf = profile.get("is_breastfeeding")
    if is_bf is True:
        parts.append("She is currently breastfeeding.")
    elif is_bf is False:
        parts.append("She is not currently breastfeeding.")
    
    # Support system
    social_support = profile.get("social_support", "")
    if social_support:
        parts.append(f"Social support: {social_support}.")
    
    # Medical considerations
    conditions = profile.get("pregnancy_conditions", [])
    if conditions:
        conditions_str = ", ".join(conditions)
        parts.append(f"Pregnancy conditions: {conditions_str}.")
    
    parity = profile.get("parity", "")
    if parity:
        parts.append("She has had previous births.")
    else:
        parts.append("This is her first birth.")    
    
    medications = profile.get("current_medications", [])
    if medications:
        meds_str = ", ".join(medications)
        parts.append(f"Current medications: {meds_str}.")

    past_medications = profile.get("past_medications", [])
    if past_medications:
        meds_str = ", ".join(past_medications)
        parts.append(f"Past medications: {meds_str}.")

    tobacco_use = profile.get("tobacco_use", "")
    if tobacco_use:
        parts.append(f"Tobacco use: {tobacco_use}.")
    
    alcohol_use = profile.get("alcohol_use", "")
    if alcohol_use:
        parts.append(f"Alcohol use: {alcohol_use}.")
        
    # Location (useful for cultural context)
    location = profile.get("location", "")
    if location:
        parts.append(f"Location: {location}.")

    date_of_birth = profile.get("date_of_birth", "")
    if date_of_birth:
        parts.append(f"Her Date of Birth is: {date_of_birth}.")
    
    return " ".join(parts)


# Convenience function for quick testing
def print_user_profile(user_id: str) -> None:
    """
    Fetch and print a user's profile in a readable format.
    Useful for testing and debugging.
    
    Args:
        user_id: The user's MongoDB ObjectId or user_id
    """
    profile = get_user_profile(user_id)
    
    if not profile.get("found"):
        print(f"❌ User {user_id} not found")
        print(f"   Error: {profile.get('error', 'Unknown error')}")
        return
    
    print(f"\n{'='*60}")
    print(f"User Profile: {profile.get('preferred_name', 'Unknown')}")
    print(f"{'='*60}\n")
    
    print(f"User ID: {profile['user_id']}")
    print(f"Postpartum: Week {profile['postpartum_week']}, Day {profile['postpartum_days']} ({profile['total_postpartum_days']} days total)")
    print(f"Delivery: {profile.get('delivery_type', 'N/A')}")
    print(f"Breastfeeding: {profile.get('is_breastfeeding', 'N/A')}")
    print(f"Location: {profile.get('location', 'N/A')}")
    print(f"Support: {profile.get('social_support', 'N/A')}")
    
    if profile.get('pregnancy_conditions'):
        print(f"Conditions: {', '.join(profile['pregnancy_conditions'])}")
    
    if profile.get('current_medications'):
        print(f"Medications: {', '.join(profile['current_medications'])}")
    
    print(f"\n{'='*60}")
    print("Formatted for LLM:")
    print(f"{'='*60}\n")
    print(format_profile_for_prompt(profile))
    print()
    """
        User Profile Context Tool for Viva Mama Chatbot

        This module provides functions to fetch and format user profile data
        from MongoDB for use in personalized chatbot responses.

        The profile data includes:
        - User's preferred name
        - Delivery date and type
        - Current postpartum week/days
        - Breastfeeding status
        - Medical history and conditions
        - Support system information

        This data allows the chatbot to:
        - Address users by name
        - Provide week-specific advice
        - Consider delivery type in recommendations
        - Tailor responses to their specific situation
    """
