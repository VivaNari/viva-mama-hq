# app/settings.py
# ----------------
# Centralized configuration using Pydantic Settings.
# Reads from environment variables (and .env in development).
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Environment
    env: str = "dev"

    # Groq LLM
    groq_api_key: str
    llm_model: str = "llama-3.1-70b-versatile"

    # Redis (session memory)
    redis_url: str = "redis://localhost:6379/0"
    memory_ttl_seconds: int = 7200  # 2 hours per session

    # RAG
    embeddings_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    local_vector_dir: str = ".local_vector_store"
    rag_top_k: int = 6
    # If similarity < threshold across all docs, we fallback to model KB
    rag_score_threshold: float = 0.55  # cosine similarity-ish scale [0..1]

    # Products source (local repo vs. MCP server)
    products_source: str = "local"  # "local" or "mcp"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
