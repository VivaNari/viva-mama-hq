import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import env from "../../../../config/env";
import { messages } from "../../../../constants/messages";
import { isEntitlementDenied, sendDenial } from "../../../../middlewares/entitlement.middleware";
import { sendAttachmentError } from "../../../../middlewares/upload.middleware";
import UserModel from "../../../../models/user.model";
import { ECapability } from "../../../../services/entitlements/entitlement.config";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import {
    healthRecordService,
    isHealthRecordsEnabled,
} from "../../../../services/health-records/health-record.service";
import { healthSummaryService } from "../../../../services/health-records/health-summary.service";
import {
    ACCEPTED_ATTACHMENT_MIME_TYPES,
    AttachmentError,
} from "../../../../types/chat-attachment.types";
import { AuthenticatedRequest } from "../../../../types/chat.types";
import { EHealthRecordError, HealthRecordError } from "../../../../types/health-record.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import {
    healthRecordFileFieldsValidator,
    listHealthRecordsQueryValidator,
} from "../../validators/health-records/health-record.validator";

/** Map a service error to its response; anything else goes to the error handler. */
const handle = (err: unknown, res: Response, next: NextFunction, userId?: string) => {
    if (err instanceof HealthRecordError) return sendAttachmentError(res, err.status, err.code);
    // Page validation (size, type, PDF checks) shares the chat attachment codes.
    if (err instanceof AttachmentError) return sendAttachmentError(res, err.status, err.code);
    if (isEntitlementDenied(err)) return sendDenial(err, res, userId);
    return next(err);
};

const userIdOf = (request: Request): string => String((request as AuthenticatedRequest).user._id);

/** The app sends its UI locale ("en", "hi", "hi-IN"); everything else reads as English. */
const toLang = (lang: unknown, fallback?: unknown): "en" | "hi" =>
    String(lang || fallback || "")
        .toLowerCase()
        .startsWith("hi")
        ? "hi"
        : "en";

const hasCurrentConsent = (consent: { version?: string | null } | null | undefined): boolean =>
    consent?.version === env.HEALTH_RECORDS_CONSENT_VERSION;

const ok = (response: Response, data: unknown, message: string, statusCode = StatusCodes.OK) =>
    sendResponse({ data, message, success: true, statusCode, response });

class HealthRecordController {
    /** What the app needs to show (or hide) the records screens and check files locally. */
    getConfig = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const enabled = isHealthRecordsEnabled();
            const [user, uploads, summaries] = await Promise.all([
                UserModel.findById(userId).select("health_records_consent").lean(),
                entitlementService.peekQuota(userId, ECapability.RECORDS_UPLOAD),
                entitlementService.peekQuota(userId, ECapability.HEALTH_SUMMARY),
            ]);
            return ok(
                response,
                {
                    enabled,
                    maxFiles: env.HEALTH_RECORD_MAX_FILES,
                    maxBytes: env.HEALTH_RECORD_MAX_BYTES,
                    maxPdfPages: env.HEALTH_RECORD_MAX_PDF_PAGES,
                    acceptedMimeTypes: ACCEPTED_ATTACHMENT_MIME_TYPES,
                    consentVersion: env.HEALTH_RECORDS_CONSENT_VERSION,
                    consentAccepted: hasCurrentConsent(user?.health_records_consent),
                    quota: { uploads, summaries },
                },
                messages.HEALTH_RECORDS_CONFIG_SUCCESS,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    acceptConsent = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            if (request.body.consentVersion !== env.HEALTH_RECORDS_CONSENT_VERSION) {
                // She agreed to text we no longer show: ask again rather than record it.
                return sendAttachmentError(response, 409, EHealthRecordError.CONSENT_REQUIRED);
            }
            await UserModel.updateOne(
                { _id: userId },
                {
                    $set: {
                        health_records_consent: {
                            version: env.HEALTH_RECORDS_CONSENT_VERSION,
                            acceptedAt: new Date(),
                        },
                    },
                },
            );
            return ok(
                response,
                { consentVersion: env.HEALTH_RECORDS_CONSENT_VERSION },
                messages.HEALTH_RECORDS_CONSENT_SAVED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    create = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const { record, created } = await healthRecordService.createDraft(userId, request.body);
            return ok(
                response,
                { record: await healthRecordService.toView(record) },
                messages.HEALTH_RECORD_CREATED,
                created ? StatusCodes.CREATED : StatusCodes.OK,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    addFile = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const { error, value } = healthRecordFileFieldsValidator.validate(request.body ?? {});
            if (error || !request.file) {
                return sendAttachmentError(response, 400, "ATTACHMENT_MISSING");
            }
            const { file, created } = await healthRecordService.addFile(
                userId,
                String(request.params.id),
                request.file,
                value.clientUploadId,
            );
            const preview =
                file.kind === "IMAGE"
                    ? await healthRecordService
                          .fileUrl(userId, String(request.params.id), file.clientUploadId)
                          .catch(() => null)
                    : null;
            return ok(
                response,
                {
                    file: {
                        id: file.clientUploadId,
                        kind: file.kind,
                        mimeType: file.mimeType,
                        sizeBytes: file.sizeBytes,
                        width: file.width,
                        height: file.height,
                        pageCount: file.pageCount,
                        originalName: file.originalName,
                    },
                    previewUrl: preview?.url ?? null,
                },
                messages.HEALTH_RECORD_FILE_ADDED,
                created ? StatusCodes.CREATED : StatusCodes.OK,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    removeFile = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const record = await healthRecordService.removeFile(
                userId,
                String(request.params.id),
                String(request.params.fileId),
            );
            return ok(
                response,
                { record: await healthRecordService.toView(record) },
                messages.HEALTH_RECORD_FILE_REMOVED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    submit = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const user = await UserModel.findById(userId)
                .select("health_records_consent preferred_language")
                .lean();
            if (!hasCurrentConsent(user?.health_records_consent)) {
                return sendAttachmentError(response, 403, EHealthRecordError.CONSENT_REQUIRED);
            }
            const { record, quota } = await healthRecordService.submit(
                userId,
                String(request.params.id),
                toLang(request.body?.lang ?? request.query.lang, user?.preferred_language),
            );
            return ok(
                response,
                { record: await healthRecordService.toView(record), quota },
                messages.HEALTH_RECORD_SUBMITTED,
                StatusCodes.ACCEPTED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    retry = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const { record, quota } = await healthRecordService.retry(
                userId,
                String(request.params.id),
            );
            return ok(
                response,
                { record: await healthRecordService.toView(record), quota },
                messages.HEALTH_RECORD_SUBMITTED,
                StatusCodes.ACCEPTED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    list = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const { error, value } = listHealthRecordsQueryValidator.validate(request.query ?? {});
            if (error) return sendAttachmentError(response, 400, "INVALID_QUERY");
            const [page, readyRecords] = await Promise.all([
                healthRecordService.list(userId, value),
                healthRecordService.readyCount(userId),
            ]);
            return ok(response, { ...page, readyRecords }, messages.HEALTH_RECORDS_FETCHED);
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    get = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const record = await healthRecordService.getOwned(userId, String(request.params.id));
            return ok(
                response,
                { record: await healthRecordService.toView(record) },
                messages.HEALTH_RECORD_FETCHED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    update = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const record = await healthRecordService.update(
                userId,
                String(request.params.id),
                request.body,
            );
            return ok(
                response,
                { record: await healthRecordService.toView(record) },
                messages.HEALTH_RECORD_UPDATED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    remove = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            await healthRecordService.delete(userId, String(request.params.id));
            return ok(response, { deleted: 1 }, messages.HEALTH_RECORD_DELETED);
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    removeMany = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const deleted = await healthRecordService.deleteMany(userId, request.body.ids);
            return ok(response, { deleted }, messages.HEALTH_RECORD_DELETED);
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    fileUrl = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const link = await healthRecordService.fileUrl(
                userId,
                String(request.params.id),
                String(request.params.fileId),
            );
            return ok(response, link, messages.HEALTH_RECORD_URL_SUCCESS);
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    // ── Overall health summary ─────────────────────────────────────────────────

    generateSummary = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const user = await UserModel.findById(userId).select("preferred_language").lean();
            const { summary, quota } = await healthSummaryService.generate(
                userId,
                toLang(request.body?.lang ?? request.query.lang, user?.preferred_language),
            );
            return ok(
                response,
                { summary, quota },
                messages.HEALTH_SUMMARY_STARTED,
                StatusCodes.ACCEPTED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    latestSummary = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            return ok(
                response,
                await healthSummaryService.latest(userId),
                messages.HEALTH_SUMMARY_FETCHED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    summaryHistory = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            const limit = Number(request.query.limit);
            return ok(
                response,
                await healthSummaryService.history(userId, {
                    before: (request.query.before as string) || null,
                    ...(limit ? { limit } : {}),
                }),
                messages.HEALTH_SUMMARY_FETCHED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    getSummary = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            return ok(
                response,
                { summary: await healthSummaryService.get(userId, String(request.params.id)) },
                messages.HEALTH_SUMMARY_FETCHED,
            );
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };

    deleteSummary = async (request: Request, response: Response, next: NextFunction) => {
        const userId = userIdOf(request);
        try {
            await healthSummaryService.delete(userId, String(request.params.id));
            return ok(response, { deleted: 1 }, messages.HEALTH_SUMMARY_DELETED);
        } catch (err) {
            return handle(err, response, next, userId);
        }
    };
}

/** 403 HEALTH_RECORDS_DISABLED while the feature is off. Config stays readable. */
export const requireHealthRecords = (request: Request, response: Response, next: NextFunction) => {
    if (!isHealthRecordsEnabled()) {
        return sendAttachmentError(response, 403, EHealthRecordError.FEATURE_DISABLED);
    }
    return next();
};

/** Pages are only accepted once she has agreed; checked before multer buffers a byte. */
export const requireHealthRecordsConsent = async (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    try {
        const user = await UserModel.findById(userIdOf(request))
            .select("health_records_consent")
            .lean();
        if (!hasCurrentConsent(user?.health_records_consent)) {
            return sendAttachmentError(response, 403, EHealthRecordError.CONSENT_REQUIRED);
        }
        return next();
    } catch (err) {
        return next(err);
    }
};

export default HealthRecordController;
