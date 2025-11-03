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
        return docs

    for name in os.listdir(folder):
        if not name.lower().endswith(".txt"):
            continue

        path = os.path.join(folder, name)

        loader = TextLoader(path, encoding="utf-8")
        file_docs = loader.load()

        for d in file_docs:
            d.metadata = {
                **d.metadata,         
                "source_file": name,  
                "source_path": path,  
            }

        docs.extend(file_docs)

    return docs
