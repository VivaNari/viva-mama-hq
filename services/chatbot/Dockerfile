# syntax=docker/dockerfile:1
# Build context is services/chatbot (see docker-compose.yml). Self-contained;
# no monorepo workspace dependencies.
#
# ── Stage 1: Dependencies ──────────────────────────────────────────
FROM python:3.14-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
# CPU-only PyTorch wheels (pulled transitively by sentence-transformers) keep the
# image small and avoid CUDA downloads.
RUN pip install --no-cache-dir --prefix=/install \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/install/lib/python3.10/site-packages
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /install /install
COPY app ./app
COPY ingest_data.py ./ingest_data.py

# The knowledge corpus (data/) and FAISS index (.local_vector_store/) are NOT
# baked into the image — supply them at runtime via mounted volumes and build the
# index once with:
#   docker compose run --rm chatbot python ingest_data.py
# See services/chatbot/data/SOURCES.md.

RUN useradd -m appuser && chown -R appuser /app
USER appuser
EXPOSE 8001
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
