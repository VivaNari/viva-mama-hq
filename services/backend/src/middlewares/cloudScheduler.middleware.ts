import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";
import env from "../config/env";
import logger, { createModuleLogger } from "../utils/logger";
import sendResponse from "../utils/commonFunctions/sendResponse";

const log = createModuleLogger(logger, "cloudScheduler.middleware");

/**
 * Authenticates requests coming from Google Cloud Scheduler to the internal
 * cron-job endpoints (see src/api/v1/routes/cron-jobs/cron-jobs.route.ts).
 *
 * Cloud Scheduler is configured with an OIDC token whose `audience` is this
 * service's Cloud Run URL and whose identity is the `scheduler-invoker`
 * service account. We verify the Google-signed JWT and assert that:
 *   - the `aud` claim matches CLOUD_RUN_URL, and
 *   - the verified `email` claim matches SCHEDULER_SA_EMAIL.
 * There is no static secret to manage — tokens are short-lived and minted by
 * Google on every invocation.
 *
 * In development only, a shared-secret header (`x-cron-secret` === CRON_DEV_SECRET)
 * bypasses OIDC so the jobs can be triggered with a plain curl.
 */
const oAuthClient = new OAuth2Client();

const cloudSchedulerMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    // Development-only shared-secret bypass.
    if (env.isDevelopment() && env.CRON_DEV_SECRET) {
        const providedSecret = req.headers["x-cron-secret"];
        if (providedSecret === env.CRON_DEV_SECRET) {
            return next();
        }
    }

    if (!env.SCHEDULER_SA_EMAIL || !env.CLOUD_RUN_URL) {
        log.error("Cron auth misconfigured: SCHEDULER_SA_EMAIL or CLOUD_RUN_URL is not set");
        return sendResponse({
            data: null,
            message: "Cron endpoint is not configured for authentication",
            success: false,
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            response: res,
        });
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
        return sendResponse({
            data: null,
            message: "Unauthorized: missing bearer token",
            success: false,
            statusCode: StatusCodes.UNAUTHORIZED,
            response: res,
        });
    }

    try {
        const ticket = await oAuthClient.verifyIdToken({
            idToken: token,
            audience: env.CLOUD_RUN_URL,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email_verified || payload.email !== env.SCHEDULER_SA_EMAIL) {
            log.warn({ email: payload?.email }, "Cron auth rejected: identity mismatch");
            return sendResponse({
                data: null,
                message: "Forbidden: token identity not allowed",
                success: false,
                statusCode: StatusCodes.FORBIDDEN,
                response: res,
            });
        }

        return next();
    } catch (error) {
        log.warn({ error }, "Cron auth rejected: invalid OIDC token");
        return sendResponse({
            data: null,
            message: "Unauthorized: invalid token",
            success: false,
            statusCode: StatusCodes.UNAUTHORIZED,
            response: res,
        });
    }
};

export default cloudSchedulerMiddleware;
