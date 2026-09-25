import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import UserModel from "../../../../models/user.model";
import {
    ModerationError,
    moderationService,
} from "../../../../services/vivaClub/moderation.service";
import {
    COMMUNITY_GUIDELINES_CONSENT,
    CURRENT_COMMUNITY_GUIDELINES_VERSION,
    hasAcceptedGuidelines,
} from "../../../../services/vivaClub/posting-gate";
import { EReportTargetType } from "../../../../types/moderation.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

/**
 * Maps the service's error codes onto HTTP without leaking internals.
 *
 * The error's own code goes on the body as well as deciding the status: a 403 with no
 * code is indistinguishable from an expired token, and the app ends the session when it
 * sees one. "You cannot report your own content" must not cost someone their login.
 */
const statusFor = (code: ModerationError["code"]) =>
    code === "NOT_FOUND"
        ? StatusCodes.NOT_FOUND
        : code === "FORBIDDEN"
          ? StatusCodes.FORBIDDEN
          : StatusCodes.BAD_REQUEST;

export default class ModerationController {
    createReport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await moderationService.report({
                reporterId: req.user?._id,
                targetType: req.body.targetType,
                targetId: req.body.targetId,
                reason: req.body.reason,
                details: req.body.details,
            });

            return sendResponse({
                response: res,
                statusCode: StatusCodes.CREATED,
                success: true,
                // Same message either way. Telling a reporter "you already reported
                // this" is fine; telling them how many others have is not — it would
                // turn the queue into a scoreboard and invite pile-ons.
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
                    // Carries the code deliberately: a 403 with `data: null` is exactly
                    // what an expired token looks like, and the app would end the
                    // session over a refusal that has nothing to do with the session.
                    data: { code: error.code },
                });
            }
            next(error);
        }
    };

    deletePost = async (req: Request, res: Response, next: NextFunction) =>
        this.deleteContent(req, res, next, EReportTargetType.VIVA_CLUB_POST, String(req.params.id));

    deleteComment = async (req: Request, res: Response, next: NextFunction) =>
        this.deleteContent(
            req,
            res,
            next,
            EReportTargetType.VIVA_CLUB_COMMENT,
            String(req.params.commentId),
        );

    private deleteContent = async (
        req: Request,
        res: Response,
        next: NextFunction,
        targetType: EReportTargetType,
        targetId: string,
    ) => {
        try {
            await moderationService.deleteOwnContent({
                userId: req.user?._id,
                targetType,
                targetId,
            });
            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Deleted",
                data: null,
            });
        } catch (error) {
            if (error instanceof ModerationError) {
                return sendResponse({
                    response: res,
                    statusCode: statusFor(error.code),
                    success: false,
                    message: error.message,
                    // Carries the code deliberately: a 403 with `data: null` is exactly
                    // what an expired token looks like, and the app would end the
                    // session over a refusal that has nothing to do with the session.
                    data: { code: error.code },
                });
            }
            next(error);
        }
    };

    blockUser = async (req: Request, res: Response, next: NextFunction) =>
        this.setBlock(req, res, next, true);

    unblockUser = async (req: Request, res: Response, next: NextFunction) =>
        this.setBlock(req, res, next, false);

    private setBlock = async (
        req: Request,
        res: Response,
        next: NextFunction,
        blocked: boolean,
    ) => {
        try {
            await moderationService.setBlocked(req.user?._id, String(req.params.userId), blocked);
            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                success: true,
                message: blocked ? "User blocked" : "User unblocked",
                data: { blocked },
            });
        } catch (error) {
            if (error instanceof ModerationError) {
                return sendResponse({
                    response: res,
                    statusCode: statusFor(error.code),
                    success: false,
                    message: error.message,
                    // Carries the code deliberately: a 403 with `data: null` is exactly
                    // what an expired token looks like, and the app would end the
                    // session over a refusal that has nothing to do with the session.
                    data: { code: error.code },
                });
            }
            next(error);
        }
    };

    /** Lets the app decide whether to show the acceptance gate before the composer. */
    guidelinesStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await UserModel.findById(req.user?._id)
                .select("consents communityBanned")
                .lean();

            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Guidelines status",
                data: {
                    accepted: user ? hasAcceptedGuidelines(user) : false,
                    version: CURRENT_COMMUNITY_GUIDELINES_VERSION,
                    banned: !!user?.communityBanned,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    acceptGuidelines = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Pull first, then push: re-accepting after a version bump should leave one
            // current record rather than a growing stack of superseded ones.
            await UserModel.updateOne(
                { _id: req.user?._id },
                { $pull: { consents: { type: COMMUNITY_GUIDELINES_CONSENT } } },
            );
            await UserModel.updateOne(
                { _id: req.user?._id },
                {
                    $push: {
                        consents: {
                            type: COMMUNITY_GUIDELINES_CONSENT,
                            version: CURRENT_COMMUNITY_GUIDELINES_VERSION,
                            acceptedAt: new Date(),
                        },
                    },
                },
            );

            return sendResponse({
                response: res,
                statusCode: StatusCodes.OK,
                success: true,
                message: "Community guidelines accepted",
                data: { version: CURRENT_COMMUNITY_GUIDELINES_VERSION },
            });
        } catch (error) {
            next(error);
        }
    };
}
