import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import {
    ModerationError,
    moderationService,
} from "../../../../services/vivaClub/moderation.service";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Maps the service's codes onto HTTP.
 *
 * FORBIDDEN is absent on purpose — this endpoint never distinguishes "not yours" from
 * "does not exist", because doing so would confirm another user's message id is real.
 *
 * Every refusal carries `data.code`. A 403 with no code is indistinguishable from an
 * expired token and the app ends the session over it; the same rule is why the codes
 * exist at all (see EAuthDenial), and it is cheap to honour everywhere rather than
 * remember which statuses it applies to.
 */
const statusFor = (code: ModerationError["code"]) => {
    if (code === "NOT_FOUND") return StatusCodes.NOT_FOUND;
    if (code === "RATE_LIMITED") return StatusCodes.TOO_MANY_REQUESTS;
    if (code === "UNSUPPORTED") return StatusCodes.BAD_REQUEST;
    return StatusCodes.FORBIDDEN;
};

export default class AIMessageReportController {
    /**
     * Flag a Viva AI reply as offensive or harmful.
     *
     * Required by Play's AI-Generated Content policy: users must be able to report
     * model output without leaving the app.
     */
    createReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await moderationService.reportAiMessage({
                reporterId: req.user?._id,
                messageId: req.body.messageId,
                reason: req.body.reason,
                details: req.body.details,
            });

            return sendResponse({
                response: res,
                statusCode: StatusCodes.CREATED,
                success: true,
                // Deliberately the same message whether this was the first report or a
                // repeat. "You already reported this" tells her the tap did nothing,
                // when the outcome she wanted is already in place.
                message: "Thank you. Our team will review this.",
                data: { alreadyReported: result.alreadyReported },
            });
        } catch (error) {
            if (error instanceof ModerationError) {
                return sendResponse({
                    response: res,
                    statusCode: statusFor(error.code),
                    success: false,
                    message: error.message,
                    data: { code: error.code },
                });
            }
            next(error);
        }
    };
}
