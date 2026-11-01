import { createHash, randomUUID } from "crypto";
import { Types } from "mongoose";

import env from "../../config/env";
import { getStorage } from "../../config/gcs.config";
import { startOfIstDay } from "../../constants/consultation-slots";
import chatAttachmentModel from "../../models/chat-attachment.model";
import pendingGcsPurgeModel from "../../models/pending-gcs-purge.model";
import {
    AttachmentError,
    EAttachmentError,
    EAttachmentStatus,
    IChatAttachment,
} from "../../types/chat-attachment.types";
import { AttachmentTypeEnum, IMessageAttachment } from "../../types/chat.types";
import logger, { createModuleLogger } from "../../utils/logger";
import { processAttachment } from "./attachment-processing.service";

const log = createModuleLogger(logger, "chat-attachments");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** How long the record outlives the file, so "expired" still resolves for a while. */
const TOMBSTONE_DAYS = 90;
const BURST_WINDOW_MS = 60 * 1000;
const BURST_LIMIT = 5;

/** What the app is given about one attachment. The URL is short-lived and never stored. */
export type TAttachmentView = {
    id: string;
    kind: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    pageCount: number | null;
    originalName: string | null;
    expiresAt: Date;
    previewUrl: string | null;
    previewUrlExpiresAt: Date | null;
};

/** What the chatbot is given: where to read the file, nothing else. */
export type TChatbotAttachmentRef = {
    attachment_id: string;
    uri: string;
    mime_type: string;
    kind: "image" | "pdf";
    page_count?: number;
};

const userPrefix = (userId: string): string => `chat/${userId}/`;

const sanitizeName = (name: string | undefined): string | null => {
    if (!name) return null;
    // Keep what she would recognise; drop anything path-like or control characters.
    const base = name.split(/[\\/]/).pop() ?? "";
    // eslint-disable-next-line no-control-regex
    const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return clean ? clean.slice(0, 80) : null;
};

const isGone = (att: IChatAttachment, now: Date): boolean =>
    att.status === EAttachmentStatus.DELETED ||
    att.status === EAttachmentStatus.REJECTED ||
    att.status === EAttachmentStatus.FAILED ||
    att.expiresAt.getTime() <= now.getTime();

class ChatAttachmentService {
    private bucket() {
        if (!env.CHAT_ATTACHMENTS_BUCKET) {
            throw new AttachmentError(EAttachmentError.STORAGE_UNAVAILABLE, 503);
        }
        return getStorage().bucket(env.CHAT_ATTACHMENTS_BUCKET);
    }

    /** How many files she has uploaded today (IST), counting ones since deleted. */
    async uploadsToday(userId: string, now: Date = new Date()): Promise<number> {
        return chatAttachmentModel.countDocuments({
            userId,
            createdAt: { $gte: startOfIstDay(now) },
        });
    }

    async assertWithinLimits(userId: string, now: Date = new Date()): Promise<void> {
        const [today, burst] = await Promise.all([
            this.uploadsToday(userId, now),
            chatAttachmentModel.countDocuments({
                userId,
                createdAt: { $gte: new Date(now.getTime() - BURST_WINDOW_MS) },
            }),
        ]);
        if (today >= env.CHAT_ATTACHMENT_DAILY_LIMIT) {
            throw new AttachmentError(EAttachmentError.DAILY_LIMIT, 429);
        }
        if (burst >= BURST_LIMIT) {
            throw new AttachmentError(EAttachmentError.RATE_LIMIT, 429);
        }
    }

    /**
     * Validate, clean and store one file. Idempotent on clientUploadId: a retried
     * upload gets the first record back and stores nothing new.
     */
    async upload(
        userId: string,
        file: { buffer: Buffer; originalname?: string },
        clientUploadId: string,
    ): Promise<{ attachment: IChatAttachment; created: boolean }> {
        const existing = await chatAttachmentModel.findOne({ userId, clientUploadId });
        if (existing) return { attachment: existing, created: false };

        await this.assertWithinLimits(userId);
        const processed = await processAttachment(file.buffer);

        const objectName = `${userPrefix(userId)}${randomUUID()}.${processed.extension}`;
        const gcsFile = this.bucket().file(objectName);
        try {
            await gcsFile.save(processed.buffer, {
                resumable: false,
                contentType: processed.mimeType,
                metadata: {
                    cacheControl: "private, max-age=0, no-store",
                    contentDisposition: "inline",
                },
                preconditionOpts: { ifGenerationMatch: 0 },
            });
        } catch (err) {
            log.error({ err, userId }, "Attachment upload to storage failed");
            throw new AttachmentError(EAttachmentError.STORAGE_UNAVAILABLE, 503);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + env.CHAT_ATTACHMENT_RETENTION_DAYS * MS_PER_DAY);
        try {
            const attachment = await chatAttachmentModel.create({
                userId,
                clientUploadId,
                kind: processed.kind,
                mimeType: processed.mimeType,
                sizeBytes: processed.buffer.length,
                sha256: processed.sha256,
                width: processed.width,
                height: processed.height,
                pageCount: processed.pageCount,
                originalName:
                    processed.kind === AttachmentTypeEnum.PDF
                        ? sanitizeName(file.originalname)
                        : null,
                bucket: env.CHAT_ATTACHMENTS_BUCKET,
                objectName,
                status: EAttachmentStatus.UPLOADED,
                expiresAt,
                purgeAt: new Date(expiresAt.getTime() + TOMBSTONE_DAYS * MS_PER_DAY),
            });
            log.info(
                {
                    userId,
                    attachmentId: String(attachment._id),
                    kind: processed.kind,
                    sizeBytes: processed.buffer.length,
                    pageCount: processed.pageCount,
                },
                "Attachment stored",
            );
            return { attachment, created: true };
        } catch (err: any) {
            // Two identical uploads raced: keep the first, drop the object we just wrote.
            await gcsFile.delete({ ignoreNotFound: true }).catch(() => undefined);
            if (err?.code === 11000) {
                const winner = await chatAttachmentModel.findOne({ userId, clientUploadId });
                if (winner) return { attachment: winner, created: false };
            }
            throw err;
        }
    }

    /** Hers, or 404. Never 403: that would confirm the id exists. */
    async getOwned(userId: string, id: string): Promise<IChatAttachment> {
        if (!Types.ObjectId.isValid(id)) throw new AttachmentError(EAttachmentError.NOT_FOUND, 404);
        const attachment = await chatAttachmentModel.findOne({ _id: id, userId });
        if (!attachment) throw new AttachmentError(EAttachmentError.NOT_FOUND, 404);
        return attachment;
    }

    /** A V4 read URL valid for a few minutes. Minted per request after the ownership check. */
    async signedReadUrl(
        attachment: IChatAttachment,
        now: Date = new Date(),
    ): Promise<{ url: string; expiresAt: Date }> {
        if (isGone(attachment, now)) throw new AttachmentError(EAttachmentError.EXPIRED, 410);
        const expiresAt = new Date(now.getTime() + env.CHAT_ATTACHMENT_SIGNED_URL_TTL_SEC * 1000);
        try {
            const [url] = await getStorage()
                .bucket(attachment.bucket)
                .file(attachment.objectName)
                .getSignedUrl({
                    version: "v4",
                    action: "read",
                    expires: expiresAt,
                    responseType: attachment.mimeType,
                    responseDisposition: "inline",
                });
            return { url, expiresAt };
        } catch (err) {
            log.error(
                { err, attachmentId: String(attachment._id) },
                "Signing attachment URL failed",
            );
            throw new AttachmentError(EAttachmentError.STORAGE_UNAVAILABLE, 503);
        }
    }

    async toView(attachment: IChatAttachment, withUrl = true): Promise<TAttachmentView> {
        let preview: { url: string; expiresAt: Date } | null = null;
        if (withUrl) {
            preview = await this.signedReadUrl(attachment).catch(() => null);
        }
        return {
            id: String(attachment._id),
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            width: attachment.width,
            height: attachment.height,
            pageCount: attachment.pageCount,
            originalName: attachment.originalName,
            expiresAt: attachment.expiresAt,
            previewUrl: preview?.url ?? null,
            previewUrlExpiresAt: preview?.expiresAt ?? null,
        };
    }

    /**
     * Reserve her files for one turn. Either every id is claimed or none is: a file
     * that is not hers, already used, expired or deleted fails the whole turn before
     * any quota is spent. Up to the per-turn limit of images, or exactly one PDF.
     */
    async claimForTurn(
        userId: string,
        ids: string[],
        now: Date = new Date(),
    ): Promise<IChatAttachment[]> {
        const unique = [...new Set(ids.map(String))];
        if (unique.length === 0) return [];
        if (unique.length > env.CHAT_ATTACHMENT_MAX_PER_TURN) {
            throw new AttachmentError(EAttachmentError.TOO_MANY, 400);
        }
        if (unique.some((id) => !Types.ObjectId.isValid(id))) {
            throw new AttachmentError(EAttachmentError.NOT_AVAILABLE, 409);
        }

        const claimed: IChatAttachment[] = [];
        for (const id of unique) {
            const doc = await chatAttachmentModel.findOneAndUpdate(
                {
                    _id: id,
                    userId,
                    status: EAttachmentStatus.UPLOADED,
                    expiresAt: { $gt: now },
                },
                { $set: { status: EAttachmentStatus.ATTACHED } },
                { new: true },
            );
            if (!doc) {
                await this.releaseClaim(claimed.map((c) => String(c._id)));
                throw new AttachmentError(EAttachmentError.NOT_AVAILABLE, 409);
            }
            claimed.push(doc);
        }

        const pdfs = claimed.filter((c) => c.kind === AttachmentTypeEnum.PDF).length;
        if (pdfs > 0 && claimed.length > 1) {
            await this.releaseClaim(claimed.map((c) => String(c._id)));
            throw new AttachmentError(EAttachmentError.MIXED_KINDS, 400);
        }
        // Keep the order she picked them in.
        return unique.map((id) => claimed.find((c) => String(c._id) === id)!);
    }

    /** Give claimed files back (the turn was refused before it started, e.g. no quota). */
    async releaseClaim(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await chatAttachmentModel.updateMany(
            { _id: { $in: ids }, status: EAttachmentStatus.ATTACHED },
            { $set: { status: EAttachmentStatus.UPLOADED } },
        );
    }

    /**
     * Record how the turn went. Anything other than an accepted health document is
     * deleted from storage at once: there is no reason to keep a selfie, or a photo
     * of a body, for 90 days.
     */
    async markOutcome(
        attachments: IChatAttachment[],
        outcome: {
            status:
                | EAttachmentStatus.ANALYZED
                | EAttachmentStatus.REJECTED
                | EAttachmentStatus.FAILED;
            verdict?: { code: string | null; category: string | null; subject: string | null };
            conversationId?: unknown;
            messageId?: unknown;
        },
    ): Promise<void> {
        if (attachments.length === 0) return;
        await chatAttachmentModel.updateMany(
            { _id: { $in: attachments.map((a) => a._id) } },
            {
                $set: {
                    status: outcome.status,
                    verdict: outcome.verdict ?? null,
                    conversationId: outcome.conversationId ?? null,
                    messageId: outcome.messageId ?? null,
                },
            },
        );
        if (outcome.status !== EAttachmentStatus.ANALYZED) {
            await Promise.all(attachments.map((a) => this.deleteObject(a, outcome.status)));
        }
    }

    /** Remove the stored file. The record stays as a tombstone so the app can show "expired". */
    async deleteObject(
        attachment: IChatAttachment,
        status: EAttachmentStatus = EAttachmentStatus.DELETED,
    ): Promise<void> {
        try {
            await getStorage()
                .bucket(attachment.bucket)
                .file(attachment.objectName)
                .delete({ ignoreNotFound: true });
        } catch (err) {
            // The janitor retries anything whose object may still exist.
            log.error(
                { err, attachmentId: String(attachment._id) },
                "Deleting attachment object failed",
            );
            return;
        }
        await chatAttachmentModel.updateOne(
            { _id: attachment._id },
            { $set: { status, deletedAt: new Date() } },
        );
    }

    /** Every file she ever attached, for account deletion. */
    async deleteAllForUser(userId: string): Promise<void> {
        if (!env.CHAT_ATTACHMENTS_BUCKET) return;
        await this.bucket().deleteFiles({ prefix: userPrefix(userId), force: true });
    }

    /** Queue a prefix whose deletion failed. Holds no reference to the user. */
    async queuePurge(userId: string, error: unknown): Promise<void> {
        await pendingGcsPurgeModel.create({
            bucket: env.CHAT_ATTACHMENTS_BUCKET,
            prefix: userPrefix(userId),
            attempts: 1,
            lastError: String((error as Error)?.message ?? error).slice(0, 300),
        });
    }

    toChatbotRef(attachment: IChatAttachment): TChatbotAttachmentRef {
        return {
            attachment_id: String(attachment._id),
            uri: `gs://${attachment.bucket}/${attachment.objectName}`,
            mime_type: attachment.mimeType,
            kind: attachment.kind === AttachmentTypeEnum.PDF ? "pdf" : "image",
            ...(attachment.pageCount ? { page_count: attachment.pageCount } : {}),
        };
    }

    toMessageAttachment(attachment: IChatAttachment): IMessageAttachment {
        return {
            attachmentId: attachment._id as unknown as string,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            width: attachment.width,
            height: attachment.height,
            pageCount: attachment.pageCount,
            originalName: attachment.originalName,
        };
    }
}

/**
 * Whether this user gets attachments: the env switch AND (an allowlisted tester OR
 * inside the rollout percentage, by a stable hash of her id so she never flips
 * between sessions).
 */
export function isAttachmentFeatureEnabledFor(userId: string): boolean {
    if (!env.CHAT_ATTACHMENTS_ENABLED || !env.CHAT_ATTACHMENTS_BUCKET) return false;
    if (env.CHAT_ATTACHMENTS_ALLOWLIST.includes(String(userId))) return true;
    const bucket = createHash("sha256").update(String(userId)).digest().readUInt32BE(0) % 100;
    return bucket < env.CHAT_ATTACHMENTS_ROLLOUT_PERCENT;
}

export const chatAttachmentService = new ChatAttachmentService();
export default ChatAttachmentService;
