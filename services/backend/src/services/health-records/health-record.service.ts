import { randomUUID } from "crypto";
import { Types } from "mongoose";

import env from "../../config/env";
import { getStorage } from "../../config/gcs.config";
import healthRecordModel from "../../models/health-record.model";
import pendingGcsPurgeModel from "../../models/pending-gcs-purge.model";
import UserModel from "../../models/user.model";
import { AttachmentTypeEnum } from "../../types/chat.types";
import {
    EHealthRecordError,
    EHealthRecordStatus,
    EHealthRecordCategory,
    ERecordSubject,
    EScanType,
    HealthRecordError,
    IHealthRecord,
    IHealthRecordFile,
} from "../../types/health-record.types";
import { EChildOnboardingStatus, IChild } from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";
import { processAttachment } from "../chat-system/attachment-processing.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";
import { getISTCalendarDate } from "../date/date.service";
import { ECapability } from "../entitlements/entitlement.config";
import { entitlementService } from "../entitlements/entitlement.service";
import LLMService, { TRecordAnalyzeResult } from "../llm/llm.service";

const log = createModuleLogger(logger, "health-records");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** A refused record stays listed this long, so she sees why it was not added. */
const REJECTED_KEPT_DAYS = 7;
const SIGNED_URL_TTL_SEC = 900;
const LIST_PAGE = 20;

export type TSubjectInput = { type: ERecordSubject; childId?: string | null };

export type TRecordListItem = {
    id: string;
    category: EHealthRecordCategory;
    scanType: EScanType | null;
    subject: { type: ERecordSubject; childId: string | null; childName: string | null };
    title: string | null;
    status: EHealthRecordStatus;
    severity: "NONE" | "MEDIUM" | "HIGH" | null;
    recordDate: string;
    kind: string | null;
    fileCount: number;
    pageCount: number | null;
    thumbnailUrl: string | null;
    reasonCode: string | null;
    message: string | null;
    createdAt: Date;
};

export type TRecordView = TRecordListItem & {
    files: {
        id: string;
        kind: string;
        mimeType: string;
        sizeBytes: number;
        width: number | null;
        height: number | null;
        pageCount: number | null;
        originalName: string | null;
    }[];
    summary: {
        markdown: string;
        severity: "NONE" | "MEDIUM" | "HIGH";
        criticalMatches: string[];
        lang: string;
        generatedAt: Date;
    } | null;
};

const prefixFor = (userId: string, recordId?: string): string =>
    recordId ? `records/${userId}/${recordId}/` : `records/${userId}/`;

/** 'YYYY-MM-DD' of a stored record date (a UTC-midnight marker of an IST day). */
export const recordDayKey = (d: Date): string => d.toISOString().slice(0, 10);

const sanitizeName = (name: string | undefined): string | null => {
    if (!name) return null;
    const base = name.split(/[\\/]/).pop() ?? "";
    const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return clean ? clean.slice(0, 80) : null;
};

/** "6 weeks old", for the chatbot's reading of a baby's record. */
export const childAgeText = (
    dob: Date | null | undefined,
    now: Date = new Date(),
): string | null => {
    if (!dob) return null;
    const days = Math.floor(
        (getISTCalendarDate(now).getTime() - getISTCalendarDate(new Date(dob)).getTime()) /
            MS_PER_DAY,
    );
    if (days < 0) return null;
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} old`;
    if (days < 84) {
        const weeks = Math.floor(days / 7);
        return `${weeks} week${weeks === 1 ? "" : "s"} old`;
    }
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} old`;
};

const encodeCursor = (r: Pick<IHealthRecord, "recordDate" | "_id">): string =>
    Buffer.from(`${r.recordDate.toISOString()}_${String(r._id)}`).toString("base64url");

const decodeCursor = (cursor: string): { date: Date; id: Types.ObjectId } | null => {
    try {
        const [iso = "", id = ""] = Buffer.from(cursor, "base64url").toString("utf8").split("_");
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()) || !Types.ObjectId.isValid(id)) return null;
        return { date, id: new Types.ObjectId(id) };
    } catch {
        return null;
    }
};

class HealthRecordService {
    private llm = new LLMService();

    private bucketName(): string {
        if (!env.HEALTH_RECORDS_BUCKET) {
            throw new HealthRecordError(EHealthRecordError.STORAGE_UNAVAILABLE, 503);
        }
        return env.HEALTH_RECORDS_BUCKET;
    }

    private async childrenOf(userId: string): Promise<IChild[]> {
        const user = await UserModel.findById(userId).select("childs").lean();
        return ((user?.childs ?? []) as IChild[]).filter(
            (c) => c.onboarding_status !== EChildOnboardingStatus.DRAFT,
        );
    }

    private async assertSubject(userId: string, subject: TSubjectInput): Promise<void> {
        if (subject.type !== ERecordSubject.CHILD) return;
        try {
            const child = await getOwnedChild(userId, String(subject.childId ?? ""));
            if (child.onboarding_status === EChildOnboardingStatus.DRAFT) {
                throw new ChildNotFoundError();
            }
        } catch (err) {
            if (err instanceof ChildNotFoundError) {
                throw new HealthRecordError(EHealthRecordError.INVALID_CHILD, 422);
            }
            throw err;
        }
    }

    /** Hers and not deleted, or 404. Never 403: that would confirm the id exists. */
    async getOwned(userId: string, id: string): Promise<IHealthRecord> {
        if (!Types.ObjectId.isValid(id)) {
            throw new HealthRecordError(EHealthRecordError.NOT_FOUND, 404);
        }
        const record = await healthRecordModel.findOne({ _id: id, userId, deletedAt: null });
        if (!record) throw new HealthRecordError(EHealthRecordError.NOT_FOUND, 404);
        return record;
    }

    /** A record she is adding. Idempotent on clientUploadId: a retried create returns it. */
    async createDraft(
        userId: string,
        input: {
            clientUploadId: string;
            category: EHealthRecordCategory;
            scanType?: EScanType | null;
            subject: TSubjectInput;
        },
    ): Promise<{ record: IHealthRecord; created: boolean }> {
        const existing = await healthRecordModel.findOne({
            userId,
            clientUploadId: input.clientUploadId,
            deletedAt: null,
        });
        if (existing) return { record: existing, created: false };

        await this.assertSubject(userId, input.subject);
        try {
            const record = await healthRecordModel.create({
                userId,
                clientUploadId: input.clientUploadId,
                category: input.category,
                scanType:
                    input.category === EHealthRecordCategory.SCAN ? (input.scanType ?? null) : null,
                subject: {
                    type: input.subject.type,
                    childId:
                        input.subject.type === ERecordSubject.CHILD ? input.subject.childId : null,
                },
                bucket: this.bucketName(),
                status: EHealthRecordStatus.DRAFT,
                recordDate: getISTCalendarDate(),
            });
            return { record, created: true };
        } catch (err: any) {
            if (err?.code === 11000) {
                const winner = await healthRecordModel.findOne({
                    userId,
                    clientUploadId: input.clientUploadId,
                });
                if (winner && !winner.deletedAt) return { record: winner, created: false };
                throw new HealthRecordError(EHealthRecordError.NOT_FOUND, 404);
            }
            throw err;
        }
    }

    /**
     * Validate, clean and store one page of a draft. Pages upload in parallel, so the
     * page is added with one conditional push that also enforces the limits: at most
     * HEALTH_RECORD_MAX_FILES photos, or a single PDF on its own.
     */
    async addFile(
        userId: string,
        recordId: string,
        file: { buffer: Buffer; originalname?: string },
        clientUploadId: string,
    ): Promise<{ record: IHealthRecord; file: IHealthRecordFile; created: boolean }> {
        const record = await this.getOwned(userId, recordId);
        const already = record.files.find((f) => f.clientUploadId === clientUploadId);
        if (already) return { record, file: already, created: false };
        if (record.status !== EHealthRecordStatus.DRAFT) {
            throw new HealthRecordError(EHealthRecordError.NOT_DRAFT, 409);
        }
        if (record.files.length >= env.HEALTH_RECORD_MAX_FILES) {
            throw new HealthRecordError(EHealthRecordError.TOO_MANY_FILES, 400);
        }
        if (record.files.some((f) => f.kind === AttachmentTypeEnum.PDF)) {
            throw new HealthRecordError(EHealthRecordError.MIXED_KINDS, 400);
        }

        const processed = await processAttachment(file.buffer, {
            maxBytes: env.HEALTH_RECORD_MAX_BYTES,
            maxPdfPages: env.HEALTH_RECORD_MAX_PDF_PAGES,
        });
        const isPdf = processed.kind === AttachmentTypeEnum.PDF;
        if (isPdf && record.files.length > 0) {
            throw new HealthRecordError(EHealthRecordError.MIXED_KINDS, 400);
        }

        const objectName = `${prefixFor(userId, recordId)}${randomUUID()}.${processed.extension}`;
        const gcsFile = getStorage().bucket(record.bucket).file(objectName);
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
            log.error({ err, userId, recordId }, "Record page upload to storage failed");
            throw new HealthRecordError(EHealthRecordError.STORAGE_UNAVAILABLE, 503);
        }

        const entry: IHealthRecordFile = {
            clientUploadId,
            objectName,
            kind: processed.kind,
            mimeType: processed.mimeType,
            sizeBytes: processed.buffer.length,
            sha256: processed.sha256,
            width: processed.width,
            height: processed.height,
            pageCount: processed.pageCount,
            originalName: isPdf ? sanitizeName(file.originalname) : null,
        };
        const updated = await healthRecordModel.findOneAndUpdate(
            {
                _id: recordId,
                userId,
                deletedAt: null,
                status: EHealthRecordStatus.DRAFT,
                "files.clientUploadId": { $ne: clientUploadId },
                [`files.${env.HEALTH_RECORD_MAX_FILES - 1}`]: { $exists: false },
                ...(isPdf
                    ? { "files.0": { $exists: false } }
                    : { "files.kind": { $ne: AttachmentTypeEnum.PDF } }),
            },
            { $push: { files: entry } },
            { new: true },
        );
        if (updated) return { record: updated, file: entry, created: true };

        // Lost a race (a duplicate retry, another page filled the last slot, or it was
        // submitted meanwhile): keep what is there, drop the object we just wrote.
        await gcsFile.delete({ ignoreNotFound: true }).catch(() => undefined);
        const current = await this.getOwned(userId, recordId);
        const winner = current.files.find((f) => f.clientUploadId === clientUploadId);
        if (winner) return { record: current, file: winner, created: false };
        if (current.status !== EHealthRecordStatus.DRAFT) {
            throw new HealthRecordError(EHealthRecordError.NOT_DRAFT, 409);
        }
        if (current.files.length >= env.HEALTH_RECORD_MAX_FILES) {
            throw new HealthRecordError(EHealthRecordError.TOO_MANY_FILES, 400);
        }
        throw new HealthRecordError(EHealthRecordError.MIXED_KINDS, 400);
    }

    /** Take one page off a draft. Once submitted, the pages and summary go together. */
    async removeFile(userId: string, recordId: string, fileId: string): Promise<IHealthRecord> {
        const record = await this.getOwned(userId, recordId);
        if (record.status !== EHealthRecordStatus.DRAFT) {
            throw new HealthRecordError(EHealthRecordError.NOT_DRAFT, 409);
        }
        const file = record.files.find((f) => f.clientUploadId === fileId);
        if (!file) return record;
        const updated = await healthRecordModel.findOneAndUpdate(
            { _id: recordId, userId, status: EHealthRecordStatus.DRAFT },
            { $pull: { files: { clientUploadId: fileId } } },
            { new: true },
        );
        await getStorage()
            .bucket(record.bucket)
            .file(file.objectName)
            .delete({ ignoreNotFound: true })
            .catch((err) => log.error({ err, recordId }, "Deleting a draft page failed"));
        return updated ?? record;
    }

    /**
     * Spend one record and start reading it. Idempotent: submitting a record that is
     * already being read or was read returns it as it is, without spending again.
     */
    async submit(
        userId: string,
        recordId: string,
        lang: "en" | "hi",
    ): Promise<{
        record: IHealthRecord;
        quota: Awaited<ReturnType<typeof entitlementService.peekQuota>>;
    }> {
        const record = await this.getOwned(userId, recordId);
        if (record.status !== EHealthRecordStatus.DRAFT) {
            if (
                record.status === EHealthRecordStatus.PROCESSING ||
                record.status === EHealthRecordStatus.READY
            ) {
                return {
                    record,
                    quota: await entitlementService.peekQuota(userId, ECapability.RECORDS_UPLOAD),
                };
            }
            throw new HealthRecordError(EHealthRecordError.NOT_DRAFT, 409);
        }
        if (record.files.length === 0) {
            throw new HealthRecordError(EHealthRecordError.NO_FILES, 400);
        }

        const quota = await entitlementService.consumeCapability(
            userId,
            ECapability.RECORDS_UPLOAD,
        );
        const started = await healthRecordModel.findOneAndUpdate(
            { _id: recordId, userId, deletedAt: null, status: EHealthRecordStatus.DRAFT },
            {
                $set: {
                    status: EHealthRecordStatus.PROCESSING,
                    submittedAt: new Date(),
                    // Filed under the day she saves it, never a date printed on it: an
                    // MCH card carries many visit dates, and handwriting gets misread.
                    recordDate: getISTCalendarDate(),
                    lang,
                    quotaRefunded: false,
                    message: null,
                    verdict: null,
                },
                $inc: { attempts: 1 },
            },
            { new: true },
        );
        if (!started) {
            // A double tap got here first; give this unit back.
            await entitlementService.refundQuota(userId, ECapability.RECORDS_UPLOAD);
            return {
                record: await this.getOwned(userId, recordId),
                quota: await entitlementService.peekQuota(userId, ECapability.RECORDS_UPLOAD),
            };
        }
        this.startAnalysis(started);
        return { record: started, quota };
    }

    /** Read a FAILED record again. Spends a new unit, since the first was refunded. */
    async retry(
        userId: string,
        recordId: string,
    ): Promise<{
        record: IHealthRecord;
        quota: Awaited<ReturnType<typeof entitlementService.peekQuota>>;
    }> {
        const record = await this.getOwned(userId, recordId);
        if (record.status !== EHealthRecordStatus.FAILED || record.files.length === 0) {
            throw new HealthRecordError(EHealthRecordError.NOT_RETRYABLE, 409);
        }
        const quota = await entitlementService.consumeCapability(
            userId,
            ECapability.RECORDS_UPLOAD,
        );
        const started = await healthRecordModel.findOneAndUpdate(
            { _id: recordId, userId, deletedAt: null, status: EHealthRecordStatus.FAILED },
            {
                $set: {
                    status: EHealthRecordStatus.PROCESSING,
                    submittedAt: new Date(),
                    quotaRefunded: false,
                    message: null,
                    verdict: null,
                },
                $inc: { attempts: 1 },
            },
            { new: true },
        );
        if (!started) {
            await entitlementService.refundQuota(userId, ECapability.RECORDS_UPLOAD);
            throw new HealthRecordError(EHealthRecordError.NOT_RETRYABLE, 409);
        }
        this.startAnalysis(started);
        return { record: started, quota };
    }

    /** Fire and forget: the app polls GET /:id. Any failure ends in FAILED + a refund. */
    private startAnalysis(record: IHealthRecord): void {
        this.runAnalysis(record).catch(async (err) => {
            log.error(
                { err: { message: (err as Error)?.message }, recordId: String(record._id) },
                "Record analysis failed",
            );
            await this.markFailed(record, "CHATBOT_UNAVAILABLE").catch(() => undefined);
        });
    }

    async runAnalysis(record: IHealthRecord): Promise<void> {
        const userId = String(record.userId);
        const subject: {
            type: "mother" | "child";
            child_name?: string | null;
            child_age_text?: string | null;
        } = { type: "mother" };
        if (record.subject.type === ERecordSubject.CHILD && record.subject.childId) {
            const child = await getOwnedChild(userId, String(record.subject.childId)).catch(
                () => null,
            );
            subject.type = "child";
            subject.child_name = child?.name?.slice(0, 80) ?? null;
            subject.child_age_text = childAgeText(child?.date_of_birth);
        }
        const result = await this.llm.analyzeRecord({
            user_id: userId,
            record_id: String(record._id),
            category: record.category,
            scan_type: record.scanType,
            subject,
            files: record.files.map((f) => ({
                attachment_id: f.clientUploadId,
                uri: `gs://${record.bucket}/${f.objectName}`,
                mime_type: f.mimeType,
                kind: f.kind === AttachmentTypeEnum.PDF ? "pdf" : "image",
                ...(f.pageCount ? { page_count: Math.min(f.pageCount, 20) } : {}),
            })),
            lang: record.lang,
        });
        await this.applyResult(record, result);
    }

    /**
     * Store what the chatbot said. A record deleted while it was being read is left
     * deleted: the update only matches a live PROCESSING record.
     */
    async applyResult(record: IHealthRecord, result: TRecordAnalyzeResult): Promise<void> {
        const live = { _id: record._id, status: EHealthRecordStatus.PROCESSING, deletedAt: null };
        const verdict = {
            code: result.verdict,
            reasonCode: result.reason_code,
            documentType: result.document_type ?? null,
        };

        if (result.verdict === "ANALYZED") {
            await healthRecordModel.updateOne(live, {
                $set: {
                    status: EHealthRecordStatus.READY,
                    verdict,
                    message: null,
                    title: result.title?.slice(0, 200) ?? null,
                    summary: {
                        markdown: result.summary_markdown ?? "",
                        analysis: result.analysis ?? null,
                        digest: (result.digest ?? "").slice(0, 3000),
                        severity: result.severity ?? "NONE",
                        criticalMatches: result.critical_matches ?? [],
                        lang: record.lang,
                        generatedAt: new Date(),
                    },
                },
            });
            return;
        }

        if (result.verdict === "ERROR") {
            await this.markFailed(record, result.reason_code, result.message ?? null);
            return;
        }

        // Refused: not a health record of hers or her baby's. Nothing about it is kept
        // but the reason; the files go now and the record in a week.
        const updated = await healthRecordModel.findOneAndUpdate(
            live,
            {
                $set: {
                    status: EHealthRecordStatus.REJECTED,
                    verdict,
                    message: result.message ?? null,
                    files: [],
                    purgeAt: new Date(Date.now() + REJECTED_KEPT_DAYS * MS_PER_DAY),
                },
            },
            { new: true },
        );
        if (!updated) return;
        await this.purgeObjects(String(record.userId), String(record._id), record.bucket);
        await this.refundOnce(record);
    }

    async markFailed(record: IHealthRecord, reasonCode: string, message: string | null = null) {
        const updated = await healthRecordModel.findOneAndUpdate(
            { _id: record._id, status: EHealthRecordStatus.PROCESSING, deletedAt: null },
            {
                $set: {
                    status: EHealthRecordStatus.FAILED,
                    verdict: { code: "ERROR", reasonCode, documentType: null },
                    message,
                },
            },
            { new: true },
        );
        if (updated) await this.refundOnce(record);
    }

    /** At most one refund per submission, however many paths reach here. */
    private async refundOnce(record: IHealthRecord): Promise<void> {
        const claimed = await healthRecordModel.findOneAndUpdate(
            { _id: record._id, quotaRefunded: false },
            { $set: { quotaRefunded: true } },
        );
        if (!claimed) return;
        await entitlementService
            .refundQuota(String(record.userId), ECapability.RECORDS_UPLOAD)
            .catch((err) => log.error({ err, recordId: String(record._id) }, "Refund failed"));
    }

    // ── Reads ──────────────────────────────────────────────────────────────────

    private async signFile(
        bucket: string,
        file: IHealthRecordFile,
    ): Promise<{ url: string; expiresAt: Date }> {
        const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000);
        try {
            const [url] = await getStorage().bucket(bucket).file(file.objectName).getSignedUrl({
                version: "v4",
                action: "read",
                expires: expiresAt,
                responseType: file.mimeType,
                responseDisposition: "inline",
            });
            return { url, expiresAt };
        } catch (err) {
            log.error({ err }, "Signing record file URL failed");
            throw new HealthRecordError(EHealthRecordError.STORAGE_UNAVAILABLE, 503);
        }
    }

    private async toListItem(record: IHealthRecord, children: IChild[]): Promise<TRecordListItem> {
        const first = record.files[0];
        const childId = record.subject.childId ? String(record.subject.childId) : null;
        const child = childId ? children.find((c) => String(c._id) === childId) : undefined;
        let thumbnailUrl: string | null = null;
        if (first && first.kind === AttachmentTypeEnum.IMAGE) {
            thumbnailUrl =
                (await this.signFile(record.bucket, first).catch(() => null))?.url ?? null;
        }
        return {
            id: String(record._id),
            category: record.category,
            scanType: record.scanType ?? null,
            subject: { type: record.subject.type, childId, childName: child?.name ?? null },
            title: record.title ?? null,
            status: record.status,
            severity: record.summary?.severity ?? null,
            recordDate: recordDayKey(record.recordDate),
            kind: first?.kind ?? null,
            fileCount: record.files.length,
            pageCount:
                first?.kind === AttachmentTypeEnum.PDF ? first.pageCount : record.files.length,
            thumbnailUrl,
            reasonCode: record.verdict?.reasonCode ?? null,
            message: record.message ?? null,
            createdAt: record.createdAt,
        };
    }

    async toView(record: IHealthRecord): Promise<TRecordView> {
        const children = await this.childrenOf(String(record.userId));
        const item = await this.toListItem(record, children);
        return {
            ...item,
            files: record.files.map((f) => ({
                id: f.clientUploadId,
                kind: f.kind,
                mimeType: f.mimeType,
                sizeBytes: f.sizeBytes,
                width: f.width,
                height: f.height,
                pageCount: f.pageCount,
                originalName: f.originalName,
            })),
            summary: record.summary
                ? {
                      markdown: record.summary.markdown,
                      severity: record.summary.severity,
                      criticalMatches: record.summary.criticalMatches ?? [],
                      lang: record.summary.lang,
                      generatedAt: record.summary.generatedAt,
                  }
                : null,
        };
    }

    /**
     * Her records, newest report first, grouped by day. Drafts are not shown; a
     * refused record is, for a week, so she knows why it was not added.
     */
    async list(
        userId: string,
        opts: {
            cursor?: string | null;
            limit?: number;
            subject?: ERecordSubject | null;
            childId?: string | null;
            category?: EHealthRecordCategory | null;
        } = {},
    ): Promise<{
        groups: { date: string; records: TRecordListItem[] }[];
        nextCursor: string | null;
    }> {
        const limit = Math.min(Math.max(opts.limit ?? LIST_PAGE, 1), 50);
        const filter: Record<string, any> = {
            userId,
            deletedAt: null,
            status: { $ne: EHealthRecordStatus.DRAFT },
        };
        if (opts.subject) filter["subject.type"] = opts.subject;
        if (opts.childId && Types.ObjectId.isValid(opts.childId)) {
            filter["subject.childId"] = new Types.ObjectId(opts.childId);
        }
        if (opts.category) filter.category = opts.category;
        const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
        if (cursor) {
            filter.$or = [
                { recordDate: { $lt: cursor.date } },
                { recordDate: cursor.date, _id: { $lt: cursor.id } },
            ];
        }

        const [rows, children] = await Promise.all([
            healthRecordModel
                .find(filter)
                .sort({ recordDate: -1, _id: -1 })
                .limit(limit + 1),
            this.childrenOf(userId),
        ]);
        const page = rows.slice(0, limit);
        const items = await Promise.all(page.map((r) => this.toListItem(r, children)));

        const groups: { date: string; records: TRecordListItem[] }[] = [];
        for (const item of items) {
            const last = groups[groups.length - 1];
            if (last && last.date === item.recordDate) last.records.push(item);
            else groups.push({ date: item.recordDate, records: [item] });
        }
        return {
            groups,
            nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!) : null,
        };
    }

    /** How many READY records she has, for the summary button. */
    async readyCount(userId: string): Promise<number> {
        return healthRecordModel.countDocuments({
            userId,
            deletedAt: null,
            status: EHealthRecordStatus.READY,
        });
    }

    async fileUrl(
        userId: string,
        recordId: string,
        fileId: string,
    ): Promise<{ url: string; expiresAt: Date }> {
        const record = await this.getOwned(userId, recordId);
        const file = record.files.find((f) => f.clientUploadId === fileId);
        if (!file) throw new HealthRecordError(EHealthRecordError.NOT_FOUND, 404);
        return this.signFile(record.bucket, file);
    }

    /** She corrects what it is, or who it is for. The summary is not re-read. */
    async update(
        userId: string,
        recordId: string,
        changes: {
            category?: EHealthRecordCategory;
            scanType?: EScanType | null;
            subject?: TSubjectInput;
        },
    ): Promise<IHealthRecord> {
        const record = await this.getOwned(userId, recordId);
        const $set: Record<string, unknown> = {};
        const category = changes.category ?? record.category;
        if (changes.category !== undefined) $set.category = changes.category;
        if (changes.category !== undefined || changes.scanType !== undefined) {
            $set.scanType =
                category === EHealthRecordCategory.SCAN
                    ? ((changes.scanType !== undefined ? changes.scanType : record.scanType) ??
                      null)
                    : null;
        }
        if (changes.subject) {
            await this.assertSubject(userId, changes.subject);
            $set.subject = {
                type: changes.subject.type,
                childId:
                    changes.subject.type === ERecordSubject.CHILD
                        ? new Types.ObjectId(String(changes.subject.childId))
                        : null,
            };
        }
        if (Object.keys($set).length === 0) return record;
        const updated = await healthRecordModel.findOneAndUpdate(
            { _id: recordId, userId, deletedAt: null },
            { $set },
            { new: true },
        );
        if (!updated) throw new HealthRecordError(EHealthRecordError.NOT_FOUND, 404);
        return updated;
    }

    // ── Deletion ───────────────────────────────────────────────────────────────

    /**
     * Delete records for good: hidden at once, then their files, then the document
     * (with its summary). If storage is down the prefix is queued for the janitor and
     * the record is still gone from her app. Deleting never gives quota back.
     */
    async deleteMany(userId: string, ids: string[]): Promise<number> {
        const valid = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
        if (valid.length === 0) return 0;
        const records = await healthRecordModel
            .find({ _id: { $in: valid }, userId, deletedAt: null })
            .select("_id bucket")
            .lean();
        if (records.length === 0) return 0;
        const recordIds = records.map((r) => r._id);
        await healthRecordModel.updateMany(
            { _id: { $in: recordIds }, userId },
            { $set: { deletedAt: new Date() } },
        );
        for (const r of records) {
            await this.purgeObjects(userId, String(r._id), r.bucket);
        }
        const { deletedCount } = await healthRecordModel.deleteMany({
            _id: { $in: recordIds },
            userId,
        });
        log.info({ userId, deleted: deletedCount }, "Health records deleted");
        return deletedCount ?? 0;
    }

    async delete(userId: string, recordId: string): Promise<void> {
        await this.getOwned(userId, recordId);
        await this.deleteMany(userId, [recordId]);
    }

    /** Delete a record's files, or queue the prefix if storage is unavailable. */
    async purgeObjects(userId: string, recordId: string, bucket: string): Promise<void> {
        const prefix = prefixFor(userId, recordId);
        try {
            await getStorage().bucket(bucket).deleteFiles({ prefix, force: true });
        } catch (err) {
            log.error({ err, recordId }, "Deleting record files failed; queued");
            await pendingGcsPurgeModel.create({
                bucket,
                prefix,
                attempts: 1,
                lastError: String((err as Error)?.message ?? err).slice(0, 300),
            });
        }
    }

    /** Every record file she ever stored, for account deletion. */
    async deleteAllForUser(userId: string): Promise<void> {
        if (!env.HEALTH_RECORDS_BUCKET) return;
        await getStorage()
            .bucket(env.HEALTH_RECORDS_BUCKET)
            .deleteFiles({ prefix: prefixFor(userId), force: true });
    }

    async queuePurge(userId: string, error: unknown): Promise<void> {
        await pendingGcsPurgeModel.create({
            bucket: env.HEALTH_RECORDS_BUCKET,
            prefix: prefixFor(userId),
            attempts: 1,
            lastError: String((error as Error)?.message ?? error).slice(0, 300),
        });
    }
}

/** Whether health records are on: the env switch and a configured bucket. */
export function isHealthRecordsEnabled(): boolean {
    return env.HEALTH_RECORDS_ENABLED && !!env.HEALTH_RECORDS_BUCKET;
}

export const healthRecordService = new HealthRecordService();
export default HealthRecordService;
