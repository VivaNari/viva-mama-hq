import env from "../../config/env";
import paymentOrderModel from "../../models/payment-order.model";
import { IPaymentOrder } from "../../types/payment.types";
import subscriptionModel from "../../models/subscription.model";
import UserModel from "../../models/user.model";
import {
    EBillingMode,
    EBillingProvider,
    ECreditType,
    EPaymentOrderPurpose,
    EPlanCode,
    ESubscriptionGrantSource,
    ESubscriptionStatus,
    ESubscriptionTier,
    ISubscription,
    ISubscriptionPlan,
    TObjectIdLike,
} from "../../types/subscription.types";
import { creditService } from "../entitlements/credit.service";
import { TRIAL_DURATION_DAYS } from "../entitlements/entitlement.config";
import {
    EPlaySubscriptionState,
    GooglePlayProvider,
    getBillingProvider,
    ICheckoutPayload,
    IPlaySubscriptionPurchase,
    IVerificationInput,
    obfuscatedPlayAccountId,
    planCodeForPlayProduct,
    playAccountIdMatches,
    PLAY_ACKNOWLEDGED,
    PLAY_ENTITLED_STATES,
} from "./billing";
import { subscriptionPlanService } from "./subscription-plan.service";
import { analyticsService } from "../analytics/analytics.service";
import { EAnalyticsEvent } from "../../types/analytics.types";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "subscription.service");

export class SubscriptionError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode = 400,
    ) {
        super(message);
    }
}

/** Statuses where the row still governs the user's access. */
const LIVE_STATUSES = [
    ESubscriptionStatus.TRIALING,
    ESubscriptionStatus.ACTIVE,
    ESubscriptionStatus.HALTED,
    // Cancelled but inside the paid period still governs access — cancelling stops
    // renewal, it does not revoke what was already paid for.
    ESubscriptionStatus.CANCELLED,
];

function addDays(from: Date, days: number): Date {
    const out = new Date(from);
    out.setDate(out.getDate() + days);
    return out;
}

/**
 * The subscription state machine: the only writer of `subscriptions` rows and of the
 * denormalized `user.subscription` snapshot.
 *
 * Two invariants it exists to hold:
 *  - At most one live row per user (also enforced by a partial unique index).
 *  - `hasUsedTrial` is never cleared, so a trial is once per user forever.
 */
export class SubscriptionService {
    /** The row currently governing this user's access, if any. */
    public async getCurrent(userId: TObjectIdLike): Promise<ISubscription | null> {
        return subscriptionModel.findOne({ user_id: userId, isCurrent: true }).lean();
    }

    /**
     * Mirror a row onto `user.subscription`.
     *
     * Dotted paths, never a whole-object assignment: replacing the sub-doc would wipe
     * `hasUsedTrial`.
     */
    private async syncSnapshot(
        userId: TObjectIdLike,
        subscription: ISubscription | null,
        extra: Record<string, unknown> = {},
    ): Promise<void> {
        const snapshot = subscription
            ? {
                  "subscription.tier": subscription.tier,
                  "subscription.status": subscription.status,
                  "subscription.planCode": subscription.planCode,
                  "subscription.subscription_id": subscription._id,
                  "subscription.billingMode": subscription.billingMode,
                  "subscription.trialEndAt": subscription.trialEndAt,
                  "subscription.currentPeriodEnd": subscription.currentPeriodEnd,
              }
            : {
                  "subscription.tier": ESubscriptionTier.FREE,
                  "subscription.status": null,
                  "subscription.planCode": null,
                  "subscription.subscription_id": null,
                  "subscription.billingMode": null,
                  "subscription.trialEndAt": null,
                  "subscription.currentPeriodEnd": null,
              };

        await UserModel.findByIdAndUpdate(userId, { $set: { ...snapshot, ...extra } });
    }

    /**
     * Re-derive `user.subscription` from whatever row is live for this user right now.
     *
     * For callers that write a row directly instead of going through one of the
     * transitions above — the Play RTDN handlers, which apply Google's view of a
     * subscription to an existing row. `resolveTier` reads the snapshot and nothing
     * else, so a row updated without this is invisible to access control: a renewal
     * extends `currentPeriodEnd` on the row while the snapshot keeps the previous
     * term's date, and the user drops to FREE at the end of their first period while
     * Google keeps charging them.
     *
     * Re-reads rather than taking the caller's row, for the same reason `expire` does:
     * on the Play rail a notification can arrive for a row that is no longer current
     * (a plan change issues a new purchase token and Google then expires the old one),
     * and the snapshot must describe the live subscription, not the one the
     * notification happened to name.
     */
    public async refreshSnapshot(userId: TObjectIdLike): Promise<void> {
        const live = await this.getCurrent(userId);
        await this.syncSnapshot(userId, live);
    }

    /**
     * Tell Google the purchase was delivered, unless Google already knows.
     *
     * ⚠️ An unacknowledged subscription is auto-refunded and revoked after three days.
     * The user pays, gets access, and loses it seventy-two hours later with no event in
     * this system to explain why — the most expensive failure in the integration, and a
     * silent one.
     *
     * This runs on EVERY path that returns an activated purchase, not just the one that
     * inserts the row. A single transient Play API failure used to be permanent: the
     * activation logged the error and moved on, and no later call retried, because the
     * only acknowledge lived past an early return that a re-verify never reached. The
     * client re-reports precisely the purchases Play still lists as unacknowledged, so
     * every retry arrived at the one path that could not act on it.
     *
     * Skipping when Google reports ACKNOWLEDGED is what stops that retry loop: the
     * client keeps re-reporting until acknowledgement sticks, and stops once it does.
     *
     * Failure stays non-fatal. The user has paid and is entitled; losing the activation
     * over a bookkeeping call would be strictly worse, and the next sweep tries again.
     */
    private async ensureAcknowledged(
        provider: GooglePlayProvider,
        purchaseToken: string,
        purchase: IPlaySubscriptionPurchase,
    ): Promise<void> {
        if (purchase.acknowledgementState === PLAY_ACKNOWLEDGED) return;

        const productId = purchase.lineItems?.[0]?.productId;
        if (!productId) return;

        try {
            await provider.acknowledge(purchaseToken, productId);
        } catch (error) {
            log.error(
                { err: error, productId },
                "Play acknowledge failed; purchase auto-refunds in 3 days if every retry keeps failing",
            );
        }
    }

    /** Retire the live row, if any, so a new one can take its place. */
    private async closeCurrent(
        userId: TObjectIdLike,
        status: ESubscriptionStatus,
        options?: { exceptPlayPurchaseToken?: string },
    ): Promise<void> {
        await subscriptionModel.updateMany(
            {
                user_id: userId,
                isCurrent: true,
                // Concurrent callers activating the SAME Play purchase must not close
                // each other's work. Without this, the loser of the insert race expires
                // the winner's row on its way past, and the user is left holding a
                // subscription that reads "expired" milliseconds after it was created.
                ...(options?.exceptPlayPurchaseToken
                    ? { playPurchaseToken: { $ne: options.exceptPlayPurchaseToken } }
                    : {}),
            },
            { $set: { status, isCurrent: false } },
        );
    }

    /**
     * Record the free-tier choice. No subscription row — FREE is the absence of one.
     *
     * `is_subscription_completed` means "the user made a tier choice", so it is set here
     * as well as on starting a trial; onboarding completes down either branch.
     */
    public async selectFree(userId: TObjectIdLike): Promise<void> {
        await this.closeCurrent(userId, ESubscriptionStatus.EXPIRED);
        await this.syncSnapshot(userId, null, {
            "is_onboarded.is_subscription_completed": true,
        });

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.FREE_SELECTED,
            tier: ESubscriptionTier.FREE,
        });
    }

    /**
     * Start the 7-day trial. Once per user, ever.
     *
     * Under MANUAL no payment details are collected and nothing is charged on day 7 —
     * the lifecycle job drops the user to FREE and the paywall appears. Under AUTOPAY
     * the provider creates a mandate here whose first charge lands on day 7.
     */
    public async startTrial(userId: TObjectIdLike, planCode?: EPlanCode): Promise<ISubscription> {
        const user = await UserModel.findById(userId).select("subscription").lean();
        if (!user) throw new SubscriptionError("USER_NOT_FOUND", "User not found", 404);

        const existing = await this.getCurrent(userId);
        if (existing) {
            throw new SubscriptionError(
                "SUBSCRIPTION_EXISTS",
                "An active subscription already exists",
                409,
            );
        }

        const hasAnySubscription = await subscriptionModel.exists({ user_id: userId });
        if (user.subscription?.hasUsedTrial || hasAnySubscription) {
            throw new SubscriptionError(
                "TRIAL_ALREADY_USED",
                "The free trial has already been used",
                409,
            );
        }

        // Stamped from the env at creation and never rewritten. Every later decision
        // reads the row, so flipping the toggle cannot retroactively change the deal a
        // user signed up under.
        const billingMode = env.BILLING_MODE;
        const provider = getBillingProvider(billingMode);

        // MANUAL trials are plan-less: nothing will be charged, so there is nothing to
        // choose yet. AUTOPAY trials must name a plan up front — the mandate created
        // here is what gets debited on day 7, so it has to know the amount.
        let plan: ISubscriptionPlan | null = null;
        if (planCode) {
            plan = await subscriptionPlanService.getByCode(planCode);
            if (!plan) {
                throw new SubscriptionError("PLAN_NOT_FOUND", "Unknown or inactive plan", 404);
            }
        }
        if (billingMode === EBillingMode.AUTOPAY && !plan) {
            throw new SubscriptionError(
                "PLAN_REQUIRED",
                "A plan must be selected to start an autopay trial",
                400,
            );
        }

        const handle = await provider.startTrial(String(userId), plan);

        const now = new Date();
        const trialEndAt = addDays(now, TRIAL_DURATION_DAYS);

        const subscription = (await subscriptionModel.create({
            user_id: userId,
            planCode: plan?.code ?? null,
            tier: ESubscriptionTier.TRIAL,
            status: ESubscriptionStatus.TRIALING,
            billingMode,
            provider: provider.name,
            trialStartAt: now,
            trialEndAt,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            providerOrderId: null,
            providerSubscriptionId: handle.providerSubscriptionId,
            mandateStatus: handle.mandateStatus,
            isCurrent: true,
        })) as unknown as ISubscription;

        await this.syncSnapshot(userId, subscription, {
            // Set once and never cleared — not on expiry, not on cancellation.
            "subscription.hasUsedTrial": true,
            "is_onboarded.is_subscription_completed": true,
        });

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.TRIAL_STARTED,
            tier: ESubscriptionTier.TRIAL,
            metadata: { billingMode, trialEndAt },
        });

        return subscription;
    }

    /**
     * Create a checkout for a plan.
     *
     * The amount is resolved from the catalog by `planCode`; the client never supplies
     * it. The legacy /orders/create takes `amount` from the request body, which lets a
     * client buy a ₹1,499 plan for ₹1.
     */
    public async createCheckout(
        userId: TObjectIdLike,
        planCode: EPlanCode,
    ): Promise<ICheckoutPayload & { planCode: EPlanCode }> {
        const plan = await subscriptionPlanService.getByCode(planCode);
        if (!plan) {
            throw new SubscriptionError("PLAN_NOT_FOUND", "Unknown or inactive plan", 404);
        }

        const billingMode = env.BILLING_MODE;
        const provider = getBillingProvider(billingMode);
        const checkout = await provider.createCheckout(String(userId), plan);

        await paymentOrderModel.create({
            order_id: checkout.providerOrderId,
            receipt: `sub_${plan.code}`,
            user_id: userId,
            purpose: EPaymentOrderPurpose.SUBSCRIPTION,
            planCode: plan.code,
            subscription_id: null,
            billingMode,
            amount: checkout.amountPaise,
            currency: checkout.currency,
            status: "created",
        });

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.CHECKOUT_CREATED,
            planCode: plan.code,
            metadata: { amountPaise: plan.amountPaise, billingMode },
        });

        return { ...checkout, planCode: plan.code };
    }

    /**
     * Verify a payment and activate the subscription.
     *
     * The plan is re-read from the stored order rather than taken from the request, so a
     * client cannot pay for MONTHLY and claim HALF_YEARLY.
     */
    public async activatePaid(
        userId: TObjectIdLike,
        input: IVerificationInput,
    ): Promise<ISubscription> {
        const order = await paymentOrderModel.findOne({
            order_id: input.razorpay_order_id,
            user_id: userId,
        });
        if (!order) {
            throw new SubscriptionError("ORDER_NOT_FOUND", "Payment order not found", 404);
        }

        // Replaying a verified callback must not grant a second term or a second set of
        // credits.
        if (order.status === "paid") {
            const current = await this.getCurrent(userId);
            if (current) return current;
        }

        const billingMode = order.billingMode ?? env.BILLING_MODE;
        const provider = getBillingProvider(billingMode);

        let verified;
        try {
            verified = await provider.verify(input);
        } catch {
            await paymentOrderModel.updateOne({ _id: order._id }, { $set: { status: "failed" } });
            throw new SubscriptionError(
                "PAYMENT_VERIFICATION_FAILED",
                "Payment verification failed",
                400,
            );
        }

        return this.activateFromPaidOrder(userId, order, verified.providerPaymentId);
    }

    /**
     * Reconcile a checkout whose client callback never delivered a signature.
     *
     * The react-native Razorpay SDK can reject after a UPI payment is already captured,
     * so the app's success handler — and therefore `activatePaid` — never runs, leaving a
     * genuinely paid order stuck at `created`. The app calls this on the error path with
     * just the order id; the server asks Razorpay whether the order was paid and, if so,
     * activates. No signature is involved because Razorpay itself is the authority.
     *
     * Idempotent: a paid order whose subscription already exists returns it unchanged, so
     * this is safe to call alongside the happy path and any future webhook.
     */
    public async reconcileCheckout(
        userId: TObjectIdLike,
        razorpayOrderId: string,
    ): Promise<{ activated: boolean; subscription: ISubscription | null }> {
        const order = await paymentOrderModel.findOne({
            order_id: razorpayOrderId,
            user_id: userId,
        });
        if (!order) {
            throw new SubscriptionError("ORDER_NOT_FOUND", "Payment order not found", 404);
        }

        if (order.status === "paid") {
            return { activated: false, subscription: await this.getCurrent(userId) };
        }

        const billingMode = order.billingMode ?? env.BILLING_MODE;
        const provider = getBillingProvider(billingMode);
        if (!provider.fetchPaidPayment) {
            throw new SubscriptionError(
                "RECONCILE_UNSUPPORTED",
                "This billing rail cannot be reconciled",
                400,
            );
        }

        const { paid, paymentId } = await provider.fetchPaidPayment(razorpayOrderId);
        if (!paid) {
            // Not paid on Razorpay's side either — nothing to activate. The order stays
            // `created` so a later attempt or webhook can still complete it.
            return { activated: false, subscription: null };
        }

        const subscription = await this.activateFromPaidOrder(
            userId,
            order,
            paymentId ?? "reconciled",
        );
        return { activated: true, subscription };
    }

    /**
     * The activation core shared by the signed happy path and the reconcile fallback.
     * Assumes the payment is genuine; the two callers each establish that differently
     * (HMAC signature vs. a direct Razorpay order lookup).
     */
    private async activateFromPaidOrder(
        userId: TObjectIdLike,
        order: IPaymentOrder & { _id: unknown },
        providerPaymentId: string,
    ): Promise<ISubscription> {
        const billingMode = order.billingMode ?? env.BILLING_MODE;
        const provider = getBillingProvider(billingMode);

        const plan = order.planCode
            ? await subscriptionPlanService.getByCode(order.planCode)
            : null;
        if (!plan) {
            throw new SubscriptionError("PLAN_NOT_FOUND", "Plan for this order not found", 404);
        }

        const now = new Date();

        // Read BEFORE closing — we need the previous row for two things:
        //  1. The tier, so analytics can record whether this was a trial conversion.
        //  2. The remaining paid time, so we can roll it forward into the new term.
        const previous = await this.getCurrent(userId);
        const previousTier = previous?.tier ?? null;

        // If the user is currently on an active PREMIUM plan with time still remaining,
        // start counting the new term from their existing end date rather than today.
        // This means a user who renews 3 days early keeps those 3 days instead of losing
        // them — the new period simply begins where the old one would have ended.
        //
        // Trial days are intentionally NOT rolled over: the trial is free, and carrying
        // free days into a paid term would be an unintended discount.
        const isPreviousPremiumActive =
            previous?.tier === ESubscriptionTier.PREMIUM &&
            previous?.currentPeriodEnd != null &&
            previous.currentPeriodEnd > now;

        const baseDate = isPreviousPremiumActive ? previous!.currentPeriodEnd! : now;
        const currentPeriodEnd = addDays(baseDate, plan.durationDays);

        // Buying during a trial ends the trial early rather than stacking a second live
        // row — the partial unique index would reject the insert otherwise.
        await this.closeCurrent(userId, ESubscriptionStatus.EXPIRED);

        const subscription = (await subscriptionModel.create({
            user_id: userId,
            planCode: plan.code,
            tier: ESubscriptionTier.PREMIUM,
            status: ESubscriptionStatus.ACTIVE,
            billingMode,
            provider: provider.name,
            trialStartAt: null,
            trialEndAt: null,
            currentPeriodStart: now,
            currentPeriodEnd,
            providerOrderId: order.order_id,
            providerSubscriptionId: null,
            mandateStatus: null,
            isCurrent: true,
        })) as unknown as ISubscription;

        await paymentOrderModel.updateOne(
            { _id: order._id },
            {
                $set: {
                    status: "paid",
                    razorpay_payment_id: providerPaymentId,
                    subscription_id: subscription._id,
                },
            },
        );

        // Granted in full at activation, usable at any pace, expiring with the term.
        await creditService.grantForPlan({
            userId,
            subscriptionId: subscription._id,
            credits: plan.credits,
            expiresAt: currentPeriodEnd,
        });

        await this.syncSnapshot(userId, subscription, {
            "subscription.hasUsedTrial": true,
            "is_onboarded.is_subscription_completed": true,
        });

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.SUBSCRIPTION_ACTIVATED,
            tier: ESubscriptionTier.PREMIUM,
            planCode: plan.code,
            metadata: {
                amountPaise: plan.amountPaise,
                durationDays: plan.durationDays,
                // Whether this activation came off the back of a trial is the single
                // most useful dimension on this event.
                fromTrial: previousTier === ESubscriptionTier.TRIAL,
            },
        });

        return subscription;
    }

    /**
     * Grant a subscription with no payment behind it, for a redeemed referral code.
     *
     * Deliberately a separate method rather than reaching into `activateFromPaidOrder`:
     * that one writes to `payment_orders` and assumes a real order exists, so calling it
     * with a synthetic order would put a fictional payment in the billing ledger. The
     * row it produces here is honest about its origin — `provider: INTERNAL_GRANT`,
     * `grantSource: REFERRAL` — so no ops query mistakes it for a checkout that lost
     * its order id.
     *
     * Idempotent: a user who already has live PREMIUM is returned unchanged rather than
     * granted twice. That is what makes it safe to retry from the redemption flow.
     */
    public async grantFromReferral({
        userId,
        planCode,
        programId,
        now = new Date(),
    }: {
        userId: TObjectIdLike;
        planCode: EPlanCode;
        programId: TObjectIdLike;
        now?: Date;
    }): Promise<ISubscription> {
        const plan = await subscriptionPlanService.getByCode(planCode);
        if (!plan) {
            throw new SubscriptionError("PLAN_NOT_FOUND", `Plan ${planCode} is not available`, 404);
        }

        const existing = await this.getCurrent(userId);
        const hasLivePremium =
            existing?.tier === ESubscriptionTier.PREMIUM &&
            existing?.currentPeriodEnd != null &&
            existing.currentPeriodEnd > now;
        if (hasLivePremium) return existing as ISubscription;

        const currentPeriodEnd = addDays(now, plan.durationDays);

        // Ends a live trial rather than stacking a second row — the partial unique index
        // would reject the insert otherwise. Same move as the paid path.
        await this.closeCurrent(userId, ESubscriptionStatus.EXPIRED);

        const subscription = (await subscriptionModel.create({
            user_id: userId,
            planCode: plan.code,
            tier: ESubscriptionTier.PREMIUM,
            status: ESubscriptionStatus.ACTIVE,
            // HARDCODED MANUAL, never env.BILLING_MODE. There is no mandate behind a
            // grant, and an AUTOPAY-stamped row would be picked up by machinery that
            // assumes one exists.
            billingMode: EBillingMode.MANUAL,
            provider: EBillingProvider.INTERNAL_GRANT,
            trialStartAt: null,
            trialEndAt: null,
            currentPeriodStart: now,
            currentPeriodEnd,
            providerOrderId: null,
            providerSubscriptionId: null,
            mandateStatus: null,
            isCurrent: true,
            grantSource: ESubscriptionGrantSource.REFERRAL,
            referral_program_id: programId,
        })) as unknown as ISubscription;

        // The seat was bought at the plan's price, which includes its credits. A deal
        // that should not include them points at LITE, which exists for exactly that.
        await creditService.grantForPlan({
            userId,
            subscriptionId: subscription._id,
            credits: plan.credits,
            expiresAt: currentPeriodEnd,
        });

        // `is_subscription_completed` MUST be set here: the app skips the plan catalog
        // for a granted user, so nothing else will ever set it and she would be stuck
        // in onboarding forever.
        await this.syncSnapshot(userId, subscription, {
            "subscription.hasUsedTrial": true,
            "is_onboarded.is_subscription_completed": true,
        });

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.SUBSCRIPTION_ACTIVATED,
            tier: ESubscriptionTier.PREMIUM,
            planCode: plan.code,
            metadata: {
                amountPaise: 0,
                durationDays: plan.durationDays,
                grantSource: ESubscriptionGrantSource.REFERRAL,
                referralProgramId: String(programId),
            },
        });

        return subscription;
    }

    /**
     * Activate from a Google Play purchase.
     *
     * The Play counterpart of activateFromPaidOrder, and deliberately a separate method
     * rather than a branch inside it, because the two rails agree on almost nothing:
     * there is no server-created order, no signature, no paymentOrder row, and — the
     * part that matters most — **the period end is not ours to compute**.
     *
     * Google owns the billing calendar on this rail. Free-trial length, grace periods,
     * account hold, pauses and upgrade proration all move the expiry, so
     * `currentPeriodEnd` is copied from `lineItems[0].expiryTime` and never derived from
     * `plan.durationDays`. A locally computed date drifts from what the user sees in the
     * Play app, and when they disagree, Play is right.
     *
     * Idempotent on the purchase token: the client retries verification after a network
     * failure, and RTDN can deliver SUBSCRIPTION_PURCHASED for a purchase the client
     * already reported.
     */
    public async activateFromPlayPurchase(
        userId: TObjectIdLike,
        input: { purchaseToken: string; productId: string },
    ): Promise<ISubscription> {
        const provider = getBillingProvider(EBillingMode.PLAY) as GooglePlayProvider;

        // Already redeemed? Return it unchanged before doing anything else — this is the
        // retry path and it must not close and recreate a live subscription.
        const existing = (await subscriptionModel
            .findOne({ playPurchaseToken: input.purchaseToken, isCurrent: true })
            .lean()) as ISubscription | null;
        if (existing) {
            if (String(existing.user_id) !== String(userId)) {
                // Someone is presenting a purchase token that already belongs to another
                // account. Never a legitimate client state.
                throw new SubscriptionError(
                    "PLAY_PURCHASE_ALREADY_CLAIMED",
                    "This purchase belongs to a different account",
                    409,
                );
            }

            // The entitlement is already granted, but acknowledgement may not have
            // landed — the client only re-reports purchases Play still lists as
            // unacknowledged, so arriving here is itself evidence that it did not. Costs
            // one Play read on a path that stops firing as soon as it succeeds.
            const acknowledged = await provider.getSubscription(input.purchaseToken);
            await this.ensureAcknowledged(provider, input.purchaseToken, acknowledged);

            // Re-derive the snapshot too: verify is the recovery endpoint, so it should
            // converge a user whose snapshot drifted rather than returning early on the
            // strength of a row that reads fine.
            await this.refreshSnapshot(userId);

            return existing;
        }

        const purchase = await provider.getSubscription(input.purchaseToken);

        // PENDING is its own case, not a failure: on UPI a purchase can sit unpaid for
        // minutes. Saying so lets the app show "waiting for your payment" instead of an
        // error, and the eventual RTDN completes it.
        if (purchase.subscriptionState === EPlaySubscriptionState.PENDING) {
            throw new SubscriptionError(
                "PLAY_PURCHASE_PENDING",
                "Payment is still being confirmed by Google Play",
                409,
            );
        }

        if (!PLAY_ENTITLED_STATES.includes(purchase.subscriptionState)) {
            throw new SubscriptionError(
                "PLAY_PURCHASE_NOT_ACTIVE",
                `Purchase is not active (${purchase.subscriptionState})`,
                400,
            );
        }

        // Bind the purchase to the caller. See play-account-id.ts for why the endpoint
        // being authenticated is not sufficient on its own.
        const expectedAccountId = obfuscatedPlayAccountId(userId);
        const claimedAccountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
        if (!playAccountIdMatches(expectedAccountId, claimedAccountId)) {
            throw new SubscriptionError(
                "PLAY_ACCOUNT_MISMATCH",
                "This purchase was not made by this account",
                403,
            );
        }

        const lineItem = purchase.lineItems?.[0];
        if (!lineItem?.expiryTime) {
            throw new SubscriptionError(
                "PLAY_PURCHASE_MALFORMED",
                "Purchase has no line item or expiry",
                502,
            );
        }

        // An unrecognised product is an error, never a default. Falling back to the
        // cheapest plan on a mapping typo would grant the wrong tier and the wrong credit
        // buckets, and nothing downstream would notice.
        const planCode = planCodeForPlayProduct(lineItem.productId);
        if (!planCode) {
            throw new SubscriptionError(
                "PLAY_PRODUCT_UNMAPPED",
                `Play product ${lineItem.productId} is not in this catalog`,
                400,
            );
        }

        const plan = await subscriptionPlanService.getByCode(planCode);
        if (!plan) {
            throw new SubscriptionError("PLAN_NOT_FOUND", "Plan for this product not found", 404);
        }

        const now = new Date();
        const currentPeriodEnd = new Date(lineItem.expiryTime);

        const previous = await this.getCurrent(userId);
        const previousTier = previous?.tier ?? null;

        // No period roll-forward here, unlike the Razorpay path: Google has already done
        // its own proration when issuing this purchase, and adding ours on top would pay
        // the user twice for the same days.
        // Scoped so a sibling call verifying this same token cannot expire the row that
        // sibling just inserted. Any OTHER live subscription is still closed, which is
        // the actual job here (an upgrade replacing a cheaper plan).
        await this.closeCurrent(userId, ESubscriptionStatus.EXPIRED, {
            exceptPlayPurchaseToken: input.purchaseToken,
        });

        let subscription: ISubscription;
        try {
            subscription = (await subscriptionModel.create({
                user_id: userId,
                planCode: plan.code,
                tier: ESubscriptionTier.PREMIUM,
                status: ESubscriptionStatus.ACTIVE,
                billingMode: EBillingMode.PLAY,
                provider: provider.name,
                trialStartAt: null,
                trialEndAt: null,
                currentPeriodStart: purchase.startTime ? new Date(purchase.startTime) : now,
                currentPeriodEnd,
                providerOrderId: purchase.latestOrderId ?? null,
                providerSubscriptionId: null,
                mandateStatus: null,
                playPurchaseToken: input.purchaseToken,
                isCurrent: true,
            })) as unknown as ISubscription;
        } catch (error) {
            // One purchase reaches this method several times over: the client's own
            // purchaseUpdatedListener resolves a verify call, and the launch reconcile
            // sweep independently posts the same token. The check at the top of this
            // method catches the sequential case; concurrent callers all read "no row
            // yet" and all insert, and the unique indexes let exactly one through.
            //
            // A duplicate here therefore means a sibling call already did this work —
            // the user IS subscribed. Re-read and return that row rather than throwing,
            // or the purchase succeeds while the app shows "failed to complete setup".
            if ((error as { code?: number }).code !== 11000) throw error;

            // Two different unique indexes can raise 11000 here and they mean opposite
            // things, so the row that owns the token decides which happened. Looked up
            // by token alone: filtering on isCurrent would make the second case below
            // indistinguishable from the third.
            const owner = (await subscriptionModel
                .findOne({ playPurchaseToken: input.purchaseToken })
                .lean()) as ISubscription | null;

            // A sibling call won the race and its row is live. Return it — the caller
            // asked for this purchase to be active and it is. Acknowledge on the way
            // out: the winner may still be mid-flight, and two acknowledges of the same
            // token are harmless where zero is a refund.
            if (owner?.isCurrent) {
                await this.ensureAcknowledged(provider, input.purchaseToken, purchase);
                return owner;
            }

            // The token was redeemed before and that subscription has since ended. Not a
            // conflict with anything, and not something a retry fixes: replaying an old
            // token cannot resurrect a term Google has already closed.
            if (owner) {
                throw new SubscriptionError(
                    "PLAY_PURCHASE_ALREADY_CONSUMED",
                    "This purchase has already been redeemed and its term has ended",
                    409,
                );
            }

            // Nothing owns the token, so the collision was on the one-live-row-per-user
            // index: a different subscription holds the slot. That is a real conflict.
            throw new SubscriptionError(
                "SUBSCRIPTION_CONFLICT",
                "Could not activate this purchase; a different subscription is already live",
                409,
            );
        }

        // Close out the plan being replaced before granting the new one's allowance.
        // `closeCurrent` above only retires the ROW; the credit ledger is separate and
        // nothing else zeroes it, so an upgrade would otherwise hand the user the new
        // plan's credits stacked on whatever the old plan left unspent — the same
        // accumulation the renewal path had, reached through a different door.
        //
        // Guarded on the token because the row being replaced has to be a genuinely
        // different subscription: expiring on a re-verify of the SAME purchase would
        // destroy the allowance that purchase had just been granted.
        if (previous && previous.playPurchaseToken !== input.purchaseToken) {
            for (const type of [ECreditType.EXPERT, ECreditType.CARE_MANAGER]) {
                await creditService.expireBucket({
                    userId,
                    subscriptionId: previous._id,
                    type,
                    expiresAt: now,
                });
            }
        }

        await creditService.grantForPlan({
            userId,
            subscriptionId: subscription._id,
            credits: plan.credits,
            expiresAt: currentPeriodEnd,
        });

        await this.syncSnapshot(userId, subscription, {
            "subscription.hasUsedTrial": true,
            "is_onboarded.is_subscription_completed": true,
        });

        // ⚠️ Acknowledge LAST, and only once the row is committed. Acknowledging before
        // the row exists means a crash here leaves Google believing a purchase was
        // delivered that this system has no record of.
        //
        // Retried by the client sweep rather than by RTDN, which never acknowledges: a
        // failure here leaves the purchase unacknowledged, Play keeps listing it as
        // such, and the next foreground re-verifies and reaches the early-return path
        // above, which acknowledges.
        await this.ensureAcknowledged(provider, input.purchaseToken, purchase);

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.SUBSCRIPTION_ACTIVATED,
            tier: ESubscriptionTier.PREMIUM,
            planCode: plan.code,
            metadata: {
                amountPaise: plan.amountPaise,
                durationDays: plan.durationDays,
                fromTrial: previousTier === ESubscriptionTier.TRIAL,
                billingMode: EBillingMode.PLAY,
                isTestPurchase: Boolean(purchase.testPurchase),
            },
        });

        return subscription;
    }

    /**
     * Close out the old term's credits and grant the renewed term's.
     *
     * Only reachable from the Play rail today, because it is the only one that renews
     * without a fresh purchase: MANUAL has no renewal at all, and AUTOPAY's Razorpay
     * charge comes back through `activateFromPaidOrder`, which grants on its own.
     *
     * Credits are per period, not cumulative: an allowance of one expert consultation a
     * month means one a month, not twelve banked and spent at once. That distinction is
     * money — every consultation carries a real fulfilment cost — so it cannot rest on
     * the `expiresAt` stamped on each grant. Nothing reads that field: `getBalance`
     * returns the newest ledger row's running `balanceAfter` and never filters on dates,
     * so an unspent credit stays spendable until something explicitly zeroes it. This is
     * that something.
     *
     * Expiring before granting keeps the user whole. The two writes are adjacent, so the
     * balance goes 1 -> 0 -> 1 rather than ever resting at 0, and the ledger records both
     * halves: an EXPIRE stamped with the term that ended, then a GRANT for the new one.
     */
    public async grantRenewalCredits(subscription: ISubscription, expiresAt: Date): Promise<void> {
        if (!subscription.planCode) return;

        const plan = await subscriptionPlanService.getByCode(subscription.planCode);
        if (!plan) {
            // A renewal for a plan that has since been removed from the catalog. The
            // subscription itself is still valid, so the term is already extended; only
            // the credit grant is skipped, and loudly.
            log.error(
                { planCode: subscription.planCode, subscriptionId: String(subscription._id) },
                "Renewal credits skipped: plan not found in catalog",
            );
            return;
        }

        // The caller passes the row as it was BEFORE the renewal was applied, so this is
        // the outgoing term's end — a truer stamp for the EXPIRE row than "now", which on
        // a late-arriving notification can be hours past the boundary it belongs to.
        const outgoingTermEnd = subscription.currentPeriodEnd ?? new Date();

        for (const type of [ECreditType.EXPERT, ECreditType.CARE_MANAGER]) {
            await creditService.expireBucket({
                userId: subscription.user_id,
                subscriptionId: subscription._id,
                type,
                expiresAt: outgoingTermEnd,
            });
        }

        await creditService.grantForPlan({
            userId: subscription.user_id,
            subscriptionId: subscription._id,
            credits: plan.credits,
            expiresAt,
        });
    }

    /**
     * Cancel. Access continues to `currentPeriodEnd` — the row stays live and the
     * lifecycle job retires it when the period actually ends.
     */
    public async cancel(userId: TObjectIdLike): Promise<ISubscription> {
        const current = await this.getCurrent(userId);
        if (!current) {
            throw new SubscriptionError(
                "NO_ACTIVE_SUBSCRIPTION",
                "No active subscription to cancel",
                404,
            );
        }

        if (current.status === ESubscriptionStatus.CANCELLED) return current;

        await getBillingProvider(current.billingMode).cancel(current);

        const updated = (await subscriptionModel
            .findByIdAndUpdate(
                current._id,
                { $set: { status: ESubscriptionStatus.CANCELLED, cancelledAt: new Date() } },
                { new: true },
            )
            .lean()) as ISubscription;

        await this.syncSnapshot(userId, updated);

        analyticsService.track({
            userId,
            event: EAnalyticsEvent.SUBSCRIPTION_CANCELLED,
            tier: current.tier,
            planCode: current.planCode,
            metadata: { accessUntil: current.currentPeriodEnd },
        });

        return updated;
    }

    /**
     * Retire a subscription whose term has ended.
     *
     * Called by the lifecycle job and by the Play RTDN handlers for EXPIRED, REVOKED and
     * voided purchases. A late run delays notifications, never correctness: the
     * entitlement layer re-derives the tier from the snapshot's dates on every request.
     *
     * ⚠️ The row passed in is NOT necessarily the user's current one. On the Play rail a
     * plan change issues a new purchase token and Google then expires the old one, so an
     * EXPIRED — or a refund of the previous term — arrives for a row that was closed
     * while a newer, paid subscription is live. `findByToken` in the RTDN service looks
     * up by token alone, which is what surfaces those rows here.
     */
    public async expire(subscription: ISubscription, now: Date = new Date()): Promise<void> {
        await subscriptionModel.updateOne(
            { _id: subscription._id },
            { $set: { status: ESubscriptionStatus.EXPIRED, isCurrent: false } },
        );

        for (const type of [ECreditType.EXPERT, ECreditType.CARE_MANAGER]) {
            await creditService.expireBucket({
                userId: subscription.user_id,
                subscriptionId: subscription._id,
                type,
                expiresAt: now,
            });
        }

        // Re-derive rather than blank. `resolveTier` reads this snapshot and nothing
        // else, so an unconditional clear here would drop a user to FREE on the strength
        // of an old row expiring — losing access they have paid for, silently, with a
        // support ticket as their only recourse. getCurrent returns null when nothing is
        // live, which preserves the ordinary end-of-term behaviour.
        const live = await this.getCurrent(subscription.user_id);
        await this.syncSnapshot(subscription.user_id, live);

        analyticsService.track({
            userId: subscription.user_id,
            event:
                subscription.tier === ESubscriptionTier.TRIAL
                    ? EAnalyticsEvent.TRIAL_EXPIRED
                    : EAnalyticsEvent.SUBSCRIPTION_EXPIRED,
            tier: subscription.tier,
            planCode: subscription.planCode,
        });
    }

    /** Rows whose trial or paid period has elapsed but are still marked live. */
    public async findExpirable(now: Date = new Date()): Promise<ISubscription[]> {
        return subscriptionModel
            .find({
                isCurrent: true,
                status: { $in: LIVE_STATUSES },
                $or: [
                    {
                        status: ESubscriptionStatus.TRIALING,
                        trialEndAt: { $lte: now },
                    },
                    {
                        status: {
                            $in: [
                                ESubscriptionStatus.ACTIVE,
                                ESubscriptionStatus.CANCELLED,
                                ESubscriptionStatus.HALTED,
                            ],
                        },
                        currentPeriodEnd: { $lte: now },
                    },
                ],
            })
            .lean();
    }
}

export const subscriptionService = new SubscriptionService();
export { LIVE_STATUSES };
