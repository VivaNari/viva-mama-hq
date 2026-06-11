"""
Unit tests: knowledge-base curation & inventory (offline ingestion path).

Maps to PRD: content inventory, deduplication, metadata for traceability.
Ingestion is driven by app.rag.loaders + ingest_data-style flow (no HTTP API).

Requires: chardet, langchain loaders stack (see project requirements.txt).
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

_SKIP_MSG = "Install project dependencies (e.g. pip install -r requirements.txt)."

try:
    from app.rag.loaders import (
        get_last_load_stats,
        load_documents,
        remove_duplicates,
        validate_folder_path,
    )

    _LOADERS_OK = True
except ImportError:
    _LOADERS_OK = False

    def _missing(*_a: object, **_k: object) -> None:  # pragma: no cover
        raise RuntimeError("app.rag.loaders not importable in this environment")

    get_last_load_stats = _missing  # type: ignore[assignment]
    load_documents = _missing  # type: ignore[assignment]
    remove_duplicates = _missing  # type: ignore[assignment]
    validate_folder_path = _missing  # type: ignore[assignment]


@unittest.skipUnless(_LOADERS_OK, _SKIP_MSG)
class TestValidateFolderPath(unittest.TestCase):
    """Quality gate: reject invalid paths before load."""

    def test_raises_when_folder_missing(self) -> None:
        with self.assertRaises(FileNotFoundError):
            validate_folder_path("/nonexistent/path/that/does/not/exist")

    def test_raises_when_not_directory(self) -> None:
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            with self.assertRaises(ValueError):
                validate_folder_path(path)
        finally:
            Path(path).unlink(missing_ok=True)


@unittest.skipUnless(_LOADERS_OK, _SKIP_MSG)
class TestLoadDocumentsInventoryMetadata(unittest.TestCase):
    """Curated files produce inventory-like metadata (hash, source, size)."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def test_loads_txt_and_sets_content_hash_and_source_path(self) -> None:
        root = Path(self._tmp.name)
        (root / "article_a.txt").write_text(
            "Postpartum hydration tips for new mothers.\n", encoding="utf-8"
        )

        docs = load_documents(
            str(root),
            file_types=[".txt"],
            recursive=False,
            parallel=False,
            remove_duplicates_flag=False,
        )

        self.assertEqual(len(docs), 1)
        meta = docs[0].metadata
        self.assertIn("content_hash", meta)
        self.assertEqual(len(meta["content_hash"]), 32)
        self.assertEqual(meta["source_file"], "article_a.txt")
        self.assertIn("source_path", meta)
        self.assertGreater(meta.get("file_size_bytes", 0), 0)

    def test_remove_duplicates_drops_duplicate_content(self) -> None:
        root = Path(self._tmp.name)
        body = "Same text for inventory dedup test.\n"
        (root / "one.txt").write_text(body, encoding="utf-8")
        (root / "two.txt").write_text(body, encoding="utf-8")

        docs = load_documents(
            str(root),
            file_types=[".txt"],
            recursive=False,
            parallel=False,
            remove_duplicates_flag=True,
        )

        self.assertEqual(len(docs), 1)

    def test_load_stats_populated_after_load(self) -> None:
        root = Path(self._tmp.name)
        (root / "x.txt").write_text("Hello world\n", encoding="utf-8")

        load_documents(
            str(root),
            file_types=[".txt"],
            recursive=False,
            parallel=False,
        )
        stats = get_last_load_stats()
        self.assertGreaterEqual(stats["total_files_found"], 1)
        self.assertGreaterEqual(stats["total_files_loaded"], 1)


class _StubDoc:
    """Minimal doc shape for remove_duplicates (avoids langchain imports in tests)."""

    __slots__ = ("page_content", "metadata")

    def __init__(self, page_content: str, metadata: dict) -> None:
        self.page_content = page_content
        self.metadata = metadata


@unittest.skipUnless(_LOADERS_OK, _SKIP_MSG)
class TestRemoveDuplicatesHelper(unittest.TestCase):
    """Explicit unit tests for duplicate removal by content_hash."""

    def test_keeps_one_when_same_hash(self) -> None:
        d1 = _StubDoc(
            "identical",
            {"content_hash": "abc", "source_file": "a.txt"},
        )
        d2 = _StubDoc(
            "identical",
            {"content_hash": "abc", "source_file": "b.txt"},
        )
        out = remove_duplicates([d1, d2])
        self.assertEqual(len(out), 1)
