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
                    if (isEntitlementDenied(error)) return sendDenial(error, response);
                    throw error;
                }

                this.chatFlowAIService.saveResponse(
                    userId,
                    freeText,
                    sessionId,
                    conversationId,
                    model,
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
