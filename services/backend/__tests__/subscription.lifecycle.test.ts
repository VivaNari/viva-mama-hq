jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
// Razorpay's constructor validates credentials at construction time; the provider is
// stubbed below, but the module is still imported.
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import subscriptionModel from "../src/models/subscription.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import paymentOrderModel from "../src/models/payment-order.model";
import UserModel from "../src/models/user.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import { subscriptionService } from "../src/services/subscription/subscription.service";
import {
    creditService,
    InsufficientCreditsError,
} from "../src/services/entitlements/credit.service";
import { ECapability } from "../src/services/entitlements/entitlement.config";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { __setBillingProviderForTests } from "../src/services/subscription/billing";
import {
    EBillingMode,
    EBillingProvider,
    ECreditType,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

/** Deterministic stand-in for Razorpay — no network, signature always valid. */
const stubProvider = {
    mode: EBillingMode.MANUAL,
    name: EBillingProvider.RAZORPAY_ORDERS,
    startTrial: jest.fn(async () => ({ providerSubscriptionId: null, mandateStatus: null })),
    createCheckout: jest.fn(async (_userId: string, plan: any) => ({
        providerOrderId: `order_${Date.now()}_${Math.random()}`,
        amountPaise: plan.amountPaise,
        currency: "INR",
        providerKeyId: "rzp_test_key",
    })),
    verify: jest.fn(async (input: any) => ({
        providerOrderId: input.razorpay_order_id,
        providerPaymentId: "pay_stub",
    })),
    cancel: jest.fn(async () => undefined),
};

async function makeUser() {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        is_onboarded: { is_questionnaire_completed: true, is_subscription_completed: false },
    });
    return user;
}

async function seedPlans() {
    await subscriptionPlanModel.create([
        {
            code: EPlanCode.MONTHLY,
            displayName: "Monthly",
            amountPaise: 149_900,
            durationDays: 30,
            credits: { expert: 1, careManager: 1 },
        },
        {
            code: EPlanCode.HALF_YEARLY,
            displayName: "6 Months",
            amountPaise: 399_900,
            durationDays: 180,
            credits: { expert: 6, careManager: 6 },
        },
    ]);
}

beforeAll(async () => {
    await connectTestDb();
    __setBillingProviderForTests(EBillingMode.MANUAL, stubProvider as any);
});

afterAll(async () => {
    __setBillingProviderForTests(EBillingMode.MANUAL, null);
    await closeTestDb();
});

beforeEach(async () => {
    await clearTestDb();
    await seedPlans();
});

describe("startTrial", () => {
    it("creates a 7-day trial and marks the trial used", async () => {
        const user = await makeUser();
        const sub = await subscriptionService.startTrial(user._id);

        expect(sub.tier).toBe(ESubscriptionTier.TRIAL);
        expect(sub.status).toBe(ESubscriptionStatus.TRIALING);
        expect(sub.planCode).toBeNull();

        const days = Math.round(
            (sub.trialEndAt!.getTime() - sub.trialStartAt!.getTime()) / 86_400_000,
        );
        expect(days).toBe(7);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.TRIAL);
        expect(fresh!.subscription.hasUsedTrial).toBe(true);
        // Onboarding completes down the trial branch as well as the free branch.
        expect(fresh!.is_onboarded.is_subscription_completed).toBe(true);
    });

    it("refuses a second trial, forever", async () => {
        const user = await makeUser();
        await subscriptionService.startTrial(user._id);
        // Even once the first trial is fully expired and retired.
        const sub = await subscriptionService.getCurrent(user._id);
        await subscriptionService.expire(sub!);

        await expect(subscriptionService.startTrial(user._id)).rejects.toMatchObject({
            code: "TRIAL_ALREADY_USED",
        });
    });

    // The partial unique index is the real guard; this asserts the service surfaces it
    // as a clean error rather than a duplicate-key crash.
    it("refuses a trial while a subscription is already live", async () => {
        const user = await makeUser();
        await subscriptionService.startTrial(user._id);
        await UserModel.findByIdAndUpdate(user._id, {
            $set: { "subscription.hasUsedTrial": false },
        });

        await expect(subscriptionService.startTrial(user._id)).rejects.toMatchObject({
            code: "SUBSCRIPTION_EXISTS",
        });
    });

    it("stamps the billing mode on the row", async () => {
        const user = await makeUser();
        const sub = await subscriptionService.startTrial(user._id);
        expect(sub.billingMode).toBe(EBillingMode.MANUAL);
    });
});

describe("checkout and activation", () => {
    it("derives the amount from the plan, never from the caller", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.HALF_YEARLY);

        expect(checkout.amountPaise).toBe(399_900);

        const order = await paymentOrderModel.findOne({ order_id: checkout.providerOrderId });
        expect(order!.amount).toBe(399_900);
        expect(order!.planCode).toBe(EPlanCode.HALF_YEARLY);
    });

    it("rejects an unknown plan", async () => {
        const user = await makeUser();
        await expect(
            subscriptionService.createCheckout(user._id, "PLATINUM" as EPlanCode),
        ).rejects.toMatchObject({ code: "PLAN_NOT_FOUND" });
    });

    it("activates premium and grants the plan's credits in both buckets", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.HALF_YEARLY);

        const sub = await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_1",
            razorpay_signature: "sig",
        });

        expect(sub.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(sub.planCode).toBe(EPlanCode.HALF_YEARLY);

        const days = Math.round(
            (sub.currentPeriodEnd!.getTime() - sub.currentPeriodStart!.getTime()) / 86_400_000,
        );
        expect(days).toBe(180);

        // 12 total, split evenly — never one shared pool.
        const balances = await creditService.getBalances(user._id);
        expect(balances).toEqual({ expert: 6, careManager: 6 });
    });

    it("ends the trial early when the user buys mid-trial", async () => {
        const user = await makeUser();
        await subscriptionService.startTrial(user._id);

        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_2",
            razorpay_signature: "sig",
        });

        // Exactly one live row — the invariant the unique index protects.
        const live = await subscriptionModel.find({ user_id: user._id, isCurrent: true });
        expect(live).toHaveLength(1);
        expect(live[0]!.tier).toBe(ESubscriptionTier.PREMIUM);

        const all = await subscriptionModel.find({ user_id: user._id });
        expect(all).toHaveLength(2); // history preserved
    });

    // Razorpay can deliver a callback more than once; a replay must not buy a second term.
    it("is idempotent when the same verified callback replays", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        const payload = {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_3",
            razorpay_signature: "sig",
        };

        const first = await subscriptionService.activatePaid(user._id, payload);
        const second = await subscriptionService.activatePaid(user._id, payload);

        expect(String(second._id)).toBe(String(first._id));
        const balances = await creditService.getBalances(user._id);
        expect(balances).toEqual({ expert: 1, careManager: 1 }); // not doubled
    });

    it("marks the order failed and refuses activation on a bad signature", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        stubProvider.verify.mockRejectedValueOnce(new Error("PAYMENT_SIGNATURE_INVALID"));

        await expect(
            subscriptionService.activatePaid(user._id, {
                razorpay_order_id: checkout.providerOrderId,
                razorpay_payment_id: "pay_4",
                razorpay_signature: "forged",
            }),
        ).rejects.toMatchObject({ code: "PAYMENT_VERIFICATION_FAILED" });

        const order = await paymentOrderModel.findOne({ order_id: checkout.providerOrderId });
        expect(order!.status).toBe("failed");
        expect(await subscriptionService.getCurrent(user._id)).toBeNull();
    });
});

describe("cancel and expiry", () => {
    it("keeps premium access until period end after cancelling", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_5",
            razorpay_signature: "sig",
        });

        const cancelled = await subscriptionService.cancel(user._id);
        expect(cancelled.status).toBe(ESubscriptionStatus.CANCELLED);
        expect(cancelled.cancelledAt).not.toBeNull();
        expect(cancelled.isCurrent).toBe(true);

        const fresh = await UserModel.findById(user._id).lean();
        expect(entitlementService.resolveTier(fresh as any)).toBe(ESubscriptionTier.PREMIUM);
    });

    it("does not drop a user to FREE when an already-closed row expires", async () => {
        // The Play rail reaches expire() with rows that are not the user's current one:
        // a plan change issues a new purchase token and Google then expires the old one,
        // and the RTDN handler looks up by token alone. Blanking the snapshot on that
        // signal would revoke access the user has paid for, because resolveTier reads
        // the snapshot and nothing else.
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_superseded",
            razorpay_signature: "sig",
        });
        const superseded = (await subscriptionService.getCurrent(user._id))!;

        // The replacement, exactly as a plan change would leave things: the old row
        // closed, a newer paid row live.
        const replacement = await subscriptionService.createCheckout(
            user._id,
            EPlanCode.HALF_YEARLY,
        );
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: replacement.providerOrderId,
            razorpay_payment_id: "pay_replacement",
            razorpay_signature: "sig",
        });
        const live = (await subscriptionService.getCurrent(user._id))!;
        expect(String(live._id)).not.toBe(String(superseded._id));

        await subscriptionService.expire(superseded);

        const fresh = await UserModel.findById(user._id).lean();
        expect(entitlementService.resolveTier(fresh as any)).toBe(ESubscriptionTier.PREMIUM);
        expect(String(fresh!.subscription!.subscription_id)).toBe(String(live._id));

        // The live row is untouched; only the superseded one is retired.
        const stillLive = await subscriptionModel.findById(live._id).lean();
        expect(stillLive!.isCurrent).toBe(true);
    });

    it("still drops the user to FREE when the last live row expires", async () => {
        // The guard above must not turn expire() into a no-op for the ordinary
        // end-of-term case, which is what the lifecycle job relies on.
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_last",
            razorpay_signature: "sig",
        });

        await subscriptionService.expire((await subscriptionService.getCurrent(user._id))!);

        const fresh = await UserModel.findById(user._id).lean();
        expect(entitlementService.resolveTier(fresh as any)).toBe(ESubscriptionTier.FREE);
    });

    // The two paths the My Subscription screen depends on. Neither had coverage, and the
    // app's behaviour is built on both being true.
    it("refuses to cancel when there is nothing to cancel", async () => {
        const user = await makeUser();

        // The screen hides its cancel button on a free account, so reaching this means
        // the client's view of the subscription was stale. It must be an orderly refusal,
        // not a 500.
        await expect(subscriptionService.cancel(user._id)).rejects.toMatchObject({
            code: "NO_ACTIVE_SUBSCRIPTION",
            statusCode: 404,
        });
    });

    it("treats a second cancel as a no-op and does not move the access date", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_cancel_twice",
            razorpay_signature: "sig",
        });

        const first = await subscriptionService.cancel(user._id);
        const second = await subscriptionService.cancel(user._id);

        // The app retries a cancel after a network error without knowing whether the
        // first one landed. A second call must not shorten the access she already has,
        // nor re-stamp the moment she cancelled.
        expect(second.status).toBe(ESubscriptionStatus.CANCELLED);
        expect(second.currentPeriodEnd).toEqual(first.currentPeriodEnd);
        expect(second.cancelledAt).toEqual(first.cancelledAt);
        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(1);

        const fresh = await UserModel.findById(user._id).lean();
        expect(entitlementService.resolveTier(fresh as any)).toBe(ESubscriptionTier.PREMIUM);
    });

    /**
     * Cancelling must change what she is *billed*, and nothing about what she can *do*
     * until the period she paid for runs out. Asserted against the real gates —
     * getEntitlements, assertCapability, consumeCapability and the credit ledger —
     * rather than against `resolveTier` alone, because a regression would most likely
     * arrive as some new check reading `status` instead of the tier.
     */
    describe("cancelling does not disturb existing access", () => {
        const activatePaidPlan = async (userId: any, paymentId: string) => {
            const checkout = await subscriptionService.createCheckout(userId, EPlanCode.MONTHLY);
            await subscriptionService.activatePaid(userId, {
                razorpay_order_id: checkout.providerOrderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: "sig",
            });
        };

        it("leaves every capability exactly as it was", async () => {
            const user = await makeUser();
            await activatePaidPlan(user._id, "pay_caps_before");

            const before = await entitlementService.getEntitlements(user._id);
            await subscriptionService.cancel(user._id);
            const after = await entitlementService.getEntitlements(user._id);

            // Whole-object comparison rather than a spot check on one capability: any
            // future capability is covered automatically, and only `status` is allowed
            // to differ.
            expect(after.capabilities).toEqual(before.capabilities);
            expect(after.tier).toBe(before.tier);
            expect(after.planCode).toBe(before.planCode);
            expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
            expect(after.credits).toEqual(before.credits);
            expect(after.status).toBe(ESubscriptionStatus.CANCELLED);
        });

        it("still lets a premium-only feature run, on premium limits", async () => {
            const user = await makeUser();
            await activatePaidPlan(user._id, "pay_caps_consume");
            await subscriptionService.cancel(user._id);

            // The weekly check-in is the capability FREE does not get at all, so it is
            // the one that proves premium is still in force.
            await expect(
                entitlementService.assertCapability(user._id, ECapability.CHECKIN_WEEKLY),
            ).resolves.toBe(ESubscriptionTier.PREMIUM);

            // Still on the premium allowance, not the free 3-a-day one: the limit stays
            // null (unlimited), which is also why nothing is metered here.
            const used = await entitlementService.consumeCapability(user._id, ECapability.AI_CHAT);
            expect(used.limit).toBeNull();
            expect(used.remaining).toBeNull();
        });

        it("does not touch her consultation credits", async () => {
            const user = await makeUser();
            await activatePaidPlan(user._id, "pay_caps_credits");

            const sub = await subscriptionService.cancel(user._id);

            // Granted by the plan, unspent, and still spendable — cancelling is not a
            // forfeit of what the plan already bought.
            expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);

            await creditService.consume({
                userId: user._id,
                subscriptionId: sub._id,
                type: ECreditType.EXPERT,
                consultationId: "5f0000000000000000000042",
                expiresAt: sub.currentPeriodEnd!,
            });

            expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);
        });

        it("drops to FREE once the paid period ends, and not before", async () => {
            const user = await makeUser();
            await activatePaidPlan(user._id, "pay_caps_boundary");
            await subscriptionService.cancel(user._id);

            const fresh = await UserModel.findById(user._id).lean();
            const periodEnd = fresh!.subscription.currentPeriodEnd!;

            const aMomentBefore = new Date(periodEnd.getTime() - 1000);
            const aMomentAfter = new Date(periodEnd.getTime() + 1000);

            expect(entitlementService.resolveTier(fresh as any, aMomentBefore)).toBe(
                ESubscriptionTier.PREMIUM,
            );
            // Falls to FREE on the date alone — no cron run involved, so a stalled
            // lifecycle job can never keep granting access it should not.
            expect(entitlementService.resolveTier(fresh as any, aMomentAfter)).toBe(
                ESubscriptionTier.FREE,
            );
        });

        it("keeps a cancelled trial on TRIAL until the trial end date", async () => {
            const user = await makeUser();
            await subscriptionService.startTrial(user._id);

            const cancelled = await subscriptionService.cancel(user._id);
            // A trial has no currentPeriodEnd, so the access date has to come from
            // trialEndAt — the fallback the cancel controller returns as `accessUntil`.
            expect(cancelled.currentPeriodEnd).toBeNull();
            expect(cancelled.trialEndAt).not.toBeNull();

            const fresh = await UserModel.findById(user._id).lean();
            expect(entitlementService.resolveTier(fresh as any)).toBe(ESubscriptionTier.TRIAL);
        });
    });

    it("expires a lapsed trial and drops the user to FREE", async () => {
        const user = await makeUser();
        await subscriptionService.startTrial(user._id);

        // Rewind the trial so it has already lapsed.
        await subscriptionModel.updateOne(
            { user_id: user._id, isCurrent: true },
            { $set: { trialEndAt: new Date(Date.now() - 1000) } },
        );

        const due = await subscriptionService.findExpirable();
        expect(due).toHaveLength(1);

        await subscriptionService.expire(due[0]!);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.FREE);
        // Never cleared, so the trial cannot be taken twice.
        expect(fresh!.subscription.hasUsedTrial).toBe(true);
        expect(await subscriptionService.getCurrent(user._id)).toBeNull();
    });

    it("expires unconsumed credits with an auditable ledger row", async () => {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: "pay_6",
            razorpay_signature: "sig",
        });

        const sub = await subscriptionService.getCurrent(user._id);
        await subscriptionService.expire(sub!);

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 0,
            careManager: 0,
        });
        // Zeroed by appending, not by deleting history.
        const expiries = await consultationCreditModel.find({ reason: "EXPIRE" });
        expect(expiries).toHaveLength(2);
    });

    it("does not treat a still-running subscription as expirable", async () => {
        const user = await makeUser();
        await subscriptionService.startTrial(user._id);
        expect(await subscriptionService.findExpirable()).toHaveLength(0);
    });
});

describe("credit ledger concurrency", () => {
    async function premiumUserWithCredits() {
        const user = await makeUser();
        const checkout = await subscriptionService.createCheckout(user._id, EPlanCode.MONTHLY);
        await subscriptionService.activatePaid(user._id, {
            razorpay_order_id: checkout.providerOrderId,
            razorpay_payment_id: `pay_${Math.random()}`,
            razorpay_signature: "sig",
        });
        const sub = await subscriptionService.getCurrent(user._id);
        return { user, sub: sub! };
    }

    // The bug that costs real money: two bookings racing on a 1-credit balance.
    it("lets exactly one of five parallel consumes win on a 1-credit balance", async () => {
        const { user, sub } = await premiumUserWithCredits();

        const attempts = Array.from({ length: 5 }, (_, i) =>
            creditService
                .consume({
                    userId: user._id,
                    subscriptionId: sub._id,
                    type: ECreditType.EXPERT,
                    consultationId: `5f${String(i).padStart(22, "0")}`,
                    expiresAt: sub.currentPeriodEnd!,
                })
                .then(() => "ok" as const)
                .catch(() => "rejected" as const),
        );

        const results = await Promise.all(attempts);
        expect(results.filter((r) => r === "ok")).toHaveLength(1);
        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);
    });

    // A double-tapped "Book" on the same consultation must spend one credit, not two.
    it("spends one credit when the same consultation is booked twice", async () => {
        const { user, sub } = await premiumUserWithCredits();
        const consultationId = "5f0000000000000000000099";

        await creditService.consume({
            userId: user._id,
            subscriptionId: sub._id,
            type: ECreditType.EXPERT,
            consultationId,
            expiresAt: sub.currentPeriodEnd!,
        });

        await expect(
            creditService.consume({
                userId: user._id,
                subscriptionId: sub._id,
                type: ECreditType.EXPERT,
                consultationId,
                expiresAt: sub.currentPeriodEnd!,
            }),
        ).rejects.toThrow();

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(0);
    });

    it("refuses to consume below zero", async () => {
        const { user, sub } = await premiumUserWithCredits();
        await creditService.consume({
            userId: user._id,
            subscriptionId: sub._id,
            type: ECreditType.EXPERT,
            consultationId: "5f0000000000000000000001",
            expiresAt: sub.currentPeriodEnd!,
        });

        await expect(
            creditService.consume({
                userId: user._id,
                subscriptionId: sub._id,
                type: ECreditType.EXPERT,
                consultationId: "5f0000000000000000000002",
                expiresAt: sub.currentPeriodEnd!,
            }),
        ).rejects.toBeInstanceOf(InsufficientCreditsError);
    });

    it("keeps the two buckets independent", async () => {
        const { user, sub } = await premiumUserWithCredits();
        await creditService.consume({
            userId: user._id,
            subscriptionId: sub._id,
            type: ECreditType.EXPERT,
            consultationId: "5f0000000000000000000003",
            expiresAt: sub.currentPeriodEnd!,
        });

        // Spending the expert credit must not touch the care-manager bucket.
        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 0,
            careManager: 1,
        });
    });

    it("restores the balance on refund", async () => {
        const { user, sub } = await premiumUserWithCredits();
        await creditService.consume({
            userId: user._id,
            subscriptionId: sub._id,
            type: ECreditType.EXPERT,
            consultationId: "5f0000000000000000000004",
            expiresAt: sub.currentPeriodEnd!,
        });
        await creditService.refund({
            userId: user._id,
            subscriptionId: sub._id,
            type: ECreditType.EXPERT,
            consultationId: "5f0000000000000000000004",
            expiresAt: sub.currentPeriodEnd!,
        });

        expect(await creditService.getBalance(user._id, ECreditType.EXPERT)).toBe(1);
    });
});

describe("selectFree", () => {
    it("completes onboarding without creating a subscription row", async () => {
        const user = await makeUser();
        await subscriptionService.selectFree(user._id);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.FREE);
        expect(fresh!.is_onboarded.is_subscription_completed).toBe(true);
        // FREE is the absence of a subscription, not a row.
        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(0);
    });

    // Choosing free must not silently burn the trial.
    it("leaves the trial available", async () => {
        const user = await makeUser();
        await subscriptionService.selectFree(user._id);
        const sub = await subscriptionService.startTrial(user._id);
        expect(sub.tier).toBe(ESubscriptionTier.TRIAL);
    });
});
