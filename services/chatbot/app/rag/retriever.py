# app/rag/retriever.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# - Create a local vector search index (FAISS) over your curated documents.
# - On each question, retrieve the most similar chunks.
# - If the best match isn't strong enough, DON'T use docs (fallback to model KB).
#
# WHY THIS MATTERS:
# - Keeps answers grounded in your content when relevant.
# - Avoids forcing irrelevant context that can confuse the model.
# ---------------------------------------------------------------------

from __future__ import annotations
import os
from typing import List, Tuple, Optional

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.settings import settings

# We'll keep singletons so the notebook/process reuses the same objects.
_FAISS_INDEX: Optional[FAISS] = None
_EMB: Optional[HuggingFaceEmbeddings] = None


def _emb() -> HuggingFaceEmbeddings:
    """
    Create (or reuse) the embeddings model.
    - MiniLM is small & fast; great for local dev.
    - You can swap to a larger model by changing EMBEDDINGS_MODEL in .env.
    """
    global _EMB
    if _EMB is None:
        _EMB = HuggingFaceEmbeddings(model_name=settings.embeddings_model)
    return _EMB


def _split(docs: List[Document]) -> List[Document]:
    """
    Chunk documents into overlapping pieces:
    - chunk_size=800 chars: big enough for rich info
    - chunk_overlap=150: smooths boundaries so we don't cut key sentences
    """
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
    return splitter.split_documents(docs)


def build_or_load_index(docs: Optional[List[Document]] = None) -> FAISS:
    """
    Build the FAISS index from 'docs' (if provided) OR load an existing one from disk.

    Behavior:
    - If 'docs' provided: split -> embed -> build index -> persist to disk.
    - Else: try loading the saved index from disk.
    - If nothing exists yet: create a tiny placeholder index so queries won't crash.

    Storage:
    - Uses settings.local_vector_dir (e.g., ".local_vector_store/faiss_index")
    """
    global _FAISS_INDEX
    if _FAISS_INDEX is not None:
        return _FAISS_INDEX

    store_dir = settings.local_vector_dir
    os.makedirs(store_dir, exist_ok=True)
    index_path = os.path.join(store_dir, "faiss_index")

    if docs:
        chunks = _split(docs)
        _FAISS_INDEX = FAISS.from_documents(chunks, _emb())
        _FAISS_INDEX.save_local(index_path)
        return _FAISS_INDEX

    if os.path.exists(index_path):
        _FAISS_INDEX = FAISS.load_local(index_path, _emb(), allow_dangerous_deserialization=True)
        return _FAISS_INDEX

    # Last resort: empty index with a harmless placeholder entry so .similarity_search works.
    _FAISS_INDEX = FAISS.from_texts(["placeholder"], _emb(), metadatas=[{"placeholder": True}])
    return _FAISS_INDEX


def _distance_to_similarity(distance: float) -> float:
    """
    Convert a distance value (lower = closer) to a similarity score in [0..1] (higher = better).
    - FAISS + HuggingFaceEmbeddings typically use cosine distance variants.
    - Heuristic mapping: score = 1 - distance, clamped to [0, 1].
    - This isn't mathematically perfect, but works well as a simple threshold.
    """
    try:
        score = 1.0 - float(distance)
    except Exception:
        score = 0.0
    return max(0.0, min(1.0, score))


def query_with_fallback(question: str, k: Optional[int] = None) -> Tuple[List[Document], bool, float]:
    """
    INPUT:
      question: the user's query
      k       : how many docs to retrieve (defaults to settings.rag_top_k)

    OUTPUT:
      (docs, used_rag, best_score)
        - docs      : retrieved Documents (possibly empty if fallback triggers)
        - used_rag  : True if we will include these docs in the LLM prompt
        - best_score: similarity of the top hit (0..1), for debugging/telemetry

    LOGIC:
      1) Search top-k similar chunks.
      2) Convert distances to a rough "similarity" score in [0..1].
      3) If best_score >= threshold (from .env), we use the docs.
         Else, we return [] and used_rag=False so the model answers from its own knowledge.
    """
    if k is None:
        
        k = settings.rag_top_k

    vs = build_or_load_index()
    pairs = vs.similarity_search_with_score(question, k=k)

    if not pairs:
        return [], False, 0.0

    docs: List[Document] = []
    best_score = 0.0

    for doc, distance in pairs:
        sim = _distance_to_similarity(distance)
        if sim > best_score:
            best_score = sim
        docs.append(doc)

    # Decide: use docs or fall back
    used_rag = best_score >= settings.rag_score_threshold
    if not used_rag:
        # Weak match → don't force irrelevant context.
        docs = []

    return docs, used_rag, best_score
