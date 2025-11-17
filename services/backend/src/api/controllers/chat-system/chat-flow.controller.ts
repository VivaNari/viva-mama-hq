import { Request, Response, NextFunction } from "express";
import ChatFlowService from "../../../services/chat-system/chat-flow.service";
import { IUser } from "../../../types";
import { StatusCodes } from "http-status-codes";

interface AuthenticatedRequest extends Request {
    user: IUser & { _id: string };
}

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

            if (!userId || !slug) {
                return response.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "userId and flow slug are required",
                });
            }

            this.chatFlowService.handleSseConnection(userId, slug, response);
        } catch (err) {
            next(err);
        }
    };

    saveAnswer = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const req = request as AuthenticatedRequest;
            const userId = req.user._id;
            const { flowInstanceId, nodeId, selectedKeys } = req.body;

            if (!flowInstanceId || !nodeId || !selectedKeys || !Array.isArray(selectedKeys)) {
                return response.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: "flowInstanceId, nodeId, and selectedKeys (array) are required",
                });
            }

            const result = await this.chatFlowService.saveAnswer(
                userId,
                flowInstanceId,
                nodeId,
                selectedKeys,
            );

            response.status(StatusCodes.OK).json({
                ...result,
            });
        } catch (err: any) {
            console.error("❌ Error in saveAnswer:", err);
            response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: err.message || "Failed to save answer",
            });
        }
    };
}

export default ChatFlowController;
