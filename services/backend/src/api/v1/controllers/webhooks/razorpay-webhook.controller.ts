import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import {
    WebhookSignatureError,
    webhookService,
} from "../../../../services/subscription/webhook.service";
import logger, { createModuleLogger } from "../../../../utils/logger";

const log = createModuleLogger(logger, "razorpay-webhook.controller");

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Unauthenticated by design — the signature IS the authentication. There is no user
 * session here: the day-7 charge and every renewal happen with no client involved.
 */
export const handleRazorpayWebhook = async (
    request: Request,
    response: Response,
): Promise<void> => {
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

    try {
        webhookService.verifySignature(
            rawBody ?? JSON.stringify(request.body),
            request.headers["x-razorpay-signature"] as string | undefined,
        );
    } catch (error) {
        if (error instanceof WebhookSignatureError) {
            log.warn({ error: error.message }, "Rejected webhook with bad signature");
            // 401, deliberately: Razorpay retries on 5xx, and retrying a forged or
            // misconfigured request forever helps nobody.
            response.status(StatusCodes.UNAUTHORIZED).json({ success: false });
            return;
        }
        throw error;
    }

    try {
        const result = await webhookService.handle(request.body);
        // 200 even for a duplicate: it means "we already have this", and anything else
        // would make Razorpay retry an event that is already applied.
        response.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error: any) {
        log.error({ error }, "Webhook processing failed");
        // 500 so Razorpay retries — the event is recorded with its error and the
        // idempotency guard makes the retry safe.
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false });
    }
};
