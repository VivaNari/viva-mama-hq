import { NextFunction, Request, Response } from "express";

import { ECapability } from "../services/entitlements/entitlement.config";
import { entitlementService } from "../services/entitlements/entitlement.service";
import { EntitlementDeniedError } from "../services/entitlements/entitlement.errors";
import { messages } from "../constants/messages";
import sendResponse from "../utils/commonFunctions/sendResponse";
import { analyticsService } from "../services/analytics/analytics.service";
import { EAnalyticsEvent } from "../types/analytics.types";

/**
 * Write a denial in the one shape the app has a single handler for.
 *
 * HTTP 402 with a machine-readable code and the context needed to render a paywall —
 * which capability, which tier, the limit, and when it resets.
 */
export function sendDenial(
    error: EntitlementDeniedError,
    response: Response,
    userId?: string,
): void {
    // Every refusal, recorded at the single choke point they all pass through — so a
    // new gate is measured automatically rather than needing its own instrumentation.
    // Fire-and-forget: the paywall must appear even if the analytics write fails.
    if (userId) {
        analyticsService.track({
            userId,
            event: EAnalyticsEvent.CAPABILITY_DENIED,
            tier: error.payload.tier,
            capability: error.payload.capability,
            metadata: {
                code: error.code,
                limit: error.payload.limit ?? null,
            },
        });
    }

    sendResponse({
        data: { code: error.code, ...error.payload },
        statusCode: error.statusCode,
        success: false,
        message: error.message,
        response,
    });
}

/** True when the error is a paywall refusal rather than a server fault. */
export function isEntitlementDenied(error: unknown): error is EntitlementDeniedError {
    return error instanceof EntitlementDeniedError;
}

/**
 * Gate a route on a capability being available at all, without metering it.
 * Composes after authMiddleware, the same way requestValidator does.
 */
export const requireCapability =
    (capability: ECapability) =>
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);
            await entitlementService.assertCapability(request.user._id, capability);
            next();
        } catch (error) {
            if (isEntitlementDenied(error)) {
                return sendDenial(error, response, request.user?._id);
            }
            next(error);
        }
    };

/**
 * Gate a route AND spend one unit of its allowance.
 *
 * The unit is spent before the handler runs, so a request that the handler later fails
 * has still consumed quota. That is deliberate for the metered capabilities here — the
 * allowance is on the user's *action*, and refunding on failure would let a client
 * manufacture free attempts by inducing errors. Where a failure genuinely should not
 * cost anything, the handler can call `entitlementService.refundQuota`.
 */
export const enforceQuota =
    (capability: ECapability) =>
    async (request: Request, response: Response, next: NextFunction): Promise<void> => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);
            await entitlementService.consumeCapability(request.user._id, capability);
            next();
        } catch (error) {
            if (isEntitlementDenied(error)) {
                return sendDenial(error, response, request.user?._id);
            }
            next(error);
        }
    };
