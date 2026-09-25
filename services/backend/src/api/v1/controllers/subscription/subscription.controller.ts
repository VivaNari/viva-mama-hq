import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import env from "../../../../config/env";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import { obfuscatedPlayAccountId, PlayApiError } from "../../../../services/subscription/billing";
import { subscriptionPlanService } from "../../../../services/subscription/subscription-plan.service";
import {
    SubscriptionError,
    subscriptionService,
} from "../../../../services/subscription/subscription.service";
import { localizeSubscriptionPlans } from "../../../../utils/i18n/localizeSubscriptionPlan";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import logger, { createModuleLogger } from "../../../../utils/logger";

const log = createModuleLogger(logger, "subscription.controller");

export class SubscriptionController {
    /**
     * GET /subscription/me
     *
     * The app's single source of truth for what the current user may do. Returns the
     * resolved tier, the dates behind it, credit balances, every capability's limit and
     * the usage against the metered ones.
     *
     * `billingMode` is included so the app can render the trial CTA and the "what
     * happens on day 7" copy without shipping its own copy of the flag — flipping
     * BILLING_MODE server-side must never require an app release.
     */
    public getMe = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const entitlements = await entitlementService.getEntitlements(request.user._id);

            sendResponse({
                data: {
                    ...entitlements,
                    // The mode that applies to a NEW subscription. An existing
                    // subscription's own mode is on `entitlements.billingMode`, and the
                    // two can legitimately differ after the env toggle is flipped.
                    billingModeForNewSubscriptions: env.BILLING_MODE,
                    // Sent to Google as `obfuscatedAccountId` when the app launches a
                    // Play purchase, and checked again on the way back in. Derived
                    // server-side so the app never needs the hashing key, and so the two
                    // sides cannot disagree about how it is computed.
                    playAccountId: obfuscatedPlayAccountId(request.user._id),
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.SUBSCRIPTION_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * GET /subscription/plans
     *
     * The localized catalog. Prices come from the database, never from the client.
     */
    public getPlans = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const plans = await subscriptionPlanService.listActive();

            const user = request.user ? await UserModel.findById(request.user._id) : null;
            const lang = resolveLanguage(request.query?.lang as string, user?.preferred_language);

            sendResponse({
                data: localizeSubscriptionPlans(plans, lang),
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.SUBSCRIPTION_PLANS_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Turn a SubscriptionError into its own status and machine-readable code, so the app
     * can distinguish "trial already used" from "plan not found" without parsing prose.
     * Anything else is a genuine fault and goes to the error handler.
     */
    private handle(err: unknown, response: Response, next: NextFunction): void {
        if (err instanceof SubscriptionError) {
            sendResponse({
                data: { code: err.code },
                statusCode: err.statusCode,
                success: false,
                message: err.message,
                response,
            });
            return;
        }

        // Play faults arrive as PlayApiError, which is not a SubscriptionError and so
        // used to fall through to the generic error handler: a bare 500 with the one
        // field naming the cause discarded. That is how a GET-carrying-a-body bug in the
        // provider took an hour to identify — the app said "setup failed", the logs said
        // nothing, and `code` never left the process.
        //
        // Logged here rather than left to errorHandler, because handling it means it no
        // longer reaches that middleware. Unlike SubscriptionError, which is ordinary
        // business logic ("trial already used"), every one of these is an upstream fault
        // worth a log line.
        if (err instanceof PlayApiError) {
            log.error(
                { err, code: err.code, playStatus: err.status },
                "Play Developer API call failed",
            );

            // The status reflects what the CLIENT can do about it, not what Google
            // answered. A 401 from the Play API means OUR service account was rejected;
            // returning 401 to the app would wrongly tell it the user's session is bad.
            const statusCode =
                err.code === "PLAY_PURCHASE_NOT_FOUND"
                    ? StatusCodes.NOT_FOUND
                    : err.code === "PLAY_NOT_CONFIGURED"
                      ? StatusCodes.INTERNAL_SERVER_ERROR
                      : StatusCodes.BAD_GATEWAY;

            sendResponse({
                data: { code: err.code },
                statusCode,
                success: false,
                message: err.message,
                response,
            });
            return;
        }

        next(err);
    }

    /**
     * POST /subscription/trial/start — the 7-day trial, once per user ever.
     *
     * Under MANUAL this collects no payment details and nothing is charged on day 7.
     * Under AUTOPAY the response carries the mandate payload the client needs.
     */
    public startTrial = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const subscription = await subscriptionService.startTrial(
                request.user._id,
                request.body?.planCode,
            );

            sendResponse({
                data: {
                    subscription,
                    billingMode: subscription.billingMode,
                },
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.TRIAL_STARTED_SUCCESS,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /** POST /subscription/free/select — the "continue with the free app" branch. */
    public selectFree = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            await subscriptionService.selectFree(request.user._id);
            const entitlements = await entitlementService.getEntitlements(request.user._id);

            sendResponse({
                data: entitlements,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.FREE_PLAN_SELECTED_SUCCESS,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /**
     * POST /subscription/checkout/create — takes a planCode, never an amount.
     */
    public createCheckout = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const checkout = await subscriptionService.createCheckout(
                request.user._id,
                request.body.planCode,
            );

            sendResponse({
                data: checkout,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.PAYMENT_ORDER_CREATED,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /**
     * POST /subscription/checkout/verify — verify signature, activate, grant credits.
     * Idempotent: replaying a verified callback returns the existing subscription.
     */
    public verifyCheckout = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const subscription = await subscriptionService.activatePaid(
                request.user._id,
                request.body,
            );
            const entitlements = await entitlementService.getEntitlements(request.user._id);

            sendResponse({
                data: { subscription, entitlements },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.PAYMENT_VERIFIED_SUCCESSFULLY,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /**
     * POST /subscription/checkout/reconcile — activate a captured-but-unconfirmed order.
     *
     * The app calls this when the Razorpay sheet errors out (the SDK can reject after a
     * UPI payment is already captured). The server asks Razorpay whether the order was
     * actually paid and activates if so, so a real payment is never silently lost.
     */
    public reconcileCheckout = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const result = await subscriptionService.reconcileCheckout(
                request.user._id,
                request.body.razorpay_order_id,
            );
            const entitlements = await entitlementService.getEntitlements(request.user._id);

            sendResponse({
                data: { ...result, entitlements },
                statusCode: StatusCodes.OK,
                success: true,
                message: result.activated
                    ? messages.PAYMENT_VERIFIED_SUCCESSFULLY
                    : messages.SUBSCRIPTION_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /**
     * POST /subscription/play/verify — redeem a Google Play purchase.
     *
     * The Play counterpart of checkout/verify, and a separate route because the rails do
     * not share a shape: no server-created order, no signature, just the opaque purchase
     * token the client received from Google.
     *
     * Returns the same `{ subscription, entitlements }` envelope as checkout/verify so
     * the app's success path is identical on both rails.
     */
    public verifyPlayPurchase = async (
        request: Request,
        response: Response,
        next: NextFunction,
    ) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const subscription = await subscriptionService.activateFromPlayPurchase(
                request.user._id,
                {
                    purchaseToken: request.body.purchaseToken,
                    productId: request.body.productId,
                },
            );
            const entitlements = await entitlementService.getEntitlements(request.user._id);

            sendResponse({
                data: { subscription, entitlements },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.PAYMENT_VERIFIED_SUCCESSFULLY,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };

    /** POST /subscription/cancel — access continues to currentPeriodEnd. */
    public cancel = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) throw new Error(messages.USER_FETCH_FAILED);

            const subscription = await subscriptionService.cancel(request.user._id);

            sendResponse({
                data: {
                    subscription,
                    // Surfaced explicitly so the app can say "you keep access until X"
                    // rather than implying the subscription ended immediately.
                    accessUntil: subscription.currentPeriodEnd ?? subscription.trialEndAt,
                },
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.SUBSCRIPTION_CANCELLED_SUCCESS,
                response,
            });
        } catch (err) {
            this.handle(err, response, next);
        }
    };
}

export default SubscriptionController;
