import { Schema, Types } from "mongoose";
import { AttachmentTypeEnum } from "./chat.types";

/**
 * A file she attached to a Viva AI turn: a lab report, scan report, ultrasound or
 * prescription. The bytes live in a private GCS bucket; this record is how every
 * read is authorised, and the trail of what happened to the file.
 *
 *   UPLOADED  stored, not yet sent with a turn (deleted by the janitor after 24h)
 *   ATTACHED  claimed by a turn that is being answered
 *   ANALYZED  the chatbot accepted it as a mother/baby health document
 *   REJECTED  the chatbot refused it (unrelated, someone else's, a body photo,
 *             unreadable); the object is deleted straight away
 *   FAILED    the turn failed; the object is deleted
 *   DELETED   she removed it, or retention ended
 */
export enum EAttachmentStatus {
    UPLOADED = "UPLOADED",
    ATTACHED = "ATTACHED",
    ANALYZED = "ANALYZED",
    REJECTED = "REJECTED",
    FAILED = "FAILED",
    DELETED = "DELETED",
}

/** Error codes the app localises. Shared with the app through @vivamama/contracts. */
export enum EAttachmentError {
    FEATURE_DISABLED = "FEATURE_DISABLED",
    CONSENT_REQUIRED = "ATTACHMENT_CONSENT_REQUIRED",
    MISSING = "ATTACHMENT_MISSING",
    TOO_LARGE = "ATTACHMENT_TOO_LARGE",
    UNSUPPORTED_TYPE = "ATTACHMENT_UNSUPPORTED_TYPE",
    CORRUPT = "ATTACHMENT_CORRUPT",
    PDF_ENCRYPTED = "ATTACHMENT_PDF_ENCRYPTED",
    PDF_TOO_MANY_PAGES = "ATTACHMENT_PDF_TOO_MANY_PAGES",
    PDF_UNSAFE = "ATTACHMENT_PDF_UNSAFE",
    IMAGE_TOO_SMALL = "ATTACHMENT_IMAGE_TOO_SMALL",
    IMAGE_TOO_LARGE_DIMENSIONS = "ATTACHMENT_IMAGE_TOO_LARGE_DIMENSIONS",
    DAILY_LIMIT = "ATTACHMENT_DAILY_LIMIT",
    RATE_LIMIT = "ATTACHMENT_RATE_LIMIT",
    BUSY = "ATTACHMENT_BUSY",
    STORAGE_UNAVAILABLE = "ATTACHMENT_STORAGE_UNAVAILABLE",
    NOT_FOUND = "ATTACHMENT_NOT_FOUND",
    EXPIRED = "ATTACHMENT_EXPIRED",
    NOT_AVAILABLE = "ATTACHMENT_NOT_AVAILABLE",
    TOO_MANY = "ATTACHMENT_TOO_MANY",
    MIXED_KINDS = "ATTACHMENT_MIXED_KINDS",
}

export type TAttachmentKind = AttachmentTypeEnum.IMAGE | AttachmentTypeEnum.PDF;

export type TAttachmentMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const ACCEPTED_ATTACHMENT_MIME_TYPES: TAttachmentMime[] = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
];

export interface IChatAttachment {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    clientUploadId: string;
    kind: TAttachmentKind;
    mimeType: TAttachmentMime;
    sizeBytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    pageCount: number | null;
    originalName: string | null;
    bucket: string;
    objectName: string;
    status: EAttachmentStatus;
    verdict: {
        code: string | null;
        category: string | null;
        subject: string | null;
    } | null;
    conversationId: Schema.Types.ObjectId | Types.ObjectId | null;
    messageId: Schema.Types.ObjectId | Types.ObjectId | null;
    expiresAt: Date;
    deletedAt: Date | null;
    /** When this tombstone itself is dropped (TTL index). */
    purgeAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** Thrown by the attachment services; the controller maps it to an HTTP status. */
export class AttachmentError extends Error {
    constructor(
        public readonly code: EAttachmentError,
        public readonly status: number,
        message?: string,
    ) {
        super(message ?? code);
        this.name = "AttachmentError";
    }
}
