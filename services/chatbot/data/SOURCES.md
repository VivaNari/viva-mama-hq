# Knowledge corpus — sources & how to populate

The RAG chatbot answers are grounded in a corpus of maternal- and infant-health
literature. **That corpus is _not_ committed to this repository.** The original
private project bundled ~650 MB of third-party PDFs (peer-reviewed journal
articles and clinical guidelines) that are **copyrighted and not redistributable**
in a public, open-source repo. They were removed during the open-sourcing
migration (see [`MIGRATION_NOTES.md`](../../../MIGRATION_NOTES.md)).

To run the chatbot with grounded answers, **bring your own documents**.

## How to populate

1. Place source documents (PDF / TXT / Markdown) under:

   ```
   services/chatbot/data/raw/
   ```

2. Build the FAISS vector index:

   ```bash
   cd services/chatbot
   uv run python ingest_data.py        # or: pnpm --filter @vivamama/chatbot ingest
   ```

   This writes the index to `LOCAL_VECTOR_DIR` (default `.local_vector_store/`),
   which is git-ignored.

Without a corpus the service still starts, but retrieval returns no context and
the assistant falls back to the LLM's own knowledge (subject to
`RAG_SCORE_THRESHOLD`).

## Suggested open / licensed sources

You are responsible for the licensing of whatever you ingest. Good openly
available starting points for maternal & newborn health:

| Source | Notes |
| --- | --- |
| WHO maternal/newborn health guidelines | Check each document's license (many are CC BY-NC-SA — review terms before any commercial use). |
| Your own organisation's clinical content | Ensure you have the rights to use it. |
| Open-access journals (e.g. PLOS, BMC) | Typically CC BY — redistribution-friendly. |

> ⚠️ Do **not** re-commit the original private corpus or any copyrighted PDFs.
> The repo `.gitignore` excludes everything in `data/` except this file and the
> `.gitkeep` placeholders.
