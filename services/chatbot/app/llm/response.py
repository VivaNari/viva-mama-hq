"""Read the answer text out of an LLM reply, whatever shape the provider returns.

Gemini 2.5 Flash returns `message.content` as a plain string. Gemini 3.x returns a
list of parts, e.g.

    [{"type": "text", "text": "...", "thought_signature": "AY89..."}]

where `thought_signature` is an opaque token Google uses to resume its reasoning.
It is not text and must never reach the user. Code that treated `content` as a
string broke on the list: `.strip()` raised, so the grounding gate failed closed
and every main answer became the apology message.

Every place that reads an LLM reply as text goes through `response_text`.
"""

from __future__ import annotations

from typing import Any


def response_text(response: Any) -> str:
    """The reply's visible text: text parts joined, thought/signature data dropped.

    Accepts a LangChain message (or anything with `.content`), a bare content
    value, or None. Never raises.
    """
    content = getattr(response, "content", response)
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for part in content:
            if isinstance(part, str):
                texts.append(part)
            # Parts without a type are text (older shapes); "thinking"/"reasoning"
            # parts carry the model's thoughts, which are not part of the answer.
            elif isinstance(part, dict) and part.get("type", "text") == "text":
                text = part.get("text")
                if isinstance(text, str):
                    texts.append(text)
        return "".join(texts)
    return str(content)
