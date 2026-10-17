import crypto from "crypto";
import Razorpay from "razorpay";

import env from "../../../config/env";
import { TRIAL_DURATION_DAYS } from "../../entitlements/entitlement.config";
import {
    EBillingMode,
    EBillingProvider,
    ISubscription,
    ISubscriptionPlan,
} from "../../../types/subscription.types";
import {
    IBillingProvider,
    ICheckoutPayload,
    ITrialHandle,
    IVerificationInput,
    IVerifiedActivation,
} from "./billing.provider";

/**
 * AUTOPAY mode — Razorpay Subscriptions (recurring mandate).
 *
 * The user authorises a mandate up front; Razorpay charges it automatically when the
 * trial ends and again each term. The charge is reported by webhook
 * (`subscription.charged`), which is what actually activates the subscription — this
 * provider only creates and cancels the mandate.
 *
 * Requires recurring payments to be enabled on the merchant account, and each plan to
 * carry a `razorpayPlanId`.
 */
export class RazorpaySubscriptionsProvider implements IBillingProvider {
    public readonly mode = EBillingMode.AUTOPAY;
    public readonly name = EBillingProvider.RAZORPAY_SUBSCRIPTIONS;

    private razorpay: Razorpay;

    constructor() {
        this.razorpay = new Razorpay({
            key_id: env.RAZORPAY_API_KEY as string,
            key_secret: env.RAZORPAY_SECRET_KEY as string,
        });
    }

    private assertPlan(plan: ISubscriptionPlan | null): ISubscriptionPlan {
        if (!plan) {
            // Unlike MANUAL, an autopay trial cannot be plan-less: the mandate has to
            // know what it will charge on day 7.
            throw new Error("AUTOPAY requires a plan to start a trial");
        }
        if (!plan.razorpayPlanId) {
            throw new Error(
                `Plan ${plan.code} has no razorpayPlanId; it cannot be sold on AUTOPAY`,
            );
        }
        return plan;
    }

    /** Razorpay takes epoch seconds, not milliseconds. */
    private epochSeconds(date: Date): number {
        return Math.floor(date.getTime() / 1000);
    }

    /**
     * Create the mandate. `start_at` is the trial end, so Razorpay collects
     * authorisation now and takes the first payment only when the trial expires —
     * which is exactly the "you won't be charged during the trial" promise.
     */
    public async startTrial(userId: string, plan: ISubscriptionPlan | null): Promise<ITrialHandle> {
        const resolved = this.assertPlan(plan);
        const startAt = new Date();
        startAt.setDate(startAt.getDate() + TRIAL_DURATION_DAYS);

        const subscription = await this.razorpay.subscriptions.create({
            plan_id: resolved.razorpayPlanId as string,
            // Razorpay requires a finite cycle count. A long horizon behaves as
            // "until cancelled" for a monthly-ish plan without being unbounded.
            total_count: 120,
            customer_notify: 1,
            start_at: this.epochSeconds(startAt),
            notes: { userId, planCode: resolved.code },
        });

        return {
            providerSubscriptionId: subscription.id,
            mandateStatus: subscription.status,
        };
    }

    /**
     * Buying directly, without a trial: the mandate starts charging immediately.
     */
    public async createCheckout(
        userId: string,
        plan: ISubscriptionPlan,
    ): Promise<ICheckoutPayload> {
        const resolved = this.assertPlan(plan);

        const subscription = await this.razorpay.subscriptions.create({
            plan_id: resolved.razorpayPlanId as string,
            total_count: 120,
            customer_notify: 1,
            notes: { userId, planCode: resolved.code },
        });

        return {
            // The client opens the checkout against a subscription id rather than an
            // order id; the field is shared so the app needs no branch.
            providerOrderId: subscription.id,
            amountPaise: resolved.amountPaise,
            currency: "INR",
            providerKeyId: env.RAZORPAY_API_KEY as string,
        };
    }

    /**
     * Verify the client's post-authorisation callback.
     *
     * NOTE the payload order differs from the Orders rail: subscriptions sign
     * `payment_id|subscription_id`, where orders sign `order_id|payment_id`. Getting
     * this backwards produces a signature that never matches.
     */
    public async verify(input: IVerificationInput): Promise<IVerifiedActivation> {
        const subscriptionId = input.razorpay_order_id;

        const expected = crypto
            .createHmac("sha256", env.RAZORPAY_SECRET_KEY as string)
            .update(`${input.razorpay_payment_id}|${subscriptionId}`)
            .digest("hex");

        const expectedBuf = Buffer.from(expected, "utf8");
        const actualBuf = Buffer.from(input.razorpay_signature ?? "", "utf8");
        const matches =
            expectedBuf.length === actualBuf.length &&
            crypto.timingSafeEqual(expectedBuf, actualBuf);

        if (!matches) {
            throw new Error("PAYMENT_SIGNATURE_INVALID");
        }

        return {
            providerOrderId: subscriptionId,
            providerPaymentId: input.razorpay_payment_id,
        };
    }

    /**
     * Cancel at the end of the paid cycle, not immediately — the user keeps the access
     * they have already paid for, which is what the cancel endpoint promises.
     */
    public async cancel(subscription: ISubscription): Promise<void> {
        if (!subscription.providerSubscriptionId) return;

        await this.razorpay.subscriptions.cancel(subscription.providerSubscriptionId, true);
    }
}
