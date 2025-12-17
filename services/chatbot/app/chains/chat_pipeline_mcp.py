"""
Enhanced Chat Pipeline with MCP Context Integration

This is the main chat pipeline that:
1. Receives user messages
2. Calls MCP server to fetch user context (profile + recovery data)
3. Assembles rich prompt with context
4. Generates personalized LLM response
5. Returns response with metadata

Key Enhancement: Every response now has full user context!
"""

from __future__ import annotations
from typing import Dict, Any, Optional
import asyncio
import os

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.settings import settings
from app.llm.groq_client import get_llm
from app.memory.redis_memory import RedisSessionMemory
from app.guardrails.input_guard import redact, enforce_scope
from app.escalation.policy import scan_for_red_flags, format_escalation_banner
from app.chains.router import route_intent
from app.rag.retriever import query_with_fallback


# System prompt with context placeholders
SYSTEM_PROMPT = (
    "You are a compassionate postpartum **wellness** assistant for educational purposes only.\n"
    "- You do NOT diagnose, prescribe, or provide medication dosages.\n"
    "- Prefer using provided CONTEXT for facts; if CONTEXT is empty, answer from general postpartum wellness knowledge.\n"
    "- For product questions, use PRODUCT_CANDIDATES if present; never invent products or claims.\n"
    "- Keep responses concise, empathetic, practical, and culturally aware for users in India.\n"
    "- If unsure or outside wellness scope, say so and suggest consulting a clinician.\n"
    "- Always end with: 'Wellness information only; not medical advice.'"
)


# =========================================================
# MCP CLIENT INTEGRATION
# =========================================================

async def fetch_user_context(user_id: str) -> Dict[str, Any]:
    """
    Fetch user context from MCP server.
    
    This function:
    1. Starts the MCP server as a subprocess
    2. Calls get_user_profile tool
    3. Calls get_active_recommendations tool
    4. Returns formatted context strings
    
    Args:
        user_id: The user's MongoDB ObjectId or integer user_id
        
    Returns:
        dict: {
            "profile_context": str,  # Formatted profile for prompt
            "recovery_context": str,  # Formatted recovery + ePHI for prompt
            "has_profile": bool,
            "has_recovery": bool,
            "error": str or None
        }
    """
    # Get the MCP server script path
    project_root = os.getcwd()
    server_script = os.path.join(project_root, "app", "mcp", "context_server.py")
    print(f"[CHAT] MCP server script: {server_script}")
    # Configure server parameters
    server_params = StdioServerParameters(
        command="python3",
        args=[server_script],
        env={
            **os.environ.copy(),
            "PYTHONPATH": project_root
        }
    )
    
    context_result = {
        "profile_context": "",
        "recovery_context": "",
        "has_profile": False,
        "has_recovery": False,
        "error": None
    }
    
    try:
        # Start MCP server and connect
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                
                # Fetch user profile
                try:
                    profile_result = await session.call_tool(
                        name="get_user_profile",
                        arguments={"user_id": user_id, "format_for_prompt": True}
                    )
                    
                    if profile_result.content:
                        profile_text = profile_result.content[0].text
                        # Check if it's an error
                        if '"error"' not in profile_text.lower():
                            context_result["profile_context"] = profile_text
                            context_result["has_profile"] = True
                except Exception as e:
                    print(f"[CHAT] Error fetching profile: {str(e)}")
                    context_result["error"] = f"Profile fetch failed: {str(e)}"
                
                # Fetch recovery recommendations
                try:
                    recs_result = await session.call_tool(
                        name="get_active_recommendations",
                        arguments={"user_id": user_id, "limit": 3, "format_for_prompt": True}
                    )
                    
                    if recs_result.content:
                        recs_text = recs_result.content[0].text
                        # Check if it's an error or "not found"
                        if '"error"' not in recs_text.lower() and 'not found' not in recs_text.lower():
                            context_result["recovery_context"] = recs_text
                            context_result["has_recovery"] = True
                except Exception as e:
                    print(f"[CHAT] Error fetching recommendations: {str(e)}")
                    # Don't overwrite profile error if it exists
                    if not context_result["error"]:
                        context_result["error"] = f"Recommendations fetch failed: {str(e)}"
        
        return context_result
    
    except Exception as e:
        print(f"[CHAT] MCP client error: {str(e)}")
        context_result["error"] = f"MCP connection failed: {str(e)}"
        return context_result


# =========================================================
# MAIN CHAT FUNCTION (ENHANCED WITH MCP)
# =========================================================

async def chat_once(
    user_text: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    history_window: int = 4,
) -> Dict[str, Any]:
    """
    Process a single chat message with full user context from MCP.
    
    Args:
        user_text: The user's message
        user_id: The user's MongoDB ObjectId (required for personalization)
        session_id: Redis session ID for conversation memory
        history_window: Number of previous turns to include
        
    Returns:
        dict: {
            "session_id": str,
            "answer": str,
            "intent": str,
            "used_rag": bool,
            "rag_best_score": float,
            "user_context": dict,  # NEW: Contains profile + recovery data
            "redaction": dict,
            "scope": dict,
            "escalation_banner": str or None,
            "memory_turns": list
        }
    """
    memory = RedisSessionMemory(window_size=6)
    session_id = memory.ensure_session_id(session_id)
    
    prior_turns = memory.get_last_n(session_id, history_window)
    
    # ---------------- Guardrails ----------------
    redacted_text, redaction_report = redact(user_text)
    safe_text, scope_notes = enforce_scope(redacted_text)
    
    if scope_notes["offtopic"]:
        return {
            "session_id": session_id,
            "answer": safe_text,
            "intent": "OUT_OF_SCOPE",
            "redaction": redaction_report,
            "scope": scope_notes,
            "used_rag": False,
            "rag_best_score": 0.0,
            "user_context": {},
            "escalation_banner": "",
            "memory_turns": memory.get_last_n(session_id, history_window),
        }
    
    # ---------------- Intent Routing ----------------
    intent = route_intent(safe_text)
    
    empathetic_prefix = ""
    if intent != "PRODUCT_QUERY":
        empathetic_prefix = (
            "- Begin with a warm, validating emotional acknowledgment.\n"
            "- Respond with empathy and reassurance.\n"
            "- Provide clear, simple, and supportive steps.\n"
        )
    
    # ============================================================
    # NEW: FETCH USER CONTEXT VIA MCP
    # ============================================================
    
    user_context = {}
    profile_context_str = ""
    recovery_context_str = ""
    
    if user_id:
        print(f"[CHAT] Fetching context for user_id: {user_id}")
        user_context = await fetch_user_context(user_id)
        
        if user_context["has_profile"]:
            profile_context_str = user_context["profile_context"]
            print(f"[CHAT] ✅ Profile context loaded")
        else:
            print(f"[CHAT] ⚠️  No profile context available")
        
        if user_context["has_recovery"]:
            recovery_context_str = user_context["recovery_context"]
            print(f"[CHAT] ✅ Recovery context loaded")
        else:
            print(f"[CHAT] ⚠️  No recovery context available")
        
        if user_context.get("error"):
            print(f"[CHAT] ⚠️  Context fetch error: {user_context['error']}")
    else:
        print(f"[CHAT] ⚠️  No user_id provided - skipping personalization")
    
    # ---------------- RAG (Document Retrieval) ----------------
    docs, used_rag, best_score = query_with_fallback(safe_text)
    
    if used_rag and docs:
        rag_context_block = "\n\n".join(
            f"[{i+1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
        )
    else:
        rag_context_block = "None"
    
    # ============================================================
    # BUILD ENRICHED PROMPT WITH USER CONTEXT
    # ============================================================
    
    # Format conversation history
    history_block = ""
    for t in prior_turns:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))[:800]
        history_block += f"{role}: {content}\n"
    
    # Build the complete prompt with all context
    prompt_parts = [SYSTEM_PROMPT, "\n"]
    
    # Add user context if available
    if profile_context_str:
        prompt_parts.append("=== USER PROFILE ===\n")
        prompt_parts.append(profile_context_str)
        prompt_parts.append("\n\n")
    
    if recovery_context_str:
        prompt_parts.append("=== RECOVERY STATUS & RECENT CHECK-IN ===\n")
        prompt_parts.append(recovery_context_str)
        prompt_parts.append("\n\n")
    
    # Add conversation history
    if history_block:
        prompt_parts.append("=== CONVERSATION HISTORY ===\n")
        prompt_parts.append(history_block)
        prompt_parts.append("\n")
    
    # Add RAG context
    prompt_parts.append("=== KNOWLEDGE BASE CONTEXT ===\n")
    prompt_parts.append(rag_context_block)
    prompt_parts.append("\n\n")
    
    # Add current query
    prompt_parts.append("=== USER QUERY ===\n")
    prompt_parts.append(safe_text)
    prompt_parts.append("\n\n")
    
    # Add instructions
    prompt_parts.append("=== INSTRUCTIONS ===\n")
    prompt_parts.append(empathetic_prefix)
    prompt_parts.append("- Use the USER PROFILE and RECOVERY STATUS to personalize your response.\n")
    prompt_parts.append("- Reference specific details from their check-in when relevant.\n")
    prompt_parts.append("- Do not invent information not provided in the context.\n")
    prompt_parts.append("- Do not provide diagnosis or medication advice.\n")
    prompt_parts.append("- End with: 'Wellness information only; not medical advice.'\n")
    
    final_prompt = "".join(prompt_parts)
    
    # ============================================================
    # GENERATE RESPONSE
    # ============================================================
    
    llm = get_llm()
    llm_response = llm.invoke(final_prompt)
    draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)
    
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
    memory.append(session_id, "user", safe_text)
    memory.append(session_id, "assistant", final_answer)
    
    # ============================================================
    # RETURN RESPONSE
    # ============================================================
    
    return {
        "session_id": session_id,
        "answer": final_answer,
        "intent": intent,
        "redaction": redaction_report,
        "scope": scope_notes,
        "used_rag": used_rag,
        "rag_best_score": round(float(best_score), 3),
        "user_context": user_context,  # NEW: Full context metadata
        "escalation_banner": banner,
        "memory_turns": memory.get_last_n(session_id, history_window),
    }


# =========================================================
# BACKWARDS COMPATIBILITY (for existing code)
# =========================================================

def chat_once_name_detector(
    user_text: str,
    session_id: Optional[str] = None,
    history_window: int = 4,
) -> Dict[str, Any]:
    """
    Detect if user's message contains their name.
    (This is your existing function - kept for compatibility)
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
    
    return {
        "answer": draft_answer
    }