"""
MongoDB Connection Layer for Viva Mama MCP Server

This module handles the connection to your existing MongoDB database.
It's designed to be imported by MCP tools that need to fetch user context.

Key responsibilities:
1. Establish and maintain a connection to MongoDB
2. Provide easy access to collections (users, messages, recommendations, etc.)
3. Handle connection errors gracefully
4. Support both development and production environments

The connection uses the same MongoDB database that your Node.js server uses,
so the MCP server is reading from your single source of truth.
"""

from typing import Optional
import os
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from app.settings import settings


# Global connection objects - these will be initialized once and reused
_mongo_client: Optional[MongoClient] = None
_database: Optional[Database] = None


def get_mongo_client() -> MongoClient:
    """
    Get or create the MongoDB client connection.
    
    This function uses a singleton pattern - it creates the connection once
    and returns the same connection on subsequent calls. This is important
    for performance because establishing database connections is expensive.
    
    The connection string comes from the MONGODB_URI environment variable,
    which should be set in your .env file or deployment configuration.
    
    Example connection strings:
    - Local development: "mongodb://localhost:27017/viva_mama"
    - MongoDB Atlas: "mongodb+srv://username:password@cluster.mongodb.net/viva_mama"
    
    Returns:
        MongoClient: A connected MongoDB client instance
        
    Raises:
        ValueError: If MONGODB_URI environment variable is not set
        ConnectionError: If unable to connect to MongoDB
    """
    global _mongo_client
    
    # If we already have a connection, return it immediately
    if _mongo_client is not None:
        return _mongo_client
    
    # Get the connection string from environment variables
    mongo_uri = settings.mongodb_uri
    
    if not mongo_uri:
        raise ValueError(
            "MONGODB_URI environment variable is not set. "
            "Please add it to your .env file with your MongoDB connection string."
        )
    
    try:
        # Create the MongoDB client
        # serverSelectionTimeoutMS controls how long to wait when connecting
        # We set it to 5 seconds so the server doesn't hang indefinitely if MongoDB is down
        _mongo_client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        
        # Test the connection by running a simple command
        # This will raise an exception if MongoDB is unreachable
        _mongo_client.admin.command('ping')
        
        #print(f"[DB] Successfully connected to MongoDB")
        
        return _mongo_client
        
    except Exception as e:
        #print(f"[DB ERROR] Failed to connect to MongoDB: {str(e)}")
        raise ConnectionError(
            f"Could not connect to MongoDB. Please check that MongoDB is running "
            f"and that your MONGODB_URI is correct. Error: {str(e)}"
        )


def get_database() -> Database:
    """
    Get the Viva Mama database instance.
    
    This function returns a reference to your application database.
    The database name comes from the MONGODB_DATABASE environment variable,
    which defaults to "viva_mama" if not specified.
    
    Returns:
        Database: The MongoDB database instance
    """
    global _database
    
    if _database is not None:
        return _database
    
    # Get the database name from environment variables
    # Default to "viva_mama" if not specified
    db_name = settings.mongodb_database
    
    client = get_mongo_client()
    _database = client[db_name]
    
    #print(f"[DB] Using database: {db_name}")
    
    return _database


def close_connection():
    """
    Close the MongoDB connection.
    
    This should be called when the MCP server is shutting down to ensure
    that database connections are properly closed and resources are released.
    
    In normal operation, you don't need to call this manually - the connection
    will be closed when the Python process exits. However, it's useful for
    clean shutdowns and testing.
    """
    global _mongo_client, _database
    
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
        _database = None
        #print("[DB] MongoDB connection closed")


# =============================================================================
# Collection Access Functions
# =============================================================================
# These functions provide easy access to specific collections in your database.
# They match the collection names used by your Mongoose models in Node.js.
# =============================================================================

def get_users_collection() -> Collection:
    """
    Get the 'users' collection.
    
    This collection stores user profiles, onboarding data, and current status.
    Schema reference: src/models/schema/user.schema.ts
    
    Key fields used by chatbot:
    - onboarding_data.preferred_name: User's name
    - onboarding_data.delivery_date: When they gave birth
    - onboarding_data.delivery_type: "vaginal" or "cesarean"
    - current_weekdays: {weeks: number, days: number}
    - is_breastfeeding_currently: boolean
    """
    db = get_database()
    return db["users"]


def get_recommendation_history_collection() -> Collection:
    """
    Get the 'recommendation_history' collection.
    
    This collection stores weekly recovery scores and recommendations.
    Schema reference: src/models/schema/recommendationHistory.schema.ts
    
    Key fields used by chatbot:
    - week: Which postpartum week this assessment is for
    - finalScore: Overall recovery score (0-100)
    - zone: "RED", "YELLOW", or "GREEN"
    - weakestCategory: "physical", "lactation", or "emotional"
    - categoryScores: Detailed scores for each dimension
    - individualRecommendations: Specific recommendations per category
    """
    db = get_database()
    return db["recommendation_histories"]


def get_recommendations_collection() -> Collection:
    """
    Get the 'Recommendation' collection (note the capital R and singular form).
    
    This collection stores the template recommendations that get shown to users
    based on their recovery phase, zone, and category.
    Schema reference: src/models/schema/recommendation.schema.ts
    
    Key fields:
    - phase: "1-2", "3-4", "5-6", "7-12", "13-26", "27-52"
    - zone: "RED", "YELLOW", "GREEN"
    - category: "physical", "lactation", "emotional", "all"
    - title, goingWell, needsHelp, celebrate, tips, next: Content fields
    """
    db = get_database()
    return db["Recommendation"]


def get_flow_instances_collection() -> Collection:
    """
    Get the 'flow_instances' collection.
    
    This collection stores instances of questionnaire flows that users have started.
    Schema reference: src/models/schema/flowInstance.schema.ts
    
    Key fields used by chatbot:
    - userId: Who this flow belongs to
    - flowSlug: Which questionnaire type (e.g., "weekly_checkin")
    - postpartumWeek, postpartumDays: When they took this assessment
    - state: "active", "completed", etc.
    - variables: Object containing all the answers they provided
    - outcome: Final results and recommendations from this flow
    """
    db = get_database()
    return db["flow_instances"]


def get_flow_responses_collection() -> Collection:
    """
    Get the 'flow_responses' collection.
    
    This collection stores individual answers to questionnaire nodes.
    Schema reference: src/models/schema/flowResponse.schema.ts
    
    Key fields:
    - flowInstanceId: Links to a flow_instance
    - nodeId: Which question this answers
    - answer: The user's response (can be selectedKeys or freeText)
    """
    db = get_database()
    return db["flow_responses"]


def get_conversations_collection() -> Collection:
    """
    Get the 'conversations' collection.
    
    This collection stores chat conversation metadata.
    Schema reference: src/models/schema/conversation.schema.ts
    
    Key fields:
    - userId: Who owns this conversation
    - title: Conversation title (often auto-generated)
    - chatMode: Type of chat interaction
    - lastMessageAt: Timestamp of most recent message
    """
    db = get_database()
    return db["conversations"]


def get_messages_collection() -> Collection:
    """
    Get the 'messages' collection.
    
    This collection stores individual chat messages.
    Schema reference: src/models/schema/message.schema.ts
    
    Key fields used by chatbot:
    - conversationId: Which conversation this belongs to
    - userId: Who sent/received this message
    - role: "user" or "assistant"
    - text: Message content
    - ai: Metadata about how this response was generated
    """
    db = get_database()
    return db["messages"]


# =============================================================================
# Health Check Function
# =============================================================================

def check_database_health() -> dict:
    """
    Verify that the database connection is working and collections are accessible.
    
    This is useful for health check endpoints and debugging connection issues.
    
    Returns:
        dict: Status information about the database connection
        {
            "connected": bool,
            "database": str,
            "collections_accessible": bool,
            "error": str (only present if there's an error)
        }
    """
    try:
        db = get_database()
        
        # Try to list collections to verify we have access
        collections = db.list_collection_names()
        
        # Check if key collections exist
        expected_collections = [
            "users",
            "recommendation_history",
            "flow_instances",
            "messages",
            "conversations"
        ]
        
        existing_collections = [c for c in expected_collections if c in collections]
        
        return {
            "connected": True,
            "database": db.name,
            "collections_accessible": True,
            "collections_found": existing_collections,
            "total_collections": len(collections)
        }
        
    except Exception as e:
        return {
            "connected": False,
            "collections_accessible": False,
            "error": str(e)
        }
    
get_mongo_client()