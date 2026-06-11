"""
Simple MCP Server Test

Run from project root: python3 test_context_server.py
"""

import asyncio
import os
import sys

# Add current directory to path
sys.path.insert(0, os.getcwd())

#from asyncio import tools
from dotenv import load_dotenv

load_dotenv()

from app.mcp.db_connection import get_recommendation_history_collection, get_users_collection
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def test_mcp_server():
    """Test the MCP server"""
    
    print("\n" + "="*60)
    print("Testing MCP Context Server")
    print("="*60 + "\n")
    
    # Find a test user
    print("Finding a test user...")
    users = get_users_collection()
    sample_user = users.find_one({})
    
    if not sample_user:
        print("❌ No users in database. Create a user first.")
        return False
    
    user_id = str(sample_user.get("_id"))
    print(f"✅ Found test user: {user_id}")
    print()
    
    # Check for recommendations
    rec_history = get_recommendation_history_collection()
    has_recs = rec_history.find_one({"userId": sample_user.get("_id")}) is not None
    
    if has_recs:
        print("✅ User has recommendation history")
    else:
        print("⚠️  User has no recommendation history yet")
    print()
    
    # Get the server script path
    server_script = os.path.join(os.getcwd(), "app", "mcp", "context_server.py")
    
    print(f"Server script: {server_script}")
    
    if not os.path.exists(server_script):
        print("❌ Server script not found!")
        print(f"   Current directory: {os.getcwd()}")
        print("   Expected location: app/mcp/context_server.py")
        print()
        print("Make sure you're running from the project root:")
        print("  cd /Users/rahul39duttagmail.com/nexaneura/rag_chatbot")
        print("  python3 test_context_server.py")
        return False
    
    print("✅ Server script found")
    print()
    
    server_params = StdioServerParameters(
        command="python3",
        args=[server_script],
        env={
            **os.environ.copy(),  # Copy current environment
            "PYTHONPATH": os.getcwd()  # Add project root to PYTHONPATH
        }
    )
    
    print("Starting MCP server...")
    
    try:
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                print("✅ Connected to MCP server")
                print()
                
                # List tools
                print("-" * 60)
                print("Available Tools")
                print("-" * 60 + "\n")
                
                tools_result = await session.list_tools()
                tools = tools_result.tools  # ✅ Access the .tools attribute
                print(f"Found {len(tools)} tools:")
                #print(f"Found {len(tools)} tools:")
                for tool in tools:
                    print(f"  • {tool.name}")
                print()
                
                # Test profile
                print("-" * 60)
                print("Testing: get_user_profile")
                print("-" * 60 + "\n")
                
                result = await session.call_tool(
                    name="get_user_profile",
                    arguments={"user_id": user_id, "format_for_prompt": True}
                )
                
                if result.content:
                    print("✅ Profile fetched:")
                    print()
                    print(result.content[0].text)
                    print()
                
                # Test recommendations (if available)
                if has_recs:
                    print("-" * 60)
                    print("Testing: get_active_recommendations")
                    print("-" * 60 + "\n")
                    
                    result = await session.call_tool(
                        name="get_active_recommendations",
                        arguments={"user_id": user_id, "limit": 2, "format_for_prompt": True}
                    )
                    
                    if result.content:
                        formatted = result.content[0].text
                        print("✅ Recommendations fetched:")
                        print()
                        # Show first 600 chars
                        print(formatted[:600])
                        if len(formatted) > 600:
                            print(f"\n... (showing first 600 of {len(formatted)} chars)")
                        print()
                
                return True
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n🏥 Viva Mama - MCP Context Server Tests")
    print("="*60)
    
    success = asyncio.run(test_mcp_server())
    
    print("="*60)
    if success:
        print("🎉 MCP server is working!")
        print()
        print("Next: Integrate into chat pipeline (Step 7)")
    else:
        print("⚠️  Test failed - check errors above")
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())