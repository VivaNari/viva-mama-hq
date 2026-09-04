import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { ReferralError, referralService } from "../../../../services/referral/referral.service";

export class ReferralController {
    /**
     * POST /referral/redeem
     *
     * Replaces POST /user/map-expert-referral, which stored whatever string it was
     * given and always answered 200. A code can now carry a subscription, so an
     * unrecognised one is a 404 the app surfaces to the user rather than a silent
     * success she only discovers when the free month never arrives.
     *
     * `data.grant` is the whole client contract: non-null means a subscription was
     * attached and the app skips the plan catalog.
     */
    public redeem = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const result = await referralService.redeem(
                request.user._id,
                request.body.referralCode,
            );

            return sendResponse({
                data: result,
                statusCode: StatusCodes.OK,
                success: true,
                message: result.grant
                    ? "Referral code applied and your plan is active"
                    : "Referral code applied",
                response,
            });
        } catch (err) {
            if (err instanceof ReferralError) {
                return sendResponse({
                    data: { code: err.code },
                    statusCode: err.statusCode,
                    success: false,
                    message: err.message,
                    response,
                });
            }
            next(err);
        }
    };
}

export default ReferralController;
