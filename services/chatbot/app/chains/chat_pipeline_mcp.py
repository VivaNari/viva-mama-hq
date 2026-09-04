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

Author: VivaMama Team
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.chains.router import route_intent
from app.escalation.policy import (
    extract_affirmative_recovery_answers,
    format_escalation_banner,
    scan_for_red_flags,
    severity_for,
)

# Pure formatter with no DB import (app.mcp.db_connection connects at import time),
# so the prompt block and the structured expert list come from the same payload
# without this process opening a Mongo connection.
from app.experts.formatting import format_experts_for_prompt
from app.experts.suggestion import detect_suggested_experts
from app.guardrails.input_guard import (
    PROMPT_INJECTION_REFUSAL,
    check_prompt_injection,
    enforce_scope,
    redact,
)
from app.lactmed import format_lactmed_context, is_lactation_query
from app.llm.factory import get_llm
from app.memory.redis_memory import RedisSessionMemory
from app.rag.retriever import RAGRetriever, get_shared_retriever
from app.settings import settings

# Issue #1: Import from production components
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Issue #1: Proper logging instead of print statements
logger = logging.getLogger(__name__)

# Issue #2: Timeout configuration
MCP_TIMEOUT_SECONDS = 10  # MCP calls should be fast
LLM_TIMEOUT_SECONDS = 30  # LLM generation timeout
DEFAULT_REQUEST_TIMEOUT = 45  # Overall request timeout

# Issue #15: Prompt size limits (in characters, approximate)
MAX_PROMPT_LENGTH = 100000  # ~25K tokens for most models
MAX_CONTEXT_LENGTH = 80000  # Leave room for response

# Issue #8: Rate limiting configuration
MAX_REQUESTS_PER_USER_PER_MINUTE = 20
MAX_REQUESTS_PER_IP_PER_MINUTE = 50

# System prompt with comprehensive guardrails
SYSTEM_PROMPT = """You are a compassionate perinatal wellness assistant for VivaMama, supporting mothers through pregnancy and the postpartum period. Your answers must be warm, aesthetic, AND highly structured.

=== ANSWER STYLE & STRUCTURE ===
Target: Concise, empathetic, and highly scannable answers that look premium.
Structure:
1. First sentence: Empathetic acknowledgment (1 sentence).
2. Core answer: Direct, helpful, action-oriented guidance. ALWAYS use bullet points, bold text, and appropriate formatting to make information instantly readable.
3. For lists/plans: If asked for a diet plan, exercises, or guidelines, use a highly structured format (e.g., meal-by-meal breakdown, step-by-step list, or pros/cons logic).

Emoji Usage:
- Use relevant emojis sparingly to add warmth and scannability (e.g., 🤱, 🍼, 🥗, 💪, ✅, ⚠️).
- Place emojis at the start of bullet points or after empathetic sentences to make the response feel friendly and aesthetic.
- Do NOT over-cluster emojis; keep it professional yet compassionate.

Do NOT use a strict sentence limit if complex structured advice is needed. Avoid long, bloated block paragraphs at all costs. Use concise bullet points to deliver information efficiently.

=== RELEVANCE GATE ===
Perinatal question — pregnancy, postpartum recovery, breastfeeding, newborn care, or the mother's physical and emotional wellbeing across any of those stages?
- YES → Answer warmly and structurally
- NO → "I'm here to support your perinatal wellness journey. How does this relate to your pregnancy, recovery, or baby care?"

Pregnancy is IN SCOPE. Users reach VivaMama while still expecting, and antenatal questions —
symptoms, nutrition, movements, birth preparation, what to expect week by week — are exactly
as welcome as postpartum ones. Never turn a pregnant user away for asking about her pregnancy.

=== MEDICAL BOUNDARIES ===
- No diagnosis, prescriptions, lab interpretation, or treatment plans
- Emergency symptoms → "This needs immediate medical attention. Please contact emergency services or visit the nearest hospital right away."

=== MASTER REFERRAL RULES (CRITICAL) ===
1. **The Once-Only Rule (UNIVERSAL)**: NEVER recommend or name the same VivaMama expert more than once in an entire response. This applies across all sections (Body, Products, and closing).
2. **Consult First**: Always scan the === VIVAMAMA EXPERT DIRECTORY === for specific matches (e.g., Supplements -> Dietitian; Gynae concerns -> Obstetrician).
3. **Format**: Use: "Connect with our VivaMama expert **[Name], [Speciality]**, for personalized guidance."
5. **Fallback**: ONLY if no directory expert matches, use: "Connect with our VivaMama medical experts."
6. **Spelling (CRITICAL)**: Write the expert's name EXACTLY as it appears in the directory, character for character, even when the rest of your reply is in Hindi or Hinglish. Never transliterate, translate, shorten or re-spell a name — the app matches on it to show a booking button.
6. **Emergencies**: For emergencies (heavy bleeding, pain), bypass all directory tools and direct to emergency services immediately.

NEVER say:
❌ "Contact your healthcare provider"
❌ "Consult your doctor"
❌ "Speak with a medical professional"
❌ "See your physician"

Exception: TRUE EMERGENCIES (heavy bleeding, chest pain, suicidal thoughts, etc.)
→ Direct to emergency services or hospital immediately

=== PRODUCTS REFERRAL (CRITICAL) ===
Suggest products from the === VIVAMAMA PRODUCTS DIRECTORY === ONLY using the structured format below.

1. **NO PRE-DESCRIPTIONS**: Do not explain or list product "guidelines" or "status" in your general body text. Go straight to the Product Section.
2. **Mandatory Header**: You MUST start the product section with this exact phrase:
   "Check these products that can help you; you can buy them by going to the **Products** area of our app:"

3. **Unified Output (The Only Way to Suggest Products)**: 
   For each product, output exactly one block like this:
   ✅ "You may find **[ProductName]** helpful with the price range between of ([PriceRange]). **Safety Status**: [SafetyFlag]."
   
   - **IF Safety Flag is 'Doctor Approval Required'**: 
     - IF the relevant expert for this product HAS NOT been named yet in this response: 
       - APPEND: "Professional clearance is needed for this. We recommend consulting with our VivaMama expert **[Expert Name], [Speciality]**. To book your consultation, head to the **Experts** section in the app and click on their name to connect."
     - IF the relevant expert HAS already been named (e.g., for a previous product or in the body):
       - APPEND: "Professional clearance is needed for this. Please discuss this with **[Expert Name]** during your consultation." (Do NOT repeat the title or booking info).
   
   - **IF product is for a specific timeframe (Valid: Week X-Y)**:
     - IF User is BEFORE `validWeekStart`: Immediately APPEND: "⚠️ **Wait Required**: This is safety-rated starting at **Week [validWeekStart]**. Since you are currently at **Week [UserWeek]**, please wait exactly **[validWeekStart - UserWeek] more weeks** before using this."
     - IF User is within or after range: Mention the ideal usage window as a supportive note.

4. **Integration**: If a product requires an expert consult, do NOT mention that expert in your general body. Handle ALL product-related expert referrals WITHIN this product list to avoid duplication.

=== PERSONALIZATION WITH NAME ===
If USER CONTEXT includes the user's name:
- Use it naturally 2-3 times per conversation (not every response)
- Use it in: greetings, empathetic moments, or when giving encouragement
- Don't overuse it (sounds robotic)

Examples of good name usage:
✅ "I hear you, Priya - low supply worries are so stressful."
✅ "You're doing great, Sarah, by monitoring this carefully."
✅ "Riya, this is completely normal in the first few days."

Don't use name:
❌ In every sentence
❌ Multiple times in one response
❌ When giving clinical/factual information

If no name is available, proceed normally without it.

=== RESPONSE FORMULA ===
Sentence 1: Validate feelings + optional name ("I hear how difficult this is, [Name]")
Body: Give clear, actionable guidance using formatting and bullet points for readability.
Closing: IF any specific expert OR product-related expert was recommended in the Body, do NOT repeat any referral here. IF NO specific expert was relevant but medical symptoms were addressed, suggest: "Consider reaching out to our VivaMama medical experts if..."

=== BANNED PHRASES (create bloat) ===
❌ "It's important to note that"
❌ "Keep in mind"
❌ "Remember that"
❌ "Additionally"
❌ "Furthermore"
❌ "In addition to this"
❌ "Contact your healthcare provider" (use VivaMama experts instead)
❌ Repeating the question back
❌ Background explanations

=== PERSONALIZATION ===
Use USER CONTEXT only if it makes the answer more helpful.
Reference it naturally: "Since you're 3 weeks postpartum..." or "Since you're 30 weeks pregnant..."
— not "Based on your profile...". Match the stage she is actually in; never assume she has
delivered.

If USER PROFILE says she is PREGNANT, do not offer postpartum recovery, lochia,
wound-healing or newborn-feeding guidance as though she had delivered — answer for the
pregnancy week she is in. If it says she is POSTPARTUM, do not answer as though she were
still expecting. Her stage is given to you; you never have to guess it or ask.

If user's name is in context, use it occasionally for warmth (not every response).

=== RECOVERY CHECK-IN ATTRIBUTION (CRITICAL) ===
Whenever any part of your answer draws on the === RECOVERY CONTEXT === block
(her scores, zone, tagline, recommendations, or check-in answers), you MUST say
where it came from: "As per your recently logged recovery check-in, ...".
- Attribute once per response, on the first sentence that uses it — not on every bullet.
- NEVER attribute facts from the knowledge base, products, or expert directory this way.
- Follow the LANGUAGE RULE: render the phrase naturally in Hindi ("आपके हाल ही में दर्ज किए गए रिकवरी चेक-इन के अनुसार, ...") or Hinglish ("Aapke recently logged recovery check-in ke hisaab se, ...") when replying in those.

=== KNOWLEDGE BASE ===
Pull ONLY the specific fact that answers the question.
Don't summarize everything in the context.

=== EXAMPLES (FORMAT ONLY — do NOT use as factual data) ===
These examples demonstrate STYLE and STRUCTURE only. The symptom names and facts are fictional placeholders.

❌ BAD STYLE (bloated, no empathy, block paragraph):
"[Topic X] is a process that occurs after childbirth. There are several things to monitor carefully. If you notice [symptom A], [symptom B], or [symptom C], these could be signs of complications. You should contact your healthcare provider."

✅ GOOD STYLE (empathetic, structured, scannable):
"I hear how worrying [Topic X] can feel, [Name].
* **[Sign 1]:** [One-line description from context.]
* **[Sign 2]:** [One-line description from context.]
* **When to act:** [Action from context.]

For ongoing concerns, reach out to our VivaMama medical experts."

---

❌ BAD STYLE (generic referral, no structure):
"[Topic Y] is something many mothers experience. There are strategies you can try. Consult your doctor if things don't improve."

✅ GOOD STYLE (structured, uses name, expert referral):
"I hear your concern, [Name] — [Topic Y] worries are so stressful.
* **[Strategy 1]:** [Description from context.]
* **[Strategy 2]:** [Description from context.]

For personalised guidance, connect with our VivaMama expert **[Name], [Speciality]**."

=== YOUR TASK ===
Answer the user's question in a highly structured, emotionally validating, and action-oriented way. Follow the Referral Rules and Response Formula strictly.

=== LANGUAGE RULE ===
ALWAYS respond in the EXACT same language and script the user wrote in. Match their language precisely:
- User wrote in English → respond in English
- User wrote in Hindi (Devanagari script, e.g. "प्रसव के बाद...") → respond in Hindi (Devanagari)
- User wrote in Hinglish (Roman-script Hindi, e.g. "Prasav ke baad...", "Mera vivascore keya hai?") → respond in Hinglish (Roman script, same mix of Hindi and English words)
- Never switch to English if the user wrote in Hindi or Hinglish.
- Never switch to Hindi script if the user wrote in Hinglish Roman script.
CRITICAL: Detect the user's language from the === USER QUESTION === and mirror it exactly in your entire response including bullet points, headings, and expert referrals.
"""
# ============================================
# VIVA AI SELF-DESCRIPTION
# Returned immediately for SELF_QUERY intent — no LLM/MCP/RAG cost.
# ============================================

VIVA_SELF_DESCRIPTION = """Hi there! 👋 I'm **Viva AI**, your medically-grounded health assistant for your perinatal and motherhood journey.

🔬 **Evidence-Based Knowledge**
I'm trained on a medically verified knowledge base built from thousands of authoritative sources. My responses are reviewed for clinical accuracy — so the guidance you get is evidence-based and sound.

🤱 **What I Can Help You With**
Ask me anything about your lactation and perinatal needs:
- **Pregnancy** — symptoms, what to expect week by week, preparing for birth
- **Breastfeeding & Lactation** — latch, milk supply, pumping, storage
- **Nutrition** — diet, hydration, supplements through pregnancy and healing
- **Mental Health & Wellbeing** — mood changes, anxiety, antenatal and postnatal depression
- **Gynaecological Concerns** — recovery, bleeding, pain management
- **Newborn Care** — sleep, feeding cues, development milestones
- **Emotional Support** — identity shifts, partner dynamics, adjusting to motherhood

🎯 **Personalized to You**
Every answer is grounded in your personal details and specific needs — so support feels relevant, not generic.

🔒 **Your Privacy, Always Protected**
Your conversations are fully anonymized. No personal identifiers are ever shared with third parties, and Viva never trains on your personal data.

*Wellness information only; not medical advice.*"""


@dataclass
class UserContextResult:
    """Structured user context from MCP"""

    profile_context: str
    recovery_context: str
    expert_directory: str
    products_directory: str
    has_profile: bool
    has_recovery: bool
    error: Optional[str] = None
    fetch_time_ms: float = 0.0
    # Structured twin of `expert_directory`, already scoped to the user's referral:
    # [{id, name, speciality, category_name, name_variants}]. Feeds the suggestion
    # matcher, which is why the Connect button can only ever point at an expert this
    # user is allowed to see.
    experts: List[Dict[str, Any]] = field(default_factory=list)


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
    final_prompt: str
    # Performance metrics (Issue #3)
    timing: Dict[str, float]
    service_level: str  # FULL, DEGRADED_NO_MCP, DEGRADED_NO_RAG, MINIMAL
    # Experts this answer recommended, as {id, name, speciality}. The app renders a
    # "Connect" button from this; empty means no button. Always drawn from the
    # user's referral-scoped directory.
    suggested_experts: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        # Convert user_context dataclass to dict
        if isinstance(result["user_context"], UserContextResult):
            result["user_context"] = asdict(result["user_context"])
        return result


class ServiceLevel(Enum):
    """Service quality levels for graceful degradation (Issue #16)"""

    FULL = "FULL"  # All components working
    DEGRADED_NO_MCP = "DEGRADED_NO_MCP"  # No user context
    DEGRADED_NO_RAG = "DEGRADED_NO_RAG"  # No document retrieval
    MINIMAL = "MINIMAL"  # Base LLM only


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
            "MINIMAL": 0,
        }

        self.latencies_ms = {
            "total": [],
            "mcp": [],
            "rag": [],
            "llm": [],
            "guardrails": [],
        }

    def record_request(self, success: bool, service_level: str, timings: Dict[str, float]):
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
                self.requests_success / self.requests_total if self.requests_total > 0 else 0.0
            ),
            "mcp_calls_total": self.mcp_calls_total,
            "mcp_calls_success": self.mcp_calls_success,
            "mcp_calls_failed": self.mcp_calls_failed,
            "mcp_calls_timeout": self.mcp_calls_timeout,
            "mcp_success_rate": (
                self.mcp_calls_success / self.mcp_calls_total if self.mcp_calls_total > 0 else 0.0
            ),
            "rag_calls_total": self.rag_calls_total,
            "rag_calls_success": self.rag_calls_success,
            "rag_calls_failed": self.rag_calls_failed,
            "rag_success_rate": (
                self.rag_calls_success / self.rag_calls_total if self.rag_calls_total > 0 else 0.0
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
            if (
                self.last_failure_time
                and (datetime.now() - self.last_failure_time).total_seconds() > self.timeout
            ):
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
                f"MCP circuit breaker: CLOSED → OPEN ({self.failure_count} consecutive failures)"
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
            ts for ts in self.user_requests[user_id] if (now - ts).total_seconds() < 60
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
            ts for ts in self.ip_requests[ip_address] if (now - ts).total_seconds() < 60
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
    if len(user_id) == 24 and all(c in "0123456789abcdef" for c in user_id.lower()):
        return user_id

    if user_id.isdigit():
        return user_id

    logger.warning(f"Invalid user_id format: {user_id}")
    return None


# ============================================
# MCP CLIENT INTEGRATION (Issues #2, #4, #5, #7, #11, #13, #14)
# ============================================


async def fetch_user_context(user_id: str, request_id: str) -> UserContextResult:
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
            fetch_time_ms=0.0,
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
            fetch_time_ms=0.0,
        )

    # Configure server parameters.
    # PYTHONPATH must be PREPENDED to (not replace) the inherited value: in the
    # container, all third-party packages (incl. the `mcp` SDK) live only in
    # /install/lib/pythonX/site-packages, which is reachable solely via the
    # inherited PYTHONPATH. Overwriting it dropped that path and made the MCP
    # subprocess fail with `ModuleNotFoundError: No module named 'mcp'`. We add
    # the app root (module_dir.parent) so `app.*` imports resolve too.
    child_env = os.environ.copy()
    existing_pythonpath = child_env.get("PYTHONPATH", "")
    child_env["PYTHONPATH"] = str(module_dir.parent) + (
        os.pathsep + existing_pythonpath if existing_pythonpath else ""
    )
    server_params = StdioServerParameters(
        command=sys.executable,  # Use current Python interpreter
        args=[str(server_script)],
        env=child_env,
    )

    context_result = UserContextResult(
        profile_context="",
        recovery_context="",
        expert_directory="",
        products_directory="",
        has_profile=False,
        has_recovery=False,
        error=None,
        fetch_time_ms=0.0,
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
                            arguments={"user_id": user_id, "format_for_prompt": True},
                        )
                        logger.info(f"Profile result {profile_result}")

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
                                else:
                                    # Loud on purpose. A tool-side crash used to land
                                    # here and silently produce a promptless, profile-free
                                    # answer that was indistinguishable at INFO level from
                                    # a user who simply had no profile — which is how a
                                    # total outage on the pregnant-user path went unnoticed.
                                    logger.warning(
                                        f"[{request_id}] Profile tool returned an error, "
                                        f"personalization disabled: {parsed.get('error')}"
                                    )
                                    context_result.error = "Profile tool error"
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
                            arguments={"user_id": user_id, "limit": 3, "format_for_prompt": True},
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
                        logger.error(
                            f"[{request_id}] Recommendations fetch error: {type(e).__name__}"
                        )
                        if not context_result.error:
                            context_result.error = "Recommendations fetch failed"

                    # Fetch expert directory, scoped to this user's referral.
                    # Requested as JSON rather than a pre-formatted block because the
                    # suggestion matcher needs the expert ids and name variants; the
                    # prompt block is rendered from the same payload below.
                    try:
                        expert_result = await session.call_tool(
                            name="get_all_experts",
                            arguments={"user_id": user_id, "format_for_prompt": False},
                        )
                        if expert_result.content:
                            import json

                            experts_payload = json.loads(expert_result.content[0].text)
                            context_result.experts = experts_payload.get("experts", [])
                            context_result.expert_directory = format_experts_for_prompt(
                                experts_payload
                            )
                    except Exception as e:
                        logger.warning(f"[{request_id}] Expert directory fetch error: {str(e)}")

                    # Fetch products directory, scoped to this user's entitlements —
                    # a referral program may suppress product recommendations entirely,
                    # in which case this comes back empty and nothing is offered.
                    try:
                        products_result = await session.call_tool(
                            name="get_all_products",
                            arguments={"user_id": user_id, "format_for_prompt": True},
                        )
                        if products_result.content:
                            raw_products = products_result.content[0].text
                            # MCP sometimes returns duplicated product lines — deduplicate
                            seen = set()
                            deduped_lines = []
                            for line in raw_products.splitlines():
                                if line not in seen:
                                    seen.add(line)
                                    deduped_lines.append(line)
                            context_result.products_directory = "\n".join(deduped_lines)
                    except Exception as e:
                        logger.warning(f"[{request_id}] Products directory fetch error: {str(e)}")

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
            expert_directory="",
            products_directory="",
            has_profile=False,
            has_recovery=False,
            error="Service timeout",  # Issue #11: Safe message
            fetch_time_ms=elapsed_ms,
        )

    except OSError as e:
        # File system or process errors
        logger.error(f"[{request_id}] MCP process error: {str(e)}")
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False)

        return UserContextResult(
            profile_context="",
            recovery_context="",
            expert_directory="",
            products_directory="",
            has_profile=False,
            has_recovery=False,
            error="Service unavailable",  # Issue #11: Safe message
            fetch_time_ms=(time.time() - start_time) * 1000,
        )

    except Exception as e:
        # Unexpected errors
        logger.error(
            f"[{request_id}] Unexpected MCP error: {type(e).__name__}: {str(e)}", exc_info=True
        )
        _mcp_circuit_breaker.record_failure()
        _metrics.record_mcp_call(success=False)

        return UserContextResult(
            profile_context="",
            recovery_context="",
            expert_directory="",
            products_directory="",
            has_profile=False,
            has_recovery=False,
            error="Service error",  # Issue #11: Safe message
            fetch_time_ms=(time.time() - start_time) * 1000,
        )


# ============================================
# ASYNC RAG RETRIEVAL (Issue #9, #17)
# ============================================


_NON_LATIN_RANGES = (
    (0x0900, 0x097F),  # Devanagari (Hindi, Marathi, etc.)
    (0x0980, 0x09FF),  # Bengali
    (0x0A00, 0x0A7F),  # Gurmukhi (Punjabi)
    (0x0A80, 0x0AFF),  # Gujarati
    (0x0B00, 0x0B7F),  # Odia
    (0x0B80, 0x0BFF),  # Tamil
    (0x0C00, 0x0C7F),  # Telugu
    (0x0C80, 0x0CFF),  # Kannada
    (0x0D00, 0x0D7F),  # Malayalam
    (0x0600, 0x06FF),  # Arabic / Urdu
    (0x4E00, 0x9FFF),  # CJK (Chinese/Japanese/Korean)
)


def _is_non_latin(text: str) -> bool:
    """Return True if text contains a significant portion of non-Latin characters."""
    non_latin = sum(1 for ch in text if any(lo <= ord(ch) <= hi for lo, hi in _NON_LATIN_RANGES))
    return non_latin >= max(1, len(text) * 0.15)  # ≥15% non-Latin chars


import re as _re


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> reasoning blocks produced by qwen3 and similar models."""
    stripped = _re.sub(r"<think>.*?</think>", "", text, flags=_re.DOTALL)
    return stripped.strip()


def translate_query_for_rag(text: str, request_id: str) -> str:
    """
    Ensure the query is in English for FAISS retrieval.

    Handles all scripts and mixed languages including:
    - Pure Hindi (Devanagari): translated to English
    - Hinglish (Roman-script Hindi like "Prasav ke baad..."): translated to English
    - Pure English: returned unchanged (LLM detects and skips translation)

    Uses a strong translation model (settings.translation_model) rather than
    the small classifier model: small models mistranslate domain terms — e.g.
    "nehlana" (bathe) rendered as "circumcise" — which produces a wrong English
    query, drops the RAG score below threshold, and silently breaks retrieval.
    The original text is kept intact for the final LLM prompt so the
    user always receives a response in their own language.
    """
    try:
        llm = get_llm(settings.translation_model)
        prompt = (
            "If the following text is not in English (including Hinglish, Roman-script Hindi, "
            "or any other non-English language), translate it to English. "
            "If it is already in English, return it exactly as-is. "
            "Return ONLY the text, no explanations, no quotes:\n\n"
            f"{text}"
        )
        response = llm.invoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        translated = _strip_thinking(raw).strip()
        if translated.lower() != text.lower():
            logger.info(
                f"[{request_id}] Query translated for RAG: '{text[:60]}' → '{translated[:60]}'"
            )
        return translated or text  # Fallback to original if empty
    except Exception as e:
        logger.warning(
            f"[{request_id}] Translation failed ({type(e).__name__}), using original query for RAG"
        )
        return text  # Graceful fallback — use original


# Canned response returned whenever no context source can answer the question.
NO_CONTEXT_FALLBACK = (
    "I'm sorry, I don't have specific information about that in my knowledge base right now. "
    "For personalised guidance on your perinatal wellness journey, please reach out to our "
    "VivaMama medical experts through the **Experts** section in the app."
)


def check_context_grounding(
    query: str,
    rag_context_block: str,
    profile_context: str,
    recovery_context: str,
    products_directory: str,
    request_id: str,
    rag_best_score: float = 0.0,
    content_context: str = "",
) -> bool:
    """
    Deterministic gate: ask a fast classifier model whether the question can be
    directly answered using only the assembled context (RAG docs + curated content
    + user profile + recovery data + products directory).

    This is a hard short-circuit, not a prompt suggestion to the main LLM — the
    main generation LLM is never invoked when this returns False. Fails closed
    (treats errors/ambiguous output as "not grounded") because in this medical
    context a wrongly-withheld answer is far safer than a hallucinated one.
    """
    has_rag = bool(rag_context_block) and rag_context_block.strip() != "None"
    has_content = bool(content_context and content_context.strip())
    has_profile = bool(profile_context and profile_context.strip())
    has_recovery = bool(recovery_context and recovery_context.strip())
    has_products = bool(products_directory and products_directory.strip())

    if not (has_rag or has_content or has_profile or has_recovery or has_products):
        logger.info(f"[{request_id}] Grounding gate: no context available -> not grounded")
        return False

    # High-confidence RAG match — skip the classifier entirely
    if rag_best_score >= 0.75:
        logger.info(
            f"[{request_id}] Grounding gate: RAG score={rag_best_score:.3f} >= 0.75 -> auto-grounded"
        )
        return True

    sources = []
    if has_rag:
        sources.append("=== RAG DOCUMENTS ===\n" + rag_context_block[:2500])
    if has_content:
        sources.append("=== CONTENT ARTICLES ===\n" + content_context[:2500])
    if has_profile:
        sources.append("=== USER PROFILE ===\n" + profile_context[:1000])
    if has_recovery:
        sources.append("=== RECOVERY DATA ===\n" + recovery_context[:1000])
    if has_products:
        sources.append("=== PRODUCTS DIRECTORY ===\n" + products_directory[:1500])

    prompt = (
        "You are a strict grounding checker for a medical wellness assistant. "
        "Given a user question and context sources, decide whether the question can be "
        "DIRECTLY answered using ONLY information explicitly present in those sources.\n\n"
        + "\n\n".join(sources)
        + f"\n\nQUESTION: {query}\n\n"
        "Rules:\n"
        "- If the sources directly address this specific question, answer: YES\n"
        "- If the sources are about a different topic, or don't contain the answer, answer: NO\n"
        "- Answer with ONLY the single word YES or NO, nothing else."
    )

    try:
        llm = get_llm(settings.scope_classifier_model, classifier=True)
        response = llm.invoke(prompt)
        text = (response.content if hasattr(response, "content") else str(response)).strip().upper()
        grounded = text.startswith("YES")
        logger.info(
            f"[{request_id}] Grounding gate: classifier='{text[:20]}' -> grounded={grounded}"
        )
        return grounded
    except Exception as e:
        logger.warning(
            f"[{request_id}] Grounding gate error ({type(e).__name__}: {e}) -> failing closed (not grounded)"
        )
        return False


async def fetch_rag_context(
    query: str, request_id: str, retriever: RAGRetriever
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
        result = await loop.run_in_executor(None, retriever.query, query)

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


async def fetch_content_context(query: str, request_id: str) -> str:
    """Search the curated `contents` collection (via MCP) for the given query.

    Used as a FALLBACK only when RAG retrieved weakly. Returns a formatted content
    block for the prompt, or "" when nothing relevant matched or on any error
    (fails soft — the pipeline just proceeds without content).
    """
    import json

    query = (query or "").strip()
    if not query:
        return ""

    module_dir = Path(__file__).resolve().parent.parent
    server_script = module_dir / "mcp" / "context_server.py"
    if not server_script.exists():
        logger.error(f"[{request_id}] MCP server script not found for content: {server_script}")
        return ""

    # Same PYTHONPATH handling as fetch_user_context: prepend the app root but keep
    # the inherited path so the container can still import installed packages.
    child_env = os.environ.copy()
    existing_pythonpath = child_env.get("PYTHONPATH", "")
    child_env["PYTHONPATH"] = str(module_dir.parent) + (
        os.pathsep + existing_pythonpath if existing_pythonpath else ""
    )
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(server_script)],
        env=child_env,
    )

    try:
        async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
            async with stdio_client(server_params) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    result = await session.call_tool(
                        name="get_relevant_contents",
                        arguments={
                            "query": query,
                            "limit": settings.content_search_limit,
                            "format_for_prompt": True,
                        },
                    )
                    if not result.content:
                        return ""
                    text = (result.content[0].text or "").strip()
                    # Error payloads come back as JSON {"error": ...}
                    try:
                        parsed = json.loads(text)
                        if isinstance(parsed, dict) and "error" in parsed:
                            logger.warning(f"[{request_id}] Content tool error: {parsed['error']}")
                            return ""
                    except (json.JSONDecodeError, TypeError):
                        pass  # normal case: formatted (non-JSON) content block
                    if text:
                        logger.info(f"[{request_id}] Content fallback matched ({len(text)} chars)")
                    return text
    except Exception as e:
        logger.warning(f"[{request_id}] Content fetch failed ({type(e).__name__}): {e}")
        return ""


# ============================================
# PROMPT BUILDING WITH SIZE VALIDATION (Issue #15)
# ============================================


def _contains_devanagari(text: str) -> bool:
    """True if the text contains any Devanagari (Hindi script) character."""
    return any("ऀ" <= ch <= "ॿ" for ch in text)


def build_script_directive(user_query: str) -> str:
    """
    Deterministic language/script directive for the main LLM.

    The model cannot be trusted to infer script on its own — with Roman-script
    Hinglish (e.g. "kya bacche ko nehlana sahi hai?") llama-3.3-70b "normalizes"
    the reply into Devanagari Hindi, which is the wrong script. So we detect the
    script the user actually typed in (presence of Devanagari code points) and
    hand the model an unambiguous instruction instead of asking it to detect.
    """
    if _contains_devanagari(user_query):
        return (
            "  • The user wrote in DEVANAGARI (Hindi) script. You MUST write your "
            "ENTIRE response in Hindi using Devanagari script.\n"
        )
    return (
        "  • The user wrote in ROMAN / LATIN script (this is Hinglish — "
        "Roman-script Hindi — or English). You MUST write your ENTIRE response "
        "using ONLY Roman/Latin letters (a–z).\n"
        "  • If the question is Hinglish, reply in Hinglish: the same natural "
        "Roman-script Hindi+English mix the user used.\n"
        "  • ⛔ DO NOT output a single Devanagari/Hindi-script character. "
        "Transliterating Hindi words into Roman letters is required, not optional.\n"
    )


def build_prompt(
    system_prompt: str,
    profile_context: str,
    recovery_context: str,
    expert_directory: str,
    products_directory: str,
    has_profile: bool,
    has_recovery: bool,
    history_block: str,
    rag_context: str,
    user_query: str,
    request_id: str,
    content_context: str = "",
) -> str:
    """
    Build final prompt with size validation.

    Issue #15: Validate prompt size and truncate if needed
    """
    prompt_parts = [system_prompt, "\n\n"]

    # --- Expert Directory (Reference for referrals) ---
    prompt_parts.append("=== VIVAMAMA EXPERT DIRECTORY ===\n")
    if expert_directory:
        prompt_parts.append(expert_directory)
    else:
        prompt_parts.append(
            "⚠️ No expert data is available right now. "
            "DO NOT invent, guess, or use any expert names. "
            'Use ONLY the generic fallback phrase: "Connect with our VivaMama medical experts."'
        )
    prompt_parts.append("\n\n")

    # --- Products Directory (Reference for products) ---
    # Cap at 3500 chars to stay within the free-tier 6000 TPM limit
    # (system prompt + user profile + RAG chunks + products ≈ 5500 tokens total)
    MAX_PRODUCTS_CHARS = 3500
    if settings.disable_product_recommendations:
        # Toggle ON: omit the catalog entirely (nothing to recommend) AND override the
        # SYSTEM_PROMPT's PRODUCTS REFERRAL rules so the model doesn't emit the products
        # header or product names.
        prompt_parts.append(
            "=== PRODUCT RECOMMENDATIONS: DISABLED ===\n"
            "Product recommendations are turned OFF for this response. Do NOT suggest, "
            "mention, name, or reference ANY product, and do NOT output the products "
            "section or its header. Ignore all PRODUCTS REFERRAL instructions above.\n\n"
        )
    elif products_directory:
        truncated_products = products_directory[:MAX_PRODUCTS_CHARS]
        if len(products_directory) > MAX_PRODUCTS_CHARS:
            truncated_products += "\n[... more products available in the app ...]"
        prompt_parts.append("=== VIVAMAMA PRODUCTS DIRECTORY ===\n")
        prompt_parts.append(truncated_products)
        prompt_parts.append("\n\n")

    # --- User Context (conditionally usable) ---
    # The profile is NOT optional context. Her stage and week are not facts to answer
    # *from* — they are the parameters that decide WHICH answer is correct. Labelling
    # this block "(optional)" and telling the model to drop it when unsure is how a
    # pregnant user got told "I don't have information about your current week".
    if has_profile and profile_context:
        prompt_parts.append("=== USER PROFILE (established facts about this user) ===\n")
        prompt_parts.append(profile_context)
        prompt_parts.append(
            "\nThese are verified facts about the woman you are speaking to, taken from "
            "her own record. Her stage and week are KNOWN — never tell her you don't "
            "know them, and never ask her to confirm whether she is pregnant or "
            "postpartum. Answer for the stage stated above.\n"
        )
        prompt_parts.append("\n")

    # Recovery data, unlike the profile, genuinely IS optional — it is a topical
    # source, not a statement of who she is.
    if has_recovery and recovery_context:
        prompt_parts.append("=== RECOVERY CONTEXT (optional) ===\n")
        prompt_parts.append(recovery_context)
        prompt_parts.append("\n\n")
        prompt_parts.append(
            "You MAY reference RECOVERY CONTEXT only if it directly helps answer the "
            "question. If unsure, ignore it.\n"
        )
        # Repeated next to the data itself — adherence is far better here
        # than from the system prompt alone.
        prompt_parts.append(
            "If you use anything from RECOVERY CONTEXT, attribute it with "
            '"As per your recently logged recovery check-in, ...".\n'
        )
        prompt_parts.append("\n")

    # --- Conversation history (non-influential) ---
    if history_block:
        prompt_parts.append("Recent context (for reference only, do not repeat):\n")
        prompt_parts.append(history_block)
        prompt_parts.append("\n")

    # --- RAG context ---
    has_rag = rag_context and rag_context.strip() != "None"
    if has_rag:
        prompt_parts.append(
            "=== KNOWLEDGE BASE CONTEXT (RAG) ===\n"
            "Retrieved documents most relevant to the user's question:\n"
        )
        prompt_parts.append(rag_context)
        prompt_parts.append("\n\n")
    else:
        prompt_parts.append(
            "=== KNOWLEDGE BASE CONTEXT (RAG) ===\n"
            "No relevant documents were retrieved for this query.\n\n"
        )

    # --- Curated content (fallback source, ranked after RAG) ---
    if content_context and content_context.strip():
        prompt_parts.append(
            "=== CONTENT KNOWLEDGE BASE ===\n"
            "Curated VivaMama articles relevant to the user's question "
            "(use these when the RAG documents above don't fully answer it):\n"
        )
        prompt_parts.append(content_context)
        prompt_parts.append("\n\n")

    # --- User query ---
    prompt_parts.append("=== USER QUESTION ===\n")
    prompt_parts.append(user_query)
    prompt_parts.append("\n\n")

    # --- Answering rules (LLM is the sole grounding authority) ---
    prompt_parts.append(
        "=== ANSWERING RULES ===\n"
        "You have the following context sources available:\n"
        "  1. KNOWLEDGE BASE CONTEXT (RAG) — retrieved medical/wellness documents\n"
        "  2. CONTENT KNOWLEDGE BASE — curated VivaMama articles (fallback when RAG is thin)\n"
        "  3. USER PROFILE — established facts about WHO you are answering for: her "
        "stage (pregnant / postpartum / not pregnant) and her week within it\n"
        "  4. VIVAMAMA PRODUCTS DIRECTORY — product catalog\n"
        "  5. VIVAMAMA EXPERT DIRECTORY — available specialists\n\n"
        "USER PROFILE is not ranked with the others — it is the LENS you read them "
        "through. It tells you who she is and what stage she is in, so use it to "
        "select and frame the answer even when the answer itself comes from RAG.\n\n"
        "CRITICAL — Follow this decision logic strictly:\n"
        "  STEP 1 — Read the user's question carefully.\n"
        "  STEP 2 — Identify which context sources are RELEVANT to THIS specific question. "
        "A source is relevant if it discusses the same topic — EVEN IF it does not contain a "
        "complete or word-for-word answer. Ignore any source that is about a different topic.\n"
        "  STEP 3 — If ANY relevant context exists, answer from it (prefer in this order: RAG → "
        "CONTENT KNOWLEDGE BASE → PRODUCTS), framed for the stage and week in USER PROFILE:\n"
        "      • If the relevant context FULLY answers the question → answer it directly.\n"
        "      • If it only PARTIALLY answers (related, but not the exact point asked) → give the "
        "helpful, grounded answer you CAN from what is present, and be transparent about the gap, "
        'e.g. "I don\'t have the exact <thing asked>, but based on my knowledge base: ...". '
        "Do NOT refuse just because the match isn't perfect.\n"
        "  STEP 4 — If NONE of the context sources are relevant to the question → do NOT invent an "
        "answer. Briefly acknowledge you don't have specific information on that topic, then direct "
        "the user to the **Experts** section. This NEVER extends to her own details: if USER "
        "PROFILE is present you always know her stage and week, so never say you lack them and "
        "never ask her to tell you whether she is pregnant or postpartum. Example wording:\n"
        "      \"I'm sorry, I don't have specific information about that in my knowledge base "
        "right now. For personalised guidance on your perinatal wellness journey, please "
        'reach out to our VivaMama medical experts through the **Experts** section in the app."\n\n'
        "ABSOLUTE RULES:\n"
        "  ✗ NEVER use general training knowledge — answer ONLY from the relevant context above. "
        "If a fact is not in the context, you do not know it.\n"
        "  ✗ NEVER fabricate facts, numbers, dosages, medication effects, or citations.\n"
        "  ✗ NEVER use the EXAMPLES section as factual data — it is format guidance only.\n"
        "  ✓ Stay strictly on the user's ACTUAL question. Do not drift onto a loosely-related "
        "topic just because a retrieved document happens to mention it.\n"
        "  ✓ Default output: concise, scannable answers using bullet points and bold text.\n\n"
        "⚠️ LANGUAGE & SCRIPT — THIS IS MANDATORY, DO THIS BEFORE WRITING ANYTHING:\n"
        + build_script_directive(user_query)
        + "  • Mirror this script in your ENTIRE response — bullet points, "
        "headings, product lines and expert referrals included.\n"
        "  • Match the user's language too: never switch to English if the user "
        "wrote in Hindi or Hinglish.\n"
    )

    final_prompt = "".join(prompt_parts)

    # --- Size guard ---
    if len(final_prompt) > MAX_PROMPT_LENGTH:
        logger.warning(f"[{request_id}] Prompt too long ({len(final_prompt)} chars), truncating")
        final_prompt = final_prompt[:MAX_PROMPT_LENGTH] + "\n[... truncated ...]"

    logger.debug(f"[{request_id}] Final prompt:\n{final_prompt}")

    return final_prompt


# ============================================
# MAIN CHAT FUNCTION (ALL ISSUES ADDRESSED)
# ============================================


async def chat_once(
    user_text: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    history_window: int = 3,
    model: Optional[str] = None,
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
            user_context=UserContextResult(
                profile_context="",
                recovery_context="",
                expert_directory="",
                products_directory="",
                has_profile=False,
                has_recovery=False,
                error="Rate limited",
                fetch_time_ms=0.0,
            ),
            redaction={},
            scope={},
            escalation_banner=None,
            memory_turns=[],
            timing={},
            service_level=ServiceLevel.MINIMAL.value,
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
            user_context=UserContextResult(
                profile_context="",
                recovery_context="",
                expert_directory="",
                products_directory="",
                has_profile=False,
                has_recovery=False,
                error="Rate limited",
                fetch_time_ms=0.0,
            ),
            redaction={},
            scope={},
            escalation_banner=None,
            memory_turns=[],
            timing={},
            service_level=ServiceLevel.MINIMAL.value,
        )

    # Issue #17: Use async memory operations
    memory = RedisSessionMemory(window_size=8)
    session_id = memory.ensure_session_id(session_id)

    # Issue #12: Validate user_id
    validated_user_id = validate_user_id(user_id)
    logger.info(f"validated {user_id}")
    if user_id and not validated_user_id:
        logger.warning(f"[{request_id}] Invalid user_id format: {user_id}")
        validated_user_id = None

    # Get conversation history
    # Issue #17: Run in executor to avoid blocking
    loop = asyncio.get_event_loop()
    prior_turns = await loop.run_in_executor(None, memory.get_last_n, session_id, history_window)

    # ---------------- Guardrails ----------------
    guardrails_start = time.time()

    redacted_text, redaction_report = redact(user_text)

    # LactMed carve-out: breastfeeding drug-safety questions are answered from the
    # curated LactMed dataset, so they must bypass the medical-scope refusal in
    # enforce_scope (which blocks words like "antibiotic" or "medicine for ...").
    # We still guard this path against prompt injection.
    lactmed_drug = is_lactation_query(redacted_text)
    if lactmed_drug is not None:
        safe_text = redacted_text
        scope_notes = {"blocked": False, "offtopic": False, "matched": []}
        is_injection, injection_patterns = check_prompt_injection(redacted_text)
        if is_injection:
            safe_text = PROMPT_INJECTION_REFUSAL
            scope_notes = {"blocked": False, "offtopic": True, "matched": injection_patterns}
            lactmed_drug = None
        else:
            logger.info(f"[{request_id}] LactMed match: {lactmed_drug['name']}")
    else:
        safe_text, scope_notes = enforce_scope(redacted_text)

    timings["guardrails"] = (time.time() - guardrails_start) * 1000

    if scope_notes["offtopic"]:
        logger.info(f"[{request_id}] Request rejected: out of scope")
        timings["total"] = (time.time() - request_start_time) * 1000

        _metrics.record_request(
            success=True, service_level=ServiceLevel.MINIMAL.value, timings=timings
        )

        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            answer=safe_text,
            intent="OUT_OF_SCOPE",
            used_rag=False,
            rag_best_score=0.0,
            user_context=UserContextResult(
                profile_context="",
                recovery_context="",
                expert_directory="",
                products_directory="",
                has_profile=False,
                has_recovery=False,
                error=None,
                fetch_time_ms=0.0,
            ),
            redaction=redaction_report,
            scope=scope_notes,
            escalation_banner="",
            memory_turns=prior_turns,
            timing=timings,
            service_level=ServiceLevel.MINIMAL.value,
        )

    # ---------------- Intent Routing ----------------
    # Issue #16: Determine service level based on component availability
    service_level = ServiceLevel.FULL
    intent = route_intent(safe_text)

    # SELF_QUERY short-circuit — return Viva AI description instantly,
    # before any MCP/RAG/LLM calls (zero compute cost).
    if intent == "SELF_QUERY":
        logger.info(f"[{request_id}] SELF_QUERY detected — returning self-description")
        await loop.run_in_executor(None, memory.append, session_id, "user", safe_text)
        await loop.run_in_executor(
            None, memory.append, session_id, "assistant", VIVA_SELF_DESCRIPTION
        )
        timings["total"] = (time.time() - request_start_time) * 1000
        _metrics.record_request(
            success=True, service_level=ServiceLevel.FULL.value, timings=timings
        )
        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            answer=VIVA_SELF_DESCRIPTION,
            intent="SELF_QUERY",
            used_rag=False,
            rag_best_score=0.0,
            user_context=UserContextResult(
                profile_context="",
                recovery_context="",
                expert_directory="",
                products_directory="",
                has_profile=False,
                has_recovery=False,
                error=None,
                fetch_time_ms=0.0,
            ),
            redaction=redaction_report,
            scope=scope_notes,
            escalation_banner=None,
            memory_turns=await loop.run_in_executor(
                None, memory.get_last_n, session_id, history_window
            ),
            final_prompt="[SELF_QUERY — no LLM call]",
            timing=timings,
            service_level=ServiceLevel.FULL.value,
        )

    # Keyword args, deliberately: this used to be six positional arguments against a
    # dataclass that had since gained expert_directory and products_directory as
    # fields 3 and 4, so the booleans were landing in the directory slots.
    user_context = UserContextResult(
        profile_context="",
        recovery_context="",
        expert_directory="",
        products_directory="",
        has_profile=False,
        has_recovery=False,
        error=None,
        fetch_time_ms=0.0,
    )

    if validated_user_id:
        logger.info(f"[{request_id}] Fetching context for user_id: {validated_user_id}")
        mcp_start = time.time()

        try:
            user_context = await fetch_user_context(validated_user_id, request_id)
            logger.info(user_context)
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

    # Curated-content fallback block (populated below only when RAG is weak).
    content_context = ""

    if lactmed_drug is not None:
        # Answer from the curated LactMed dataset instead of the vector index.
        rag_context_block = format_lactmed_context(lactmed_drug)
        docs, used_rag, best_score = [], True, 1.0  # >=0.75 auto-passes grounding gate
        grounding_query = safe_text
        timings["rag"] = (time.time() - rag_start) * 1000
        logger.info(
            f"[{request_id}] LactMed context for '{lactmed_drug['name']}' "
            "\u2014 skipping vector retrieval"
        )
    else:
        # Process-wide retriever: the model (downloaded from GCS on boot) and the
        # FAISS index are loaded ONCE per container and reused across requests,
        # instead of re-loading the ~2 GB model on every request.
        retriever = get_shared_retriever()

        # Retrieve on the RAW user query first. The embedding model (bge-m3) is
        # multilingual, so Hindi/Hinglish queries match the English corpus directly
        # — no translation needed in the common case. safe_text (original language)
        # is still what goes into the LLM prompt so the user is answered in their
        # own language.
        loop = asyncio.get_event_loop()
        grounding_query = safe_text  # query handed to the grounding classifier
        try:
            # Issue #9: Async RAG call
            docs, used_rag, best_score = await fetch_rag_context(safe_text, request_id, retriever)

            # Lazy translation fallback (safety net): only if the raw query retrieved
            # weakly do we pay for a translation LLM call and retrieve again, keeping
            # whichever variant scored higher. This removes the single point of
            # failure — a bad translation can no longer sink a query, and a query the
            # embedder already handles well never touches the translator at all.
            if best_score < settings.rag_translation_fallback_threshold:
                translated = await loop.run_in_executor(
                    None, translate_query_for_rag, safe_text, request_id
                )
                if translated and translated.strip().lower() != safe_text.strip().lower():
                    # English form is the most reliable input for the grounding classifier.
                    grounding_query = translated
                    t_docs, t_used, t_score = await fetch_rag_context(
                        translated, request_id, retriever
                    )
                    logger.info(
                        f"[{request_id}] RAG dual-retrieval: raw={best_score:.3f} "
                        f"translated={t_score:.3f} -> "
                        f"{'translated' if t_score > best_score else 'raw'}"
                    )
                    if t_score > best_score:
                        docs, used_rag, best_score = t_docs, t_used, t_score

            timings["rag"] = (time.time() - rag_start) * 1000

            if used_rag and docs:
                rag_context_block = "\n\n".join(
                    f"[{i + 1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
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

    # ---------------- Content Fallback (conditional) ----------------
    # Only when RAG retrieved weakly do we search the curated `contents`
    # collection (matches your "if not in RAG, look in content" requirement).
    # Uses grounding_query — the English translation when RAG fell back — so
    # multilingual queries still match the English articles. LactMed answers are
    # authoritative (best_score=1.0), so this never fires for them.
    if (
        settings.enable_content_source
        and lactmed_drug is None
        and best_score < settings.rag_translation_fallback_threshold
    ):
        content_context = await fetch_content_context(grounding_query, request_id)

    # Visibility: log the retrieved RAG documents (and any content match) BEFORE
    # the grounding gate. When the gate fails closed, build_prompt — the only other
    # place these appear — never runs, so without this the retrieved context is
    # invisible for exactly the queries you most need to debug.
    logger.info(
        f"[{request_id}] Retrieved RAG context (best_score={best_score:.3f}, "
        f"grounding_query='{grounding_query[:80]}'):\n{rag_context_block}"
    )
    if content_context:
        logger.info(f"[{request_id}] Retrieved content context:\n{content_context}")

    # ---------------- Hard Grounding Gate (optional, default OFF) ----------------
    # Deterministic short-circuit: a fast classifier decides whether a context
    # source actually contains an answer, and if not, returns a canned fallback
    # WITHOUT calling the main LLM. This over-rejected genuine partial answers
    # (e.g. it only saw the first ~2500 chars of RAG), so it is now disabled by
    # default: the main LLM is the sole grounding authority via its ANSWERING RULES
    # (answer from relevant context, soft-fallback only when nothing relevant).
    # Kept behind settings.enable_grounding_gate purely for instant rollback.
    if settings.enable_grounding_gate:
        grounded = await loop.run_in_executor(
            None,
            check_context_grounding,
            grounding_query,
            rag_context_block,
            user_context.profile_context,
            user_context.recovery_context,
            user_context.products_directory,
            request_id,
            best_score,
            content_context,
        )

        if not grounded:
            logger.info(
                f"[{request_id}] Grounding gate: NOT grounded — returning fallback, skipping main LLM"
            )

            # Still scan the user's own message for emergency red flags so a true
            # emergency isn't silently swallowed just because RAG/profile/products
            # didn't have a topical match.
            in_level, in_matches = scan_for_red_flags(safe_text)
            banner = (
                format_escalation_banner(in_level, list(in_matches)) if in_level != "NONE" else ""
            )
            fallback_answer = (banner + "\n\n" if banner else "") + NO_CONTEXT_FALLBACK

            await loop.run_in_executor(None, memory.append, session_id, "user", safe_text)
            await loop.run_in_executor(
                None, memory.append, session_id, "assistant", fallback_answer
            )

            timings["total"] = (time.time() - request_start_time) * 1000
            _metrics.record_request(
                success=True, service_level=ServiceLevel.MINIMAL.value, timings=timings
            )

            return ChatResponse(
                request_id=request_id,
                session_id=session_id,
                answer=fallback_answer,
                intent="NO_RAG_CONTEXT",
                used_rag=used_rag,
                rag_best_score=round(float(best_score), 3),
                user_context=user_context,
                redaction=redaction_report,
                scope=scope_notes,
                escalation_banner=banner,
                memory_turns=await loop.run_in_executor(
                    None, memory.get_last_n, session_id, history_window
                ),
                timing=timings,
                service_level=ServiceLevel.MINIMAL.value,
                final_prompt="",
            )

        logger.info(f"[{request_id}] Grounding gate: PASSED — proceeding to main LLM generation")

    # ============================================================
    # BUILD ENRICHED PROMPT
    # ============================================================

    # Format conversation history — capped to fit within qwen3-32b's 6000 TPM limit
    history_block = ""
    for t in prior_turns[-3:]:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))[:300]
        history_block += f"- {role}: {content}\n"

    # Issue #15: Build prompt with size validation
    final_prompt = build_prompt(
        SYSTEM_PROMPT,
        user_context.profile_context,
        user_context.recovery_context,
        user_context.expert_directory,
        user_context.products_directory,
        user_context.has_profile,
        user_context.has_recovery,
        history_block,
        rag_context_block,
        safe_text,
        request_id,
        content_context,
    )

    # ============================================================
    # GENERATE RESPONSE
    # ============================================================

    llm_start = time.time()

    try:
        # Get LLM from production client (has metrics, error handling, etc.)
        llm = get_llm(model)

        # Issue #9: Run LLM in executor to avoid blocking
        loop = asyncio.get_event_loop()
        llm_response = await loop.run_in_executor(None, llm.invoke, final_prompt)
        logger.info(f"[llm_response is=>> {llm_response}] ")

        timings["llm"] = (time.time() - llm_start) * 1000

        draft_answer = _strip_thinking(
            llm_response.content if hasattr(llm_response, "content") else str(llm_response)
        )

        # A blank response usually means a Vertex safety filter blocked the
        # output (even with BLOCK_ONLY_HIGH). Never return an empty answer to a
        # user — fall back to the safe canned message instead.
        if not draft_answer.strip():
            logger.warning(
                f"[{request_id}] Empty LLM response (likely a safety block) — using fallback."
            )
            draft_answer = NO_CONTEXT_FALLBACK

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
    # Scan ONLY user-generated content for red flags:
    #   1. safe_text          — user's current message
    #   2. profile_context    — user's profile (conditions, medications)
    #   3. recovery_context   — user's check-in Q&A answers
    # Never scan draft_answer, RAG docs, or product/expert directories —
    # those contain symptom words as clinical descriptions, not user reports.
    query_level, query_matches = scan_for_red_flags(safe_text)
    profile_level, profile_matches = scan_for_red_flags(user_context.profile_context or "")
    recovery_level, recovery_matches = scan_for_red_flags(
        extract_affirmative_recovery_answers(user_context.recovery_context or "")
    )

    severity = (
        "HIGH"
        if "HIGH" in (query_level, profile_level, recovery_level)
        else "MEDIUM"
        if "MEDIUM" in (query_level, profile_level, recovery_level)
        else "NONE"
    )

    # Which of these have we already warned her about in this session?
    # Her profile and check-in answers are re-fetched every turn, so without
    # this a fever logged last week would re-trigger the banner on every
    # single message. A symptom she reports in THIS message always warns.
    announced = await loop.run_in_executor(None, memory.get_announced_alerts, session_id)

    if query_matches:
        banner_matches = list(query_matches)
        banner_source = "message"
    else:
        banner_matches = [m for m in {*recovery_matches, *profile_matches} if m not in announced]
        banner_source = (
            "checkin" if any(m in recovery_matches for m in banner_matches) else "profile"
        )

    banner = (
        format_escalation_banner(severity_for(banner_matches), banner_matches, source=banner_source)
        if banner_matches
        else ""
    )

    final_answer = (banner + "\n\n" if banner else "") + draft_answer

    # ---------------- Expert Suggestion ----------------
    # Match against draft_answer, not final_answer: the escalation banner is text we
    # prepended, not a referral the model made.
    #
    # Suppressed entirely on HIGH severity — an emergency response must send her to
    # emergency services, not offer a booking button.
    suggested_experts: List[Dict[str, Any]] = []
    if severity != "HIGH":
        try:
            suggested_experts = detect_suggested_experts(draft_answer, user_context.experts)
        except Exception as e:
            # A missing button must never cost the user her answer.
            logger.warning(
                f"[{request_id}] Expert suggestion detection failed: {type(e).__name__}: {e}"
            )

    # ---------------- Save to Memory ----------------
    # Issue #17: Async memory operations
    await loop.run_in_executor(None, memory.append, session_id, "user", safe_text)
    await loop.run_in_executor(None, memory.append, session_id, "assistant", final_answer)

    # Only what the banner actually named is marked as announced — a red flag
    # sitting in her check-in that this turn's banner did not mention must
    # still get its own warning later.
    if banner:
        await loop.run_in_executor(None, memory.mark_alerts_announced, session_id, banner_matches)

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
    _metrics.record_request(success=True, service_level=service_level.value, timings=timings)
    # Issue #18: Return structured response
    return ChatResponse(
        request_id=request_id,
        session_id=session_id,
        answer=final_answer,
        intent="LACTATION_SAFETY" if lactmed_drug is not None else "USER_QUERY",
        used_rag=used_rag,
        rag_best_score=round(float(best_score), 3),
        user_context=user_context,
        redaction=redaction_report,
        scope=scope_notes,
        escalation_banner=banner,
        memory_turns=await loop.run_in_executor(
            None, memory.get_last_n, session_id, history_window
        ),
        timing=timings,
        service_level=service_level.value,
        final_prompt=final_prompt,
        suggested_experts=suggested_experts,
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
            if _mcp_circuit_breaker.last_failure_time
            else None
        ),
    }


# ============================================
# BACKWARDS COMPATIBILITY
# ============================================


def chat_once_name_detector(
    user_text: str,
    session_id: Optional[str] = None,
    history_window: int = 8,
) -> Dict[str, Any]:
    """
    Detect if user's message contains their name.
    (Kept for backwards compatibility)
    """

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

    return {"answer": draft_answer}
