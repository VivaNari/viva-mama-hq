from __future__ import annotations
from typing import Dict, Any, List, Optional
import asyncio
import ast

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.settings import settings
from app.llm.groq_client import get_llm
from app.memory.redis_memory import RedisSessionMemory
from app.guardrails.input_guard import redact, enforce_scope
from app.escalation.policy import scan_for_red_flags, format_escalation_banner
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

# =========================================================
# MCP CLIENT
# =========================================================

async def call_mcp(user_text: str) -> Dict[str, Any]:
    """
    Call MCP server via STDIO.
    The server (with LLM) decides which tool to use.
    """

    # 1️⃣ Define how to start your MCP server
    server_params = StdioServerParameters(
        command="python",
        args=["/Users/saurabh/Desktop/NN/chatbot/rag_chatbot/app/mcp/server.py"],  # path to your MCP server script
        env=None                 # inherit current environment
    )


    # 2️⃣ Connect to server using stdio_client
    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            # 3️⃣ Call your router tool on the MCP server
            result = await session.call_tool(
                name="router",  # this tool decides which product tool to call
                arguments={"text": user_text}
            )

            # 4️⃣ Convert the MCP TextContent result to Python dict
            if result.content:
                try:
                    return ast.literal_eval(result.content[0].text)
                except Exception:
                    return {}

            return {}


# =========================================================
# HELPERS
# =========================================================

def _format_product_section(products: List[Dict[str, Any]]) -> str:
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
    out = []
    for t in last_turns:
        role = str(t.get("role", "")).upper()[:12]
        content = str(t.get("content", ""))[:cap_chars]
        out.append(f"{role}: {content}")
    return "\n".join(out)


# =========================================================
# MAIN CHAT FUNCTION
# =========================================================

async def chat_once(
    user_text: str,
    session_id: Optional[str] = None,
    history_window: int = 4,
) -> Dict[str, Any]:

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
            "products": [],
            "escalation_banner": "",
            "memory_turns": memory.get_last_n(session_id, history_window),
        }

    # ---------------- Intent ----------------
    intent = route_intent(safe_text)

    empathetic_prefix = ""
    if intent != "PRODUCT_QUERY":
        empathetic_prefix = (
            "- Begin with a warm, validating emotional acknowledgment.\n"
            "- Respond with empathy and reassurance.\n"
            "- Provide clear, simple, and supportive steps.\n"
        )

    # =========================================================
    # MCP CALL (ONLY FOR PRODUCT INTENT)
    # =========================================================

    products: List[Dict[str, Any]] = []
    operation_result: Dict[str, Any] = {}

    if intent == "PRODUCT_QUERY":
        mcp_result = await call_mcp(safe_text)
        print("mcp_result===",mcp_result)
        if mcp_result.get("tool") == "search_products":
            products = mcp_result.get("products", [])

        elif "success" in mcp_result:
            operation_result = mcp_result

    # If delete/add → return immediately
    if operation_result:
        answer = operation_result.get("message", "Operation completed.")
        final_answer = answer + "\n\n— *Wellness information only; not medical advice.*"

        memory.append(session_id, "user", safe_text)
        memory.append(session_id, "assistant", final_answer)

        return {
            "session_id": session_id,
            "answer": final_answer,
            "intent": "PRODUCT_OPERATION",
            "products": [],
            "operation_result": operation_result,
            "memory_turns": memory.get_last_n(session_id, history_window),
        }

    # =========================================================
    # RAG
    # =========================================================

    docs, used_rag, best_score = query_with_fallback(safe_text)

    if used_rag and docs:
        context_block = "\n\n".join(
            f"[{i+1}] {d.page_content[:1200]}" for i, d in enumerate(docs)
        )
    else:
        context_block = "None"

    # =========================================================
    # PROMPT
    # =========================================================

    history_block = _format_history(prior_turns)
    product_block = _format_product_section(products)
    user_name = "Diya"

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Conversation history (recent):\n{history_block if history_block else 'None'}\n\n"
        f"USER QUESTION:\n{safe_text}\n\n"
        f"CONTEXT (RAG):\n{context_block}\n\n"
        f"PRODUCT_CANDIDATES:\n{product_block}\n\n"
        "TASK:\n"
        f"- Address the user by their name ({user_name}) at the start.\n"
        f"{empathetic_prefix}"
        "- If PRODUCT_CANDIDATES are relevant, mention up to 1–2 with usage tips.\n"
        "- Do not invent products.\n"
        "- Do not provide diagnosis or medication advice.\n"
        "- End with: 'Wellness information only; not medical advice.'"
    )

    llm = get_llm()
    llm_response = llm.invoke(prompt)
    draft_answer = llm_response.content if hasattr(llm_response, "content") else str(llm_response)

    # =========================================================
    # ESCALATION
    # =========================================================

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

    # =========================================================
    # MEMORY + RESPONSE
    # =========================================================

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
