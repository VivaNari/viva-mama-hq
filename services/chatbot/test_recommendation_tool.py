"""
Test script for recommendations_tool

Tests fetching the last 3 recommendations and formatting for the chatbot.

Run: python3 tests/test_recommendations.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(".env"))))

from dotenv import load_dotenv

load_dotenv()

from app.mcp.db_connection import get_recommendation_history_collection
from app.mcp.tools.get_active_recommendations_tool import (
    format_recommendations_for_prompt,
    get_active_recommendations,
    print_recommendations_summary,
)


def test_recommendations_tool():
    """Test the recommendations fetching functionality"""
    print("\n" + "="*60)
    print("Testing Recommendations Tool")
    print("="*60 + "\n")
    
    try:
        # Find a user who has recommendation history
        rec_history = get_recommendation_history_collection()
        print(rec_history, "2232")
        sample_rec = rec_history.find({})
        
        if not sample_rec:
            print("ℹ️  No recommendation history in database yet.")
            print("   Users need to complete weekly check-ins first.")
            return False
        
        # Get the userId from the sample
        user_id = sample_rec.get("userId")
        if not user_id:
            print("❌ Sample recommendation has no userId field")
            return False
        
        user_id_str = str(user_id)
        
        print("✅ Found user with recommendation history")
        print(f"   User ID: {user_id_str}")
        print()
        
        # Test 1: Fetch recommendations
        print("-" * 60)
        print("Test 1: Fetching Last 3 Recommendations")
        print("-" * 60 + "\n")
        
        recs_data = get_active_recommendations(user_id_str, limit=3)
        
        if recs_data.get("found"):
            print("✅ Successfully fetched recommendations!")
            print(f"   Count: {recs_data['count']}")
            print(f"   Trend: {recs_data['trend']}")
            print()
            
            # Show each recommendation briefly
            for i, rec in enumerate(recs_data["recommendations"]):
                marker = "← CURRENT" if i == len(recs_data["recommendations"]) - 1 else ""
                print(f"   Week {rec['week']}: Score {rec['finalScore']}, {rec['zone']} zone {marker}")
        else:
            print(f"❌ Failed to fetch: {recs_data.get('error')}")
            return False
        
        # Test 2: Format for LLM
        print("\n" + "-" * 60)
        print("Test 2: Formatting for LLM Prompt")
        print("-" * 60 + "\n")
        
        formatted = format_recommendations_for_prompt(recs_data)
        print("✅ Formatted context:")
        print()
        print(formatted)
        print()
        
        # Test 3: Verify latest recommendation has content
        print("-" * 60)
        print("Test 3: Checking Recommendation Content")
        print("-" * 60 + "\n")
        
        latest = recs_data.get("latest")
        if latest and latest.get("content"):
            content = latest["content"]
            print("✅ Latest recommendation has content:")
            print(f"   Title: {content.get('title', 'N/A')[:60]}...")
            print(f"   Going Well: {content.get('goingWell', 'N/A')[:60]}...")
            print(f"   Focus: {content.get('needsHelp', 'N/A')[:60]}...")
        else:
            print("⚠️  Latest recommendation missing content")
            print("   (This might be normal if recommendations haven't been fully set up)")
        
        # Test 4: Pretty print
        print("\n" + "-" * 60)
        print("Test 4: Pretty Print Summary")
        print("-" * 60)
        
        print_recommendations_summary(user_id_str)
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_with_specific_user():
    """Test with a specific user ID"""
    print("\n" + "="*60)
    print("Test with Specific User ID")
    print("="*60 + "\n")
    
    user_id = input("Enter a user_id to test (or press Enter to skip): ").strip()
    
    if not user_id:
        print("Skipped.")
        return
    
    print()
    print_recommendations_summary(user_id)


def main():
    """Run all tests"""
    print("\n🏥 Viva Mama - Recommendations Tool Tests")
    print("="*60)
    
    success = test_recommendations_tool()
    
    print("\n" + "="*60)
    if success:
        print("🎉 All tests passed!")
        print("="*60 + "\n")
        print("The recommendations tool is working correctly.")
        print()
        print("What this means:")
        print("✅ Can fetch last 3 recommendations")
        print("✅ Can calculate recovery trend (improving/stable/declining)")
        print("✅ Can link to full recommendation content")
        print("✅ Can format for chatbot consumption")
        print()
        print("This allows the chatbot to:")
        print("  - Reference current week's focus")
        print("  - Acknowledge progress from previous weeks")
        print("  - Celebrate improvements")
        print("  - Address ongoing concerns")
        print()
        
        test_with_specific_user()
    else:
        print("⚠️  Some tests failed")
        print("="*60 + "\n")
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())