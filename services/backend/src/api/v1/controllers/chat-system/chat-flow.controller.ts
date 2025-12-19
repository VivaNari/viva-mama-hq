import { Request, Response, NextFunction } from "express";
import ChatFlowService from "../../../../services/chat-system/chat-flow.service";
import { IUser } from "../../../../types";
import { StatusCodes } from "http-status-codes";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { messages } from "../../../../constants/messages";
import { AuthenticatedRequest, FlowType } from "../../../../types/chat.types";

class ChatFlowController {
    private chatFlowService: ChatFlowService;

    constructor() {
        this.chatFlowService = new ChatFlowService();
    }

    handleSseConnection = (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const { slug } = req.params;
            const userId = req.user._id;
            const { flowType } = req.query;

            if (!userId || !slug) {
                return sendResponse({
                    data: null,
                    message: messages.USER_AND_SLUG_REQUIRED,
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            this.chatFlowService.handleSseConnection(userId, slug, flowType as FlowType, response);
        } catch (err) {
            next(err);
        }
    };

    saveResponse = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;
            const { flowInstanceId, nodeId, selectedKeys, freeText, flowType } = req.body;

            // ✅ Validate required fields
            if (!flowInstanceId || !nodeId) {
                return sendResponse({
                    data: null,
                    message: "flowInstanceId and nodeId are required",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            // ✅ Validate that EITHER selectedKeys OR freeText is provided
            if (!selectedKeys && !freeText) {
                return sendResponse({
                    data: null,
                    message: "Either selectedKeys (array) or freeText (string) must be provided",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            // ✅ If selectedKeys is provided, validate it's an array
            if (selectedKeys && !Array.isArray(selectedKeys)) {
                return sendResponse({
                    data: null,
                    message: "selectedKeys must be an array",
                    success: false,
                    statusCode: StatusCodes.BAD_REQUEST,
                    response,
                });
            }

            // ✅ If freeText is provided, validate it's a non-empty string
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
