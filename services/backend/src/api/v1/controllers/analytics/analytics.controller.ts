import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { messages } from "../../../../constants/messages";
import { analyticsService } from "../../../../services/analytics/analytics.service";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import UserModel from "../../../../models/user.model";
import { IUser } from "../../../../types";
import { CLIENT_REPORTABLE_EVENTS, EAnalyticsEvent } from "../../../../types/analytics.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";

export class AnalyticsController {
    /**
     * POST /analytics/events
     *
     * The app reports the two events that have no server-side trace: a paywall being
     * seen, and its CTA being tapped. Everything else in the funnel is recorded where
     * it happens, so it cannot be faked or lost.
     *
     * The event name is checked against an allowlist rather than trusted — otherwise a
     * client could write arbitrary rows into the funnel and make the numbers useless.
     * `tier` is resolved server-side for the same reason.
     */
    public recordEvent = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const { event, capability, metadata } = request.body as {
                event: EAnalyticsEvent;
                capability?: string;
                metadata?: Record<string, unknown>;
            };

            if (!CLIENT_REPORTABLE_EVENTS.includes(event)) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST,
                    success: false,
                    message: `Event "${event}" cannot be reported by a client`,
                    response,
                });
            }

            const user = (await UserModel.findById(request.user._id).select(
                "subscription",
            )) as IUser | null;

            await analyticsService.trackAndWait({
                userId: request.user._id,
                event,
                // Never taken from the request — the client's view of the tier can be
                // stale, and a wrong tier makes every segment of the funnel wrong.
                tier: user ? entitlementService.resolveTier(user) : null,
                capability: capability ?? null,
                metadata: metadata ?? {},
            });

            sendResponse({
                data: null,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.ANALYTICS_EVENT_RECORDED,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * GET /analytics/funnel?from=&to=
     *
     * Defaults to the last 30 days — long enough that trials started inside the window
     * have had time to convert, which a 7-day window would not.
     */
    public getFunnel = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const to = request.query.to ? new Date(String(request.query.to)) : new Date();
            const from = request.query.from
                ? new Date(String(request.query.from))
                : new Date(to.getTime() - 30 * 86_400_000);

            sendResponse({
                data: await analyticsService.getFunnel(from, to),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.ANALYTICS_FUNNEL_FETCHED,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}

export default AnalyticsController;
