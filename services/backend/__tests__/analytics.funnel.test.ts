jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import analyticsEventModel from "../src/models/analytics-event.model";
import { analyticsService } from "../src/services/analytics/analytics.service";
import { EAnalyticsEvent } from "../src/types/analytics.types";
import { ESubscriptionTier } from "../src/types/subscription.types";
import { ECapability } from "../src/services/entitlements/entitlement.config";

jest.setTimeout(120000);

const USER = "507f1f77bcf86cd799439011";
const FROM = new Date(Date.now() - 30 * 86_400_000);
const TO = new Date(Date.now() + 86_400_000);

async function seed(event: EAnalyticsEvent, times: number, capability?: string) {
    for (let i = 0; i < times; i += 1) {
        await analyticsService.trackAndWait({
            userId: USER,
            event,
            tier: ESubscriptionTier.FREE,
            capability: capability ?? null,
        });
    }
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("funnel", () => {
    it("computes trial conversion from activations over trials started", async () => {
        await seed(EAnalyticsEvent.TRIAL_STARTED, 10);
        await seed(EAnalyticsEvent.SUBSCRIPTION_ACTIVATED, 3);

        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.trialsStarted).toBe(10);
        expect(funnel.subscriptionsActivated).toBe(3);
        expect(funnel.trialConversionRate).toBe(30);
    });

    // How much is lost inside the payment sheet, as distinct from before it.
    it("computes checkout completion separately from trial conversion", async () => {
        await seed(EAnalyticsEvent.CHECKOUT_CREATED, 8);
        await seed(EAnalyticsEvent.SUBSCRIPTION_ACTIVATED, 2);

        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.checkoutCompletionRate).toBe(25);
    });

    // Divide-by-zero on an empty window must read as 0%, not NaN or Infinity.
    it("reports zero rather than NaN with no data", async () => {
        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.trialConversionRate).toBe(0);
        expect(funnel.checkoutCompletionRate).toBe(0);
        expect(funnel.denialsByCapability).toEqual([]);
    });

    // This is the ranking that tells you which limit is actually binding.
    it("ranks denials by capability, most-hit first", async () => {
        await seed(EAnalyticsEvent.CAPABILITY_DENIED, 5, ECapability.AI_CHAT);
        await seed(EAnalyticsEvent.CAPABILITY_DENIED, 2, ECapability.PRODUCTS_VIEW);
        await seed(EAnalyticsEvent.CAPABILITY_DENIED, 9, ECapability.CHECKIN_WEEKLY);

        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.denialsByCapability).toEqual([
            { capability: ECapability.CHECKIN_WEEKLY, count: 9 },
            { capability: ECapability.AI_CHAT, count: 5 },
            { capability: ECapability.PRODUCTS_VIEW, count: 2 },
        ]);
    });

    it("excludes events outside the window", async () => {
        await seed(EAnalyticsEvent.TRIAL_STARTED, 4);
        // Backdate two of them well before the window opens. Written through the native
        // collection because mongoose protects `createdAt` from being $set on update.
        const rows = await analyticsEventModel.find().limit(2);
        await analyticsEventModel.collection.updateMany(
            { _id: { $in: rows.map((r) => r._id) } },
            { $set: { createdAt: new Date(Date.now() - 90 * 86_400_000) } },
        );

        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.trialsStarted).toBe(2);
    });

    it("counts paywall impressions", async () => {
        await seed(EAnalyticsEvent.PAYWALL_SHOWN, 7, ECapability.AI_CHAT);
        const funnel = await analyticsService.getFunnel(FROM, TO);
        expect(funnel.paywallImpressions).toBe(7);
    });
});

describe("track", () => {
    /**
     * The property that matters most: instrumentation must never be able to break the
     * feature it measures. A failing write is logged and dropped, not thrown.
     */
    it("never throws when the write fails", async () => {
        const spy = jest
            .spyOn(analyticsEventModel, "create")
            .mockRejectedValueOnce(new Error("db down") as never);

        expect(() =>
            analyticsService.track({ userId: USER, event: EAnalyticsEvent.TRIAL_STARTED }),
        ).not.toThrow();

        // Let the rejected promise settle so an unhandled rejection would surface here.
        await new Promise((resolve) => setImmediate(resolve));
        spy.mockRestore();
    });

    it("records the tier the user was on at the time", async () => {
        await analyticsService.trackAndWait({
            userId: USER,
            event: EAnalyticsEvent.CAPABILITY_DENIED,
            tier: ESubscriptionTier.TRIAL,
            capability: ECapability.AI_CHAT,
        });

        const row = await analyticsEventModel.findOne({ user_id: USER });
        expect(row!.tier).toBe(ESubscriptionTier.TRIAL);
        expect(row!.capability).toBe(ECapability.AI_CHAT);
    });
});
