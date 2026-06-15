import logging

from app.rag.loaders import load_documents
from app.rag.retriever import RAGRetriever

# Set up logging to see progress
logging.basicConfig(level=logging.INFO)

def ingest():
    # 1. Initialize retriever
    retriever = RAGRetriever()
    
    # 2. Load all documents (now including PDFs)
    print("Loading documents from data/raw...")
    docs = load_documents("data/raw", recursive=True)
    
    if not docs:
        print("No documents found! Check your data/raw folder.")
        return

    # 3. Build and save the index
    print(f"Indexing {len(docs)} document chunks...")
    retriever.build_index(docs, save=True)
    print("✅ Indexing complete! Your .local_vector_store is now populated.")

if __name__ == "__main__":
    ingest()
