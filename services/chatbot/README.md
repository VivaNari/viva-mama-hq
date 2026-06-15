# @vivamama/chatbot

VivaMama **RAG chatbot** — a Python **FastAPI** service that answers maternal- and
infant-health questions using **retrieval-augmented generation**: LangChain +
**FAISS** over a local document corpus, with **Groq**-hosted LLMs, Redis session
memory, and MCP tools that call the core backend (products, experts,
recommendations, user profile).

## Tech stack

Python 3.10 · FastAPI + Uvicorn · LangChain · sentence-transformers + faiss-cpu ·
Groq · Redis · MongoDB (PyMongo) · slowapi (rate limiting) · MCP · **uv** (deps) ·
**Ruff** (lint/format) · pytest.

## Prerequisites

- Python ≥ 3.10 and [**uv**](https://docs.astral.sh/uv/) (`pip install uv`)
- Redis and (optionally) MongoDB — `docker compose up redis mongo` from the repo root
- A **Groq API key** → https://console.groq.com/keys

## Setup

```bash
cd services/chatbot
cp .env.example .env          # then set GROQ_API_KEY and API_KEY at minimum
uv sync                       # create venv + install deps (incl. dev: ruff, pytest)
```

Every variable is documented in [`.env.example`](./.env.example) and validated by
[`app/settings.py`](./app/settings.py).

## Knowledge corpus

The chatbot is grounded in documents you supply — the original copyrighted corpus
is **not** shipped. Add documents to `data/raw/` and build the index:

```bash
uv run python ingest_data.py        # or: pnpm --filter @vivamama/chatbot ingest
```

See [`data/SOURCES.md`](./data/SOURCES.md). Without a corpus the service still
runs but falls back to the LLM's own knowledge.

## Run

```bash
uv run uvicorn app.api.main:app --reload --port 8001
# or, orchestrated from the repo root:
pnpm --filter @vivamama/chatbot dev
```

Service listens on `http://localhost:8001`.

## Test, lint, format

```bash
pnpm --filter @vivamama/chatbot lint          # uvx ruff check .
pnpm --filter @vivamama/chatbot format        # uvx ruff format .
pnpm --filter @vivamama/chatbot test          # uv run pytest (tests/)
```

> The top-level `test_*.py` files are manual integration probes that require live
> Redis/Mongo/Groq; the default `pytest` run targets the curated `tests/` suite
> (see `pyproject.toml`).

## Docker

```bash
docker compose up --build chatbot
# build the index against a mounted corpus:
docker compose run --rm chatbot python ingest_data.py
```

## Dependency manifests

`pyproject.toml` + `uv.lock` are canonical (local dev/CI). `requirements.txt` is a
pip-installable export used by the Docker image (CPU-only PyTorch wheels); keep it
in sync with `uv export --no-dev --format requirements-txt > requirements.txt`.
