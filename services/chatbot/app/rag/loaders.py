# app/rag/loaders.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Load your local text files (e.g., postpartum guidance you curated)
# and convert them into LangChain "Document" objects so we can build
# a vector index for RAG.
#
# HOW TO USE (in a notebook):
#   from app.rag.loaders import load_text_folder
#   docs = load_text_folder("../data/raw")
#   len(docs), docs[0].page_content[:200]
#
# NEXT STEP:
#   We'll feed these 'docs' into the retriever/index builder.
# ---------------------------------------------------------------------

from __future__ import annotations
import os
from typing import List

from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document


def load_text_folder(folder: str) -> List[Document]:
    """
    INPUT:
      folder: a local directory path that contains .txt files
              (e.g., "../data/raw")
    OUTPUT:
      A list of LangChain Document objects.

    BEHAVIOR:
      - Scans only *.txt files to keep things simple and deterministic.
      - Uses UTF-8 reading so it's robust for most docs.
      - Adds minimal metadata (file name & path) to each Document.
    """
    docs: List[Document] = []

    if not os.path.isdir(folder):
        # Graceful: if folder doesn't exist, just return empty.
        return docs

    for name in os.listdir(folder):
        if not name.lower().endswith(".txt"):
            continue

        path = os.path.join(folder, name)

        # TextLoader creates 1 or more Document objects from a text file.
        # We pass encoding to avoid surprises with special characters.
        loader = TextLoader(path, encoding="utf-8")
        file_docs = loader.load()

        # Add simple metadata we might use later for debugging or citations.
        for d in file_docs:
            d.metadata = {
                **d.metadata,          # keep anything the loader added
                "source_file": name,   # short name
                "source_path": path,   # full path
            }

        docs.extend(file_docs)

    return docs
