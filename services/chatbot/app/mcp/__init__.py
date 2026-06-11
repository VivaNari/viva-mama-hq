"""
MCP (Model Context Protocol) package for Viva Mama chatbot

This package contains:
- db_connection.py: MongoDB connection layer for accessing user data
- server.py: MCP server that exposes tools for context fetching
- adapter.py: Adapter for integrating MCP with the chat pipeline
"""

from app.mcp.db_connection import (
    get_mongo_client,
    get_database,
    get_users_collection,
    get_recommendation_history_collection,
    get_recommendations_collection,
    get_flow_instances_collection,
    get_flow_responses_collection,
    get_conversations_collection,
    get_messages_collection,
    check_database_health,
    close_connection,
)

__all__ = [
    'get_mongo_client',
    'get_database',
    'get_users_collection',
    'get_recommendation_history_collection',
    'get_recommendations_collection',
    'get_flow_instances_collection',
    'get_flow_responses_collection',
    'get_conversations_collection',
    'get_messages_collection',
    'check_database_health',
    'close_connection',
]