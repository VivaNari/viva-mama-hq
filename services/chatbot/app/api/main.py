from __future__ import annotations
import time
import secrets
import logging
import uuid
from typing import Optional, List, Dict, Any
import json
from fastapi import FastAPI, HTTPException, Header, Depends, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.chains.chat_pipeline_mcp import chat_once, chat_once_name_detector
from app.memory.redis_memory import RedisSessionMemory
from app.settings import settings

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

limiter = Limiter(key_func=get_remote_address)

API_KEY = settings.api_key

app = FastAPI(
    title="Postpartum Wellness Assistant (RAG + MCP)",
    version="0.1.0",
    description="AI-powered postpartum wellness chatbot with personalized recommendations"  # (12)
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.is_development else [],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request Models
class ChatRequest(BaseModel):
    """Chat request with user context"""
    query: str = Field(..., min_length=1, max_length=2000, description="User's message")
    user_id: Optional[str] = Field(None, description="User's MongoDB ObjectId for personalization")
    session_id: Optional[str] = Field(None, description="Conversation session ID")

class ChatResponse(BaseModel):
    """Chat response with metadata"""
    session_id: str
    answer: str
    intent: str
    used_rag: bool
    rag_best_score: float
    products: List[Dict[str, Any]] = []
    escalation_banner: Optional[str] = None
    latency_seconds: Optional[float] = None
    request_id: Optional[str] = None
    final_prompt: Optional[str] = None

class ChatNameDetectorRequest(BaseModel):
    """Name detection request"""
    response: str = Field(..., min_length=1, max_length=500)

class ChatNameDetectorResponse(BaseModel):
    detected_name: Optional[str] = None
    has_name: bool
    ask_back: Optional[str] = None

def require_api_key(x_api_key: Optional[str] = Header(None)):
    """
    API key authentication with timing-attack protection.
    
    Security improvements:
    - Uses secrets.compare_digest() to prevent timing attacks (2)
    - Clear error messages
    - Logs authentication attempts (6)
    """
    if API_KEY:
        if not x_api_key:
            logger.warning("Authentication failed: Missing X-API-Key header")  # (6)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing X-API-Key header"
            )
        
        # Use constant-time comparison to prevent timing attacks (2)
        if not secrets.compare_digest(x_api_key, API_KEY):
            logger.warning(f"Authentication failed: Invalid API key")  # (6)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid X-API-Key"
            )

    return True


def get_memory() -> RedisSessionMemory:
    return RedisSessionMemory(window_size=6)

@app.on_event("startup")  # 60 requests per minute per IP
async def startup_event():
    """Log application startup""" 
    logger.info("=" * 60)
    logger.info("🏥 Viva Mama API Starting")
    logger.info("=" * 60)
    logger.info(f"Environment: {settings.env}")
    logger.info(f"LLM Model: {settings.llm_model}")
    logger.info(f"Products Source: {settings.products_source}")
    logger.info("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    """Log application shutdown"""  
    logger.info("=" * 60)
    logger.info("🏥 Viva Mama API Shutting Down")
    logger.info("=" * 60)

@app.get("/admin/health", tags=["admin"])
@limiter.limit("120/minute")
async def health(request: Request):
    """
    Enhanced health check endpoint.
    
    Checks:
    - Application status
    - Redis connection (fallback mode)
    - MongoDB connection
    """ 
    mem = get_memory()
    
    mongodb_status = "ok"
    try:
        from app.mcp.db_connection import check_database_health
        db_health = check_database_health()
        mongodb_status = "ok" if db_health.get("connected") else "error"
    except Exception as e:
        logger.error(f"MongoDB health check failed: {str(e)}")
        mongodb_status = "error"
    
    checks = {
        "app": "ok",
        "redis_fallback": mem.using_fallback,
        "redis_status": "fallback" if mem.using_fallback else "connected",
        "ttl_seconds": mem.ttl_seconds,
        "mongodb_status": mongodb_status
    }
    
    # Return 503 if critical services are down
    status_code = 200 if mongodb_status == "ok" else 503
    
    return JSONResponse(
        {"status": "ok" if status_code == 200 else "degraded", "checks": checks},
        status_code=status_code
    )

@app.post("/v1/chat", response_model=ChatResponse, tags=["chat"])
@limiter.limit("60/minute")
async def chat_endpoint(
    req: ChatRequest,
    request: Request,
    ok: bool = Depends(require_api_key)
):
    """
    Main chat endpoint with personalization support.
    
    - Accepts a query and optional user_id for personalization
    - Returns structured chat response with metadata
    - Includes request tracking and error handling
    
    Args:
        req: Chat request with query, user_id, and session_id
        request: FastAPI request object for metadata
        ok: Authentication dependency
        
    Returns:
        ChatResponse with answer, intent, and metadata
    """ 
    request_id = str(uuid.uuid4())
    
    logger.info(
        f"[{request_id}] Chat request: "
        f"user_id={req.user_id}, "
        f"session_id={req.session_id}, "
        f"query_length={len(req.query)}"
    )

    start = time.time()
    logger.info(f"hi hi hi hi hi {req}")
    try:
        result = await chat_once(
            req.query,
            user_id=req.user_id, 
            session_id=req.session_id
        )
        
        elapsed = time.time() - start
        # print(result)
        logger.info(
            f"[{request_id}] Success: "
            f"intent={result.intent}, "
            f"used_rag={result.used_rag}, "
            f"latency={elapsed:.3f}s"
        )
        
        resp = ChatResponse(
            session_id=result.session_id,
            answer=result.answer,
            intent=result.intent,
            used_rag=result.used_rag,
            rag_best_score=result.rag_best_score,
            products=getattr(result, "products", []),
            escalation_banner=result.escalation_banner or None,
            latency_seconds=round(elapsed, 3),
            request_id=request_id,
            final_prompt=getattr(result, "final_prompt", None),
        )

        return resp
    
    except Exception as e:
        elapsed = time.time() - start
        
        logger.error(
            f"[{request_id}] Error: {str(e)}, "
            f"latency={elapsed:.3f}s",
            exc_info=True
        )
        
        raise HTTPException(
            status_code=500,
            detail="An error occurred processing your request. Please try again or contact support."
        )

@app.post("/v1/chat/username", response_model=ChatNameDetectorResponse, tags=["chat"])
@limiter.limit("30/minute")
async def chat_once_name_detector_endpoint(
    req: ChatNameDetectorRequest,
    request: Request,
    ok: bool = Depends(require_api_key)
):
    """
    Name detection endpoint.
    
    Detects if user's message contains their name for personalization.
    
    Args:
        req: Name detector request with user's response
        request: FastAPI request object
        ok: Authentication dependency
        
    Returns:
        ChatNameDetectorResponse with detected name info
    """ 
    request_id = str(uuid.uuid4())
    
    logger.info(f"[{request_id}] Name detection request")

    start = time.time()
    try:
        result = chat_once_name_detector(req.response)
        
        elapsed = time.time() - start
        
        raw = result.get("answer", "")
        logger.debug(f"[{request_id}] Raw LLM response: {raw[:100]}")  # (6)

        clean = raw.strip()

        if clean.startswith("```"):
            clean = clean.strip("`").strip()

        parsed = json.loads(clean)
        
        logger.info(
            f"[{request_id}] Name detection result: "
            f"has_name={parsed.get('has_name')}, "
            f"latency={elapsed:.3f}s"
        )
        
        resp = ChatNameDetectorResponse(
            detected_name=parsed.get("name"),
            has_name=parsed.get("has_name"),
            ask_back=parsed.get("ask_back"),   
        )

        return resp
    
    except Exception as e:
        elapsed = time.time() - start
        
        logger.error(
            f"[{request_id}] Name detection error: {str(e)}, "
            f"latency={elapsed:.3f}s",
            exc_info=True
        )
        
        raise HTTPException(
            status_code=500,
            detail="An error occurred processing your request."
        )