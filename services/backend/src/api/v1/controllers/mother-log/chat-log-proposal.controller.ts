import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import ChatLogProposalService from "../../../../services/mother-log/chat-log-proposal.service";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/** Why an accepted card item could not be saved, with the message the app shows. */
const REFUSAL_MESSAGES = {
    day_closed: messages.CHAT_LOG_DAY_CLOSED,
    medicine_missing: messages.CHAT_LOG_MEDICINE_MISSING,
    reminder_limit: messages.REMINDER_LIMIT_REACHED,
    reminder_in_past: messages.REMINDER_IN_PAST,
};

/** Her Yes / No on a "Save this log?" or "Set this reminder?" card in the Viva AI chat. */
export default class ChatLogProposalController {
    private service = new ChatLogProposalService();

    confirm = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { messageId, proposalId, accept } = req.body as {
                messageId: string;
                proposalId: string;
                accept: boolean;
            };

            const outcome = await this.service.confirm({
                userId: String(req.user._id),
                messageId,
                proposalId,
                accept,
            });

            if (outcome.result === "not_found") {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.CHAT_LOG_NOT_FOUND,
                    response: res,
                });
            }
            if (outcome.result !== "ok") {
                return sendResponse({
                    data: { code: outcome.result },
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: REFUSAL_MESSAGES[outcome.result],
                    response: res,
                });
            }

            sendResponse({
                data: outcome.item,
                statusCode: StatusCodes.OK,
                success: true,
                message: accept ? messages.CHAT_LOG_SAVED : messages.CHAT_LOG_DISMISSED,
                response: res,
            });
        } catch (err) {
            next(err);
        }
    };
}
