"""
Production-Ready RAG Retriever for Viva Mama Chatbot

This module provides robust document retrieval with:
- Class-based architecture (eliminates global state issues)
- Comprehensive error handling and graceful degradation
- Full logging and observability
- Proper distance metric handling
- Incremental index updates
- Index versioning and metadata tracking
- Query preprocessing and validation
- Performance metrics collection

Usage:
    from app.rag.retriever import RAGRetriever
    
    # Initialize retriever
    retriever = RAGRetriever()
    
    # Build index from documents
    retriever.build_index(documents)
    
    # Query for relevant documents
    results = retriever.query(
        question="How do I improve milk supply?",
        k=3
    )
    
    # Check if results meet quality threshold
    if results.should_use_rag:
        context = results.documents
        # Use documents as context for LLM
    else:
        # No good results, use LLM's base knowledge
        pass

Author: Viva Mama Team
"""

from __future__ import annotations

import os
import json
import hashlib
import logging
import time
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.settings import settings

# Configure logging (Issue #5)
logger = logging.getLogger(__name__)

# Constants for configuration
DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 150
MAX_RESULTS_LIMIT = 50  # Issue #12: Prevent excessive memory usage
MIN_QUERY_LENGTH = 3    # Issue #14: Minimum query length
MAX_QUERY_LENGTH = 500  # Issue #14: Maximum query length


# ============================================
# DATA CLASSES FOR TYPE SAFETY
# ============================================

@dataclass
class RetrievalResult:
    """
    Structured result from a retrieval operation.
    
    This replaces the old tuple return value with a clear, typed structure
    that makes the API self-documenting and prevents mistakes.
    """
    documents: List[Document]
    should_use_rag: bool
    best_score: float
    query_time_ms: float
    num_candidates: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/serialization"""
        return {
            "num_documents": len(self.documents),
            "should_use_rag": self.should_use_rag,
            "best_score": round(self.best_score, 3),
            "query_time_ms": round(self.query_time_ms, 2),
            "num_candidates": self.num_candidates
        }


@dataclass
class IndexMetadata:
    """
    Metadata about the vector index for versioning and tracking.
    
    Issue #9: This enables index versioning and helps track which version
    of the knowledge base produced which answers.
    """
    version: str
    created_at: str
    num_documents: int
    num_chunks: int
    chunk_size: int
    chunk_overlap: int
    embedding_model: str
    content_hash: str  # Issue #10: For detecting duplicate content
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'IndexMetadata':
        """Create from dictionary"""
        return IndexMetadata(**data)


# ============================================
# METRICS COLLECTION (Issue #5)
# ============================================

class _RetrievalMetrics:
    """
    Tracks retrieval performance metrics for monitoring and debugging.
    
    In production, you need to know if retrieval quality is degrading
    over time, if latency is increasing, or if errors are spiking.
    """
    
    def __init__(self):
        self.queries_total = 0
        self.queries_with_results = 0
        self.queries_above_threshold = 0
        self.query_times_ms = []
        self.similarity_scores = []
        self.errors = 0
    
    def record_query(
        self,
        had_results: bool,
        above_threshold: bool,
        best_score: float,
        query_time_ms: float
    ):
        """Record a query for metrics"""
        self.queries_total += 1
        
        if had_results:
            self.queries_with_results += 1
        
        if above_threshold:
            self.queries_above_threshold += 1
        
        self.similarity_scores.append(best_score)
        self.query_times_ms.append(query_time_ms)
        
        # Keep only last 1000 samples to prevent unbounded memory growth
        if len(self.similarity_scores) > 1000:
            self.similarity_scores = self.similarity_scores[-1000:]
        if len(self.query_times_ms) > 1000:
            self.query_times_ms = self.query_times_ms[-1000:]
    
    def record_error(self):
        """Record an error"""
        self.errors += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics"""
        stats = {
            "queries_total": self.queries_total,
            "queries_with_results": self.queries_with_results,
            "queries_above_threshold": self.queries_above_threshold,
            "errors": self.errors
        }
        
        # Calculate percentiles for scores and latency
        if self.similarity_scores:
            sorted_scores = sorted(self.similarity_scores)
            stats["score_p50"] = sorted_scores[len(sorted_scores) // 2]
            stats["score_p95"] = sorted_scores[int(len(sorted_scores) * 0.95)]
            stats["score_mean"] = sum(self.similarity_scores) / len(self.similarity_scores)
        
        if self.query_times_ms:
            sorted_times = sorted(self.query_times_ms)
            stats["latency_p50_ms"] = sorted_times[len(sorted_times) // 2]
            stats["latency_p95_ms"] = sorted_times[int(len(sorted_times) * 0.95)]
            stats["latency_mean_ms"] = sum(self.query_times_ms) / len(self.query_times_ms)
        
        return stats


# ============================================
# MAIN RETRIEVER CLASS (Issue #1)
# ============================================

class RAGRetriever:
    """
    Production-ready RAG retriever with proper state management.
    
    Issue #1: This class-based design eliminates global mutable state.
    Each instance owns its index and embeddings model, making the code
    testable, thread-safe, and suitable for production use.
    
    The old code used module-level globals which could cause hidden bugs
    when multiple parts of code tried to use different indexes.
    """
    
    def __init__(
        self,
        embedding_model: Optional[str] = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        score_threshold: Optional[float] = None,
        distance_metric: str = "l2"  # Issue #11: Explicit metric — matches FAISS default (LangChain builds L2 index)
    ):
        """
        Initialize the retriever.
        
        Args:
            embedding_model: Name of HuggingFace model (default from settings)
            chunk_size: Size of text chunks for splitting
            chunk_overlap: Overlap between chunks
            score_threshold: Minimum similarity score for using RAG (default from settings)
            distance_metric: Distance metric for FAISS ("cosine", "l2", "ip")
        """
        # Configuration
        self.embedding_model_name = embedding_model or settings.embeddings_model
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.score_threshold = score_threshold or settings.rag_score_threshold
        self.distance_metric = distance_metric
        
        # State (Issue #1: Explicit, not global)
        self._embeddings: Optional[HuggingFaceEmbeddings] = None
        self._index: Optional[FAISS] = None
        self._metadata: Optional[IndexMetadata] = None
        self._index_path = Path(settings.local_vector_dir)
        
        # Metrics (Issue #5)
        self._metrics = _RetrievalMetrics()
        
        # Ensure directory exists
        self._index_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(
            f"Initialized RAGRetriever with embedding_model={self.embedding_model_name}, "
            f"chunk_size={self.chunk_size}, threshold={self.score_threshold}"
        )
    
    # -------------------------------
    # Embeddings Model Management
    # -------------------------------
    
    def _get_embeddings(self) -> HuggingFaceEmbeddings:
        """
        Lazy-load embeddings model.
        
        We only load the model when actually needed, saving memory
        and startup time if the index is loaded from disk.
        """
        if self._embeddings is None:
            logger.info(f"Loading embeddings model: {self.embedding_model_name}")
            start_time = time.time()
            
            try:
                self._embeddings = HuggingFaceEmbeddings(
                    model_name=self.embedding_model_name
                )
                
                elapsed = time.time() - start_time
                logger.info(f"Embeddings model loaded in {elapsed:.2f}s")
                
            except Exception as e:
                logger.error(f"Failed to load embeddings model: {str(e)}", exc_info=True)
                raise RuntimeError(
                    f"Cannot initialize embeddings model '{self.embedding_model_name}'. "
                    f"This is required for RAG to function. Error: {str(e)}"
                )
        
        return self._embeddings
    
    # -------------------------------
    # Document Processing (Issue #13)
    # -------------------------------
    
    def _split_documents(self, docs: List[Document]) -> List[Document]:
        """
        Split documents into chunks with context preservation.
        
        Issue #13: We use RecursiveCharacterTextSplitter which tries to
        split at natural boundaries (paragraphs, sentences) rather than
        arbitrary character positions. This preserves context better.
        
        Args:
            docs: List of documents to split
            
        Returns:
            List of document chunks
        """
        logger.info(f"Splitting {len(docs)} documents into chunks")
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            # Issue #13: These separators preserve context
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
            keep_separator=True
        )
        
        chunks = splitter.split_documents(docs)
        
        logger.info(
            f"Created {len(chunks)} chunks "
            f"(avg {sum(len(c.page_content) for c in chunks) // len(chunks)} chars per chunk)"
        )
        
        return chunks
    
    def _compute_content_hash(self, docs: List[Document]) -> str:
        """
        Compute hash of document contents for deduplication.
        
        Issue #10: This allows us to detect if documents have changed
        and whether we need to rebuild the index.
        """
        # Sort documents by source to ensure consistent ordering
        sorted_docs = sorted(docs, key=lambda d: d.metadata.get("source", ""))
        
        # Concatenate all content
        combined_content = "".join(d.page_content for d in sorted_docs)
        
        # Compute MD5 hash
        content_hash = hashlib.md5(combined_content.encode()).hexdigest()
        
        return content_hash
    
    # -------------------------------
    # Index Building (Issue #2, #8, #9, #10)
    # -------------------------------
    
    def build_index(
        self,
        docs: List[Document],
        save: bool = True,
        incremental: bool = False
    ) -> IndexMetadata:
        """
        Build FAISS index from documents.
        
        Issue #2: Validates that documents exist and aren't just placeholders
        Issue #8: Supports incremental updates to avoid rebuilding everything
        Issue #9: Creates metadata for versioning
        Issue #10: Detects duplicate content via hashing
        
        Args:
            docs: List of documents to index
            save: Whether to save index to disk
            incremental: If True, add to existing index instead of rebuilding
            
        Returns:
            IndexMetadata describing the created index
            
        Raises:
            ValueError: If no valid documents provided
        """
        start_time = time.time()
        
        # Issue #2: Validate input - fail loudly if no real content
        if not docs:
            raise ValueError(
                "Cannot build index: No documents provided. "
                "The RAG system requires medical knowledge documents to function. "
                "Please ensure documents are loaded from the data folder."
            )
        
        # Check for placeholder documents
        if len(docs) == 1 and docs[0].page_content == "placeholder":
            raise ValueError(
                "Cannot build index: Only placeholder document found. "
                "Real medical content is required for the RAG system to provide accurate answers."
            )
        
        logger.info("=" * 60)
        logger.info(f"Building FAISS index ({'incremental' if incremental else 'full rebuild'})")
        logger.info("=" * 60)
        
        # Issue #10: Compute content hash for deduplication
        content_hash = self._compute_content_hash(docs)
        logger.info(f"Content hash: {content_hash}")
        
        # Check if we already have this exact content indexed
        if self._metadata and self._metadata.content_hash == content_hash:
            logger.info("Content unchanged, using existing index")
            return self._metadata
        
        # Split documents into chunks (Issue #13: context-aware splitting)
        chunks = self._split_documents(docs)
        
        # Get embeddings model
        embeddings = self._get_embeddings()
        
        # Issue #8: Support incremental updates
        if incremental and self._index is not None:
            logger.info(f"Adding {len(chunks)} new chunks to existing index")
            
            try:
                # FAISS supports adding documents to existing index
                texts = [chunk.page_content for chunk in chunks]
                metadatas = [chunk.metadata for chunk in chunks]
                
                self._index.add_texts(texts=texts, metadatas=metadatas)
                
                logger.info("Successfully added chunks to existing index")
                
            except Exception as e:
                logger.error(f"Incremental update failed: {str(e)}", exc_info=True)
                logger.warning("Falling back to full rebuild")
                incremental = False
        
        # Build new index (full rebuild)
        if not incremental:
            logger.info(f"Building new index from {len(chunks)} chunks")
            
            try:
                # Issue #3: Wrap in try-catch for error handling
                self._index = FAISS.from_documents(
                    documents=chunks,
                    embedding=embeddings
                )
                
                logger.info("Index built successfully")
                
            except Exception as e:
                logger.error(f"Failed to build FAISS index: {str(e)}", exc_info=True)
                raise RuntimeError(
                    f"Cannot build vector index. This is critical for RAG functionality. "
                    f"Error: {str(e)}"
                )
        
        # Issue #9: Create metadata for versioning
        self._metadata = IndexMetadata(
            version=datetime.now().strftime("%Y%m%d_%H%M%S"),
            created_at=datetime.now().isoformat(),
            num_documents=len(docs),
            num_chunks=len(chunks) if not incremental else self._index.index.ntotal,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            embedding_model=self.embedding_model_name,
            content_hash=content_hash
        )
        
        elapsed = time.time() - start_time
        
        logger.info("=" * 60)
        logger.info(f"Index build completed in {elapsed:.2f}s")
        logger.info(f"Version: {self._metadata.version}")
        logger.info(f"Documents: {self._metadata.num_documents}")
        logger.info(f"Chunks: {self._metadata.num_chunks}")
        logger.info("=" * 60)
        
        # Save to disk if requested
        if save:
            self.save_index()
        
        return self._metadata
    
    def save_index(self) -> None:
        """
        Save index and metadata to disk.
        
        Issue #9: Saves both the FAISS index and metadata for versioning.
        """
        if self._index is None:
            logger.warning("No index to save")
            return
        
        logger.info(f"Saving index to {self._index_path}")
        
        try:
            # Save FAISS index
            index_file = self._index_path / "faiss_index"
            self._index.save_local(str(index_file))
            
            # Issue #9: Save metadata
            if self._metadata:
                metadata_file = self._index_path / "metadata.json"
                with open(metadata_file, 'w') as f:
                    json.dump(self._metadata.to_dict(), f, indent=2)
                
                logger.info(f"Saved index version {self._metadata.version}")
            
        except Exception as e:
            logger.error(f"Failed to save index: {str(e)}", exc_info=True)
            # Don't raise - saving is not critical for operation
    
    def load_index(self) -> bool:
        """
        Load index and metadata from disk.
        
        Issue #2: Validates that loaded index contains real content.
        Issue #9: Loads metadata for versioning information.
        
        Returns:
            True if index loaded successfully, False otherwise
        """
        index_file = self._index_path / "faiss_index"
        metadata_file = self._index_path / "metadata.json"
        
        if not index_file.exists():
            logger.info(f"No index found at {index_file}")
            return False
        
        logger.info(f"Loading index from {self._index_path}")
        
        try:
            # Issue #3: Wrap in try-catch for error handling
            embeddings = self._get_embeddings()
            
            self._index = FAISS.load_local(
                str(index_file),
                embeddings,
                allow_dangerous_deserialization=True
            )
            
            # Issue #9: Load metadata if available
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata_dict = json.load(f)
                    self._metadata = IndexMetadata.from_dict(metadata_dict)
                
                logger.info(f"Loaded index version {self._metadata.version}")
                logger.info(f"Created: {self._metadata.created_at}")
                logger.info(f"Chunks: {self._metadata.num_chunks}")
            else:
                logger.warning("No metadata file found, index version unknown")
            
            # Issue #2: Validate loaded index has real content
            if self._index.index.ntotal == 0:
                logger.error("Loaded index is empty (0 vectors)")
                self._index = None
                return False
            
            # Check if it's just a placeholder
            if self._index.index.ntotal == 1:
                # Try to retrieve the single document
                test_results = self._index.similarity_search("test", k=1)
                if test_results and test_results[0].page_content == "placeholder":
                    logger.error("Loaded index contains only placeholder content")
                    self._index = None
                    return False
            
            logger.info(f"Index loaded successfully ({self._index.index.ntotal} vectors)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load index: {str(e)}", exc_info=True)
            self._index = None
            return False
    
    # -------------------------------
    # Query Processing (Issue #3, #4, #5, #12, #14)
    # -------------------------------
    
    def _preprocess_query(self, query: str) -> str:
        """
        Clean and normalize query text.
        
        Issue #14: Preprocessing helps match queries against documents better.
        We normalize whitespace, remove excessive punctuation, etc.
        """
        # Strip whitespace
        query = query.strip()
        
        # Normalize whitespace (multiple spaces to single space)
        query = " ".join(query.split())
        
        # Remove excessive punctuation (e.g., "???" -> "?")
        import re
        query = re.sub(r'([!?.])\1+', r'\1', query)
        
        return query
    
    def _validate_query(self, query: str) -> None:
        """
        Validate query input.
        
        Issue #14: Ensures query is reasonable before processing.
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")
        
        if len(query) < MIN_QUERY_LENGTH:
            raise ValueError(
                f"Query too short (minimum {MIN_QUERY_LENGTH} characters)"
            )
        
        if len(query) > MAX_QUERY_LENGTH:
            raise ValueError(
                f"Query too long (maximum {MAX_QUERY_LENGTH} characters)"
            )
    
    def _normalize_score(self, distance: float) -> float:
        """
        Convert FAISS distance to normalized similarity score [0, 1].
        
        Issue #4: Proper handling based on distance metric.
        
        FAISS distance metrics:
        - L2 (Euclidean): distance = sqrt(sum((a-b)^2)), range [0, inf)
        - Cosine: distance = 1 - cosine_similarity, range [0, 2]
        - Inner Product (IP): distance = -dot(a, b), range [-inf, inf]
        
        We convert to similarity score where 1.0 = perfect match, 0.0 = no match.
        """
        if self.distance_metric == "cosine":
            # Cosine distance is 1 - cosine_similarity
            # So similarity = 1 - distance
            # Range: [0, 2] -> [1, -1], but typically [0, 1] -> [1, 0]
            similarity = 1.0 - distance
            # Clamp to [0, 1] for safety
            return max(0.0, min(1.0, similarity))
        
        elif self.distance_metric == "l2":
            # L2 distance - smaller is better, but unbounded
            # Use inverse with decay: similarity = 1 / (1 + distance)
            return 1.0 / (1.0 + distance)
        
        elif self.distance_metric == "ip":
            # Inner product - higher is better, but unbounded
            # For normalized vectors, IP is similar to cosine
            # Assuming normalized: similarity = (1 + ip) / 2
            return max(0.0, min(1.0, (1.0 + abs(distance)) / 2.0))
        
        else:
            # Unknown metric - use simple fallback
            logger.warning(f"Unknown distance metric '{self.distance_metric}', using fallback")
            return max(0.0, min(1.0, 1.0 - distance))
    
    def query(
        self,
        question: str,
        k: Optional[int] = None,
        threshold: Optional[float] = None
    ) -> RetrievalResult:
        """
        Query the index for relevant documents.
        
        This is the main entry point for retrieval with comprehensive
        error handling, validation, logging, and metrics.
        
        Args:
            question: User's question
            k: Number of documents to retrieve (default from settings)
            threshold: Similarity threshold (default from settings)
            
        Returns:
            RetrievalResult with documents and metadata
        """
        start_time = time.time()
        
        # Issue #14: Preprocess and validate query
        try:
            question = self._preprocess_query(question)
            self._validate_query(question)
        except ValueError as e:
            logger.warning(f"Invalid query: {str(e)}")
            # Return empty result for invalid query
            return RetrievalResult(
                documents=[],
                should_use_rag=False,
                best_score=0.0,
                query_time_ms=0.0,
                num_candidates=0
            )
        
        # Set defaults
        if k is None:
            k = settings.rag_top_k
        
        # Issue #12: Enforce maximum limit
        k = min(k, MAX_RESULTS_LIMIT)
        
        if threshold is None:
            threshold = self.score_threshold
        
        logger.debug(f"Query: '{question[:100]}...' (k={k}, threshold={threshold})")
        
        # Check if index exists
        if self._index is None:
            logger.warning("No index available, returning empty result")
            self._metrics.record_error()
            return RetrievalResult(
                documents=[],
                should_use_rag=False,
                best_score=0.0,
                query_time_ms=(time.time() - start_time) * 1000,
                num_candidates=0
            )
        
        try:
            # Issue #3: Comprehensive error handling
            # Perform similarity search
            pairs = self._index.similarity_search_with_score(question, k=k)
            
            if not pairs:
                logger.debug("No results found for query")
                elapsed_ms = (time.time() - start_time) * 1000
                
                # Issue #5: Record metrics
                self._metrics.record_query(
                    had_results=False,
                    above_threshold=False,
                    best_score=0.0,
                    query_time_ms=elapsed_ms
                )
                
                return RetrievalResult(
                    documents=[],
                    should_use_rag=False,
                    best_score=0.0,
                    query_time_ms=elapsed_ms,
                    num_candidates=0
                )
            
            # Process results: convert distances to similarities
            docs_with_scores = []
            for doc, distance in pairs:
                # Issue #4: Proper score normalization
                similarity = self._normalize_score(distance)
                docs_with_scores.append((doc, similarity))
                logger.debug(
                    f"  - {doc.metadata.get('source_file', 'unknown')}: "
                    f"similarity={similarity:.3f} (distance={distance:.3f})"
                )
            
            # Sort by similarity (highest first)
            docs_with_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Get best score
            best_score = docs_with_scores[0][1] if docs_with_scores else 0.0
            
            # Decide if scores meet threshold
            should_use_rag = best_score >= threshold
            
            # Extract documents
            if should_use_rag:
                documents = [doc for doc, _ in docs_with_scores]
                logger.info(
                    f"Query succeeded: {len(documents)} docs, best_score={best_score:.3f}, "
                    f"threshold={threshold:.3f} ✓"
                )
            else:
                documents = []
                logger.info(
                    f"Query below threshold: best_score={best_score:.3f}, "
                    f"threshold={threshold:.3f} ✗"
                )
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            # Issue #5: Record metrics
            self._metrics.record_query(
                had_results=len(docs_with_scores) > 0,
                above_threshold=should_use_rag,
                best_score=best_score,
                query_time_ms=elapsed_ms
            )
            
            result = RetrievalResult(
                documents=documents,
                should_use_rag=should_use_rag,
                best_score=best_score,
                query_time_ms=elapsed_ms,
                num_candidates=len(docs_with_scores)
            )
            
            logger.debug(f"Query completed in {elapsed_ms:.2f}ms")
            
            return result
            
        except Exception as e:
            # Issue #3: Handle errors gracefully
            logger.error(f"Error during retrieval: {str(e)}", exc_info=True)
            self._metrics.record_error()
            
            # Return empty result rather than crashing
            return RetrievalResult(
                documents=[],
                should_use_rag=False,
                best_score=0.0,
                query_time_ms=(time.time() - start_time) * 1000,
                num_candidates=0
            )
    
    # -------------------------------
    # Utility Methods
    # -------------------------------
    
    def get_metadata(self) -> Optional[IndexMetadata]:
        """Get current index metadata"""
        return self._metadata
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get retrieval metrics (Issue #5)"""
        return self._metrics.get_stats()
    
    def is_ready(self) -> bool:
        """Check if retriever is ready to handle queries"""
        return self._index is not None and self._index.index.ntotal > 0


# ============================================
# BACKWARDS COMPATIBILITY
# ============================================

# Global instance for backwards compatibility with old code
_global_retriever: Optional[RAGRetriever] = None


def build_or_load_index(docs: Optional[List[Document]] = None) -> FAISS:
    """
    Legacy function for backwards compatibility.
    
    This maintains the old API but uses the new implementation internally.
    New code should use RAGRetriever class directly.
    """
    global _global_retriever
    
    if _global_retriever is None:
        _global_retriever = RAGRetriever()
    
    if docs:
        _global_retriever.build_index(docs, save=True)
    else:
        loaded = _global_retriever.load_index()
        if not loaded:
            logger.warning("Creating placeholder index for backwards compatibility")
            # Old behavior was to create placeholder - we'll do the same but warn
            placeholder_doc = Document(
                page_content="placeholder",
                metadata={"placeholder": True}
            )
            _global_retriever.build_index([placeholder_doc], save=False)
    
    return _global_retriever._index


def query_with_fallback(
    question: str,
    k: Optional[int] = None
) -> Tuple[List[Document], bool, float]:
    """
    Legacy function for backwards compatibility.
    
    Returns: (docs, used_rag, best_score) tuple as before
    """
    global _global_retriever
    
    if _global_retriever is None:
        _global_retriever = RAGRetriever()
        _global_retriever.load_index()
    
    result = _global_retriever.query(question, k=k)
    
    return (result.documents, result.should_use_rag, result.best_score)