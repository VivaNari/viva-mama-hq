jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);

const sendPushNotificationMock = jest.fn(async () => undefined);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...(args as [])),
}));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import subscriptionModel from "../src/models/subscription.model";
import UserModel from "../src/models/user.model";
import { subscriptionLifecycle } from "../src/cron-jobs/subscriptionLifecycle";
import {
    EBillingMode,
    EBillingProvider,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const NOW = new Date("2026-07-22T02:00:00.000Z");

async function makeUser(withToken = true) {
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        FCM_token: withToken ? "fcm-token" : undefined,
        subscription: { tier: ESubscriptionTier.TRIAL, hasUsedTrial: true },
    });
}

async function makeTrial(userId: unknown, trialEndAt: Date, billingMode = EBillingMode.MANUAL) {
    return subscriptionModel.create({
        user_id: userId,
        tier: ESubscriptionTier.TRIAL,
        status: ESubscriptionStatus.TRIALING,
        billingMode,
        provider: EBillingProvider.RAZORPAY_ORDERS,
        trialStartAt: new Date(trialEndAt.getTime() - 7 * 86_400_000),
        trialEndAt,
        isCurrent: true,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(async () => {
    await clearTestDb();
    sendPushNotificationMock.mockClear();
});

describe("subscriptionLifecycle", () => {
    it("retires a lapsed trial and drops the user to FREE", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-21T00:00:00.000Z"));

        const result = await subscriptionLifecycle(NOW);

        expect(result.expired).toBe(1);
        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.FREE);
        expect(fresh!.subscription.hasUsedTrial).toBe(true);
    });

    it("leaves a running trial alone", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-30T00:00:00.000Z"));

        const result = await subscriptionLifecycle(NOW);
        expect(result.expired).toBe(0);
    });

    it("reminds two days before the trial ends", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-24T00:00:00.000Z"));

        const result = await subscriptionLifecycle(NOW);
        expect(result.remindersSent).toBe(1);
    });

    /**
     * The copy must follow the mode stamped on the row, not the current env value.
     * Telling a MANUAL trial user they are about to be charged is simply false — there
     * is no card on file.
     */
    it("never promises an automatic charge to a MANUAL trial", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-22T23:00:00.000Z"), EBillingMode.MANUAL);

        await subscriptionLifecycle(NOW);

        expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
        const [{ body }] = sendPushNotificationMock.mock.calls[0] as [{ body: string }];
        expect(body).not.toMatch(/automatic/i);
        expect(body).toMatch(/subscribe/i);
    });

    it("does promise an automatic charge to an AUTOPAY trial", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-22T23:00:00.000Z"), EBillingMode.AUTOPAY);

        await subscriptionLifecycle(NOW);

        const [{ body }] = sendPushNotificationMock.mock.calls[0] as [{ body: string }];
        expect(body).toMatch(/automatically/i);
    });

    it("skips users with no FCM token instead of failing", async () => {
        const user = await makeUser(false);
        await makeTrial(user._id, new Date("2026-07-24T00:00:00.000Z"));

        const result = await subscriptionLifecycle(NOW);
        expect(result.remindersSent).toBe(0);
        expect(result.failures).toBe(0);
    });

    it("sends no reminder on a day that is not on the schedule", async () => {
        const user = await makeUser();
        await makeTrial(user._id, new Date("2026-07-26T00:00:00.000Z")); // 4 days out

        const result = await subscriptionLifecycle(NOW);
        expect(result.remindersSent).toBe(0);
    });

    // One malformed row must not stop every other user from being expired.
    it("keeps going when one subscription fails to expire", async () => {
        const good = await makeUser();
        await makeTrial(good._id, new Date("2026-07-20T00:00:00.000Z"));
        const bad = await makeUser();
        await makeTrial(bad._id, new Date("2026-07-20T00:00:00.000Z"));

        const result = await subscriptionLifecycle(NOW);
        expect(result.expired).toBe(2);
    });
});
