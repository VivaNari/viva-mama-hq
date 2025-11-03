
from __future__ import annotations
from typing import Dict, Any, List, Optional

from app.settings import settings
from app.llm.groq_client import get_llm
from app.memory.redis_memory import RedisSessionMemory
from app.guardrails.input_guard import redact, enforce_scope
from app.escalation.policy import scan_for_red_flags, format_escalation_banner
from app.products.tool import search_products_tool
from app.chains.router import route_intent
from app.rag.retriever import query_with_fallback

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
    memory = RedisSessionMemory(window_size=6)  
    session_id = memory.ensure_session_id(session_id)

    prior_turns = memory.get_last_n(session_id, history_window)

    redacted_text, redaction_report = redact(user_text)
    safe_text, scope_notes = enforce_scope(redacted_text)

    intent = route_intent(safe_text)

    products: List[Dict[str, Any]] = []
    if intent == "PRODUCT_QUERY":
        products = search_products_tool(safe_text, limit=3)

    docs, used_rag, best_score = query_with_fallback(safe_text)

    if used_rag and docs:
        context_block = "\n\n".join(
            f"[{i+1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
        )
    else:
        context_block = "None"

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

    llm = get_llm()
    llm_response = llm.invoke(prompt)
    draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)

    in_level, in_matches = scan_for_red_flags(safe_text)
    out_level, out_matches = scan_for_red_flags(draft_answer)

    severity = "HIGH" if ("HIGH" in (in_level, out_level)) else ("MEDIUM" if ("MEDIUM" in (in_level, out_level)) else "NONE")
    phrases = list({*in_matches, *out_matches})  # unique union
    banner = format_escalation_banner(severity, phrases)

    disclaimer = "\n\n— *Wellness information only; not medical advice.*"
    final_answer = (banner + "\n\n" if banner else "") + draft_answer + disclaimer

    memory.append(session_id, "user", safe_text)
    memory.append(session_id, "assistant", final_answer)

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
