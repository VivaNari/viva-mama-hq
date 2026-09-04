import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { playRtdnService } from "../../../../services/subscription/play-rtdn.service";
import logger from "../../../../utils/logger";

/**
 * POST /api/v1/webhooks/play/rtdn
 *
 * Google Play Real-Time Developer Notifications, delivered as a Pub/Sub push.
 *
 * Authentication is the OIDC token on the request, checked by pubsubPushMiddleware
 * before this runs — Pub/Sub does not sign payloads, so there is no body signature to
 * verify here the way the Razorpay webhook does.
 *
 * Answers 200 for everything it understood, including duplicates and notifications with
 * no handler. Pub/Sub retries any non-2xx until its retention window expires, so a
 * notification this code cannot act on would otherwise be redelivered for days. Only a
 * genuine processing failure returns 5xx, where a retry is what we actually want.
 */
export const handlePlayRtdn = async (request: Request, response: Response): Promise<void> => {
    try {
        const { outcome } = await playRtdnService.handle(request.body);

        if (outcome !== "PROCESSED" && outcome !== "DUPLICATE") {
            logger.info({ outcome }, "Play RTDN acknowledged without a state change");
        }

        response.status(StatusCodes.OK).json({ success: true, outcome });
    } catch (error) {
        // The event row is left unprocessed with its error recorded, and idempotency is
        // keyed on the Pub/Sub message id, so the redelivery this 500 triggers is safe.
        logger.error({ err: error }, "Play RTDN processing failed");
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false });
    }
};
