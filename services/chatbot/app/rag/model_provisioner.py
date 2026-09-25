"""
Boot-time embedding-model provisioning from GCS.

The runtime image no longer bakes the ~2 GB bge-m3 model (that keeps the image
~2 GB smaller). Instead, each Cloud Run instance downloads the model from a
private GCS bucket ONCE on boot, into a local folder, and loads it from there.

Design notes
------------
- The model is stored in GCS as a FLAT folder (the resolved sentence-transformers
  snapshot — config.json, model.safetensors, tokenizer files, 1_Pooling/…). CI
  materializes it with `cp -L` so there are no HF-cache symlinks to break in GCS.
- A local marker file (`.download_complete`) makes repeat calls a no-op and guards
  against a half-finished download being reused.
- If `MODEL_GCS_URI` is unset (e.g. local dev, or a rollback to a baked image),
  this returns None and the caller falls back to loading the model by name.
- Auth is via Application Default Credentials — on Cloud Run that is the service
  account's identity; no key files.

The download is parallelized across blobs; the single large safetensors file
dominates and streams fast from same-region GCS (egress to Cloud Run is free).
"""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional, Tuple

from app.settings import settings

logger = logging.getLogger(__name__)

# Written into MODEL_LOCAL_DIR after every blob has downloaded successfully.
_DONE_MARKER = ".download_complete"
# GCS-side completion marker uploaded by CI — not part of the model, skip it.
_REMOTE_MARKER_SUFFIX = ".complete"
_MAX_DOWNLOAD_WORKERS = 8


def _parse_gcs_uri(uri: str) -> Tuple[str, str]:
    """Split gs://bucket/prefix into (bucket, normalized-prefix-with-trailing-slash)."""
    if not uri.startswith("gs://"):
        raise ValueError(f"MODEL_GCS_URI must start with gs:// (got: {uri!r})")
    path = uri[len("gs://") :]
    parts = path.split("/", 1)
    bucket = parts[0]
    prefix = parts[1] if len(parts) > 1 else ""
    prefix = prefix.strip("/")
    prefix = f"{prefix}/" if prefix else ""
    return bucket, prefix


def model_is_present(local_dir: Path) -> bool:
    """True if a previous run already fully downloaded the model here."""
    return (local_dir / _DONE_MARKER).is_file()


def ensure_model_available() -> Optional[str]:
    """Ensure the embedding model exists locally; return its path (or None).

    Returns the local directory to load the model from, or None when no
    MODEL_GCS_URI is configured (caller then loads the model by name).

    Idempotent and safe to call concurrently-ish: the marker file is written
    only after all blobs land, so a crashed partial download is re-attempted
    rather than silently reused.
    """
    uri = (settings.model_gcs_uri or "").strip()
    if not uri:
        logger.info(
            "MODEL_GCS_URI not set — loading embedding model by name (baked image or HF download)."
        )
        return None

    local_dir = Path(settings.model_local_dir)
    if model_is_present(local_dir):
        logger.info("Embedding model already present at %s — skipping download.", local_dir)
        return str(local_dir)

    bucket_name, prefix = _parse_gcs_uri(uri)
    logger.info(
        "Downloading embedding model from gs://%s/%s to %s ...",
        bucket_name,
        prefix,
        local_dir,
    )

    # Imported here (not at module top) so the app can import this module even
    # in environments where google-cloud-storage isn't installed but the GCS
    # path is unused.
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(bucket_name)

    # Collect (blob, local_target) pairs, preserving sub-directory structure.
    jobs: List[Tuple["storage.Blob", Path]] = []
    for blob in client.list_blobs(bucket, prefix=prefix):
        if blob.name.endswith("/"):
            continue  # directory placeholder
        rel = blob.name[len(prefix) :] if prefix else blob.name
        if not rel or rel == _REMOTE_MARKER_SUFFIX or rel.endswith(_REMOTE_MARKER_SUFFIX):
            continue  # the CI-side completion marker, not a model file
        jobs.append((blob, local_dir / rel))

    if not jobs:
        raise RuntimeError(
            f"No model files found at gs://{bucket_name}/{prefix} — "
            "was the CI 'Publish embedding model to GCS' step run?"
        )

    local_dir.mkdir(parents=True, exist_ok=True)

    def _download(job: Tuple["storage.Blob", Path]) -> str:
        blob, target = job
        target.parent.mkdir(parents=True, exist_ok=True)
        # Download to a temp file then rename, so a partial file is never left
        # at the final path if the process dies mid-download.
        tmp = target.with_suffix(target.suffix + ".part")
        blob.download_to_filename(str(tmp))
        os.replace(tmp, target)
        return blob.name

    errors: List[str] = []
    with ThreadPoolExecutor(max_workers=_MAX_DOWNLOAD_WORKERS) as pool:
        futures = {pool.submit(_download, job): job for job in jobs}
        for fut in as_completed(futures):
            try:
                name = fut.result()
                logger.debug("Downloaded %s", name)
            except Exception as e:  # noqa: BLE001 - collect and fail loudly below
                blob, _ = futures[fut]
                errors.append(f"{blob.name}: {e}")

    if errors:
        raise RuntimeError("Failed to download some model files:\n  " + "\n  ".join(errors))

    # Sanity check the essential weights file arrived before marking complete.
    if not (local_dir / "model.safetensors").is_file():
        raise RuntimeError(f"Model download finished but {local_dir}/model.safetensors is missing.")

    (local_dir / _DONE_MARKER).write_text("ok", encoding="utf-8")
    logger.info("Embedding model ready at %s (%d files).", local_dir, len(jobs))
    return str(local_dir)
