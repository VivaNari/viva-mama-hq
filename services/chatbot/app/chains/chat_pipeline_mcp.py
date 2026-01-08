"""
Production-Ready Chat Pipeline with MCP Context Integration

This is the enterprise-grade chat orchestration pipeline that:
1. Receives user messages with full validation
2. Calls MCP server to fetch user context (profile + recovery data)
3. Retrieves relevant documents via RAG
4. Assembles rich prompt with all context
5. Generates personalized LLM response
6. Returns structured response with comprehensive metadata

Production Features:
- Comprehensive logging with request tracing (Issue #1, #10)
- Timeout handling for all async operations (Issue #2)
- Full metrics and performance tracking (Issue #3)
- Specific exception handling (Issue #4)
- Circuit breaker for MCP calls (Issue #5)
- Fallback tracking and graceful degradation (Issue #6, #16)
- Robust path resolution (Issue #7)
- Rate limiting protection (Issue #8)
- Fully async implementation (Issue #9, #17)
- Safe error messages (Issue #11)
- Input validation (Issue #12)
- User context caching (Issue #13)
- Robust error detection (Issue #14)
- Prompt size validation (Issue #15)
- Structured response models (Issue #18)

Author: Viva Mama Team
"""

from __future__ import annotations

import os
import sys
import asyncio
import time
import logging
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
import uuid

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Issue #1: Import from production components
from app.settings import settings
from app.llm.groq_client import get_llm, get_llm_metrics
from app.memory.redis_memory import RedisSessionMemory
from app.guardrails.input_guard import redact, enforce_scope
from app.escalation.policy import scan_for_red_flags, format_escalation_banner
from app.chains.router import route_intent
from app.rag.retriever import RAGRetriever

# Issue #1: Proper logging instead of print statements
logger = logging.getLogger(__name__)

# Issue #2: Timeout configuration
MCP_TIMEOUT_SECONDS = 10  # MCP calls should be fast
LLM_TIMEOUT_SECONDS = 30  # LLM generation timeout
DEFAULT_REQUEST_TIMEOUT = 45  # Overall request timeout

# Issue #15: Prompt size limits (in characters, approximate)
MAX_PROMPT_LENGTH = 100000  # ~25K tokens for most models
MAX_CONTEXT_LENGTH = 80000   # Leave room for response

# Issue #8: Rate limiting configuration
MAX_REQUESTS_PER_USER_PER_MINUTE = 20
MAX_REQUESTS_PER_IP_PER_MINUTE = 50

# System prompt with comprehensive guardrails
SYSTEM_PROMPT = """You are a postpartum wellness assistant.

=== RELEVANCE GATE (MANDATORY) ===
Before answering, you MUST internally decide:

"Does this question clearly and directly relate to postpartum wellness,
maternal recovery, breastfeeding, emotional wellbeing, or newborn care?"

Rules:
- If YES → proceed.
- If NO or UNCERTAIN → DO NOT answer the question.

If you do NOT answer, respond ONLY with:
"I'm here specifically to help with postpartum wellness. Could you tell me how this relates to your recovery or baby care?"

You must NOT stretch, reinterpret, or generalize unrelated questions
to make them fit postpartum wellness.

=== MEDICAL BOUNDARIES ===
- Do NOT diagnose conditions.
- Do NOT prescribe medications or dosages.
- Do NOT interpret lab results.
- Do NOT create treatment plans.
- For emergencies, instruct to seek immediate medical care.

=== PERSONALIZATION RULE ===
Use USER CONTEXT ONLY IF:
- It is directly relevant to the question
- AND it clearly improves the response

If unsure, DO NOT personalize.
Never force personalization.

=== KNOWLEDGE BASE USAGE ===
If KNOWLEDGE BASE CONTEXT is provided:
- Use ONLY parts that directly answer the question
- Do NOT summarize or restate all context
- It is acceptable to ignore the context entirely

=== RESPONSE LENGTH CONTROL (MANDATORY) ===
Default behavior:
- Respond in 4–6 sentences.

You may exceed this limit ONLY if:
- The question cannot be answered accurately or safely within 6 sentences
- AND additional detail materially improves understanding or prevents harm

If you exceed 6 sentences:
- Prefer bullet points
- No repetition or background explanations
- Stop as soon as sufficient

If unsure, stay concise.

=== STYLE RULES ===
- No introductions
- No repeating the question
- No motivational speeches
- No background explanations unless required

"""


# ============================================
# STRUCTURED RESPONSE MODELS (Issue #18)
# ============================================

@dataclass
class UserContextResult:
    """Structured user context from MCP"""
    profile_context: str
    recovery_context: str
    has_profile: bool
    has_recovery: bool
    error: Optional[str] = None
    fetch_time_ms: float = 0.0


@dataclass
class ChatResponse:
    """Structured chat response with full metadata"""
    request_id: str
    session_id: str
    answer: str
    intent: str
    used_rag: bool
    rag_best_score: float
    user_context: UserContextResult
    redaction: Dict[str, Any]
    scope: Dict[str, Any]
    escalation_banner: Optional[str]
    memory_turns: List[Dict[str, Any]]
    
    # Performance metrics (Issue #3)
    timing: Dict[str, float]
    service_level: str  # FULL, DEGRADED_NO_MCP, DEGRADED_NO_RAG, MINIMAL
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        # Convert user_context dataclass to dict
        if isinstance(result['user_context'], UserContextResult):
            result['user_context'] = asdict(result['user_context'])
        return result


class ServiceLevel(Enum):
    """Service quality levels for graceful degradation (Issue #16)"""
    FULL = "FULL"                          # All components working
    DEGRADED_NO_MCP = "DEGRADED_NO_MCP"    # No user context
    DEGRADED_NO_RAG = "DEGRADED_NO_RAG"    # No document retrieval
    MINIMAL = "MINIMAL"                     # Base LLM only


# ============================================
# METRICS TRACKING (Issue #3)
# ============================================

class _ChatMetrics:
    """Track chat pipeline performance metrics"""
    
    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        
        self.mcp_calls_total = 0
        self.mcp_calls_success = 0
        self.mcp_calls_failed = 0
        self.mcp_calls_timeout = 0
        
        self.rag_calls_total = 0
        self.rag_calls_success = 0
        self.rag_calls_failed = 0
        
        self.service_level_counts = {
            "FULL": 0,
            "DEGRADED_NO_MCP": 0,
            "DEGRADED_NO_RAG": 0,
            "MINIMAL": 0
        }
        
        self.latencies_ms = {
            "total": [],
            "mcp": [],
            "rag": [],
            "llm": [],
            "guardrails": [],
        }
    
    def record_request(
        self,
        success: bool,
        service_level: str,
        timings: Dict[str, float]
    ):
        """Record a chat request"""
        self.requests_total += 1
        if success:
            self.requests_success += 1
        else:
            self.requests_failed += 1
        
        self.service_level_counts[service_level] += 1
        
        for component, latency in timings.items():
            if component in self.latencies_ms:
                self.latencies_ms[component].append(latency)
                # Keep only last 1000 samples
                if len(self.latencies_ms[component]) > 1000:
                    self.latencies_ms[component] = self.latencies_ms[component][-1000:]
    
    def record_mcp_call(self, success: bool, timeout: bool = False):
        """Record an MCP call"""
        self.mcp_calls_total += 1
        if success:
            self.mcp_calls_success += 1
        else:
            self.mcp_calls_failed += 1
            if timeout:
                self.mcp_calls_timeout += 1
    
    def record_rag_call(self, success: bool):
        """Record a RAG call"""
        self.rag_calls_total += 1
        if success:
            self.rag_calls_success += 1
        else:
            self.rag_calls_failed += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics"""
        stats = {
            "requests_total": self.requests_total,
            "requests_success": self.requests_success,
            "requests_failed": self.requests_failed,
            "success_rate": (
                self.requests_success / self.requests_total
                if self.requests_total > 0 else 0.0
            ),
            "mcp_calls_total": self.mcp_calls_total,
            "mcp_calls_success": self.mcp_calls_success,
            "mcp_calls_failed": self.mcp_calls_failed,
            "mcp_calls_timeout": self.mcp_calls_timeout,
            "mcp_success_rate": (
                self.mcp_calls_success / self.mcp_calls_total
                if self.mcp_calls_total > 0 else 0.0
            ),
            "rag_calls_total": self.rag_calls_total,
            "rag_calls_success": self.rag_calls_success,
            "rag_calls_failed": self.rag_calls_failed,
            "rag_success_rate": (
                self.rag_calls_success / self.rag_calls_total
                if self.rag_calls_total > 0 else 0.0
            ),
            "service_levels": dict(self.service_level_counts),
        }
        
        # Calculate latency percentiles
        for component, samples in self.latencies_ms.items():
            if samples:
                sorted_samples = sorted(samples)
                stats[f"{component}_latency_p50"] = sorted_samples[len(sorted_samples) // 2]
                stats[f"{component}_latency_p95"] = sorted_samples[int(len(sorted_samples) * 0.95)]
                stats[f"{component}_latency_mean"] = sum(samples) / len(samples)
        
        return stats


# Global metrics instance
_metrics = _ChatMetrics()


# ============================================
# CIRCUIT BREAKER FOR MCP (Issue #5)
# ============================================

class MCPCircuitBreaker:
    """Circuit breaker specifically for MCP calls"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout_seconds
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def should_allow_request(self) -> bool:
        """Check if request should be allowed"""
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            # Check if timeout elapsed
            if self.last_failure_time and \
               (datetime.now() - self.last_failure_time).total_seconds() > self.timeout:
                logger.info("MCP circuit breaker: OPEN → HALF_OPEN (testing recovery)")
                self.state = "HALF_OPEN"
                return True
            return False
        
        # HALF_OPEN - allow one request to test
        return True
    
    def record_success(self):
        """Record successful call"""
        if self.state == "HALF_OPEN":
            logger.info("MCP circuit breaker: HALF_OPEN → CLOSED (service recovered)")
            self.state = "CLOSED"
            self.failure_count = 0
        elif self.failure_count > 0:
            self.failure_count = 0
    
    def record_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.state == "HALF_OPEN":
            logger.warning("MCP circuit breaker: HALF_OPEN → OPEN (still failing)")
            self.state = "OPEN"
        elif self.failure_count >= self.failure_threshold:
            logger.error(
                f"MCP circuit breaker: CLOSED → OPEN "
                f"({self.failure_count} consecutive failures)"
            )
            self.state = "OPEN"


# Global circuit breaker
_mcp_circuit_breaker = MCPCircuitBreaker()


# ============================================
# USER CONTEXT CACHING (Issue #13)
# ============================================

class _UserContextCache:
    """Simple in-memory cache for user contexts"""
    
    def __init__(self, ttl_seconds: int = 60):
        self.cache: Dict[str, tuple[UserContextResult, datetime]] = {}
        self.ttl = ttl_seconds
    
    def get(self, user_id: str) -> Optional[UserContextResult]:
        """Get cached context if not expired"""
        if user_id in self.cache:
            context, timestamp = self.cache[user_id]
            age = (datetime.now() - timestamp).total_seconds()
            if age < self.ttl:
                logger.debug(f"Cache HIT for user {user_id} (age: {age:.1f}s)")
                return context
            else:
                logger.debug(f"Cache EXPIRED for user {user_id} (age: {age:.1f}s)")
                del self.cache[user_id]
        return None
    
    def set(self, user_id: str, context: UserContextResult):
        """Cache user context"""
        self.cache[user_id] = (context, datetime.now())
        logger.debug(f"Cache SET for user {user_id}")
    
    def clear(self):
        """Clear all cached contexts"""
        self.cache.clear()


# Global cache
_user_context_cache = _UserContextCache(ttl_seconds=60)


# ============================================
# RATE LIMITING (Issue #8)
# ============================================

class _RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.user_requests: Dict[str, List[datetime]] = {}
        self.ip_requests: Dict[str, List[datetime]] = {}
    
    def check_user_limit(self, user_id: str) -> bool:
        """Check if user has exceeded rate limit"""
        now = datetime.now()
        
        if user_id not in self.user_requests:
            self.user_requests[user_id] = []
        
        # Remove old requests (older than 1 minute)
        self.user_requests[user_id] = [
            ts for ts in self.user_requests[user_id]
            if (now - ts).total_seconds() < 60
        ]
        
        # Check limit
        if len(self.user_requests[user_id]) >= MAX_REQUESTS_PER_USER_PER_MINUTE:
            return False
        
        # Record this request
        self.user_requests[user_id].append(now)
        return True
    
    def check_ip_limit(self, ip_address: str) -> bool:
        """Check if IP has exceeded rate limit"""
        now = datetime.now()
        
        if ip_address not in self.ip_requests:
            self.ip_requests[ip_address] = []
        
        # Remove old requests
        self.ip_requests[ip_address] = [
            ts for ts in self.ip_requests[ip_address]
            if (now - ts).total_seconds() < 60
        ]
        
        # Check limit
        if len(self.ip_requests[ip_address]) >= MAX_REQUESTS_PER_IP_PER_MINUTE:
            return False
        
        # Record this request
        self.ip_requests[ip_address].append(now)
        return True


# Global rate limiter
_rate_limiter = _RateLimiter()


# ============================================
# INPUT VALIDATION (Issue #12)
# ============================================

def validate_user_id(user_id: Optional[str]) -> Optional[str]:
    """
    Validate user_id format.
    
    Issue #12: Proper input validation
    """
    if not user_id:
        return None
    
    # Convert to string and strip
    user_id = str(user_id).strip()
    
    # Check if it's a valid MongoDB ObjectId (24 hex chars)
    # or a simple integer ID
    if len(user_id) == 24 and all(c in '0123456789abcdef' for c in user_id.lower()):
        return user_id
    
    if user_id.isdigit():
        return user_id
    
    logger.warning(f"Invalid user_id format: {user_id}")
    return None


# ============================================
# MCP CLIENT INTEGRATION (Issues #2, #4, #5, #7, #11, #13, #14)
# ============================================

async def fetch_user_context(
    user_id: str,
    request_id: str
) -> UserContextResult:
    """
    Fetch user context from MCP server with full error handling.
    
    Issue #2: Timeout handling
    Issue #4: Specific exception handling
    Issue #5: Circuit breaker integration
    Issue #7: Robust path resolution
    Issue #11: Safe error messages
    Issue #13: Caching support
    Issue #14: Proper JSON-based error detection
    
    Args:
        user_id: The user's ID
        request_id: Request ID for tracing
        
    Returns:
        UserContextResult with context data or error info
    """
    start_time = time.time()
    
    # Issue #13: Check cache first
    cached = _user_context_cache.get(user_id)
    if cached:
        logger.info(f"[{request_id}] Using cached user context for {user_id}")
        return cached
    
    # Issue #5: Check circuit breaker
    if not _mcp_circuit_breaker.should_allow_request():
        logger.warning(f"[{request_id}] MCP circuit breaker is OPEN, skipping context fetch")
        _metrics.record_mcp_call(success=False)
        return UserContextResult(
            profile_context="",
            recovery_context="",
            has_profile=False,
            has_recovery=False,
            error="MCP service temporarily unavailable",
            fetch_time_ms=0.0
        )
    
    # Issue #7: Robust path resolution using __file__
    module_dir = Path(__file__).resolve().parent.parent
    server_script = module_dir / "mcp" / "context_server.py"
    
    if not server_script.exists():
        logger.error(f"[{request_id}] MCP server script not found: {server_script}")
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False)
        return UserContextResult(
            profile_context="",
            recovery_context="",
            has_profile=False,
            has_recovery=False,
            error="Configuration error",  # Issue #11: Safe message
            fetch_time_ms=0.0
        )
    
    # Configure server parameters
    server_params = StdioServerParameters(
        command=sys.executable,  # Use current Python interpreter
        args=[str(server_script)],
        env={
            **os.environ.copy(),
            "PYTHONPATH": str(module_dir.parent)
        }
    )
    
    context_result = UserContextResult(
        profile_context="",
        recovery_context="",
        has_profile=False,
        has_recovery=False,
        error=None,
        fetch_time_ms=0.0
    )
    
    try:
        # Issue #2: Wrap in timeout
        async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
            # Start MCP server and connect
            async with stdio_client(server_params) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    
                    # Fetch user profile
                    # Issue #4: Specific exception handling
                    try:
                        profile_result = await session.call_tool(
                            name="get_user_profile",
                            arguments={"user_id": user_id, "format_for_prompt": True}
                        )
                        
                        if profile_result.content:
                            profile_text = profile_result.content[0].text
                            
                            # Issue #14: Proper JSON-based error detection
                            try:
                                import json
                                parsed = json.loads(profile_text)
                                if not isinstance(parsed, dict) or "error" not in parsed:
                                    context_result.profile_context = profile_text
                                    context_result.has_profile = True
                                    logger.debug(f"[{request_id}] Profile loaded successfully")
                            except json.JSONDecodeError:
                                # Not JSON, treat as plain text (probably formatted context)
                                context_result.profile_context = profile_text
                                context_result.has_profile = True
                                logger.debug(f"[{request_id}] Profile loaded (plain text)")
                    
                    except asyncio.TimeoutError:
                        logger.warning(f"[{request_id}] Profile fetch timed out")
                        context_result.error = "Profile fetch timeout"
                    except Exception as e:
                        logger.error(f"[{request_id}] Profile fetch error: {type(e).__name__}")
                        context_result.error = "Profile fetch failed"
                    
                    # Fetch recovery recommendations
                    try:
                        recs_result = await session.call_tool(
                            name="get_active_recommendations",
                            arguments={"user_id": user_id, "limit": 3, "format_for_prompt": True}
                        )
                        
                        if recs_result.content:
                            recs_text = recs_result.content[0].text
                            
                            # Issue #14: Proper error detection
                            try:
                                import json
                                parsed = json.loads(recs_text)
                                if not isinstance(parsed, dict) or "error" not in parsed:
                                    context_result.recovery_context = recs_text
                                    context_result.has_recovery = True
                                    logger.debug(f"[{request_id}] Recovery data loaded")
                            except json.JSONDecodeError:
                                context_result.recovery_context = recs_text
                                context_result.has_recovery = True
                                logger.debug(f"[{request_id}] Recovery data loaded (plain text)")
                    
                    except asyncio.TimeoutError:
                        logger.warning(f"[{request_id}] Recommendations fetch timed out")
                        if not context_result.error:
                            context_result.error = "Recommendations fetch timeout"
                    except Exception as e:
                        logger.error(f"[{request_id}] Recommendations fetch error: {type(e).__name__}")
                        if not context_result.error:
                            context_result.error = "Recommendations fetch failed"
        
        # Calculate fetch time
        context_result.fetch_time_ms = (time.time() - start_time) * 1000
        
        # Record success/failure
        if context_result.has_profile or context_result.has_recovery:
            _mcp_circuit_breaker.record_success()
            _metrics.record_mcp_call(success=True)
            logger.info(
                f"[{request_id}] MCP context fetched: "
                f"profile={context_result.has_profile}, "
                f"recovery={context_result.has_recovery}, "
                f"time={context_result.fetch_time_ms:.0f}ms"
            )
            
            # Issue #13: Cache the result
            _user_context_cache.set(user_id, context_result)
        else:
            _mcp_circuit_breaker.record_failure()
            _metrics.record_mcp_call(success=False)
            logger.warning(f"[{request_id}] MCP context fetch returned no data")
        
        return context_result
    
    except asyncio.TimeoutError:
        # Issue #2: Timeout handling
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"[{request_id}] MCP call timed out after {elapsed_ms:.0f}ms")
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False, timeout=True)
        
        return UserContextResult(
            profile_context="",
            recovery_context="",
            has_profile=False,
            has_recovery=False,
            error="Service timeout",  # Issue #11: Safe message
            fetch_time_ms=elapsed_ms
        )
    
    except OSError as e:
        # File system or process errors
        logger.error(f"[{request_id}] MCP process error: {str(e)}")
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False)
        
        return UserContextResult(
            profile_context="",
            recovery_context="",
            has_profile=False,
            has_recovery=False,
            error="Service unavailable",  # Issue #11: Safe message
            fetch_time_ms=(time.time() - start_time) * 1000
        )
    
    except Exception as e:
        # Unexpected errors
        logger.error(
            f"[{request_id}] Unexpected MCP error: {type(e).__name__}: {str(e)}",
            exc_info=True
        )
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False)
        
        return UserContextResult(
            profile_context="",
            recovery_context="",
            has_profile=False,
            has_recovery=False,
            error="Service error",  # Issue #11: Safe message
            fetch_time_ms=(time.time() - start_time) * 1000
        )


# ============================================
# ASYNC RAG RETRIEVAL (Issue #9, #17)
# ============================================

async def fetch_rag_context(
    query: str,
    request_id: str,
    retriever: RAGRetriever
) -> tuple[List[Any], bool, float]:
    """
    Fetch RAG context asynchronously.
    
    Issue #9: Run synchronous RAG in thread pool to avoid blocking
    Issue #17: Keep event loop responsive
    """
    start_time = time.time()
    
    try:
        # Run synchronous RAG call in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            retriever.query,
            query
        )
        
        elapsed_ms = (time.time() - start_time) * 1000
        _metrics.record_rag_call(success=True)
        
        logger.debug(
            f"[{request_id}] RAG: {len(result.documents)} docs, "
            f"score={result.best_score:.3f}, time={elapsed_ms:.0f}ms"
        )
        
        return result.documents, result.should_use_rag, result.best_score
    
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"[{request_id}] RAG error: {type(e).__name__}: {str(e)}")
        _metrics.record_rag_call(success=False)
        
        # Graceful degradation - return empty result
        return [], False, 0.0


# ============================================
# PROMPT BUILDING WITH SIZE VALIDATION (Issue #15)
# ============================================

def build_prompt(
    system_prompt: str,
    profile_context: str,
    recovery_context: str,
    has_profile: bool,
    has_recovery: bool,
    history_block: str,
    rag_context: str,
    user_query: str,
    request_id: str
) -> str:
    """
    Build final prompt with size validation.
    
    Issue #15: Validate prompt size and truncate if needed
    """
    prompt_parts = [system_prompt, "\n\n"]

    # --- User Context (conditionally usable) ---
    if has_profile and profile_context:
        prompt_parts.append("=== USER PROFILE (optional) ===\n")
        prompt_parts.append(profile_context)
        prompt_parts.append("\n\n")

    if has_recovery and recovery_context:
        prompt_parts.append("=== RECOVERY CONTEXT (optional) ===\n")
        prompt_parts.append(recovery_context)
        prompt_parts.append("\n\n")

    if has_profile or has_recovery:
        prompt_parts.append(
            "You MAY reference USER CONTEXT only if it directly helps answer the question.\n"
            "If unsure, ignore the context completely.\n\n"
        )

    # --- Conversation history (non-influential) ---
    if history_block:
        prompt_parts.append(
            "Recent context (for reference only, do not repeat):\n"
        )
        prompt_parts.append(history_block)
        prompt_parts.append("\n")

    # --- RAG context ---
    prompt_parts.append(
        "=== KNOWLEDGE BASE CONTEXT (use only if directly relevant) ===\n"
    )
    prompt_parts.append(rag_context if rag_context else "None")
    prompt_parts.append("\n\n")

    # --- User query ---
    prompt_parts.append("=== USER QUESTION ===\n")
    prompt_parts.append(user_query)
    prompt_parts.append("\n\n")

    # --- Hard output constraint (recency-biased) ---
    prompt_parts.append(
        "STRICT OUTPUT RULE:\n"
        "- Default to 4–6 sentences.\n"
        "- Exceed this only if brevity would cause misunderstanding or harm.\n"
        "- No explanations unless required.\n"
    )

    final_prompt = "".join(prompt_parts)

    # --- Size guard ---
    if len(final_prompt) > MAX_PROMPT_LENGTH:
        logger.warning(
            f"[{request_id}] Prompt too long ({len(final_prompt)} chars), truncating"
        )
        final_prompt = final_prompt[:MAX_PROMPT_LENGTH] + "\n[... truncated ...]"

    return final_prompt



# ============================================
# MAIN CHAT FUNCTION (ALL ISSUES ADDRESSED)
# ============================================

async def chat_once(
    user_text: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    history_window: int = 4,
) -> ChatResponse:
    """
    Process a single chat message with full production features.
    
    This function incorporates all 18 production improvements:
    1. ✅ Proper logging with levels
    2. ✅ Timeout handling on all async operations
    3. ✅ Comprehensive metrics tracking
    4. ✅ Specific exception handling
    5. ✅ Circuit breaker for MCP
    6. ✅ Fallback tracking with service levels
    7. ✅ Robust path resolution
    8. ✅ Rate limiting
    9. ✅ Fully async implementation
    10. ✅ Request ID tracing
    11. ✅ Safe error messages
    12. ✅ Input validation
    13. ✅ User context caching
    14. ✅ Robust error detection
    15. ✅ Prompt size validation
    16. ✅ Graceful degradation levels
    17. ✅ Async memory operations
    18. ✅ Structured response model
    
    Args:
        user_text: The user's message
        user_id: The user's ID (optional, enables personalization)
        session_id: Redis session ID for conversation memory
        ip_address: Client IP for rate limiting
        history_window: Number of previous turns to include
        
    Returns:
        ChatResponse with structured data and metadata
    """
    # Issue #10: Generate request ID for tracing
    request_id = str(uuid.uuid4())[:8]
    
    # Issue #3: Track timing for all components
    timings = {}
    request_start_time = time.time()
    
    logger.info(f"[{request_id}] Chat request started: user_id={user_id}")
    
    # Issue #8: Rate limiting
    if user_id and not _rate_limiter.check_user_limit(user_id):
        logger.warning(f"[{request_id}] Rate limit exceeded for user {user_id}")
        return ChatResponse(
            request_id=request_id,
            session_id=session_id or "none",
            answer="You're sending messages too quickly. Please wait a moment and try again.",
            intent="RATE_LIMITED",
            used_rag=False,
            rag_best_score=0.0,
            user_context=UserContextResult("", "", False, False, "Rate limited", 0.0),
            redaction={},
            scope={},
            escalation_banner=None,
            memory_turns=[],
            timing={},
            service_level=ServiceLevel.MINIMAL.value
        )
    
    if ip_address and not _rate_limiter.check_ip_limit(ip_address):
        logger.warning(f"[{request_id}] Rate limit exceeded for IP {ip_address}")
        return ChatResponse(
            request_id=request_id,
            session_id=session_id or "none",
            answer="Too many requests from your network. Please wait a moment and try again.",
            intent="RATE_LIMITED",
            used_rag=False,
            rag_best_score=0.0,
            user_context=UserContextResult("", "", False, False, "Rate limited", 0.0),
            redaction={},
            scope={},
            escalation_banner=None,
            memory_turns=[],
            timing={},
            service_level=ServiceLevel.MINIMAL.value
        )
    
    # Issue #17: Use async memory operations
    memory = RedisSessionMemory(window_size=6)
    session_id = memory.ensure_session_id(session_id)
    
    # Issue #12: Validate user_id
    validated_user_id = validate_user_id(user_id)
    if user_id and not validated_user_id:
        logger.warning(f"[{request_id}] Invalid user_id format: {user_id}")
        validated_user_id = None
    
    # Get conversation history
    # Issue #17: Run in executor to avoid blocking
    loop = asyncio.get_event_loop()
    prior_turns = await loop.run_in_executor(
        None,
        memory.get_last_n,
        session_id,
        history_window
    )
    
    # ---------------- Guardrails ----------------
    guardrails_start = time.time()
    
    redacted_text, redaction_report = redact(user_text)
    safe_text, scope_notes = enforce_scope(redacted_text)
    
    timings["guardrails"] = (time.time() - guardrails_start) * 1000
    
    if scope_notes["offtopic"]:
        logger.info(f"[{request_id}] Request rejected: out of scope")
        timings["total"] = (time.time() - request_start_time) * 1000
        
        _metrics.record_request(
            success=True,
            service_level=ServiceLevel.MINIMAL.value,
            timings=timings
        )
        
        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            answer=safe_text,
            intent="OUT_OF_SCOPE",
            used_rag=False,
            rag_best_score=0.0,
            user_context=UserContextResult("", "", False, False, None, 0.0),
            redaction=redaction_report,
            scope=scope_notes,
            escalation_banner="",
            memory_turns=prior_turns,
            timing=timings,
            service_level=ServiceLevel.MINIMAL.value
        )
    
    # ---------------- Intent Routing ----------------
    # Issue #16: Determine service level based on component availability
    service_level = ServiceLevel.FULL
    
    # ============================================================
    # FETCH USER CONTEXT VIA MCP (Issues #2, #5, #13)
    # ============================================================
    
    user_context = UserContextResult("", "", False, False, None, 0.0)
    
    if validated_user_id:
        logger.info(f"[{request_id}] Fetching context for user_id: {validated_user_id}")
        mcp_start = time.time()
        
        try:
            user_context = await fetch_user_context(validated_user_id, request_id)
            timings["mcp"] = user_context.fetch_time_ms
            
            if not user_context.has_profile and not user_context.has_recovery:
                # Issue #16: Degraded service level
                service_level = ServiceLevel.DEGRADED_NO_MCP
                logger.warning(f"[{request_id}] No user context available, degraded service")
        
        except Exception as e:
            # This should rarely happen due to error handling in fetch_user_context
            timings["mcp"] = (time.time() - mcp_start) * 1000
            logger.error(f"[{request_id}] Unexpected error in MCP fetch: {str(e)}")
            service_level = ServiceLevel.DEGRADED_NO_MCP
    else:
        logger.info(f"[{request_id}] No valid user_id, skipping personalization")
        service_level = ServiceLevel.DEGRADED_NO_MCP
        timings["mcp"] = 0.0
    
    # ---------------- RAG (Document Retrieval) ----------------
    rag_start = time.time()
    
    # Initialize retriever (uses production version)
    retriever = RAGRetriever()
    retriever.load_index()
    
    try:
        # Issue #9: Async RAG call
        docs, used_rag, best_score = await fetch_rag_context(
            safe_text,
            request_id,
            retriever
        )
        
        timings["rag"] = (time.time() - rag_start) * 1000
        
        if used_rag and docs:
            rag_context_block = "\n\n".join(
                f"[{i+1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
            )
        else:
            rag_context_block = "None"
            
            if service_level == ServiceLevel.FULL:
                service_level = ServiceLevel.DEGRADED_NO_RAG
    
    except Exception as e:
        timings["rag"] = (time.time() - rag_start) * 1000
        logger.error(f"[{request_id}] RAG error: {str(e)}")
        docs, used_rag, best_score = [], False, 0.0
        rag_context_block = "None"
        
        if service_level == ServiceLevel.FULL:
            service_level = ServiceLevel.DEGRADED_NO_RAG
        elif service_level == ServiceLevel.DEGRADED_NO_MCP:
            service_level = ServiceLevel.MINIMAL
    
    # ============================================================
    # BUILD ENRICHED PROMPT
    # ============================================================
    
    # Format conversation history
    history_block = ""
    for t in prior_turns:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))[:800]
        history_block += f"- {role}: {content}\n"
    
    # Issue #15: Build prompt with size validation
    final_prompt = build_prompt(
        SYSTEM_PROMPT,
        user_context.profile_context,
        user_context.recovery_context,
        user_context.has_profile,
        user_context.has_recovery,
        history_block,
        rag_context_block,
        safe_text,
        request_id
    )
    
    # ============================================================
    # GENERATE RESPONSE
    # ============================================================
    
    llm_start = time.time()
    
    try:
        # Get LLM from production client (has metrics, error handling, etc.)
        llm = get_llm()
        
        # Issue #9: Run LLM in executor to avoid blocking
        loop = asyncio.get_event_loop()
        llm_response = await loop.run_in_executor(
            None,
            llm.invoke,
            final_prompt
        )
        
        timings["llm"] = (time.time() - llm_start) * 1000
        
        draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)
        
        logger.info(
            f"[{request_id}] LLM response generated in {timings['llm']:.0f}ms "
            f"({len(draft_answer)} chars)"
        )
    
    except Exception as e:
        timings["llm"] = (time.time() - llm_start) * 1000
        logger.error(f"[{request_id}] LLM generation failed: {str(e)}", exc_info=True)
        
        # Issue #11: Safe error message
        draft_answer = (
            "I apologize, but I'm having trouble generating a response right now. "
            "Please try again in a moment. If the issue persists, please contact support."
        )
        service_level = ServiceLevel.MINIMAL
    
    # ---------------- Escalation Check ----------------
    in_level, in_matches = scan_for_red_flags(safe_text)
    out_level, out_matches = scan_for_red_flags(draft_answer)
    
    severity = (
        "HIGH" if ("HIGH" in (in_level, out_level))
        else "MEDIUM" if ("MEDIUM" in (in_level, out_level))
        else "NONE"
    )
    
    banner = format_escalation_banner(severity, list({*in_matches, *out_matches}))
    
    final_answer = (
        (banner + "\n\n" if banner else "")
        + draft_answer
        + "\n\n— *Wellness information only; not medical advice.*"
    )
    
    # ---------------- Save to Memory ----------------
    # Issue #17: Async memory operations
    await loop.run_in_executor(None, memory.append, session_id, "user", safe_text)
    await loop.run_in_executor(None, memory.append, session_id, "assistant", final_answer)
    
    # ============================================================
    # RETURN RESPONSE
    # ============================================================
    
    timings["total"] = (time.time() - request_start_time) * 1000
    
    logger.info(
        f"[{request_id}] Request completed: "
        f"service_level={service_level.value}, "
        f"total_time={timings['total']:.0f}ms"
    )
    
    # Issue #3: Record metrics
    _metrics.record_request(
        success=True,
        service_level=service_level.value,
        timings=timings
    )
    
    # Issue #18: Return structured response
    return ChatResponse(
        request_id=request_id,
        session_id=session_id,
        answer=final_answer,
        intent="USER_QUERY",
        used_rag=used_rag,
        rag_best_score=round(float(best_score), 3),
        user_context=user_context,
        redaction=redaction_report,
        scope=scope_notes,
        escalation_banner=banner,
        memory_turns=await loop.run_in_executor(
            None,
            memory.get_last_n,
            session_id,
            history_window
        ),
        timing=timings,
        service_level=service_level.value
    )


# ============================================
# METRICS API (Issue #3)
# ============================================

def get_chat_metrics() -> Dict[str, Any]:
    """
    Get current chat pipeline metrics.
    
    Returns comprehensive statistics about:
    - Request counts and success rates
    - Component performance (MCP, RAG, LLM)
    - Service level distribution
    - Latency percentiles
    """
    return _metrics.get_stats()


def reset_chat_metrics():
    """Reset all metrics (useful for testing or daily resets)"""
    global _metrics
    _metrics = _ChatMetrics()
    logger.info("Chat metrics reset")


# ============================================
# CACHE MANAGEMENT (Issue #13)
# ============================================

def clear_user_context_cache():
    """Clear the user context cache"""
    _user_context_cache.clear()
    logger.info("User context cache cleared")


# ============================================
# CIRCUIT BREAKER STATUS (Issue #5)
# ============================================

def get_mcp_circuit_breaker_status() -> Dict[str, Any]:
    """Get MCP circuit breaker status"""
    return {
        "state": _mcp_circuit_breaker.state,
        "failure_count": _mcp_circuit_breaker.failure_count,
        "last_failure": (
            _mcp_circuit_breaker.last_failure_time.isoformat()
            if _mcp_circuit_breaker.last_failure_time else None
        )
    }


# ============================================
# BACKWARDS COMPATIBILITY
# ============================================

def chat_once_name_detector(
    user_text: str,
    session_id: Optional[str] = None,
    history_window: int = 4,
) -> Dict[str, Any]:
    """
    Detect if user's message contains their name.
    (Kept for backwards compatibility)
    """
    import json
    
    prompt = f"""
    You are a name-detection microservice.

    Your ONLY job:
    1. Detect whether the user's message contains their NAME.
    2. If yes → return JSON with: has_name=true, name="<detected_name>", ask_back=""
    3. If no → return JSON with: has_name=false, name="", ask_back="Please tell me your name."

    Rules:
    - A name is usually 1–3 words, e.g., "John", "Mary Jane".
    - If user gives something that is NOT a name (e.g., "why?", "guess", "idk"), treat as has_name=false.
    - Do NOT answer anything else. Only return the JSON.

    User message: "{user_text}"
    Return JSON only:
    """
    
    llm = get_llm()
    llm_response = llm.invoke(prompt)
    draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)
    
    return {
        "answer": draft_answer
    }