import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import env from "../../config/env";
import {
    AttachmentError,
    EAttachmentError,
    TAttachmentKind,
    TAttachmentMime,
} from "../../types/chat-attachment.types";
import { AttachmentTypeEnum } from "../../types/chat.types";
import { sniffMime } from "../../utils/files/file-sniff";

// One image at a time per instance, no cache: an upload is a burst, not a hot path,
// and the API has little memory to spare.
sharp.cache(false);
sharp.concurrency(1);

/** Decoded size cap. A 10 MB PNG can claim 50k x 50k pixels and take the instance down. */
const MAX_INPUT_PIXELS = 40_000_000;
/** Longest edge kept: enough to read the small print on a lab report photo. */
const MAX_EDGE_PX = 2560;
/** Below this the text of a report cannot be read anyway. */
const MIN_EDGE_PX = 320;

export type TProcessedAttachment = {
    buffer: Buffer;
    kind: TAttachmentKind;
    mimeType: TAttachmentMime;
    extension: "jpg" | "pdf";
    width: number | null;
    height: number | null;
    pageCount: number | null;
    sha256: string;
};

const sha256 = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

/**
 * Re-encode a photo to a clean JPEG: applies the EXIF orientation, then drops every
 * metadata block (GPS location, device, timestamps), because no `withMetadata()` is
 * asked for. The stored file is the re-encoded one, so nothing she did not see is kept.
 */
async function processImage(buf: Buffer): Promise<TProcessedAttachment> {
    let meta: sharp.Metadata;
    try {
        meta = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
    } catch (err) {
        const message = String((err as Error)?.message ?? "");
        if (message.includes("pixel limit")) {
            throw new AttachmentError(EAttachmentError.IMAGE_TOO_LARGE_DIMENSIONS, 422);
        }
        throw new AttachmentError(EAttachmentError.CORRUPT, 422);
    }
    if (!meta.width || !meta.height) throw new AttachmentError(EAttachmentError.CORRUPT, 422);
    if (meta.width * meta.height > MAX_INPUT_PIXELS) {
        throw new AttachmentError(EAttachmentError.IMAGE_TOO_LARGE_DIMENSIONS, 422);
    }
    if (Math.min(meta.width, meta.height) < MIN_EDGE_PX) {
        throw new AttachmentError(EAttachmentError.IMAGE_TOO_SMALL, 422);
    }

    let output: { data: Buffer; info: sharp.OutputInfo };
    try {
        output = await sharp(buf, {
            limitInputPixels: MAX_INPUT_PIXELS,
            failOn: "error",
            sequentialRead: true,
        })
            .rotate()
            .resize({
                width: MAX_EDGE_PX,
                height: MAX_EDGE_PX,
                fit: "inside",
                withoutEnlargement: true,
            })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
    } catch {
        throw new AttachmentError(EAttachmentError.CORRUPT, 422);
    }

    return {
        buffer: output.data,
        kind: AttachmentTypeEnum.IMAGE,
        mimeType: "image/jpeg",
        extension: "jpg",
        width: output.info.width,
        height: output.info.height,
        pageCount: null,
        sha256: sha256(output.data),
    };
}

/**
 * Accept a PDF only if it is an ordinary, unlocked document of a few pages.
 *
 * The original bytes are stored (re-rendering would lose the text layer the model
 * reads best). What is refused: encrypted files (nothing can read them), more than
 * the page limit, and launch actions or embedded files, which a report never needs.
 * Embedded JavaScript is tolerated: neither Gemini nor the app's PDF viewers run it.
 */
async function processPdf(buf: Buffer, maxPdfPages: number): Promise<TProcessedAttachment> {
    const raw = buf.toString("latin1");
    if (/\/Launch\b/.test(raw) || /\/EmbeddedFiles?\b/.test(raw)) {
        throw new AttachmentError(EAttachmentError.PDF_UNSAFE, 422);
    }
    if (/\/Encrypt\b/.test(raw)) {
        throw new AttachmentError(EAttachmentError.PDF_ENCRYPTED, 422);
    }

    let doc: PDFDocument;
    try {
        doc = await PDFDocument.load(buf, { ignoreEncryption: false, updateMetadata: false });
    } catch (err) {
        if (
            String((err as Error)?.message ?? "")
                .toLowerCase()
                .includes("encrypt")
        ) {
            throw new AttachmentError(EAttachmentError.PDF_ENCRYPTED, 422);
        }
        throw new AttachmentError(EAttachmentError.CORRUPT, 422);
    }
    const pageCount = doc.getPageCount();
    if (pageCount < 1) throw new AttachmentError(EAttachmentError.CORRUPT, 422);
    if (pageCount > maxPdfPages) {
        throw new AttachmentError(EAttachmentError.PDF_TOO_MANY_PAGES, 422);
    }

    return {
        buffer: buf,
        kind: AttachmentTypeEnum.PDF,
        mimeType: "application/pdf",
        extension: "pdf",
        width: null,
        height: null,
        pageCount,
        sha256: sha256(buf),
    };
}

export type TProcessingLimits = { maxBytes: number; maxPdfPages: number };

/**
 * Validate an uploaded file by its content and return what should be stored. Limits
 * default to chat's; health records pass their own (longer PDFs).
 */
export async function processAttachment(
    buf: Buffer,
    limits: TProcessingLimits = {
        maxBytes: env.CHAT_ATTACHMENT_MAX_BYTES,
        maxPdfPages: env.CHAT_ATTACHMENT_MAX_PDF_PAGES,
    },
): Promise<TProcessedAttachment> {
    if (!buf || buf.length === 0) throw new AttachmentError(EAttachmentError.MISSING, 400);
    if (buf.length > limits.maxBytes) {
        throw new AttachmentError(EAttachmentError.TOO_LARGE, 413);
    }

    const sniffed = sniffMime(buf);
    switch (sniffed) {
        case "image/jpeg":
        case "image/png":
        case "image/webp":
            return processImage(buf);
        case "application/pdf":
            return processPdf(buf, limits.maxPdfPages);
        default:
            // HEIC lands here too: the app always converts it, so seeing one means an
            // old build or a hand-made request.
            throw new AttachmentError(EAttachmentError.UNSUPPORTED_TYPE, 415);
    }
}
