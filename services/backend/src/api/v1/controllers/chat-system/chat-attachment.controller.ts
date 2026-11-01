import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import env from "../../../../config/env";
import { messages } from "../../../../constants/messages";
import { sendAttachmentError } from "../../../../middlewares/upload.middleware";
import UserModel from "../../../../models/user.model";
import {
    chatAttachmentService,
    isAttachmentFeatureEnabledFor,
} from "../../../../services/chat-system/chat-attachment.service";
import {
    ACCEPTED_ATTACHMENT_MIME_TYPES,
    AttachmentError,
    EAttachmentError,
} from "../../../../types/chat-attachment.types";
import { AuthenticatedRequest } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { attachmentUploadFieldsValidator } from "../../validators/chat-attachments/chat-attachment.validator";

/** Map a service error to its response; anything else goes to the error handler. */
const handle = (err: unknown, res: Response, next: NextFunction) => {
    if (err instanceof AttachmentError) return sendAttachmentError(res, err.status, err.code);
    return next(err);
};

const hasCurrentConsent = (consent: { version?: string | null } | null | undefined): boolean =>
    consent?.version === env.CHAT_ATTACHMENT_CONSENT_VERSION;

class ChatAttachmentController {
    /** What the app needs to show (or hide) the attach button and check files locally. */
    getConfig = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            const enabled = isAttachmentFeatureEnabledFor(userId);
            const [user, uploadsToday] = await Promise.all([
                UserModel.findById(userId).select("chat_attachment_consent").lean(),
                enabled ? chatAttachmentService.uploadsToday(userId) : Promise.resolve(0),
            ]);
            return sendResponse({
                data: {
                    enabled,
                    maxBytes: env.CHAT_ATTACHMENT_MAX_BYTES,
                    maxPdfPages: env.CHAT_ATTACHMENT_MAX_PDF_PAGES,
                    maxPerTurn: env.CHAT_ATTACHMENT_MAX_PER_TURN,
                    acceptedMimeTypes: ACCEPTED_ATTACHMENT_MIME_TYPES,
                    dailyLimit: env.CHAT_ATTACHMENT_DAILY_LIMIT,
                    remainingToday: Math.max(0, env.CHAT_ATTACHMENT_DAILY_LIMIT - uploadsToday),
                    retentionDays: env.CHAT_ATTACHMENT_RETENTION_DAYS,
                    consentVersion: env.CHAT_ATTACHMENT_CONSENT_VERSION,
                    consentAccepted: hasCurrentConsent(user?.chat_attachment_consent),
                },
                message: messages.ATTACHMENT_CONFIG_SUCCESS,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err) {
            return handle(err, response, next);
        }
    };

    acceptConsent = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            if (request.body.consentVersion !== env.CHAT_ATTACHMENT_CONSENT_VERSION) {
                // She agreed to text we no longer show: ask again rather than record it.
                return sendAttachmentError(response, 409, EAttachmentError.CONSENT_REQUIRED);
            }
            await UserModel.updateOne(
                { _id: userId },
                {
                    $set: {
                        chat_attachment_consent: {
                            version: env.CHAT_ATTACHMENT_CONSENT_VERSION,
                            acceptedAt: new Date(),
                        },
                    },
                },
            );
            return sendResponse({
                data: { consentVersion: env.CHAT_ATTACHMENT_CONSENT_VERSION },
                message: messages.ATTACHMENT_CONSENT_SAVED,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err) {
            return handle(err, response, next);
        }
    };

    upload = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            const { error, value } = attachmentUploadFieldsValidator.validate(request.body ?? {});
            if (error) return sendAttachmentError(response, 400, EAttachmentError.MISSING);
            if (!request.file) return sendAttachmentError(response, 400, EAttachmentError.MISSING);

            const user = await UserModel.findById(userId).select("chat_attachment_consent").lean();
            if (!hasCurrentConsent(user?.chat_attachment_consent)) {
                return sendAttachmentError(response, 403, EAttachmentError.CONSENT_REQUIRED);
            }

            const { attachment, created } = await chatAttachmentService.upload(
                userId,
                request.file,
                value.clientUploadId,
            );
            return sendResponse({
                data: { attachment: await chatAttachmentService.toView(attachment) },
                message: messages.ATTACHMENT_UPLOADED,
                success: true,
                statusCode: created ? StatusCodes.CREATED : StatusCodes.OK,
                response,
            });
        } catch (err) {
            return handle(err, response, next);
        }
    };

    /** A fresh short-lived link, for the viewer and when a thumbnail's link has lapsed. */
    getUrl = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            const attachment = await chatAttachmentService.getOwned(
                userId,
                String(request.params.id),
            );
            const { url, expiresAt } = await chatAttachmentService.signedReadUrl(attachment);
            return sendResponse({
                data: { url, expiresAt },
                message: messages.ATTACHMENT_URL_SUCCESS,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err) {
            return handle(err, response, next);
        }
    };

    /** She removed it from the tray, or chose "Delete file" on a sent one. */
    remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            const attachment = await chatAttachmentService.getOwned(
                userId,
                String(request.params.id),
            );
            await chatAttachmentService.deleteObject(attachment);
            return sendResponse({
                data: null,
                message: messages.ATTACHMENT_DELETED,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err) {
            return handle(err, response, next);
        }
    };
}

/** 403 FEATURE_DISABLED for users outside the rollout. Config stays readable for everyone. */
export const requireAttachmentFeature = (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    const userId = (request as AuthenticatedRequest).user?._id;
    if (!userId || !isAttachmentFeatureEnabledFor(userId)) {
        return sendAttachmentError(response, 403, EAttachmentError.FEATURE_DISABLED);
    }
    return next();
};

export default ChatAttachmentController;
