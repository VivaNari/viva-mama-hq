"""
Active Recommendations Context Tool for Viva Mama Chatbot

This module fetches the user's recent recommendations from the recommendation_history
collection to provide the chatbot with context about their recovery journey.

Key features:
- Fetches the last 3 recommendations (shows progression over time)
- Links to the actual recommendation content from the Recommendation collection
- Provides both summary and detailed recommendation text
- Shows how the user's recovery is trending (improving/stable/declining)

This allows the chatbot to:
- Reference the current week's focus areas
- Acknowledge progress from previous weeks
- Celebrate improvements in recovery scores
- Address ongoing concerns that span multiple weeks
"""

from typing import Any, Dict, List

from app.mcp.db_connection import (
    get_recommendation_history_collection,
)
from bson import ObjectId


def calculate_trend(recommendations: List[Dict[str, Any]]) -> str:
    """
    Calculate the recovery trend based on the last 3 recommendations.
    
    Args:
        recommendations: List of recommendation history items (oldest to newest)
        
    Returns:
        str: "improving", "stable", or "declining"
    """
    if len(recommendations) < 2:
        return "stable"
    
    # Zone priority: GREEN=3, YELLOW=2, RED=1
    zone_values = {"GREEN": 3, "YELLOW": 2, "RED": 1}
    
    scores = []
    for rec in recommendations:
        zone = rec.get("zone", "YELLOW")
        scores.append(zone_values.get(zone, 2))
    
    # Compare most recent to oldest
    if scores[-1] > scores[0]:
        return "improving"
    elif scores[-1] < scores[0]:
        return "declining"
    else:
        return "stable"


def get_active_recommendations(user_id: str, limit: int = 3) -> Dict[str, Any]:
    """
    Fetch the user's recent recommendations to show recovery progression.
    
    This fetches the last N recommendations from recommendation_history and
    enriches them with the full content from the Recommendation collection.
    
    Args:
        user_id: The user's MongoDB ObjectId or integer user_id
        limit: Number of recent recommendations to fetch (default: 3)
        
    Returns:
        dict: {
            "user_id": str,
            "found": bool,
            "count": int,  # How many recommendations were found
            "trend": str,  # "improving", "stable", or "declining"
            "recommendations": [  # Oldest to newest
                {
                    "week": int,
                    "finalScore": int,
                    "zone": str,  # "RED", "YELLOW", "GREEN"
                    "tagline": str,  # Summary tagline for the week
                    "breastfeeding": bool,
                    "recorded_at": str,  # ISO timestamp
                    "category_scores": {
                        "physical": {
                            "score": int,
                            "zone": str,
                            "recommendation": {
                                "title": str,
                                "goingWell": str,
                                "needsHelp": str,
                                "celebrate": str,
                                "tips": str,
                                "next": str,
                            }
                        },
                        "lactation": {...},  # Same structure
                        "emotional": {...},   # Same structure
                    },
                    "checkin_answers": [  # The 14 Q&A pairs from weekly check-in
                        {
                            "question": str,
                            "answer": mixed  # Could be string, number, list, etc.
                        }
                    ]
                }
            ],
            "latest": {...}  # Same structure as recommendations[0], for convenience
        }
        
    Example:
        >>> recs = get_active_recommendations("507f1f77bcf86cd799439011")
        >>> print(recs["latest"]["content"]["title"])
        "Your Recovery is Progressing Well"
        >>> print(recs["trend"])
        "improving"
    """
    try:
        # Convert user_id to ObjectId if needed
        try:
            object_id = ObjectId(user_id)
        except Exception:
            object_id = user_id
        
        # Get recommendation history collection
        rec_history = get_recommendation_history_collection()
        
        # Query for the last N recommendations for this user
        # Sort by createdAt descending (newest first)
        history_docs = list(rec_history.find({
            "$or": [
                {"userId": object_id if isinstance(object_id, ObjectId) else None},
                {"userId": int(user_id) if isinstance(user_id, str) and user_id.isdigit() else None}
            ]
        }).sort("createdAt", -1).limit(limit))
        
        if not history_docs:
            return {
                "user_id": user_id,
                "found": False,
                "count": 0,
                "error": "No recommendation history found for this user"
            }
        
        # Reverse to get oldest-to-newest order
        history_docs.reverse()
        
        # Build the recommendations list with full content
        recommendations = []
        
        for doc in history_docs:
            # Get the tagline (replaces the main recommendationId)
            tagline = doc.get("tagline", "")
            
            # Get individual category recommendations (now embedded with content)
            individual_recs = doc.get("individualRecommendations", {})
            category_scores = doc.get("categoryScores", {})
            
            # Build category scores breakdown with embedded recommendations
            category_breakdown = {}
            for category in ["physical", "lactation", "emotional"]:
                cat_data = individual_recs.get(category, {})
                scores = category_scores.get(category, {})
                rec_content = cat_data.get("recommendation", {})
                
                category_breakdown[category] = {
                    "score": scores.get("weighted", 0),
                    "zone": cat_data.get("zone", "YELLOW"),
                    "recommendation": {
                        "title": rec_content.get("title", ""),
                        "goingWell": rec_content.get("goingWell", ""),
                        "needsHelp": rec_content.get("needsHelp", ""),
                        "celebrate": rec_content.get("celebrate", ""),
                        "tips": rec_content.get("tips", ""),
                        "next": rec_content.get("next", ""),
                    } if rec_content else None
                }
            
            # Extract check-in answers dump (the 14 Q&A pairs)
            checkin_answers = doc.get("checkinAnswersDump", [])
            
            # Build the recommendation object
            rec_obj = {
                "week": doc.get("week", 0),
                "finalScore": doc.get("finalScore", 0),
                "zone": doc.get("zone", "YELLOW"),
                "tagline": tagline,
                "breastfeeding": doc.get("breastfeeding", False),
                "recorded_at": doc.get("createdAt").isoformat() if doc.get("createdAt") else "",
                "category_scores": category_breakdown,
                "checkin_answers": checkin_answers  # The 14 Q&A pairs from weekly check-in
            }
            
            recommendations.append(rec_obj)
        
        # Calculate trend
        trend = calculate_trend(recommendations)
        
        # Prepare the response
        result = {
            "user_id": user_id,
            "found": True,
            "count": len(recommendations),
            "trend": trend,
            "recommendations": recommendations,
            "latest": recommendations[-1] if recommendations else None  # Most recent
        }
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch recommendations for user_id={user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "user_id": user_id,
            "found": False,
            "count": 0,
            "error": f"Error fetching recommendations: {str(e)}"
        }


def extract_key_health_insights(checkin_answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extract key health insights from the 14 check-in questions.
    
    This function looks for common health indicators in the check-in responses
    and extracts them into structured categories for easier LLM comprehension.
    
    Args:
        checkin_answers: List of {question: str, answer: mixed} from check-in
        
    Returns:
        dict: {
            "pain": str or None,
            "bleeding": str or None,
            "mood": str or None,
            "sleep": str or None,
            "breastfeeding": str or None,
            "energy": str or None,
            "support": str or None,
            "concerns": list[str],
            "all_answers": list[dict]  # Original answers for full context
        }
    """
    insights = {
        "pain": None,
        "bleeding": None,
        "mood": None,
        "sleep": None,
        "breastfeeding": None,
        "energy": None,
        "support": None,
        "concerns": [],
        "all_answers": checkin_answers
    }
    
    # Keywords to look for in questions (case-insensitive)
    keywords_map = {
        "pain": ["pain", "discomfort", "sore", "ache"],
        "bleeding": ["bleeding", "discharge", "lochia"],
        "mood": ["mood", "feeling", "emotional", "sad", "anxious", "depressed"],
        "sleep": ["sleep", "rest", "tired", "fatigue"],
        "breastfeeding": ["breastfeeding", "nursing", "feeding", "lactation", "milk"],
        "energy": ["energy", "strength", "stamina"],
        "support": ["support", "help", "family", "partner"]
    }
    
    for qa in checkin_answers:
        question = str(qa.get("question", "")).lower()
        answer = qa.get("answer", "")
        
        # Convert answer to string for easier handling
        if isinstance(answer, list):
            answer_str = ", ".join(str(a) for a in answer)
        else:
            answer_str = str(answer)
        
        # Match question to category
        for category, keywords in keywords_map.items():
            if any(keyword in question for keyword in keywords):
                # Store the answer for this category
                if insights[category] is None:
                    insights[category] = answer_str
                break
        
        # Flag potential concerns (answers suggesting issues)
        concern_indicators = ["severe", "very", "extreme", "worse", "worsening", "difficult", "struggling"]
        if any(indicator in answer_str.lower() for indicator in concern_indicators):
            insights["concerns"].append(f"{question}: {answer_str[:100]}")
    
    return insights


def format_recommendations_for_prompt(recommendations_data: Dict[str, Any]) -> str:
    """
    Format recommendations into a natural language string for the LLM prompt.
    
    This creates a narrative that shows progression over time, making it easy
    for the LLM to understand the user's recovery journey.
    
    Args:
        recommendations_data: The dict returned by get_active_recommendations()
        
    Returns:
        str: Natural language description of recommendations and progress
        
    Example:
        >>> recs = get_active_recommendations("123")
        >>> context = format_recommendations_for_prompt(recs)
        >>> print(context)
        "RECOVERY PROGRESSION:
        
        Week 1 (Score: 45, RED zone): User's emotional health needed attention.
        Week 2 (Score: 58, YELLOW zone): Physical recovery improving, still working on emotional wellness.
        Week 3 (Score: 68, YELLOW zone - CURRENT): Overall recovery is progressing. Weakest area: emotional.
        
        Trend: improving
        
        CURRENT RECOMMENDATIONS (Week 3):
        What's Going Well: Your physical recovery is on track...
        Focus This Week: Prioritize emotional wellness and rest..."
    """
    if not recommendations_data.get("found"):
        return "No recommendation history available for this user yet."
    
    recs = recommendations_data.get("recommendations", [])
    if not recs:
        return "No recommendation history available."
    
    parts = []
    
    # Show progression
    parts.append("RECOVERY PROGRESSION:")
    parts.append("")
    
    for i, rec in enumerate(recs):
        week = rec.get("week", 0)
        score = rec.get("finalScore", 0)
        zone = rec.get("zone", "YELLOW")
        tagline = rec.get("tagline", "")
        
        is_latest = (i == len(recs) - 1)
        marker = " (CURRENT)" if is_latest else ""
        
        line = f"Week {week} (Score: {score}, {zone} zone{marker})"
        if tagline:
            line += f": {tagline}"
        
        parts.append(line)
    
    # Show trend
    trend = recommendations_data.get("trend", "stable")
    parts.append("")
    parts.append(f"Trend: {trend}")
    parts.append("")
    
    # Show current (latest) recommendation details for each category
    latest = recommendations_data.get("latest")
    if latest:
        week = latest.get("week", 0)
        tagline = latest.get("tagline", "")
        
        parts.append(f"CURRENT RECOMMENDATIONS (Week {week}):")
        if tagline:
            parts.append(f"Overall: {tagline}")
            parts.append("")
        
        # Show each category's recommendation
        category_scores = latest.get("category_scores", {})
        for category in ["physical", "lactation", "emotional"]:
            cat_data = category_scores.get(category, {})
            score = cat_data.get("score", 0)
            zone = cat_data.get("zone", "YELLOW")
            rec = cat_data.get("recommendation")
            
            parts.append(f"{category.upper()}: {score} ({zone} zone)")
            
            if rec:
                if rec.get("goingWell"):
                    parts.append(f"  ✓ Going Well: {rec['goingWell']}")
                if rec.get("needsHelp"):
                    parts.append(f"  → Focus: {rec['needsHelp']}")
                if rec.get("tips"):
                    parts.append(f"  💡 Tips: {rec['tips']}")
            parts.append("")
        # Add the latest check-in answers (the 14 Q&A pairs)
        checkin_answers = latest.get("checkin_answers", [])
        if checkin_answers:
            parts.append("LATEST CHECK-IN RESPONSES:")
            for qa in checkin_answers:
                question = qa.get("question", "")
                answer = qa.get("answer", "")
                
                # Format the answer nicely
                if isinstance(answer, list):
                    answer_str = ", ".join(str(a) for a in answer)
                else:
                    answer_str = str(answer)
                
                # Truncate very long answers
                if len(answer_str) > 100:
                    answer_str = answer_str[:97] + "..."
                
                parts.append(f"  Q: {question}")
                parts.append(f"  A: {answer_str}")
    print("parts", parts)
    return "\n".join(parts)


def print_recommendations_summary(user_id: str) -> None:
    """
    Print a formatted summary of the user's recommendations.
    Useful for debugging and testing.
    
    Args:
        user_id: The user's MongoDB ObjectId or user_id
    """
    recs_data = get_active_recommendations(user_id)
    
    if not recs_data.get("found"):
        print(f"❌ No recommendations found for user {user_id}")
        print(f"   Error: {recs_data.get('error', 'Unknown error')}")
        return
    
    print(f"\n{'='*60}")
    print(f"Recommendations Summary - User {user_id}")
    print(f"{'='*60}\n")
    
    print(f"Count: {recs_data['count']} recommendations")
    print(f"Trend: {recs_data['trend']}")
    print()
    
    for i, rec in enumerate(recs_data["recommendations"]):
        marker = "📍 CURRENT" if i == len(recs_data["recommendations"]) - 1 else ""
        print(f"Week {rec['week']} {marker}")
        print(f"  Score: {rec['finalScore']}/100")
        print(f"  Zone: {rec['zone']}")
        
        if rec.get("tagline"):
            print(f"  Summary: {rec['tagline']}")
        
        print(f"  Date: {rec['recorded_at'][:10]}")
        
        # Show check-in answers count
        checkin_count = len(rec.get("checkin_answers", []))
        if checkin_count > 0:
            print(f"  Check-in Answers: {checkin_count} questions")
        
        print()
    
    print(f"{'='*60}")
    print("Formatted for LLM:")
    print(f"{'='*60}\n")
    print(format_recommendations_for_prompt(recs_data))
    print()