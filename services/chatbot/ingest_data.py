import logging
import os

from app.rag.loaders import load_documents
from app.rag.retriever import RAGRetriever

# Set up logging to see progress
logging.basicConfig(level=logging.INFO)

# Documents are synced here by CI from the private GCS bucket. Configurable so
# the same script works locally, in the ingest container, and in CI without the
# path being hard-coded.
DATA_DIR = os.environ.get("INGEST_DATA_DIR", "data")


def ingest():
    # 1. Initialize retriever
    retriever = RAGRetriever()

    # 2. Load all documents (now including PDFs)
    print(f"Loading documents from {DATA_DIR}...")
    docs = load_documents(DATA_DIR, recursive=True)

    if not docs:
        print(f"No documents found! Check your {DATA_DIR} folder.")
        return

    # 3. Build and save the index
    print(f"Indexing {len(docs)} document chunks...")
    retriever.build_index(docs, save=True)
    print("✅ Indexing complete! Your .local_vector_store is now populated.")


if __name__ == "__main__":
    ingest()
