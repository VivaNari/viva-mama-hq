import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import ChatFlowAIService from "../../../../services/chat-system/chat-flow-ai.service";
import ChatFlowService from "../../../../services/chat-system/chat-flow.service";
import { AuthenticatedRequest, FlowType, FlowTypeEnum } from "../../../../types/chat.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { ECapability } from "../../../../services/entitlements/entitlement.config";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import { isEntitlementDenied, sendDenial } from "../../../../middlewares/entitlement.middleware";
import { sendAttachmentError } from "../../../../middlewares/upload.middleware";
import messageModel from "../../../../models/message.model";
import {
    chatAttachmentService,
    isAttachmentFeatureEnabledFor,
} from "../../../../services/chat-system/chat-attachment.service";
import {
    AttachmentError,
    EAttachmentError,
    IChatAttachment,
} from "../../../../types/chat-attachment.types";
import logger, { createModuleLogger } from "../../../../utils/logger";
import { chatbotAnswerValidator } from "../../validators/chat-attachments/chat-attachment.validator";

const log = createModuleLogger(logger, "chat-flow-controller");

class ChatFlowController {
    private chatFlowService: ChatFlowService;
    private chatFlowAIService: ChatFlowAIService;

    constructor() {
        this.chatFlowService = new ChatFlowService();
        this.chatFlowAIService = new ChatFlowAIService();
    }

    handleSseConnection = (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const slug = req.params.slug as string;
            const userId = req.user._id;
            const { flowType, lang } = req.query;

            if (!userId || !slug) {
                return sendResponse({
                    data: null,
                    message: messages.USER_AND_SLUG_REQUIRED,
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            if (flowType === FlowTypeEnum.CHATBOT) {
                console.log("Chatbot flow connection");
                this.chatFlowAIService.handleChatbotSSEConnection(
                    userId,
                    slug,
                    flowType as FlowType,
                    response,
                );
                return;
            }

            this.chatFlowService.handleSseConnection(
                userId,
                slug,
                flowType as FlowType,
                response,
                lang as string | undefined,
            );
        } catch (err) {
            next(err);
        }
    };

    /**
     * The reply to one of her chatbot turns, for when the stream did not deliver it
     * (a dropped connection, the app backgrounded). 202 while it is being worked on.
     */
    getReply = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const userId = (request as AuthenticatedRequest).user._id;
            const clientMessageId = String(request.query.clientMessageId ?? "");
            if (!/^[0-9a-f-]{36}$/i.test(clientMessageId)) {
                return sendResponse({
                    data: null,
                    message: messages.CHAT_REPLY_NOT_FOUND,
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }
            const result = await this.chatFlowAIService.getReply(userId, clientMessageId);
            if (result.status === "not_found") {
                return sendResponse({
                    data: null,
                    message: messages.CHAT_REPLY_NOT_FOUND,
                    success: false,
                    statusCode: StatusCodes.NOT_FOUND,
                    response,
                });
            }
            if (result.status === "pending") {
                return sendResponse({
                    data: { status: "pending" },
                    message: messages.CHAT_REPLY_PENDING,
                    success: true,
                    statusCode: StatusCodes.ACCEPTED,
                    response,
                });
            }
            return sendResponse({
                data: { status: "ready", reply: result.payload },
                message: messages.CHAT_REPLY_FOUND,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    saveResponse = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;
            const {
                flowInstanceId,
                nodeId,
                selectedKeys,
                freeText,
                flowType,
                sessionId,
                conversationId,
                model,
                lang,
            } = req.body;

            if (flowType == FlowTypeEnum.CHATBOT) {
                const { error, value } = chatbotAnswerValidator.validate(req.body);
                const attachmentIds: string[] = value?.attachmentIds ?? [];
                const text = typeof value?.freeText === "string" ? value.freeText.trim() : "";
                if (error || (!text && attachmentIds.length === 0)) {
                    return sendResponse({
                        data: null,
                        message: "freeText or attachmentIds is required",
                        success: false,
                        statusCode: StatusCodes.BAD_REQUEST,
                        response,
                    });
                }
                if (attachmentIds.length && !isAttachmentFeatureEnabledFor(userId)) {
                    return sendAttachmentError(response, 403, EAttachmentError.FEATURE_DISABLED);
                }

                // A retried POST of a turn we already have: answer as if it were the
                // first, spend nothing, start nothing.
                const clientMessageId: string | null = value.clientMessageId ?? null;
                if (clientMessageId && (await messageModel.exists({ userId, clientMessageId }))) {
                    return sendResponse({
                        data: {
                            quota: await entitlementService.peekQuota(userId, ECapability.AI_CHAT),
                            duplicate: true,
                        },
                        message: messages.ANSWER_SAVED_SUCCESS,
                        success: true,
                        statusCode: StatusCodes.OK,
                        response,
                    });
                }

                // Her files are reserved before anything is spent, so a file that is
                // not hers, already sent or expired costs her nothing.
                let claimed: IChatAttachment[] = [];
                try {
                    claimed = await chatAttachmentService.claimForTurn(userId, attachmentIds);
                } catch (claimError) {
                    if (claimError instanceof AttachmentError) {
                        return sendAttachmentError(response, claimError.status, claimError.code);
                    }
                    throw claimError;
                }

                // Gated here rather than on the route: this endpoint also serves guided
                // check-in flows, which have their own entitlement and must not be
                // metered against the AI allowance.
                //
                // Spent on the USER's turn, not the assistant's reply — the reply is
                // produced asynchronously below, so counting it there would be both late
                // and unattributable.
                let quota;
                try {
                    quota = await entitlementService.consumeCapability(userId, ECapability.AI_CHAT);
                } catch (error) {
                    await chatAttachmentService.releaseClaim(claimed.map((c) => String(c._id)));
                    if (isEntitlementDenied(error)) return sendDenial(error, response);
                    throw error;
                }

                // Answered over SSE. Failures are handled inside (refund, ai_error),
                // so all that is left to do here is not leave the rejection unhandled.
                this.chatFlowAIService
                    .saveResponse(userId, text, sessionId, conversationId, model, {
                        clientMessageId,
                        attachments: claimed,
                        lang: value.lang ?? lang ?? (request.query.lang as string | undefined),
                    })
                    .catch((turnError) =>
                        log.warn({ err: turnError, userId }, "Chatbot turn ended in error"),
                    );
                return sendResponse({
                    // Returned so the app can render "2 of 3 questions left today"
                    // without a second round trip. `limit: null` means unlimited.
                    data: { quota },
                    message: messages.ANSWER_SAVED_SUCCESS,
                    success: true,
                    statusCode: StatusCodes.OK,
                    response,
                });
            }

            if (!flowInstanceId || !nodeId) {
                return sendResponse({
                    data: null,
                    message: "flowInstanceId and nodeId are required",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            if (!selectedKeys && !freeText) {
                return sendResponse({
                    data: null,
                    message: "Either selectedKeys (array) or freeText (string) must be provided",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            if (selectedKeys && !Array.isArray(selectedKeys)) {
                return sendResponse({
                    data: null,
                    message: "selectedKeys must be an array",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            if (freeText && (typeof freeText !== "string" || freeText.trim().length === 0)) {
                return sendResponse({
                    data: null,
                    message: "freeText must be a non-empty string",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            // Call service with both optional parameters
            const result = await this.chatFlowService.saveResponse(
                userId,
                flowInstanceId,
                nodeId,
                flowType,
                selectedKeys, // Can be undefined
                freeText, // Can be undefined
                // Prefer the body `lang`, else the query `lang` (added by the app's
                // axios interceptor); resolved against user.preferred_language.
                (lang as string | undefined) ?? (request.query.lang as string | undefined),
            );

            return sendResponse({
                data: result,
                message: messages.ANSWER_SAVED_SUCCESS,
                success: true,
                statusCode: StatusCodes.OK,
                response,
            });
        } catch (err: any) {
            console.error("❌ Error in saveAnswer:", err);
            return sendResponse({
                data: null,
                message: err.message || messages.ANSWER_SAVE_FAILED,
                success: false,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                response,
            });
        }
    };
}

export default ChatFlowController;
