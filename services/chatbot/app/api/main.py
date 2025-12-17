from __future__ import annotations
import os
import time
from typing import Optional
import json
from fastapi import FastAPI, HTTPException, Header, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.chains.chat_pipeline import chat_once, chat_once_name_detector
from app.memory.redis_memory import RedisSessionMemory
from app.settings import settings

API_KEY = settings.api_key

app = FastAPI(title="Postpartum Wellness Assistant (RAG + MCP)", version="0.1.0")

class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    answer: str
    intent: str
    used_rag: bool
    rag_best_score: float
    products: list = []
    escalation_banner: Optional[str] = None

class ChatNameDetectorResponse(BaseModel):
    detected_name: Optional[str] = None
    has_name: bool
    ask_back: Optional[str] = None

def require_api_key(x_api_key: Optional[str] = Header(None)):
    """
    Basic API key check. If you deploy in production:
      - Use a proper auth layer (JWT, OAuth, SSO).
      - Store keys hashed in a DB.
      - Add rate-limiting and quota enforcement.
    """
    if API_KEY:
        if not x_api_key or x_api_key != API_KEY:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid X-API-Key")
    return True


def get_memory() -> RedisSessionMemory:
    return RedisSessionMemory(window_size=6)


@app.get("/admin/health", tags=["admin"])
async def health():
    mem = get_memory()
    checks = {"app": "ok", "redis_fallback": mem.using_fallback, "ttl_seconds": mem.ttl_seconds}
    return JSONResponse({"status": "ok", "checks": checks})

@app.post("/chat", response_model=ChatResponse, tags=["chat"])
async def chat_endpoint(req: ChatRequest, ok: bool = Depends(require_api_key)):
    """
    Single-turn chat endpoint.
    - Accepts a query and optional session_id
    - Returns the structured payload produced by chat_once()
    """

    start = time.time()
    try:
        result = await chat_once(req.query, session_id=req.session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    elapsed = time.time() - start
    
    result_meta = {
        "latency_seconds": round(elapsed, 3)
    }

    resp = ChatResponse(
        session_id=result["session_id"],
        answer=result["answer"],
        intent=result["intent"],
        used_rag=result["used_rag"],
        rag_best_score=result["rag_best_score"],
        products=result.get("products", []),
        escalation_banner=result.get("escalation_banner") or None,
    )

    return resp

@app.get("/chat/username")
async def chat_once_name_detector_endpoint(
    response: str,
    session_id: Optional[str] = None,
):
    """
    Single-turn chat endpoint.
    - Accepts a query and optional session_id
    - Returns the structured payload produced by chat_once()
    """

    start = time.time()
    try:
        result = chat_once_name_detector(response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    elapsed = time.time() - start
    
    result_meta = {
        "latency_seconds": round(elapsed, 3)
    }
    raw = result.get("answer", "")
    print("RAW ANSWER:", repr(raw))  # debug

    clean = raw.strip()

    # If answer contains triple backticks, remove them
    if clean.startswith("```"):
        clean = clean.strip("`").strip()

    parsed = json.loads(clean)
    print(parsed)
    resp = ChatNameDetectorResponse(
        detected_name=parsed.get("name"),
        has_name=parsed.get("has_name"),
        ask_back=parsed.get("ask_back"),   
    )

    return resp
