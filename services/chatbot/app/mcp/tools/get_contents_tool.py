"""
Content search tool — MongoDB $text search over the curated `contents` collection.

Used as a FALLBACK knowledge source: the chat pipeline calls this only when the
RAG vector index retrieves weakly, to see whether a curated article answers the
question. Matches are flattened to plain English text and injected into the prompt
as a secondary context source (ranked after RAG).

Matching is keyword-based ($text) over the English + Hindi title/body fields, with
`default_language: "none"` so tokens match across scripts without stemming
conflicts. The pipeline feeds the English-translated query for best results.
"""

import logging
from typing import Any, Dict, List

from app.mcp.db_connection import get_contents_collection

logger = logging.getLogger(__name__)

# One text index spanning English + Hindi title/body. `none` disables
# language-specific stemming (there's no single language for a bilingual corpus)
# and lets tokens match across English/Devanagari cleanly.
_TEXT_INDEX_SPEC = [
    ("featuredTitle", "text"),
    ("contentBody.body", "text"),
    ("translations.hi.featuredTitle", "text"),
    ("translations.hi.contentBody.body", "text"),
]
_index_ensured = False


def _ensure_text_index() -> None:
    """Create the text index once per process (idempotent, best-effort).

    MongoDB allows only ONE text index per collection, so if a differently-shaped
    text index already exists this will conflict — in that case we log and rely on
    whatever index is present rather than crashing the search.
    """
    global _index_ensured
    if _index_ensured:
        return
    try:
        get_contents_collection().create_index(
            _TEXT_INDEX_SPEC, name="contents_text", default_language="none"
        )
        _index_ensured = True
    except Exception as e:  # noqa: BLE001 - non-fatal; search may still work
        logger.warning("Could not ensure contents text index (%s): %s", type(e).__name__, e)
        _index_ensured = True  # don't retry every call


def _flatten_content_body(blocks: List[Dict[str, Any]]) -> str:
    """Join contentBody blocks into one plain-text string.

    Headings are kept as section markers so the model sees the article's structure.
    """
    if not blocks:
        return ""
    parts: List[str] = []
    for block in blocks:
        text = (block.get("body") or "").strip()
        if not text:
            continue
        if (block.get("contentType") or "").upper() == "HEADING":
            parts.append(f"\n## {text}")
        else:
            parts.append(text)
    return "\n".join(parts).strip()


def get_relevant_contents(
    query: str,
    limit: int = 3,
    min_score: float = 0.5,
) -> Dict[str, Any]:
    """Return curated `contents` articles matching `query`, ranked by relevance.

    Args:
        query: search text (the pipeline passes the English-translated query).
        limit: max number of articles to return.
        min_score: minimum MongoDB textScore to keep a match (drops weak hits).

    Returns:
        {"found": bool, "contents": [{"title", "body", "score"}], "count": int}
    """
    query = (query or "").strip()
    if not query:
        return {"found": False, "contents": [], "count": 0}

    try:
        _ensure_text_index()
        col = get_contents_collection()
        cursor = (
            col.find(
                {"$text": {"$search": query}},
                {
                    "_id": 0,
                    "featuredTitle": 1,
                    "contentBody": 1,
                    "score": {"$meta": "textScore"},
                },
            )
            .sort([("score", {"$meta": "textScore"})])
            .limit(max(1, limit))
        )

        results: List[Dict[str, Any]] = []
        for doc in cursor:
            score = float(doc.get("score", 0.0))
            if score < min_score:
                continue
            body = _flatten_content_body(doc.get("contentBody", []))
            if not body:
                continue
            results.append(
                {
                    "title": doc.get("featuredTitle", "Untitled"),
                    "body": body,
                    "score": round(score, 3),
                }
            )

        return {"found": len(results) > 0, "contents": results, "count": len(results)}

    except Exception as e:
        logger.error("Error searching contents: %s", str(e))
        return {"found": False, "contents": [], "count": 0, "error": str(e)}


def format_contents_for_prompt(contents_data: Dict[str, Any], max_chars: int = 2400) -> str:
    """Format matched contents into a single prompt block, capped to max_chars."""
    if not contents_data.get("found"):
        return ""

    lines: List[str] = []
    used = 0
    for item in contents_data.get("contents", []):
        title = item.get("title", "Untitled")
        body = item.get("body", "")
        block = f"### {title}\n{body}"
        if used + len(block) > max_chars:
            block = block[: max(0, max_chars - used)]
        lines.append(block)
        used += len(block)
        if used >= max_chars:
            break

    return "\n\n".join(lines).strip()
