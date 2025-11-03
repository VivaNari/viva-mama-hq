# app/chains/chat_pipeline.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# One function, `chat_once(...)`, runs a single turn of your chatbot.
# It does ALL the steps:
#   1) Ensure we have a session_id (or make one)
#   2) Load recent memory (last few messages)
#   3) Guardrails on user input (redact PII, keep wellness-only scope)
#   4) Decide intent (product vs wellness)
#   5) If product: fetch catalog suggestions (tool)
#   6) RAG: try to fetch relevant document chunks; if weak match, skip context
#   7) Build a careful prompt and call Groq LLM
#   8) Scan for red-flags; add escalation banner if needed
#   9) Append a “wellness only” disclaimer
#  10) Save both user input and assistant reply to short-term memory
#  11) Return a structured result (easy for a UI/notebook to display)
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import Dict, Any, List, Optional

# Settings (env-driven) for models, thresholds, etc.
from app.settings import settings

# The Groq chat model (via LangChain)
from app.llm.groq_client import get_llm

# Short-term conversation memory stored in Redis (auto-expires)
from app.memory.redis_memory import RedisSessionMemory

# Input safety: remove emails/phones/simple name hints; steer away from diagnosis/prescriptions
from app.guardrails.input_guard import redact, enforce_scope

# Post-output safety: detect dangerous symptoms and add doctor/ER banner
from app.escalation.policy import scan_for_red_flags, format_escalation_banner

# Product suggestion tool (local now, MCP later)
from app.products.tool import search_products_tool

# Intent router: "PRODUCT_QUERY" vs "WELLNESS_INFO"
from app.chains.router import route_intent

# RAG retriever with fallback (uses FAISS and a similarity threshold)
from app.rag.retriever import query_with_fallback


# A compact, strict system instruction to keep the bot compliant and empathetic.
SYSTEM_PROMPT = (
    "You are a compassionate postpartum **wellness** assistant for educational purposes only.\n"
    "- You do NOT diagnose, prescribe, or provide medication dosages.\n"
    "- Prefer using provided CONTEXT for facts; if CONTEXT is empty, answer from general postpartum wellness knowledge.\n"
    "- For product questions, use PRODUCT_CANDIDATES if present; never invent products or claims.\n"
    "- Keep responses concise, empathetic, practical, and culturally aware for users in India.\n"
    "- If unsure or outside wellness scope, say so and suggest consulting a clinician.\n"
    "- Always end with: 'Wellness information only; not medical advice.'"
)


def _format_product_section(products: List[Dict[str, Any]]) -> str:
    """
    Turn product dicts into a short bulleted section for the prompt.
    This keeps LLM grounded (no hallucinated SKUs).
    Example bullet:
      - **GentleFlow Electric Breast Pump** — Closed system... (Use: Start on low suction...) [Link](https://...)
    """
    if not products:
        return "None"
    lines = []
    for p in products:
        name = p.get("name", "Unnamed")
        benefits = p.get("benefits", "")
        usage = p.get("usage_note", "N/A")
        url = p.get("url")
        bullet = f"- **{name}** — {benefits} (Use: {usage})"
        if url:
            bullet += f" [Link]({url})"
        lines.append(bullet)
    return "\n".join(lines)


def _format_history(last_turns: List[Dict[str, Any]], cap_chars: int = 800) -> str:
    """
    Convert recent turns into a compact text block for the prompt.
    We cap each content chunk to avoid huge prompts and costs.
    Example:
      USER: I returned to work last week.
      ASSISTANT: Congrats... here are tips...
    """
    out = []
    for t in last_turns:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))[:cap_chars]
        out.append(f"{role}: {content}")
    return "\n".join(out)


def chat_once(
    user_text: str,
    session_id: Optional[str] = None,
    # You can tune how many prior turns to include (kept short by design).
    history_window: int = 4,
) -> Dict[str, Any]:
    """
    Run one conversational turn and return a structured payload the UI (or notebook) can use.

    INPUTS:
      user_text    : raw user message (may include emails/phones — we'll redact)
      session_id   : if None, we auto-generate a UUID; else we use the provided one
      history_window: how many previous turns to include for context (small == cheaper & safer)

    RETURNS (example keys):
      {
        "session_id": "...",              # echo back (or the new UUID we generated)
        "answer": "...",                  # final assistant message (banner + content + disclaimer)
        "intent": "PRODUCT_QUERY",        # or "WELLNESS_INFO"
        "redaction": {"email": 1, ...},   # what PII we scrubbed
        "scope": {"blocked": False, ...}, # if we rewrote intent to wellness-only
        "used_rag": True,                 # whether doc context was applied
        "rag_best_score": 0.78,
        "products": [ ... ],              # recommended catalog items (dicts)
        "escalation_banner": "⚠️ ...",    # empty string if none
        "memory_turns": [ ... ],          # last N turns now stored
      }
    """
    # 1) Ensure session ID and get a handle to memory
    memory = RedisSessionMemory(window_size=6)  # rolling window capped at 6 stored turns
    session_id = memory.ensure_session_id(session_id)

    # 2) Load recent history (for a natural, continuous conversation tone)
    prior_turns = memory.get_last_n(session_id, history_window)

    # 3) Guardrails on INPUT (privacy + wellness scope)
    #    - Redact emails/phones/name-hints → “clean” text
    #    - Enforce scope: if user asks for diagnosis/prescription, we gently reframe intent
    redacted_text, redaction_report = redact(user_text)
    safe_text, scope_notes = enforce_scope(redacted_text)

    # 4) Decide intent (simple keyword router for MVP)
    intent = route_intent(safe_text)  # "PRODUCT_QUERY" or "WELLNESS_INFO"

    # 5) If product path → fetch product candidates via the tool (local now, MCP later)
    products: List[Dict[str, Any]] = []
    if intent == "PRODUCT_QUERY":
        products = search_products_tool(safe_text, limit=3)

    # 6) RAG: try to retrieve context from your local docs; else fallback to model's own knowledge
    #    - docs: list of chunks (may be empty if below threshold)
    #    - used_rag: True only if best match is strong enough
    #    - best_score: similarity score to log/display
    docs, used_rag, best_score = query_with_fallback(safe_text)

    # Prepare a compact CONTEXT block for the prompt (only if we decided to use RAG)
    if used_rag and docs:
        # Join a few chunks with lightweight labels; keep each chunk reasonably small
        context_block = "\n\n".join(
            f"[{i+1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
        )
    else:
        context_block = "None"

    # 7) Build the final prompt for the LLM
    #    We include:
    #      - System prompt (compliance & style)
    #      - Recent history (short)
    #      - The (safe) user text
    #      - RAG context (or "None")
    #      - Product candidates (or "None")
    history_block = _format_history(prior_turns)
    product_block = _format_product_section(products)

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Conversation history (recent):\n{history_block if history_block else 'None'}\n\n"
        f"USER QUESTION:\n{safe_text}\n\n"
        f"CONTEXT (RAG):\n{context_block}\n\n"
        f"PRODUCT_CANDIDATES:\n{product_block}\n\n"
        "TASK:\n"
        "- Answer empathetically with clear, simple steps.\n"
        "- If PRODUCT_CANDIDATES are relevant, mention up to 1–2 with usage tips; never invent products.\n"
        "- If CONTEXT is None, answer from general postpartum wellness knowledge.\n"
        "- Do not provide diagnosis, prescriptions, or dosages.\n"
        "- End with: 'Wellness information only; not medical advice.'"
    )

    # 8) Call Groq LLM (low temperature for stable, safe outputs)
    llm = get_llm()
    llm_response = llm.invoke(prompt)
    draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)

    # 9) Escalation check (scan both the user's text and the drafted reply)
    #    - If dangerous phrases appear (e.g., "soaking a pad an hour"), add a banner.
    in_level, in_matches = scan_for_red_flags(safe_text)
    out_level, out_matches = scan_for_red_flags(draft_answer)

    # Pick the higher severity of the two scans
    severity = "HIGH" if ("HIGH" in (in_level, out_level)) else ("MEDIUM" if ("MEDIUM" in (in_level, out_level)) else "NONE")
    phrases = list({*in_matches, *out_matches})  # unique union
    banner = format_escalation_banner(severity, phrases)

    # 10) Always append the wellness disclaimer at the end (extra safety)
    disclaimer = "\n\n— *Wellness information only; not medical advice.*"
    final_answer = (banner + "\n\n" if banner else "") + draft_answer + disclaimer

    # 11) Persist to memory (NOTE: we store only the redacted/safe text)
    memory.append(session_id, "user", safe_text)
    memory.append(session_id, "assistant", final_answer)

    # Return a structured payload your notebook or UI can render directly
    return {
        "session_id": session_id,
        "answer": final_answer,
        "intent": intent,
        "redaction": redaction_report,
        "scope": scope_notes,
        "used_rag": used_rag,
        "rag_best_score": round(float(best_score), 3),
        "products": products,
        "escalation_banner": banner,
        "memory_turns": memory.get_last_n(session_id, history_window),
    }
