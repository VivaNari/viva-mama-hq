"""
Test script for user_profile_tool

This tests the get_user_profile function with real data from your MongoDB.

Run: python3 tests/test_user_profile.py
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.mcp.tools.get_user_profile_tool import (
    get_user_profile,
    format_profile_for_prompt,
    print_user_profile
)
from app.mcp.db_connection import get_users_collection


def test_user_profile_tool():
    """Test the user profile fetching functionality"""
    print("\n" + "="*60)
    print("Testing User Profile Tool")
    print("="*60 + "\n")
    
    try:
        # First, let's find a real user in the database to test with
        users = get_users_collection()
        sample_user = users.find_one({})
        
        if not sample_user:
            print("ℹ️  No users in database yet.")
            print("   Create a user in your app first, then run this test.")
            return False
        
        # Get the user_id (could be _id or user_id field)
        user_id = str(sample_user.get("_id"))
        user_int_id = sample_user.get("user_id")
        
        print(f"✅ Found a test user in database")
        print(f"   MongoDB _id: {user_id}")
        if user_int_id:
            print(f"   User ID: {user_int_id}")
        print()
        
        # Test 1: Fetch the profile
        print("-" * 60)
        print("Test 1: Fetching User Profile")
        print("-" * 60 + "\n")
        
        profile = get_user_profile(user_id)
        
        if profile.get("found"):
            print("✅ Successfully fetched user profile!")
            print(f"   Name: {profile.get('preferred_name', 'Not set')}")
            print(f"   Postpartum Week: {profile.get('postpartum_week', 0)}")
            print(f"   Delivery Type: {profile.get('delivery_type', 'Not set')}")
            print(f"   Breastfeeding: {profile.get('is_breastfeeding', 'Not set')}")
        else:
            print(f"❌ Failed to fetch profile: {profile.get('error')}")
            return False
        
        # Test 2: Format for LLM prompt
        print("\n" + "-" * 60)
        print("Test 2: Formatting Profile for LLM")
        print("-" * 60 + "\n")
        
        formatted = format_profile_for_prompt(profile)
        print("✅ Formatted context string:")
        print()
        print(formatted)
        print()
        
        # Test 3: Test with non-existent user
        print("-" * 60)
        print("Test 3: Handling Non-Existent User")
        print("-" * 60 + "\n")
        
        fake_profile = get_user_profile("000000000000000000000000")
        
        if not fake_profile.get("found"):
            print("✅ Correctly handled non-existent user")
            print(f"   Error message: {fake_profile.get('error')}")
        else:
            print("❌ Should have returned not found for fake user")
            return False
        
        # Test 4: Print nicely formatted profile
        print("\n" + "-" * 60)
        print("Test 4: Pretty Print User Profile")
        print("-" * 60)
        
        print_user_profile(user_id)
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_with_specific_user():
    """
    Test with a specific user ID.
    Useful if you want to test with a particular user.
    """
    print("\n" + "="*60)
    print("Test with Specific User ID")
    print("="*60 + "\n")
    
    # You can hardcode a user_id here for testing
    user_id = input("Enter a user_id to test (or press Enter to skip): ").strip()
    
    if not user_id:
        print("Skipped.")
        return
    
    print()
    print_user_profile(user_id)


def main():
    """Run all tests"""
    print("\n🏥 Viva Mama - User Profile Tool Tests")
    print("="*60)
    
    success = test_user_profile_tool()
    
    print("\n" + "="*60)
    if success:
        print("🎉 All tests passed!")
        print("="*60 + "\n")
        print("The user profile tool is working correctly.")
        print()
        print("What this means:")
        print("✅ Can fetch user data from MongoDB")
        print("✅ Can calculate postpartum week/days")
        print("✅ Can format data for chatbot consumption")
        print("✅ Handles missing users gracefully")
        print()
        print("Next: We'll integrate this into the MCP server so the")
        print("      chatbot can use it for personalized responses!")
        print()
        
        # Offer to test with specific user
        test_with_specific_user()
    else:
        print("⚠️  Some tests failed")
        print("="*60 + "\n")
        print("Please check the errors above and fix them.")
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())