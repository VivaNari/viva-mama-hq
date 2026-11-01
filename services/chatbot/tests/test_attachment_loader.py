"""
Loading attached files from storage: a slow or failing download ends the turn with a
reason in the log, and a large file within the limit loads.
"""

from __future__ import annotations

import asyncio
import time
import unittest
from unittest import mock

import app.attachments.loader as loader
from app.attachments.schemas import AttachmentRef
from app.settings import settings

USER = "6a9f23daf4324a08644d1e4e"


def ref(n: int = 1, ext: str = "pdf") -> AttachmentRef:
    return AttachmentRef(
        attachment_id=f"a{n}",
        uri=f"gs://vm-bucket/chat/{USER}/3f1c2b7a-1111-4a2b-9c3d-12345678900{n}.{ext}",
        mime_type="application/pdf" if ext == "pdf" else "image/jpeg",
        kind="pdf" if ext == "pdf" else "image",
    )


class TestLoader(unittest.TestCase):
    def load(self, refs):
        return asyncio.run(loader.build_media_parts(refs))

    def test_a_large_file_within_the_limit_loads(self) -> None:
        big = b"%PDF-" + b"x" * (10 * 1024 * 1024 - 5)
        with mock.patch.object(loader, "_download", lambda uri: big):
            parts = self.load([ref()])
        self.assertEqual(parts, [{"type": "media", "data": big, "mime_type": "application/pdf"}])

    def test_a_slow_download_fails_with_a_reason(self) -> None:
        with (
            mock.patch.object(settings, "attachment_download_timeout_s", 0.2),
            mock.patch.object(loader, "_download", lambda uri: time.sleep(1) or b""),
            self.assertRaises(loader.AttachmentLoadError) as caught,
        ):
            self.load([ref()])
        self.assertIn("TimeoutError", str(caught.exception))

    def test_a_storage_error_keeps_its_message(self) -> None:
        def denied(uri):
            raise PermissionError("403 storage.objects.get denied")

        with (
            mock.patch.object(loader, "_download", denied),
            self.assertRaises(loader.AttachmentLoadError) as caught,
        ):
            self.load([ref()])
        self.assertEqual(str(caught.exception), "PermissionError: 403 storage.objects.get denied")

    def test_files_download_in_parallel_within_one_limit(self) -> None:
        # Three 0.3 s downloads finish inside a 0.7 s limit only if they overlap.
        with (
            mock.patch.object(settings, "attachment_download_timeout_s", 0.7),
            mock.patch.object(loader, "_download", lambda uri: time.sleep(0.3) or b"x"),
        ):
            parts = self.load([ref(1, "jpg"), ref(2, "jpg"), ref(3, "jpg")])
        self.assertEqual(len(parts), 3)

    def test_uri_transport_reads_nothing(self) -> None:
        with (
            mock.patch.object(settings, "attachment_transport", "uri"),
            mock.patch.object(loader, "_download", side_effect=AssertionError("downloaded")),
        ):
            parts = self.load([ref()])
        self.assertEqual(parts[0]["file_uri"], ref().uri)


if __name__ == "__main__":
    unittest.main()
