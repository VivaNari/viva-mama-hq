"""
Unit tests: KB retrieval without LLM (article-style search via RAGRetriever.query).

There is no /kb HTTP route; this validates the retrieval layer used for recommendations context.

Requires: langchain-community (FAISS), langchain-core, faiss-cpu, app.settings.
"""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock

_SKIP_MSG = "Install project dependencies (e.g. pip install -r requirements.txt)."

try:
    from app.rag.retriever import RAGRetriever, RetrievalResult

    _RETRIEVER_OK = True
except ImportError:
    _RETRIEVER_OK = False
    RAGRetriever = None  # type: ignore[assignment,misc]
    RetrievalResult = None  # type: ignore[assignment,misc]


class _StubDoc:
    """Minimal doc shape returned by mocked FAISS (matches retriever usage)."""

    __slots__ = ("page_content", "metadata")

    def __init__(self, page_content: str, metadata: dict) -> None:
        self.page_content = page_content
        self.metadata = metadata


@unittest.skipUnless(_RETRIEVER_OK, _SKIP_MSG)
class TestRAGRetrieverQueryWithoutLLM(unittest.TestCase):
    """RAGRetriever.query returns documents and scores; no generative model is invoked."""

    def test_query_empty_when_no_index(self) -> None:
        r = RAGRetriever()
        r._index = None
        result = r.query("postpartum recovery tips for new mothers")
        self.assertIsInstance(result, RetrievalResult)
        self.assertFalse(result.should_use_rag)
        self.assertEqual(len(result.documents), 0)

    def test_query_empty_when_query_too_short(self) -> None:
        r = RAGRetriever()
        mock_idx = MagicMock()
        r._index = mock_idx
        result = r.query("ab")
        self.assertFalse(result.should_use_rag)
        mock_idx.similarity_search_with_score.assert_not_called()

    def test_query_above_threshold_returns_documents(self) -> None:
        doc = _StubDoc(
            "Postpartum nutrition basics.",
            {"source_file": "nutrition.txt"},
        )
        mock_idx = MagicMock()
        # Cosine distance 0.2 -> similarity 0.8 (above default threshold ~0.55)
        mock_idx.similarity_search_with_score.return_value = [(doc, 0.2)]

        r = RAGRetriever(score_threshold=0.55, distance_metric="cosine")
        r._index = mock_idx

        result = r.query("healthy eating after delivery")

        self.assertTrue(result.should_use_rag)
        self.assertEqual(len(result.documents), 1)
        self.assertGreaterEqual(result.best_score, 0.55)

    def test_query_below_threshold_returns_no_documents(self) -> None:
        doc = _StubDoc(
            "Unrelated content.",
            {"source_file": "other.txt"},
        )
        mock_idx = MagicMock()
        mock_idx.similarity_search_with_score.return_value = [(doc, 0.7)]

        r = RAGRetriever(score_threshold=0.55, distance_metric="cosine")
        r._index = mock_idx

        result = r.query("postpartum sleep support ideas")

        self.assertFalse(result.should_use_rag)
        self.assertEqual(len(result.documents), 0)
        self.assertLess(result.best_score, 0.55)
