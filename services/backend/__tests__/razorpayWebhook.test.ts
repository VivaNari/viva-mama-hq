jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest
        .fn()
        .mockImplementation(() => ({ subscriptions: { create: jest.fn(), cancel: jest.fn() } })),
);

import crypto from "crypto";

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import env from "../src/config/env";
import subscriptionModel from "../src/models/subscription.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import UserModel from "../src/models/user.model";
import webhookEventModel from "../src/models/webhook-event.model";
import {
    ERazorpayWebhookEvent,
    WebhookSignatureError,
    webhookService,
} from "../src/services/subscription/webhook.service";
import { creditService } from "../src/services/entitlements/credit.service";
import {
    EBillingMode,
    EBillingProvider,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const SECRET = "test_webhook_secret";
const RZP_SUB_ID = "sub_test_123";

function sign(body: string): string {
    return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

function chargedEvent(id: string, currentEnd?: number) {
    return {
        id,
        event: ERazorpayWebhookEvent.SUBSCRIPTION_CHARGED,
        payload: {
            subscription: {
                entity: {
                    id: RZP_SUB_ID,
                    status: "active",
                    ...(currentEnd ? { current_end: currentEnd } : {}),
                },
            },
        },
    };
}

async function makeTrialingAutopaySubscription() {
    const user = await UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: { tier: ESubscriptionTier.TRIAL, hasUsedTrial: true },
    });

    await subscriptionPlanModel.create({
        code: EPlanCode.MONTHLY,
        displayName: "Monthly",
        amountPaise: 149_900,
        durationDays: 30,
        credits: { expert: 1, careManager: 1 },
        razorpayPlanId: "plan_rzp_1",
    });

    const subscription = await subscriptionModel.create({
        user_id: user._id,
        planCode: EPlanCode.MONTHLY,
        tier: ESubscriptionTier.TRIAL,
        status: ESubscriptionStatus.TRIALING,
        billingMode: EBillingMode.AUTOPAY,
        provider: EBillingProvider.RAZORPAY_SUBSCRIPTIONS,
        trialStartAt: new Date(),
        trialEndAt: new Date(Date.now() + 7 * 86_400_000),
        providerSubscriptionId: RZP_SUB_ID,
        isCurrent: true,
    });

    return { user, subscription };
}

beforeAll(async () => {
    await connectTestDb();
    (env as { RAZORPAY_WEBHOOK_SECRET?: string }).RAZORPAY_WEBHOOK_SECRET = SECRET;
});
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("signature verification", () => {
    it("accepts a correctly signed body", () => {
        const body = JSON.stringify(chargedEvent("evt_1"));
        expect(() => webhookService.verifySignature(body, sign(body))).not.toThrow();
    });

    it("rejects a tampered body", () => {
        const body = JSON.stringify(chargedEvent("evt_1"));
        const signature = sign(body);
        const tampered = body.replace("sub_test_123", "sub_attacker");

        expect(() => webhookService.verifySignature(tampered, signature)).toThrow(
            WebhookSignatureError,
        );
    });

    it("rejects a missing signature", () => {
        const body = JSON.stringify(chargedEvent("evt_1"));
        expect(() => webhookService.verifySignature(body, undefined)).toThrow(
            WebhookSignatureError,
        );
    });
});

describe("subscription.charged", () => {
    it("converts a trial to premium and grants the plan's credits", async () => {
        const { user, subscription } = await makeTrialingAutopaySubscription();

        const result = await webhookService.handle(chargedEvent("evt_charge_1"));
        expect(result.processed).toBe(true);

        const updated = await subscriptionModel.findById(subscription._id);
        expect(updated!.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(updated!.status).toBe(ESubscriptionStatus.ACTIVE);
        expect(updated!.trialEndAt).toBeNull();

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.PREMIUM);

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    /**
     * Razorpay retries until it gets a 2xx, so the same charge arrives repeatedly.
     * Without the idempotency guard this would grant a term and a set of credits each
     * time — the single most expensive bug available in this file.
     */
    it("grants credits once when the same event is redelivered three times", async () => {
        const { user } = await makeTrialingAutopaySubscription();
        const event = chargedEvent("evt_charge_dup");

        const first = await webhookService.handle(event);
        const second = await webhookService.handle(event);
        const third = await webhookService.handle(event);

        expect(first.processed).toBe(true);
        expect(second).toEqual({ processed: false, reason: "DUPLICATE" });
        expect(third).toEqual({ processed: false, reason: "DUPLICATE" });

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 1,
            careManager: 1,
        });
    });

    // Distinct charges are distinct events — a renewal must grant a fresh allowance.
    it("grants again for a genuinely new charge", async () => {
        const { user } = await makeTrialingAutopaySubscription();

        await webhookService.handle(chargedEvent("evt_charge_a"));
        await webhookService.handle(chargedEvent("evt_charge_b"));

        expect(await creditService.getBalances(user._id)).toEqual({
            expert: 2,
            careManager: 2,
        });
    });

    // Razorpay is the authority on when the next charge lands; drifting from it would
    // let access and billing disagree.
    it("takes the period end from the provider when supplied", async () => {
        const { subscription } = await makeTrialingAutopaySubscription();
        const currentEnd = Math.floor(Date.now() / 1000) + 45 * 86_400;

        await webhookService.handle(chargedEvent("evt_charge_end", currentEnd));

        const updated = await subscriptionModel.findById(subscription._id);
        expect(Math.floor(updated!.currentPeriodEnd!.getTime() / 1000)).toBe(currentEnd);
    });
});

describe("other events", () => {
    it("marks a halted mandate without revoking access", async () => {
        const { subscription } = await makeTrialingAutopaySubscription();

        await webhookService.handle({
            id: "evt_halt",
            event: ERazorpayWebhookEvent.SUBSCRIPTION_HALTED,
            payload: { subscription: { entity: { id: RZP_SUB_ID } } },
        });

        const updated = await subscriptionModel.findById(subscription._id);
        expect(updated!.status).toBe(ESubscriptionStatus.HALTED);
        // Still current: Razorpay is retrying, and a card that merely expired should not
        // cost the user access mid-period.
        expect(updated!.isCurrent).toBe(true);
    });

    it("marks a cancelled mandate", async () => {
        const { subscription } = await makeTrialingAutopaySubscription();

        await webhookService.handle({
            id: "evt_cancel",
            event: ERazorpayWebhookEvent.SUBSCRIPTION_CANCELLED,
            payload: { subscription: { entity: { id: RZP_SUB_ID } } },
        });

        const updated = await subscriptionModel.findById(subscription._id);
        expect(updated!.status).toBe(ESubscriptionStatus.CANCELLED);
        expect(updated!.cancelledAt).not.toBeNull();
    });

    it("records but ignores an unknown subscription", async () => {
        const result = await webhookService.handle({
            id: "evt_unknown",
            event: ERazorpayWebhookEvent.SUBSCRIPTION_CHARGED,
            payload: { subscription: { entity: { id: "sub_not_ours" } } },
        });

        expect(result.processed).toBe(true);
        expect(await webhookEventModel.countDocuments({ providerEventId: "evt_unknown" })).toBe(1);
    });

    it("rejects a malformed payload without recording it", async () => {
        expect(await webhookService.handle({})).toEqual({
            processed: false,
            reason: "MALFORMED",
        });
        expect(await webhookEventModel.countDocuments()).toBe(0);
    });

    it("stamps processedAt on success", async () => {
        await makeTrialingAutopaySubscription();
        await webhookService.handle(chargedEvent("evt_done"));

        const stored = await webhookEventModel.findOne({ providerEventId: "evt_done" });
        expect(stored!.processedAt).not.toBeNull();
        expect(stored!.error).toBeNull();
    });
});
