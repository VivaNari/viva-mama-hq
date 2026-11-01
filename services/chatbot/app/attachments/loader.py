"""Turn attachment refs into Gemini media parts."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from app.attachments.schemas import AttachmentRef
from app.settings import settings

# The metadata lookup is one small request; it should never take long.
METADATA_TIMEOUT_S = 10.0


class AttachmentLoadError(Exception):
    """The file could not be read from storage."""


def _download(uri: str) -> bytes:
    from google.cloud import storage  # lazy: most turns never need it

    bucket_name, _, name = uri[len("gs://") :].partition("/")
    blob = storage.Client().bucket(bucket_name).blob(name)
    blob.reload(timeout=METADATA_TIMEOUT_S)
    if blob.size is None or blob.size > settings.attachment_max_bytes:
        raise AttachmentLoadError(f"object too large or of unknown size ({blob.size} bytes)")
    # (connect, read) per socket operation; the whole download is bounded by the
    # wait_for in build_media_parts.
    return blob.download_as_bytes(
        timeout=(METADATA_TIMEOUT_S, settings.attachment_download_timeout_s)
    )


def _describe(error: BaseException) -> str:
    """Type and message, for the log. Says where it failed, never what the file holds."""
    if isinstance(error, asyncio.TimeoutError):
        return f"TimeoutError: no complete download within {settings.attachment_download_timeout_s:.0f}s"
    message = str(error).strip().replace("\n", " ")
    return f"{type(error).__name__}: {message}"[:300] if message else type(error).__name__


async def build_media_parts(refs: List[AttachmentRef]) -> List[Dict[str, Any]]:
    """One `media` content part per file, in order. Raises AttachmentLoadError."""
    if settings.attachment_transport == "uri":
        return [{"type": "media", "file_uri": r.uri, "mime_type": r.mime_type} for r in refs]

    loop = asyncio.get_event_loop()
    try:
        # Files download in parallel, so the limit is per turn, not per file. It is sized
        # for a 10 MB file on a slow link; inside Cloud Run, next to the bucket, a
        # download takes well under a second.
        blobs = await asyncio.wait_for(
            asyncio.gather(*[loop.run_in_executor(None, _download, r.uri) for r in refs]),
            timeout=settings.attachment_download_timeout_s,
        )
    except AttachmentLoadError:
        raise
    except Exception as e:  # noqa: BLE001 - any storage failure means we cannot read it
        raise AttachmentLoadError(_describe(e)) from e
    return [
        {"type": "media", "data": data, "mime_type": r.mime_type} for r, data in zip(refs, blobs)
    ]
