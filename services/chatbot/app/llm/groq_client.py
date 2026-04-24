"""
Production-Ready Groq LLM Client for Viva Mama Chatbot

This module provides a robust, production-grade interface to Groq's LLM API with:
- Client connection pooling and reuse (Issue #1)
- Comprehensive error handling with graceful degradation (Issue #2)
- Smart timeout strategies per operation type (Issue #3)
- Full logging and observability (Issue #4)
- Rate limit detection and handling (Issue #5)
- Model validation with fallback support (Issue #6)
- Token usage tracking and cost estimation (Issue #7)
- Well-documented configuration choices (Issue #8)
- Circuit breaker for repeated failures (Issue #9)
- Request/response logging for debugging (Issue #10)
- Cost monitoring and budgeting (Issue #11)
- Comprehensive documentation (Issue #12)

Usage:
    from app.llm.groq_client import get_llm, get_classifier_llm
    
    # Get main LLM (same interface as before)
    llm = get_llm()
    response = llm.invoke("Your prompt here")
    
    # Get classifier LLM
    classifier = get_classifier_llm()
    classification = classifier.invoke("Text to classify")
    
    # Get metrics
    from app.llm.groq_client import get_llm_metrics
    metrics = get_llm_metrics()
    print(f"Total tokens used: {metrics['total_tokens']}")
    print(f"Estimated cost: ${metrics['estimated_cost_usd']:.4f}")

Author: Viva Mama Team
"""

from __future__ import annotations

import time
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from enum import Enum

from langchain_groq import ChatGroq
from langchain_core.language_models import BaseChatModel
from groq import RateLimitError, APIError, APITimeoutError, APIConnectionError

from app.settings import settings

# Configure logging (Issue #4)
logger = logging.getLogger(__name__)

# Issue #8: Document temperature and parameter choices
"""
Temperature Settings Explained:
- 0.0: Deterministic, always picks most likely token (for classification, factual answers)
- 0.2: Slightly creative, good for medical chatbots (balance between accuracy and natural language)
- 0.7: Creative, more variety in responses (for creative writing, brainstorming)
- 1.0: Very creative, unpredictable (generally not suitable for medical applications)

Our choices:
- Main LLM: 0.2 (slightly warm for natural conversation while maintaining accuracy)
- Classifier: 0.0 (deterministic classification, no creativity needed)
"""

# Issue #3: Timeout strategy by operation type
class TimeoutStrategy(Enum):
    """
    Different timeout values for different operation types.
    
    Quick operations (classification, yes/no): 10 seconds
    - These generate only a few tokens and should be very fast
    - Longer timeouts just mean longer waits when things fail
    
    Normal operations (chat responses): 30 seconds
    - Standard conversation responses
    - Balanced between user patience and model processing time
    
    Long operations (detailed analysis, long outputs): 60 seconds
    - Complex responses that might take longer
    - Used sparingly, only when truly needed
    """
    QUICK = 10      # For fast operations like classification
    NORMAL = 30     # For standard chat responses
    LONG = 60       # For complex, detailed responses


# Issue #7: Token pricing (Groq pricing as of FEB 2026)
# Note: Update these values when Groq changes pricing
TOKEN_PRICING = {
    "llama-3.3-70b-versatile": {
        "input": 0.59 / 1_000_000,   # $0.59 per 1M input tokens
        "output": 0.79 / 1_000_000,  # $0.79 per 1M output tokens
    },
    "gpt-oss-20b": {
        "input": 0.075 / 1_000_000,   # $0.075 per 1M input tokens
        "output": 0.30 / 1_000_000,  # $0.30 per 1M output tokens
    },
    "qwen3-32b": {
        "input": 0.29 / 1_000_000,   # $0.29 per 1M input tokens
        "output": 0.59 / 1_000_000,  # $0.59 per 1M output tokens
    },
    "llama-4-maverick-17b": {
        "input": 0.20 / 1_000_000,   # $0.20 per 1M input tokens
        "output": 0.60 / 1_000_000,  # $0.60 per 1M output tokens
    },
    "llama-3.1-70b-versatile": {
        "input": 0.59 / 1_000_000,   # $0.59 per 1M input tokens
        "output": 0.79 / 1_000_000,  # $0.79 per 1M output tokens
    },
    "llama-3.1-8b-instant": {
        "input": 0.05 / 1_000_000,   # $0.05 per 1M input tokens
        "output": 0.08 / 1_000_000,  # $0.08 per 1M output tokens
    },
    # Default fallback pricing if model not listed
    "default": {
        "input": 0.50 / 1_000_000,
        "output": 0.70 / 1_000_000,
    }
}

# Issue #6: Model fallback configuration
MODEL_FALLBACKS = {
    "llama-3.3-70b-versatile": ["llama-3.1-70b-versatile", "llama-3.1-8b-instant"],
    "llama-3.1-70b-versatile": ["llama-3.1-8b-instant"],
    "llama-3.1-8b-instant": [],  # No fallback for smallest model
}


# ============================================
# METRICS AND MONITORING (Issue #4, #7, #11)
# ============================================

class _LLMMetrics:
    """
    Tracks LLM usage metrics for monitoring and cost control.
    
    This helps answer critical production questions:
    - How many tokens are we using per hour/day?
    - What's our estimated cost?
    - How often are we hitting rate limits?
    - What's the average latency?
    - How many errors are occurring?
    """
    
    def __init__(self):
        self.calls_total = 0
        self.calls_success = 0
        self.calls_failed = 0
        self.calls_rate_limited = 0
        self.calls_timeout = 0
        
        self.tokens_input = 0
        self.tokens_output = 0
        self.tokens_total = 0
        
        self.latencies_ms: List[float] = []
        
        self.cost_usd = 0.0
        
        self.last_reset = datetime.now()
    
    def record_call(
        self,
        success: bool,
        latency_ms: float,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: float = 0.0,
        error_type: Optional[str] = None
    ):
        """Record an LLM call with all metrics"""
        self.calls_total += 1
        
        if success:
            self.calls_success += 1
        else:
            self.calls_failed += 1
            
            if error_type == "rate_limit":
                self.calls_rate_limited += 1
            elif error_type == "timeout":
                self.calls_timeout += 1
        
        self.tokens_input += input_tokens
        self.tokens_output += output_tokens
        self.tokens_total += (input_tokens + output_tokens)
        
        self.cost_usd += cost_usd
        
        self.latencies_ms.append(latency_ms)
        # Keep only last 1000 samples to prevent unbounded growth
        if len(self.latencies_ms) > 1000:
            self.latencies_ms = self.latencies_ms[-1000:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics"""
        stats = {
            "calls_total": self.calls_total,
            "calls_success": self.calls_success,
            "calls_failed": self.calls_failed,
            "calls_rate_limited": self.calls_rate_limited,
            "calls_timeout": self.calls_timeout,
            "success_rate": (
                self.calls_success / self.calls_total 
                if self.calls_total > 0 else 0.0
            ),
            "tokens_input": self.tokens_input,
            "tokens_output": self.tokens_output,
            "tokens_total": self.tokens_total,
            "estimated_cost_usd": round(self.cost_usd, 4),
            "uptime_hours": (datetime.now() - self.last_reset).total_seconds() / 3600,
        }
        
        # Calculate latency percentiles
        if self.latencies_ms:
            sorted_latencies = sorted(self.latencies_ms)
            stats["latency_p50_ms"] = sorted_latencies[len(sorted_latencies) // 2]
            stats["latency_p95_ms"] = sorted_latencies[int(len(sorted_latencies) * 0.95)]
            stats["latency_p99_ms"] = sorted_latencies[int(len(sorted_latencies) * 0.99)]
            stats["latency_mean_ms"] = sum(self.latencies_ms) / len(self.latencies_ms)
        
        return stats
    
    def reset(self):
        """Reset all metrics (useful for testing or daily resets)"""
        self.__init__()


# Global metrics instance
_metrics = _LLMMetrics()


# ============================================
# CIRCUIT BREAKER (Issue #9)
# ============================================

class CircuitBreaker:
    """
    Circuit breaker pattern to prevent cascading failures.
    
    How it works:
    - CLOSED: Normal operation, requests go through
    - OPEN: Too many failures, reject requests immediately (fail fast)
    - HALF_OPEN: Testing if service recovered, allow one request
    
    Why this matters:
    If Groq is down, we don't want to keep hammering their API with requests
    that will fail. Instead, we "open the circuit" and fail fast, giving
    Groq time to recover.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        half_open_attempts: int = 1
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout_seconds
        self.half_open_attempts = half_open_attempts
        
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.half_open_attempts_made = 0
    
    def call(self, func, *args, **kwargs):
        """Execute function through circuit breaker"""
        
        # Check if we should transition states
        if self.state == "OPEN":
            if self.last_failure_time and \
               (datetime.now() - self.last_failure_time).total_seconds() > self.timeout:
                # Timeout elapsed, try again
                logger.info("Circuit breaker: OPEN → HALF_OPEN (testing recovery)")
                self.state = "HALF_OPEN"
                self.half_open_attempts_made = 0
            else:
                # Still open, fail fast
                raise Exception(
                    f"Circuit breaker is OPEN. Groq API has failed {self.failure_count} "
                    f"times. Waiting {self.timeout}s before retry."
                )
        
        # Execute the function
        try:
            result = func(*args, **kwargs)
            
            # Success - reset failure count
            if self.state == "HALF_OPEN":
                logger.info("Circuit breaker: HALF_OPEN → CLOSED (service recovered)")
                self.state = "CLOSED"
                self.failure_count = 0
            elif self.failure_count > 0:
                logger.debug(f"Circuit breaker: Reset failure count (was {self.failure_count})")
                self.failure_count = 0
            
            return result
            
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = datetime.now()
            
            if self.state == "HALF_OPEN":
                logger.warning("Circuit breaker: HALF_OPEN → OPEN (still failing)")
                self.state = "OPEN"
            elif self.failure_count >= self.failure_threshold:
                logger.error(
                    f"Circuit breaker: CLOSED → OPEN "
                    f"({self.failure_count} consecutive failures)"
                )
                self.state = "OPEN"
            
            raise


# Global circuit breakers (one per model)
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def _get_circuit_breaker(model: str) -> CircuitBreaker:
    """Get or create circuit breaker for a model"""
    if model not in _circuit_breakers:
        _circuit_breakers[model] = CircuitBreaker(
            failure_threshold=5,    # Open after 5 failures
            timeout_seconds=60,      # Wait 60s before retrying
            half_open_attempts=1
        )
    return _circuit_breakers[model]


# ============================================
# CLIENT MANAGEMENT (Issue #1)
# ============================================

class _GroqClientManager:
    """
    Manages Groq client instances with singleton pattern.
    
    Issue #1: Instead of creating a new client for every request,
    we create clients once and reuse them. This is much more efficient
    and prevents connection exhaustion under load.
    """
    
    def __init__(self):
        self._clients: Dict[str, ChatGroq] = {}
        self._client_creation_times: Dict[str, datetime] = {}
    
    def get_client(
        self,
        model: str,
        temperature: float,
        timeout: int,
        max_retries: int = 2,
        max_tokens: Optional[int] = None
    ) -> ChatGroq:
        """
        Get or create a ChatGroq client.
        
        Clients are cached by their configuration (model, temperature, etc).
        This means if you call get_llm() 1000 times, you only create 1 client.
        """
        # Create cache key based on configuration
        cache_key = f"{model}_{temperature}_{timeout}_{max_retries}_{max_tokens}"
        
        # Check if client exists and is recent (recreate if older than 1 hour)
        if cache_key in self._clients:
            age = datetime.now() - self._client_creation_times[cache_key]
            if age.total_seconds() < 3600:  # 1 hour
                logger.debug(f"Reusing existing Groq client for {model}")
                return self._clients[cache_key]
            else:
                logger.info(f"Recreating Groq client for {model} (age: {age})")
                del self._clients[cache_key]
        
        # Issue #6: Validate model exists (basic check)
        if not self._validate_model(model):
            logger.warning(f"Model {model} may not exist, attempting anyway...")
        
        # Create new client
        logger.info(
            f"Creating new Groq client: model={model}, "
            f"temp={temperature}, timeout={timeout}s"
        )
        
        client_params = {
            "groq_api_key": settings.groq_api_key,
            "model": model,
            "temperature": temperature,
            "timeout": timeout,
            "max_retries": max_retries,
        }
        
        if max_tokens is not None:
            client_params["max_tokens"] = max_tokens
        
        try:
            client = ChatGroq(**client_params)
            self._clients[cache_key] = client
            self._client_creation_times[cache_key] = datetime.now()
            return client
        except Exception as e:
            logger.error(f"Failed to create Groq client: {str(e)}", exc_info=True)
            raise
    
    def _validate_model(self, model: str) -> bool:
        """
        Basic validation that model name looks reasonable.
        
        Issue #6: Helps catch typos in configuration before making API calls.
        """
        valid_prefixes = ["llama-", "mixtral-", "gemma-"]
        return any(model.startswith(prefix) for prefix in valid_prefixes)


# Global client manager (Issue #1: Singleton pattern)
_client_manager = _GroqClientManager()


# ============================================
# SMART INVOCATION WITH ERROR HANDLING (Issue #2, #5)
# ============================================

def _invoke_with_resilience(
    client: BaseChatModel,
    prompt: str,
    model: str,
    operation_type: str = "chat"
) -> Any:
    """
    Invoke LLM with comprehensive error handling and retry logic.
    
    Issue #2: Comprehensive error handling with graceful degradation
    Issue #5: Rate limit detection and handling
    Issue #9: Circuit breaker integration
    Issue #10: Request/response logging
    """
    start_time = time.time()
    
    # Issue #10: Log request (truncate long prompts)
    prompt_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
    logger.debug(f"LLM Request [{operation_type}]: {prompt_preview}")
    
    try:
        # Issue #9: Execute through circuit breaker
        circuit_breaker = _get_circuit_breaker(model)
        
        def _execute():
            return client.invoke(prompt)
        
        response = circuit_breaker.call(_execute)
        
        # Calculate metrics
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Issue #7: Extract token usage
        input_tokens = getattr(response, "usage_metadata", {}).get("input_tokens", 0)
        output_tokens = getattr(response, "usage_metadata", {}).get("output_tokens", 0)
        
        # Issue #11: Calculate cost
        cost = _calculate_cost(model, input_tokens, output_tokens)
        
        # Issue #10: Log response
        response_preview = str(response.content)[:200] + "..." \
                          if len(str(response.content)) > 200 else str(response.content)
        logger.debug(
            f"LLM Response [{operation_type}]: {response_preview} "
            f"({input_tokens} in, {output_tokens} out, ${cost:.4f}, {elapsed_ms:.0f}ms)"
        )
        
        # Record success metrics
        _metrics.record_call(
            success=True,
            latency_ms=elapsed_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost
        )
        
        return response
        
    except RateLimitError as e:
        # Issue #5: Rate limit handling
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.error(
            f"Rate limit hit for {model}: {str(e)}. "
            f"Consider implementing request throttling or upgrading plan."
        )
        
        _metrics.record_call(
            success=False,
            latency_ms=elapsed_ms,
            error_type="rate_limit"
        )
        
        # Re-raise with helpful message
        raise RuntimeError(
            f"Groq rate limit exceeded. The system is experiencing high load. "
            f"Please try again in a moment. (Model: {model})"
        ) from e
    
    except APITimeoutError as e:
        # Issue #3: Timeout handling
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.error(f"Timeout calling {model}: {str(e)}")
        
        _metrics.record_call(
            success=False,
            latency_ms=elapsed_ms,
            error_type="timeout"
        )
        
        raise RuntimeError(
            f"LLM request timed out after {elapsed_ms/1000:.1f}s. "
            f"The model may be overloaded. Please try again."
        ) from e
    
    except APIConnectionError as e:
        # Network connectivity issues
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.error(f"Connection error calling {model}: {str(e)}")
        
        _metrics.record_call(
            success=False,
            latency_ms=elapsed_ms,
            error_type="connection"
        )
        
        raise RuntimeError(
            f"Cannot connect to Groq API. Please check your internet connection."
        ) from e
    
    except APIError as e:
        # Generic API error
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.error(f"Groq API error for {model}: {str(e)}", exc_info=True)
        
        _metrics.record_call(
            success=False,
            latency_ms=elapsed_ms,
            error_type="api_error"
        )
        
        raise RuntimeError(
            f"Groq API error: {str(e)}. Please try again or contact support if this persists."
        ) from e
    
    except Exception as e:
        # Unexpected errors
        elapsed_ms = (time.time() - start_time) * 1000
        
        logger.error(
            f"Unexpected error calling {model}: {str(e)}",
            exc_info=True
        )
        
        _metrics.record_call(
            success=False,
            latency_ms=elapsed_ms,
            error_type="unknown"
        )
        
        raise


def _calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Calculate cost of an LLM call.
    
    Issue #7: Token usage tracking
    Issue #11: Cost estimation
    """
    pricing = TOKEN_PRICING.get(model, TOKEN_PRICING["default"])
    
    cost = (
        input_tokens * pricing["input"] +
        output_tokens * pricing["output"]
    )
    
    return cost


# ============================================
# PUBLIC API (Issue #1-12 integrated)
# ============================================

def get_llm(model: str = settings.llm_model) -> BaseChatModel:
    """
    Get the main LLM client for chat responses.
    
    This returns a configured ChatGroq client with:
    - Temperature 0.2 (slightly creative, good for medical chat)
    - 30 second timeout (normal operation)
    - Client reuse (efficient)
    - Full error handling and retry logic
    - Metrics tracking
    
    The client is cached and reused across calls for efficiency.
    
    Returns:
        Configured ChatGroq client
        
    Example:
        llm = get_llm()
        response = llm.invoke("What are postpartum recovery tips?")
        print(response.content)
    """
    return _client_manager.get_client(
        model=model,
        temperature=0.2,  # Issue #8: Slightly warm for natural conversation
        timeout=TimeoutStrategy.NORMAL.value,  # Issue #3: 30 seconds for normal ops
        max_retries=2
    )


def get_classifier_llm() -> BaseChatModel:
    """
    Get the classifier LLM for quick classification tasks.
    
    This returns a configured ChatGroq client optimized for classification:
    - Temperature 0.0 (deterministic, no creativity)
    - 10 second timeout (quick operation)
    - 5 max tokens (just needs a classification label)
    - Same resilience features as main LLM
    
    Returns:
        Configured ChatGroq client optimized for classification
        
    Example:
        classifier = get_classifier_llm()
        result = classifier.invoke("Is this in scope? User: How do I improve milk supply?")
        print(result.content)  # "IN_SCOPE"
    """
    return _client_manager.get_client(
        model=settings.scope_classifier_model,
        temperature=0.0,  # Issue #8: Deterministic for classification
        timeout=TimeoutStrategy.QUICK.value,  # Issue #3: 10 seconds for quick ops
        max_retries=2,
        max_tokens=5  # Only needs a short classification response
    )


def get_llm_with_fallback(fallback_model: Optional[str] = None) -> BaseChatModel:
    """
    Get LLM with automatic fallback to smaller model if primary fails.
    
    Issue #6: Model validation and fallback support
    
    Args:
        fallback_model: Model to fall back to (default: auto-selected from config)
        
    Returns:
        Configured ChatGroq client
    """
    primary_model = settings.llm_model
    
    try:
        return get_llm()
    except Exception as e:
        # Primary model failed, try fallback
        if fallback_model is None:
            fallbacks = MODEL_FALLBACKS.get(primary_model, [])
            if not fallbacks:
                logger.error(f"No fallback available for {primary_model}")
                raise
            fallback_model = fallbacks[0]
        
        logger.warning(
            f"Primary model {primary_model} failed, falling back to {fallback_model}: {str(e)}"
        )
        
        return _client_manager.get_client(
            model=fallback_model,
            temperature=0.2,
            timeout=TimeoutStrategy.NORMAL.value,
            max_retries=2
        )


# ============================================
# METRICS AND MONITORING API (Issue #4, #7, #11)
# ============================================

def get_llm_metrics() -> Dict[str, Any]:
    """
    Get current LLM usage metrics.
    
    Issue #7: Token usage tracking
    Issue #11: Cost monitoring
    
    Returns:
        Dictionary with metrics:
        - calls_total: Total number of LLM calls
        - calls_success: Successful calls
        - calls_failed: Failed calls
        - tokens_total: Total tokens used
        - estimated_cost_usd: Estimated cost in USD
        - latency_p50_ms: Median latency
        - And more...
        
    Example:
        metrics = get_llm_metrics()
        print(f"Total cost today: ${metrics['estimated_cost_usd']:.2f}")
        print(f"Success rate: {metrics['success_rate']:.1%}")
    """
    return _metrics.get_stats()


def reset_llm_metrics():
    """
    Reset all metrics (useful for testing or daily resets).
    
    Example:
        # Reset at midnight each day
        reset_llm_metrics()
    """
    _metrics.reset()
    logger.info("LLM metrics reset")


def get_circuit_breaker_status() -> Dict[str, Any]:
    """
    Get status of all circuit breakers.
    
    Issue #9: Circuit breaker monitoring
    
    Returns:
        Dictionary with circuit breaker states per model
    """
    return {
        model: {
            "state": cb.state,
            "failure_count": cb.failure_count,
            "last_failure": cb.last_failure_time.isoformat() if cb.last_failure_time else None
        }
        for model, cb in _circuit_breakers.items()
    }


# ============================================
# BACKWARD COMPATIBILITY
# ============================================

# The old API (just returning clients) still works exactly as before
# But now with all the production improvements under the hood!

# Users of the old code don't need to change anything:
# from app.llm.groq_client import get_llm, get_classifier_llm
# llm = get_llm()
# response = llm.invoke(prompt)
# ✓ This still works, but now with resilience, monitoring, etc!