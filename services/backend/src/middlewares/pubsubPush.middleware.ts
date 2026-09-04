import { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";

import env from "../config/env";
import logger from "../utils/logger";

/**
 * Authenticates Google Cloud Pub/Sub push deliveries.
 *
 * Mirrors cloudScheduler.middleware: Pub/Sub is configured with an OIDC token whose
 * `audience` is this service's Cloud Run URL and whose identity is a service account we
 * name. The Google-signed JWT is verified and both claims are asserted.
 *
 * This is not optional hardening. The Play RTDN endpoint moves entitlements — an
 * unauthenticated one lets anyone POST a crafted "renewed" notification and extend their
 * own subscription indefinitely. Unlike the Razorpay webhook, there is no HMAC over the
 * body to fall back on: Pub/Sub does not sign payloads, so the OIDC token is the only
 * authentication that exists.
 *
 * In development only, the same `x-cron-secret` shared secret bypasses OIDC so a
 * notification can be replayed with curl.
 */
const oAuthClient = new OAuth2Client();

const pubsubPushMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    if (env.isDevelopment() && env.CRON_DEV_SECRET) {
        if (req.headers["x-cron-secret"] === env.CRON_DEV_SECRET) {
            next();
            return;
        }
    }

    if (!env.PUBSUB_PUSH_SA_EMAIL || !env.CLOUD_RUN_URL) {
        logger.error(
            "Pub/Sub push auth misconfigured: PUBSUB_PUSH_SA_EMAIL or CLOUD_RUN_URL is not set",
        );
        // 500, not 401: this is our misconfiguration, and Pub/Sub retrying is the
        // correct behaviour once it is fixed.
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false });
        return;
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false });
        return;
    }

    try {
        const ticket = await oAuthClient.verifyIdToken({
            idToken: token,
            audience: env.CLOUD_RUN_URL,
        });
        const payload = ticket.getPayload();

        if (!payload?.email_verified || payload.email !== env.PUBSUB_PUSH_SA_EMAIL) {
            logger.warn({ email: payload?.email }, "Pub/Sub push rejected: identity mismatch");
            res.status(StatusCodes.FORBIDDEN).json({ success: false });
            return;
        }

        next();
    } catch (error) {
        logger.warn({ err: error }, "Pub/Sub push rejected: invalid OIDC token");
        res.status(StatusCodes.UNAUTHORIZED).json({ success: false });
    }
};

export default pubsubPushMiddleware;
