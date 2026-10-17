# syntax=docker/dockerfile:1
# Build context is services/chatbot (see docker-compose.yml). Self-contained;
# no monorepo workspace dependencies.
#
# ── Stage 1: Dependency Builder ────────────────────────────────────
FROM python:3.12-slim AS deps

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
# CPU-only PyTorch wheels (pulled transitively by sentence-transformers) keep the
# image small and avoid CUDA downloads.
RUN pip install --no-cache-dir --prefix=/install \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt


# ── Stage 2: Base (deps + baked embedding model) ───────────────────
# Cache-stable layer: it only changes when requirements.txt or the model
# name change. It is reused for BOTH the index build (CI runs ingest inside
# this image) and the runtime image, so BAAI/bge-m3 (~2.3 GB) is downloaded
# exactly once and never at request time.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/install/lib/python3.12/site-packages \
    HF_HOME=/opt/hf

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /install /install

# Pre-download + cache the embedding model into HF_HOME.
# NOTE: this model name MUST match settings.embeddings_model
# (app/settings.py -> "BAAI/bge-m3"); load_index() rejects a mismatched index.
#
# bge-m3 ships its weights in TWO formats in the same repo: pytorch_model.bin
# AND model.safetensors (~2.3 GB EACH). sentence-transformers/transformers load
# from safetensors when it is present and never read the .bin, so the .bin is
# pure dead weight (~2 GB). We prune it in the SAME RUN as the download: Docker
# captures the layer's final state, so download-then-delete in one layer yields
# a ~2 GB-smaller layer. A separate RUN would leave the .bin in the lower layer
# and save nothing. The `readlink -f` resolves the snapshot symlink to the real
# blob so both the blob and the link are removed (works too if HF stored a plain
# file instead of a symlink). Tiny bge-m3 heads (colbert/sparse *.pt) are left
# untouched — they are not *.bin and are only a few MB.
RUN python3 -c "from langchain_community.embeddings import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='BAAI/bge-m3', encode_kwargs={'normalize_embeddings': True})" \
    && find /opt/hf -name 'pytorch_model.bin' -exec sh -c 'rm -f "$(readlink -f "$1")" "$1"' _ {} \;


# ── Stage 3: Runtime ──────────────────────────────────────────────
# Slim final image: deps + app code + prebuilt index. The embedding model is
# DELIBERATELY NOT baked here (that is what `base` is for — CI ingest + the
# model→GCS upload). At container boot the app downloads the model from GCS
# (MODEL_GCS_URI) into MODEL_LOCAL_DIR, which keeps this image ~2 GB smaller.
# This stage builds FROM the slim python base (NOT `base`), so /opt/hf's ~2 GB
# model layer never enters the runtime image.
#
# Fallback: if MODEL_GCS_URI is unset (e.g. local dev), the app loads the model
# by name from HF instead — so this image still works without GCS, it just
# downloads from HF at first use.
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/install/lib/python3.12/site-packages \
    HF_HOME=/opt/hf \
    MODEL_LOCAL_DIR=/models/bge-m3

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /install /install

COPY app ./app
COPY ingest_data.py ./ingest_data.py
# Curated NCBI/NIH LactMed dataset. app/lactmed/lookup.py resolves it as
# parents[2]/lactmed.json — /app/lactmed.json in this image — and falls back to
# an EMPTY dataset if it is missing, logging an error but not failing. Without
# this line every lactation drug-safety question silently returns nothing.
COPY lactmed.json ./lactmed.json
COPY .local_vector_store ./.local_vector_store

# Non-root runtime. appuser must be able to WRITE the model dir + HF cache at
# boot (the model is downloaded then, not baked), and read the index.
RUN useradd -m appuser \
    && mkdir -p /models /opt/hf \
    && chown -R appuser /app /models /opt/hf
USER appuser
EXPOSE 8001

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
