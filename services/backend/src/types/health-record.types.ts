import { Types } from "mongoose";
import { TAttachmentKind, TAttachmentMime } from "./chat-attachment.types";

/**
 * A health record she keeps in the app: a scan report, lab report, prescription or
 * MCH card, as 1 PDF or up to 5 photos of the same document, with the summary Viva
 * wrote when it was added. Kept until she deletes it.
 *
 *   DRAFT       created when she picks the first file; pages are being uploaded
 *               (deleted by the janitor after 24h if never submitted)
 *   PROCESSING  submitted; the chatbot is reading it
 *   READY       accepted and summarised
 *   REJECTED    not a health record of hers or her baby's; the files are deleted at
 *               once and the record itself goes after a week
 *   FAILED      reading failed; the files are kept so she can retry
 */
export enum EHealthRecordStatus {
    DRAFT = "DRAFT",
    PROCESSING = "PROCESSING",
    READY = "READY",
    REJECTED = "REJECTED",
    FAILED = "FAILED",
}

export enum EHealthRecordCategory {
    SCAN = "scan",
    LAB = "lab",
    PRESCRIPTION = "prescription",
    MCH = "mch",
}

export enum EScanType {
    DATING = "dating",
    ANOMALY = "anomaly",
    GROWTH = "growth",
}

export enum ERecordSubject {
    MOTHER = "MOTHER",
    CHILD = "CHILD",
}

export enum EHealthSummaryStatus {
    PENDING = "PENDING",
    READY = "READY",
    FAILED = "FAILED",
}

export type TRecordSeverity = "NONE" | "MEDIUM" | "HIGH";

/** Error codes the app localises. */
export enum EHealthRecordError {
    FEATURE_DISABLED = "HEALTH_RECORDS_DISABLED",
    CONSENT_REQUIRED = "HEALTH_RECORDS_CONSENT_REQUIRED",
    NOT_FOUND = "HEALTH_RECORD_NOT_FOUND",
    NOT_DRAFT = "HEALTH_RECORD_NOT_DRAFT",
    NOT_RETRYABLE = "HEALTH_RECORD_NOT_RETRYABLE",
    TOO_MANY_FILES = "HEALTH_RECORD_TOO_MANY_FILES",
    MIXED_KINDS = "HEALTH_RECORD_MIXED_KINDS",
    NO_FILES = "HEALTH_RECORD_NO_FILES",
    INVALID_CHILD = "HEALTH_RECORD_INVALID_CHILD",
    NO_RECORDS = "HEALTH_SUMMARY_NO_RECORDS",
    SUMMARY_NOT_FOUND = "HEALTH_SUMMARY_NOT_FOUND",
    SUMMARY_IN_PROGRESS = "HEALTH_SUMMARY_IN_PROGRESS",
    STORAGE_UNAVAILABLE = "HEALTH_RECORD_STORAGE_UNAVAILABLE",
}

export class HealthRecordError extends Error {
    constructor(
        public readonly code: EHealthRecordError,
        public readonly status: number,
        message?: string,
    ) {
        super(message ?? code);
        this.name = "HealthRecordError";
    }
}

export interface IHealthRecordFile {
    /** The app's id for the picked file; also how a page is addressed (view, remove). */
    clientUploadId: string;
    /** records/{userId}/{recordId}/{uuid}.{ext} */
    objectName: string;
    kind: TAttachmentKind;
    mimeType: TAttachmentMime;
    sizeBytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    pageCount: number | null;
    originalName: string | null;
}

export interface IHealthRecordSummary {
    markdown: string;
    /** The chatbot's structured reading (AnalysisOutput), kept for the overall summary. */
    analysis: Record<string, unknown> | null;
    /** Compact text of what was read; the overall summary's input. Max ~3 KB. */
    digest: string;
    severity: TRecordSeverity;
    criticalMatches: string[];
    lang: "en" | "hi";
    generatedAt: Date;
}

export interface IHealthRecord {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    clientUploadId: string;
    category: EHealthRecordCategory;
    scanType: EScanType | null;
    subject: { type: ERecordSubject; childId: Types.ObjectId | null };
    files: IHealthRecordFile[];
    bucket: string;
    status: EHealthRecordStatus;
    verdict: { code: string | null; reasonCode: string | null; documentType: string | null } | null;
    /** The refusal or failure text from the chatbot, in her language. */
    message: string | null;
    title: string | null;
    /** The day (IST) she added it; never a date printed on it. What the list groups by. */
    recordDate: Date;
    summary: IHealthRecordSummary | null;
    lang: "en" | "hi";
    submittedAt: Date | null;
    attempts: number;
    quotaRefunded: boolean;
    /** Set the moment she deletes it: every read skips it, and a late chatbot answer is dropped. */
    deletedAt: Date | null;
    /** TTL: only REJECTED records expire on their own. */
    purgeAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IHealthSummary {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    status: EHealthSummaryStatus;
    lang: "en" | "hi";
    sourceRecordIds: Types.ObjectId[];
    content: Record<string, unknown> | null;
    shareText: string | null;
    errorCode: string | null;
    quotaRefunded: boolean;
    createdAt: Date;
    updatedAt: Date;
}
