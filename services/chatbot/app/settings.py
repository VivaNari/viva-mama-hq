"""
Centralized Application Configuration

This module manages all application settings loaded from environment variables.
Uses Pydantic for type-safe configuration with validation.

Required Environment Variables:
    GROQ_API_KEY: Groq API key for LLM access (from console.groq.com)
    API_KEY: Internal API authentication key (generate strong key)
    MONGODB_URI: MongoDB connection string

Optional Environment Variables:
    See .env.example for full list with descriptions

Usage:
    from app.settings import settings

    # Access settings
    api_key = settings.groq_api_key

    # Check environment
    if settings.is_production:
        # Production-specific logic
        pass

Author: Viva Mama Team
"""

import logging
import sys
from enum import Enum
from typing import Literal, Optional

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Configure logging for settings module
logger = logging.getLogger(__name__)


# ============================================
# ENUMS & CONSTANTS
# ============================================


class Environment(str, Enum):
    """Valid runtime environments"""

    DEV = "dev"
    STAGING = "staging"
    PRODUCTION = "production"


class ProductSource(str, Enum):
    """Valid product data sources"""

    LOCAL = "local"
    MCP = "mcp"


# ============================================
# SETTINGS CLASS
# ============================================


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings are validated at load time. If validation fails,
    the application will exit with a clear error message.

    Settings are loaded from:
    1. Environment variables (highest priority)
    2. .env file in project root
    3. Default values (lowest priority)

    Attributes:
        env: Runtime environment (dev/staging/production)
        groq_api_key: Groq API key for LLM access
        llm_model: Main LLM model name
        scope_classifier_model: Smaller model for quick classifications
        api_key: Internal API authentication key
        redis_url: Redis connection string
        memory_ttl_seconds: Session memory TTL in seconds
        embeddings_model: Sentence transformer model for RAG
        local_vector_dir: Directory for FAISS vector store
        rag_top_k: Number of documents to retrieve
        rag_score_threshold: Minimum similarity score (0-1)
        products_source: Product data source (local/mcp)
        mongodb_uri: MongoDB connection string
        mongodb_database: MongoDB database name
    """

    # ============================================
    # Environment Configuration
    # ============================================

    env: Environment = Field(
        default=Environment.DEV, description="Runtime environment: dev, staging, or production"
    )

    # ============================================
    # LLM Configuration (Groq)
    # ============================================

    # Which LLM backend to use. "vertex" = Google Vertex AI (Gemini), the
    # default; "groq" = the legacy Groq path (kept as a one-flag rollback).
    # Flipping this + the three *_model values below switches providers with no
    # code change.
    llm_provider: Literal["vertex", "groq"] = Field(
        default="vertex", description="LLM backend: 'vertex' (Gemini on Vertex AI) or 'groq'."
    )

    groq_api_key: str = Field(
        default="",  # Optional now — only required when llm_provider='groq'
        description="Groq API key from console.groq.com/keys. Required only when llm_provider='groq'.",
    )

    # ---- Vertex AI (Gemini) ----
    vertex_project: str = Field(
        default="",
        description=(
            "GCP project for Vertex AI. Empty = inferred from Application Default "
            "Credentials (the Cloud Run runtime SA in prod, or `gcloud auth "
            "application-default login` locally)."
        ),
    )

    vertex_location: str = Field(
        default="asia-south1",
        description=(
            "Vertex AI region. asia-south1 (Mumbai) keeps inference in-region for "
            "data residency; fall back to another region only if the model isn't "
            "served there."
        ),
    )

    # Model IDs are provider-specific. Defaults below are the VERTEX (Gemini)
    # IDs. For a Groq rollback, set llm_provider=groq AND override these three
    # env vars with the Groq model names (e.g. llama-3.3-70b-versatile).
    llm_model: str = Field(
        default="gemini-2.5-flash",
        description="Primary LLM model for chat responses (main generation).",
    )

    scope_classifier_model: str = Field(
        default="gemini-2.5-flash",
        description="Smaller/faster model for the scope + grounding YES/NO classifier.",
    )

    translation_model: str = Field(
        default="gemini-2.5-flash",
        description=(
            "Model used to translate non-English / Hinglish queries to English "
            "before RAG retrieval. Uses a capable model because small models "
            "mistranslate domain terms (e.g. 'nehlana' -> 'circumcise' instead of "
            "'bathe'), which silently breaks retrieval."
        ),
    )

    # ============================================
    # API Authentication
    # ============================================

    api_key: str = Field(
        ...,  # Required - no default
        min_length=8,
        description="Internal API authentication key (use strong random key)",
    )

    # ============================================
    # Redis (Session Memory)
    # ============================================

    redis_url: str = Field(
        default="redis://localhost:6379/0", description="Redis connection URL for session storage"
    )

    memory_ttl_seconds: int = Field(
        default=7200,
        gt=0,
        le=86400,  # Max 24 hours
        description="Session memory TTL in seconds (default: 2 hours)",
    )

    # ============================================
    # RAG (Retrieval-Augmented Generation)
    # ============================================

    embeddings_model: str = Field(
        default="BAAI/bge-m3",
        description=(
            "HuggingFace model for text embeddings. bge-m3 is multilingual: it "
            "maps Hindi/Hinglish queries and English documents into one shared "
            "space, so non-English queries match directly without depending on a "
            "per-request translation step. NOTE: changing this requires rebuilding "
            "the FAISS index (`python ingest_data.py`) — vector dims differ."
        ),
    )

    local_vector_dir: str = Field(
        default=".local_vector_store", description="Directory to store FAISS vector index"
    )

    model_gcs_uri: str = Field(
        default="",
        description=(
            "gs:// URI of the flat embedding-model folder that Cloud Run downloads "
            "at boot (the model is no longer baked into the runtime image). When "
            "empty, the model is loaded by name instead (baked image / local dev / "
            "HF download). Set on Cloud Run, e.g. gs://vivamama-rag-model/bge-m3."
        ),
    )

    model_local_dir: str = Field(
        default="/models/bge-m3",
        description=(
            "Local directory the embedding model is downloaded to (from "
            "model_gcs_uri) and loaded from. Used only when model_gcs_uri is set."
        ),
    )

    ingest_progress: bool = Field(
        default=False,
        description=(
            "Show a tqdm progress bar (with ETA) while embedding the corpus "
            "during ingest. Enable via .env or INGEST_PROGRESS=1. Leave off at "
            "runtime — per-query embeds are a single tiny batch."
        ),
    )

    rag_top_k: int = Field(
        default=6, gt=0, le=20, description="Number of documents to retrieve from vector store"
    )

    rag_score_threshold: float = Field(
        default=0.55,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score (0-1) to use RAG context",
    )

    rag_translation_fallback_threshold: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description=(
            "If retrieval on the raw user query scores below this, fall back to "
            "translating the query to English and retrieving again (keeping the "
            "better result). With multilingual embeddings the raw query usually "
            "suffices, so the costly translation LLM call only fires when needed. "
            "Also the trigger for the curated-content fallback search."
        ),
    )

    enable_grounding_gate: bool = Field(
        default=False,
        description=(
            "Deterministic pre-LLM grounding check. When True, a fast classifier "
            "decides whether the retrieved context contains a direct answer and, if "
            "not, short-circuits to a canned fallback (the main LLM never runs). "
            "When False (default) the gate is bypassed and the main LLM is the sole "
            "grounding authority via its ANSWERING RULES — it answers from context "
            "when relevant (even partially) and soft-falls-back only when nothing "
            "relevant exists. Kept as a flag for instant rollback."
        ),
    )

    disable_product_recommendations: bool = Field(
        default=True,
        description=(
            "Toggle for product recommendations. When True (ON, current default), the "
            "products catalog is NOT added to the prompt and the model is told not to "
            "recommend any product — currently ON to temporarily stop all product "
            "suggestions everywhere (local + deployed, since the image has no .env). "
            "Set False to inject the products directory again and let the chatbot "
            "recommend products."
        ),
    )

    # ============================================
    # Content fallback (curated `contents` collection)
    # ============================================

    enable_content_source: bool = Field(
        default=True,
        description=(
            "When True, and RAG retrieves weakly, search the curated `contents` "
            "collection (MongoDB $text) and add matches to the prompt as a "
            "secondary knowledge source ranked after RAG."
        ),
    )

    content_search_limit: int = Field(
        default=3, gt=0, le=10, description="Max number of curated content articles to retrieve."
    )

    content_min_score: float = Field(
        default=0.5, ge=0.0, description="Minimum MongoDB textScore for a content match to be used."
    )

    content_max_chars: int = Field(
        default=2400,
        gt=0,
        description="Character cap on the assembled content block (token budget).",
    )

    # ============================================
    # Products
    # ============================================

    products_source: ProductSource = Field(
        default=ProductSource.LOCAL,
        description="Product data source: 'local' (in-memory) or 'mcp' (server)",
    )

    # ============================================
    # MongoDB
    # ============================================

    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection string (include credentials for production)",
    )

    mongodb_database: str = Field(default="viva_mama", description="MongoDB database name")

    # ============================================
    # Pydantic Configuration
    # ============================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # Allow GROQ_API_KEY or groq_api_key
        extra="ignore",  # Ignore unknown environment variables
    )

    # ============================================
    # VALIDATORS
    # ============================================

    @field_validator("groq_api_key")
    @classmethod
    def validate_groq_api_key(cls, v: str) -> str:
        """Validate Groq API key format when provided.

        The key is optional now (Vertex is the default provider); an empty value
        is allowed here and cross-checked against llm_provider afterwards.
        """
        v = v.strip()

        if not v:
            return v  # optional — see _validate_provider_credentials

        # Check for common placeholder values
        invalid_placeholders = [
            "your_groq_api_key_here",
            "your_api_key_here",
            "change_me",
            "xxx",
        ]

        if v.lower() in invalid_placeholders:
            raise ValueError(
                f"GROQ_API_KEY appears to be a placeholder: '{v}'. "
                "Please set a real API key from https://console.groq.com/keys"
            )

        # Groq keys should start with 'gsk_'
        if not v.startswith("gsk_"):
            logger.warning(
                "GROQ_API_KEY does not start with 'gsk_'. This may not be a valid Groq API key."
            )

        return v

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """Validate internal API key is strong enough"""
        v = v.strip()

        if not v:
            raise ValueError("API_KEY cannot be empty")

        # Warn about weak keys
        weak_keys = ["abc", "test", "password", "123456", "admin", "secret"]
        if v.lower() in weak_keys:
            raise ValueError(
                f"API_KEY '{v}' is too weak for production. "
                f"Generate a strong key with: openssl rand -hex 32"
            )

        # Recommend strong keys for production
        if len(v) < 16:
            logger.warning(
                f"API_KEY is short ({len(v)} chars). "
                f"Recommend at least 32 chars for production. "
                f"Generate with: openssl rand -hex 32"
            )

        return v

    @field_validator("mongodb_uri")
    @classmethod
    def validate_mongodb_uri(cls, v: str) -> str:
        """Validate MongoDB URI format"""
        v = v.strip()

        if not v:
            raise ValueError("MONGODB_URI cannot be empty")

        if not v.startswith("mongodb://") and not v.startswith("mongodb+srv://"):
            raise ValueError(
                f"MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://' Got: {v[:20]}..."
            )

        # Warn if using localhost in production
        if "localhost" in v or "127.0.0.1" in v:
            logger.warning(
                "MONGODB_URI points to localhost. "
                "Make sure this is intentional for your environment."
            )

        return v

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, v: str) -> str:
        """Validate Redis URL format"""
        v = v.strip()

        if not v:
            raise ValueError("REDIS_URL cannot be empty")

        if not v.startswith("redis://") and not v.startswith("rediss://"):
            raise ValueError(
                f"REDIS_URL must start with 'redis://' or 'rediss://' Got: {v[:20]}..."
            )

        return v

    @model_validator(mode="after")
    def _validate_provider_credentials(self):
        """Ensure the selected LLM provider has what it needs.

        Vertex authenticates via ADC (no key here); Groq needs GROQ_API_KEY.
        """
        if self.llm_provider == "groq" and not self.groq_api_key:
            raise ValueError(
                "GROQ_API_KEY is required when LLM_PROVIDER=groq. "
                "Either set the key or use LLM_PROVIDER=vertex."
            )
        return self

    # ============================================
    # UTILITY PROPERTIES
    # ============================================

    @property
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.env == Environment.DEV

    @property
    def is_staging(self) -> bool:
        """Check if running in staging mode"""
        return self.env == Environment.STAGING

    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.env == Environment.PRODUCTION

    def to_dict(self, hide_secrets: bool = True) -> dict:
        """
        Convert settings to dictionary for debugging.

        Args:
            hide_secrets: If True, mask sensitive values

        Returns:
            Dictionary of settings
        """
        data = self.model_dump()

        if hide_secrets:
            # Mask sensitive fields
            sensitive_fields = ["groq_api_key", "api_key", "mongodb_uri"]
            for field in sensitive_fields:
                if field in data and data[field]:
                    # Show first 4 chars + ***
                    data[field] = f"{data[field][:4]}{'*' * 20}"

        return data

    def log_configuration(self) -> None:
        """Log current configuration (with secrets masked)"""
        logger.info("=" * 60)
        logger.info("Application Configuration Loaded")
        logger.info("=" * 60)

        config = self.to_dict(hide_secrets=True)
        for key, value in config.items():
            logger.info(f"  {key}: {value}")

        logger.info("=" * 60)


# ============================================
# SINGLETON PATTERN
# ============================================

_settings: Optional[Settings] = None


def get_settings(reload: bool = False) -> Settings:
    """
    Get or create settings instance (singleton pattern).

    This allows testing with different configurations and
    prevents settings from being loaded at import time.

    Args:
        reload: If True, force reload settings from environment

    Returns:
        Settings instance

    Raises:
        ValidationError: If settings are invalid

    Example:
        >>> from app.settings import get_settings
        >>> settings = get_settings()
        >>> print(settings.env)
        'dev'

        >>> # Force reload (useful for tests)
        >>> settings = get_settings(reload=True)
    """
    global _settings

    if _settings is None or reload:
        try:
            _settings = Settings()

            # Log successful load
            logger.info(f"✅ Settings loaded successfully (env={_settings.env.value})")

            # Log configuration in debug mode
            if _settings.is_development:
                _settings.log_configuration()

        except ValidationError as e:
            logger.error("=" * 60)
            logger.error("❌ CONFIGURATION ERROR")
            logger.error("=" * 60)
            logger.error("Failed to load application settings.")
            logger.error("Please check your .env file and environment variables.")
            logger.error("")
            logger.error("Validation errors:")
            for error in e.errors():
                field = " -> ".join(str(loc) for loc in error["loc"])
                logger.error(f"  • {field}: {error['msg']}")
            logger.error("")
            logger.error("See .env.example for configuration template.")
            logger.error("=" * 60)

            # Exit in production, raise in development
            if "ENV" in str(e) or True:  # Always exit on config errors
                sys.exit(1)
            else:
                raise

    return _settings


# ============================================
# BACKWARDS COMPATIBILITY
# ============================================

# Create settings instance for backward compatibility
# Most code imports: from app.settings import settings
try:
    settings = get_settings()
except Exception:
    # If settings fail to load at import time, create a placeholder
    # This allows imports to succeed even if .env is missing
    # The actual error will be raised when settings are accessed
    logger.warning("Settings could not be loaded at import time")
    settings = None  # type: ignore


# ============================================
# CONFIGURATION HELPER
# ============================================


def validate_settings() -> bool:
    """
    Validate all settings and print results.
    Useful for deployment health checks.

    Returns:
        True if all settings are valid

    Example:
        >>> from app.settings import validate_settings
        >>> if validate_settings():
        ...     print("Configuration is valid!")
    """
    try:
        s = get_settings(reload=True)
        print("All settings validated successfully")
        print(f"   Environment: {s.env.value}")
        print(f"   MongoDB: {s.mongodb_uri[:30]}...")
        print(f"   Redis: {s.redis_url}")
        print(f"   Products: {s.products_source.value}")
        return True
    except ValidationError as e:
        print("Settings validation failed:")
        for error in e.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            print(f"   • {field}: {error['msg']}")
        return False
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return False


if __name__ == "__main__":
    # Allow running as script to validate configuration
    print("\n Validating Configuration...\n")
    if validate_settings():
        print("\n Configuration is valid and ready for deployment!\n")
        sys.exit(0)
    else:
        print("\n Configuration has errors. Please fix them before deploying.\n")
        sys.exit(1)
