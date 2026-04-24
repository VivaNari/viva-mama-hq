# ── Stage 1: Dependency Builder ────────────────────────────────────
FROM python:3.10-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# ── Stage 2: Ingest Documents Into Vector Store ────────────────────
FROM python:3.10-slim AS ingest

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/install/lib/python3.10/site-packages \
    GROQ_API_KEY=build-time-placeholder-key \
    API_KEY=build-time-placeholder-api-key

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /install /install
COPY app ./app
COPY ingest_data.py ./ingest_data.py
COPY data ./data

RUN python3 ingest_data.py


# ── Stage 3: Runtime ──────────────────────────────────────────────
FROM python:3.10-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/install/lib/python3.10/site-packages

WORKDIR /app

# Only runtime system deps here (no build-essential)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy only installed packages from dependency stage
COPY --from=deps /install /install

# Copy runtime app code without raw ingestion data
COPY app ./app
COPY ingest_data.py ./ingest_data.py
COPY --from=ingest /app/.local_vector_store ./.local_vector_store

# Run as non-root for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8001

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8001"]