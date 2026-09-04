import crypto from "crypto";

import env from "../../config/env";
import subscriptionModel from "../../models/subscription.model";
import UserModel from "../../models/user.model";
import webhookEventModel from "../../models/webhook-event.model";
import {
    EBillingProvider,
    ESubscriptionStatus,
    ESubscriptionTier,
    ISubscription,
    EPaymentOrderPurpose,
} from "../../types/subscription.types";
import { EAnalyticsEvent } from "../../types/analytics.types";
import { analyticsService } from "../analytics/analytics.service";
import { creditService } from "../entitlements/credit.service";
import { subscriptionPlanService } from "./subscription-plan.service";
import { subscriptionService } from "./subscription.service";
import paymentOrderModel from "../../models/payment-order.model";
import logger from "../../utils/logger";

/** Razorpay webhook events we act on. Anything else is recorded and ignored. */
export enum ERazorpayWebhookEvent {
    /**
     * MANUAL rail: a one-time order was fully paid. This is the safety net for the case
     * where the app's client callback never fired (the SDK can reject after a captured
     * UPI payment) AND the app was closed before it could reconcile — the server still
     * hears about the payment and activates.
     */
    ORDER_PAID = "order.paid",
    SUBSCRIPTION_CHARGED = "subscription.charged",
    SUBSCRIPTION_HALTED = "subscription.halted",
    SUBSCRIPTION_CANCELLED = "subscription.cancelled",
    SUBSCRIPTION_COMPLETED = "subscription.completed",
}

export class WebhookSignatureError extends Error {
    public readonly code = "WEBHOOK_SIGNATURE_INVALID";
}

function addDays(from: Date, days: number): Date {
    const out = new Date(from);
    out.setDate(out.getDate() + days);
    return out;
}

/**
 * Razorpay subscription webhooks — the authoritative activation path under AUTOPAY.
 *
 * The client callback tells us the user finished the checkout sheet; only the webhook
 * tells us money actually moved, and it is the only thing that fires for the automatic
 * charge on day 7 and every renewal after, when no client is involved at all.
 */
export class WebhookService {
    /**
     * Verify against the RAW request body.
     *
     * Re-serialising the parsed JSON would not reproduce Razorpay's byte sequence — key
     * order and whitespace both differ — so the signature would never match. See the
     * express.json `verify` hook in app.ts, which stashes the buffer.
     */
    public verifySignature(rawBody: Buffer | string, signature: string | undefined): void {
        const secret = env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            throw new WebhookSignatureError("RAZORPAY_WEBHOOK_SECRET is not configured");
        }

        const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

        const expectedBuf = Buffer.from(expected, "utf8");
        const actualBuf = Buffer.from(signature ?? "", "utf8");

        if (
            expectedBuf.length !== actualBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, actualBuf)
        ) {
            throw new WebhookSignatureError("Webhook signature verification failed");
        }
    }

    /**
     * Process one event, exactly once.
     *
     * Razorpay retries until it receives a 2xx, so the same `subscription.charged` can
     * arrive several times. The insert below is the idempotency guard: a duplicate
     * `providerEventId` throws 11000 and we return without reprocessing, rather than
     * granting a second term and a second set of credits.
     */
    public async handle(payload: {
        id?: string;
        event?: string;
        payload?: Record<string, any>;
    }): Promise<{ processed: boolean; reason?: string }> {
        const providerEventId = payload?.id;
        const event = payload?.event;

        if (!providerEventId || !event) {
            return { processed: false, reason: "MALFORMED" };
        }

        try {
            await webhookEventModel.create({
                providerEventId,
                provider: EBillingProvider.RAZORPAY_SUBSCRIPTIONS,
                type: event,
                payload,
                processedAt: null,
            });
        } catch (error: any) {
            if (error?.code === 11000) {
                return { processed: false, reason: "DUPLICATE" };
            }
            throw error;
        }

        try {
            await this.dispatch(event, payload);
            await webhookEventModel.updateOne(
                { providerEventId },
                { $set: { processedAt: new Date() } },
            );
            return { processed: true };
        } catch (error: any) {
            // Left with processedAt null and the error recorded, so a crash mid-handling
            // is visible rather than silently swallowed.
            await webhookEventModel.updateOne(
                { providerEventId },
                { $set: { error: error?.message ?? String(error) } },
            );
            throw error;
        }
    }

    private async dispatch(event: string, payload: Record<string, any>): Promise<void> {
        // order.paid carries an order entity, not a subscription entity, and maps to a
        // one-time payment_order rather than a subscriptions row — so it is handled
        // before the subscription-entity lookup below.
        if (event === ERazorpayWebhookEvent.ORDER_PAID) {
            await this.onOrderPaid(payload);
            return;
        }

        const entity = payload?.payload?.subscription?.entity;
        const providerSubscriptionId = entity?.id;

        if (!providerSubscriptionId) {
            logger.warn({ event }, "Webhook carried no subscription entity; ignoring");
            return;
        }

        const subscription = (await subscriptionModel
            .findOne({ providerSubscriptionId })
            .lean()) as ISubscription | null;

        if (!subscription) {
            // Can legitimately happen if the mandate was created but our row was not,
            // or for a subscription belonging to another environment sharing the account.
            logger.warn(
                { event, providerSubscriptionId },
                "Webhook for an unknown subscription; ignoring",
            );
            return;
        }

        switch (event) {
            case ERazorpayWebhookEvent.SUBSCRIPTION_CHARGED:
                await this.onCharged(subscription, entity);
                break;
            case ERazorpayWebhookEvent.SUBSCRIPTION_HALTED:
                await this.setStatus(subscription, ESubscriptionStatus.HALTED);
                break;
            case ERazorpayWebhookEvent.SUBSCRIPTION_CANCELLED:
            case ERazorpayWebhookEvent.SUBSCRIPTION_COMPLETED:
                await this.setStatus(subscription, ESubscriptionStatus.CANCELLED);
                break;
            default:
                logger.info({ event }, "Unhandled webhook event recorded but not acted on");
        }
    }

    /**
     * A one-time subscription order was paid (MANUAL rail).
     *
     * Delegates to the same reconcile the app uses, so activation is identical whether it
     * was driven by the client callback, the client's error-path reconcile, or this
     * webhook — and idempotent across all three, so whichever arrives first wins and the
     * rest are no-ops.
     */
    private async onOrderPaid(payload: Record<string, any>): Promise<void> {
        const orderId = payload?.payload?.order?.entity?.id;
        if (!orderId) {
            logger.warn("order.paid webhook carried no order entity; ignoring");
            return;
        }

        const order = await paymentOrderModel.findOne({ order_id: orderId }).lean();
        if (!order) {
            // Consultation orders live in a different collection, and orders from another
            // environment sharing the Razorpay account will not be here either.
            logger.warn({ orderId }, "order.paid for an unknown order; ignoring");
            return;
        }
        if (order.purpose !== EPaymentOrderPurpose.SUBSCRIPTION) {
            logger.info({ orderId }, "order.paid for a non-subscription order; ignoring");
            return;
        }

        await subscriptionService.reconcileCheckout(order.user_id, orderId);
    }

    /**
     * A successful charge — the trial converting on day 7, or a renewal.
     *
     * Credits are granted per charge, so each paid term gets its own allowance rather
     * than the balance accumulating across renewals.
     */
    private async onCharged(
        subscription: ISubscription,
        entity: Record<string, any>,
    ): Promise<void> {
        const plan = subscription.planCode
            ? await subscriptionPlanService.getByCode(subscription.planCode)
            : null;

        if (!plan) {
            logger.error(
                { subscriptionId: subscription._id },
                "Charged subscription has no resolvable plan; cannot grant credits",
            );
            return;
        }

        const now = new Date();
        // Prefer Razorpay's own cycle end when present — it is the authority on when the
        // next charge lands, and drifting from it would let access and billing disagree.
        const currentPeriodEnd = entity?.current_end
            ? new Date(entity.current_end * 1000)
            : addDays(now, plan.durationDays);

        await subscriptionModel.updateOne(
            { _id: subscription._id },
            {
                $set: {
                    tier: ESubscriptionTier.PREMIUM,
                    status: ESubscriptionStatus.ACTIVE,
                    isCurrent: true,
                    currentPeriodStart: now,
                    currentPeriodEnd,
                    trialEndAt: null,
                    mandateStatus: entity?.status ?? subscription.mandateStatus,
                },
            },
        );

        await UserModel.findByIdAndUpdate(subscription.user_id, {
            $set: {
                "subscription.tier": ESubscriptionTier.PREMIUM,
                "subscription.status": ESubscriptionStatus.ACTIVE,
                "subscription.planCode": plan.code,
                "subscription.subscription_id": subscription._id,
                "subscription.billingMode": subscription.billingMode,
                "subscription.trialEndAt": null,
                "subscription.currentPeriodEnd": currentPeriodEnd,
                "is_onboarded.is_subscription_completed": true,
            },
        });

        await creditService.grantForPlan({
            userId: subscription.user_id,
            subscriptionId: subscription._id,
            credits: plan.credits,
            expiresAt: currentPeriodEnd,
        });

        analyticsService.track({
            userId: subscription.user_id,
            event: EAnalyticsEvent.SUBSCRIPTION_ACTIVATED,
            tier: ESubscriptionTier.PREMIUM,
            planCode: plan.code,
            metadata: {
                source: "webhook",
                fromTrial: subscription.tier === ESubscriptionTier.TRIAL,
            },
        });
    }

    /**
     * A halted mandate keeps `isCurrent` — Razorpay is still retrying, and revoking
     * access on the first failed attempt would punish a user whose card simply expired.
     * The lifecycle job retires it once the period genuinely ends.
     */
    private async setStatus(
        subscription: ISubscription,
        status: ESubscriptionStatus,
    ): Promise<void> {
        await subscriptionModel.updateOne(
            { _id: subscription._id },
            {
                $set: {
                    status,
                    ...(status === ESubscriptionStatus.CANCELLED
                        ? { cancelledAt: new Date() }
                        : {}),
                },
            },
        );

        await UserModel.findByIdAndUpdate(subscription.user_id, {
            $set: { "subscription.status": status },
        });
    }
}

export const webhookService = new WebhookService();
