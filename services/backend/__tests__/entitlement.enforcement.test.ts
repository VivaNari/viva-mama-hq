jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import usageCounterModel from "../src/models/usage-counter.model";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { ECapability, ENTITLEMENTS, getRule } from "../src/services/entitlements/entitlement.config";
import {
    EDenialCode,
    EntitlementDeniedError,
} from "../src/services/entitlements/entitlement.errors";
import { applyContentEntitlements } from "../src/services/contents/content-access.service";
import { applyProductEntitlements } from "../src/services/products/product-access.service";
import { EContentGroup, ContentBodyTypeEnum } from "../src/types/content.types";
import { ESubscriptionTier, EUsageCounterKey } from "../src/types/subscription.types";
import { EUserCategory } from "../src/types";

jest.setTimeout(120000);

async function makeUser(tier: ESubscriptionTier, extra: Record<string, unknown> = {}) {
    const future = new Date(Date.now() + 30 * 86_400_000);
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: {
            tier,
            trialEndAt: tier === ESubscriptionTier.TRIAL ? future : null,
            currentPeriodEnd: tier === ESubscriptionTier.PREMIUM ? future : null,
            hasUsedTrial: tier !== ESubscriptionTier.FREE,
            ...extra,
        },
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("AI chat quota", () => {
    it("allows exactly 3 messages a day on FREE, then denies", async () => {
        const user = await makeUser(ESubscriptionTier.FREE);

        for (let i = 1; i <= 3; i += 1) {
            const result = await entitlementService.consumeCapability(
                user._id,
                ECapability.AI_CHAT,
            );
            expect(result.used).toBe(i);
            expect(result.remaining).toBe(3 - i);
        }

        await expect(
            entitlementService.consumeCapability(user._id, ECapability.AI_CHAT),
        ).rejects.toMatchObject({ code: EDenialCode.QUOTA_EXCEEDED });
    });

    // A double-tapped send must not yield a 4th free message.
    it("lets exactly 3 of 10 parallel sends through", async () => {
        const user = await makeUser(ESubscriptionTier.FREE);

        const results = await Promise.all(
            Array.from({ length: 10 }, () =>
                entitlementService
                    .consumeCapability(user._id, ECapability.AI_CHAT)
                    .then(() => "ok" as const)
                    .catch(() => "denied" as const),
            ),
        );

        expect(results.filter((r) => r === "ok")).toHaveLength(3);
    });

    it("does not meter TRIAL or PREMIUM at all", async () => {
        for (const tier of [ESubscriptionTier.TRIAL, ESubscriptionTier.PREMIUM]) {
            const user = await makeUser(tier);
            for (let i = 0; i < 25; i += 1) {
                await entitlementService.consumeCapability(user._id, ECapability.AI_CHAT);
            }
            // Unlimited capabilities write no counter row at all.
            expect(await usageCounterModel.countDocuments({ user_id: user._id })).toBe(0);
        }
    });

    it("carries the reset time so the app can say when it comes back", async () => {
        const user = await makeUser(ESubscriptionTier.FREE);
        for (let i = 0; i < 3; i += 1) {
            await entitlementService.consumeCapability(user._id, ECapability.AI_CHAT);
        }

        const error = await entitlementService
            .consumeCapability(user._id, ECapability.AI_CHAT)
            .catch((e) => e as EntitlementDeniedError);

        expect(error.payload.resetAt).toBeInstanceOf(Date);
        expect(error.payload.limit).toBe(3);
        expect(error.payload.upsell).toBe(ESubscriptionTier.PREMIUM);
    });

    // An expired trial must behave exactly like FREE, without waiting for the cron.
    it("meters a lapsed trial as FREE", async () => {
        const user = await makeUser(ESubscriptionTier.TRIAL, {
            trialEndAt: new Date(Date.now() - 86_400_000),
        });

        for (let i = 0; i < 3; i += 1) {
            await entitlementService.consumeCapability(user._id, ECapability.AI_CHAT);
        }
        await expect(
            entitlementService.consumeCapability(user._id, ECapability.AI_CHAT),
        ).rejects.toMatchObject({ code: EDenialCode.QUOTA_EXCEEDED });
    });

    it("counts each user separately", async () => {
        const a = await makeUser(ESubscriptionTier.FREE);
        const b = await makeUser(ESubscriptionTier.FREE);

        for (let i = 0; i < 3; i += 1) {
            await entitlementService.consumeCapability(a._id, ECapability.AI_CHAT);
        }

        const result = await entitlementService.consumeCapability(b._id, ECapability.AI_CHAT);
        expect(result.used).toBe(1);
    });

    it("refunds a unit when the work did not happen", async () => {
        const user = await makeUser(ESubscriptionTier.FREE);
        await entitlementService.consumeCapability(user._id, ECapability.AI_CHAT);
        await entitlementService.refundQuota(user._id, ECapability.AI_CHAT);

        const counter = await usageCounterModel.findOne({
            user_id: user._id,
            key: EUsageCounterKey.AI_MESSAGE,
        });
        expect(counter!.count).toBe(0);
    });
});

describe("weekly check-in", () => {
    it("is locked on FREE", async () => {
        const user = await makeUser(ESubscriptionTier.FREE);
        await expect(
            entitlementService.assertCapability(user._id, ECapability.CHECKIN_WEEKLY),
        ).rejects.toMatchObject({ code: EDenialCode.LOCKED_FEATURE });
    });

    // Reads the allowance from ENTITLEMENTS rather than hardcoding it, so retuning the
    // funnel does not break the test that proves the meter works.
    it("allows exactly the configured number on TRIAL, then denies", async () => {
        const limit = ENTITLEMENTS[ESubscriptionTier.TRIAL][ECapability.CHECKIN_WEEKLY].limit!;
        const user = await makeUser(ESubscriptionTier.TRIAL);

        for (let i = 1; i <= limit; i += 1) {
            const result = await entitlementService.consumeCapability(
                user._id,
                ECapability.CHECKIN_WEEKLY,
            );
            expect(result.used).toBe(i);
        }

        await expect(
            entitlementService.consumeCapability(user._id, ECapability.CHECKIN_WEEKLY),
        ).rejects.toMatchObject({ code: EDenialCode.QUOTA_EXCEEDED });
    });

    // PERIOD-scoped, so it must not come back at IST midnight the way the AI-chat quota does.
    it("does not replenish the TRIAL allowance overnight", async () => {
        const limit = ENTITLEMENTS[ESubscriptionTier.TRIAL][ECapability.CHECKIN_WEEKLY].limit!;
        const user = await makeUser(ESubscriptionTier.TRIAL);

        for (let i = 0; i < limit; i += 1) {
            await entitlementService.consumeCapability(user._id, ECapability.CHECKIN_WEEKLY);
        }

        const tomorrow = new Date(Date.now() + 86_400_000);
        await expect(
            entitlementService.consumeCapability(user._id, ECapability.CHECKIN_WEEKLY, tomorrow),
        ).rejects.toMatchObject({ code: EDenialCode.QUOTA_EXCEEDED });
    });

    it("is unlimited on PREMIUM", async () => {
        const user = await makeUser(ESubscriptionTier.PREMIUM);
        for (let i = 0; i < 10; i += 1) {
            await entitlementService.consumeCapability(user._id, ECapability.CHECKIN_WEEKLY);
        }
        expect(await usageCounterModel.countDocuments({ user_id: user._id })).toBe(0);
    });
});

describe("care manager", () => {
    // Was LOCKED below PREMIUM. The capability itself is now open at every tier — what
    // differs is how it gets paid for, which the booking routes decide, not this gate.
    it("is no longer locked below PREMIUM", async () => {
        for (const tier of [ESubscriptionTier.FREE, ESubscriptionTier.TRIAL]) {
            const user = await makeUser(tier);
            await expect(
                entitlementService.assertCapability(
                    user._id,
                    ECapability.CONSULTATION_CARE_MANAGER,
                ),
            ).resolves.toBe(tier);
        }
    });
});

describe("content slicing and redaction", () => {
    const article = (id: string, group: EContentGroup, extra = {}) =>
        ({
            _id: id,
            featuredTitle: `t-${id}`,
            featuredImage: "img",
            category: [EUserCategory.PP],
            contentGroup: group,
            sortOrder: 0,
            isFreeOverride: false,
            validWeekStart: 1,
            validWeekEnd: 1,
            contentBody: [{ contentType: ContentBodyTypeEnum.PARAGRAPH, body: "secret" }],
            ...extra,
        }) as any;

    // The model: GLOBAL_HEALTH and (properly-tagged) WEEKLY_RECOVERY are open to every
    // tier. The paywall sits entirely on UNCLASSIFIED (null contentGroup) content —
    // FREE gets 0, TRIAL gets a few, PREMIUM gets all.
    const unclassified = (id: string, extra = {}) => article(id, null as any, extra);

    const catalog = () => [
        article("g1", EContentGroup.GLOBAL_HEALTH),
        article("r1", EContentGroup.WEEKLY_RECOVERY),
        article("r2", EContentGroup.WEEKLY_RECOVERY),
        unclassified("n1"),
        unclassified("n2"),
    ];

    it("gives FREE all global-health and weekly-recovery, but zero unclassified", async () => {
        const out = applyContentEntitlements(catalog(), ESubscriptionTier.FREE);

        expect(out.find((c) => c._id === "g1")!.isLocked).toBeUndefined();
        expect(out.find((c) => c._id === "r1")!.isLocked).toBeUndefined();
        expect(out.find((c) => c._id === "r2")!.isLocked).toBeUndefined();
        // Unclassified is the paywall for FREE — none of it is readable.
        expect(out.find((c) => c._id === "n1")!.isLocked).toBe(true);
        expect(out.find((c) => c._id === "n2")!.isLocked).toBe(true);
    });

    // The bug this pins: LOCKED must mean 0, not "unlimited". A missing `limit` on a
    // LOCKED rule previously read as null and handed every unclassified article to FREE.
    it("never leaks unclassified content to FREE, however much there is", async () => {
        const many = Array.from({ length: 10 }, (_, i) => unclassified(`n${i}`));
        const out = applyContentEntitlements(many, ESubscriptionTier.FREE);
        expect(out.every((c) => c.isLocked)).toBe(true);
    });

    // Shipping the article and asking the UI to hide it is not a paywall.
    it("strips contentBody from every locked article", async () => {
        const out = applyContentEntitlements(catalog(), ESubscriptionTier.FREE);
        const locked = out.filter((c) => c.isLocked);
        expect(locked.length).toBeGreaterThan(0);
        for (const item of locked) {
            expect(item.contentBody).toBeUndefined();
        }
        // ...while keeping enough to render the teaser and the lock badge.
        const n1 = out.find((c) => c._id === "n1")!;
        expect(n1.featuredTitle).toBe("t-n1");
        expect(n1.featuredImage).toBe("img");
    });

    it("unlocks everything for PREMIUM", async () => {
        const out = applyContentEntitlements(catalog(), ESubscriptionTier.PREMIUM);
        expect(out.every((c) => !c.isLocked)).toBe(true);
        expect(out.every((c) => c.contentBody)).toBe(true);
    });

    it("gives TRIAL every recovery article but caps unclassified at the tier limit", async () => {
        const out = applyContentEntitlements(
            [
                ...Array.from({ length: 8 }, (_, i) =>
                    article(`r${i}`, EContentGroup.WEEKLY_RECOVERY),
                ),
                ...Array.from({ length: 8 }, (_, i) => unclassified(`n${i}`)),
            ],
            ESubscriptionTier.TRIAL,
        );

        // All 8 recovery articles are readable (weekly recovery is unlimited).
        expect(
            out.filter((c) => c.contentGroup === EContentGroup.WEEKLY_RECOVERY && !c.isLocked),
        ).toHaveLength(8);
        // Unclassified is capped at the TRIAL CONTENT_OTHER limit (5).
        const unlockedUnclassified = out.filter((c) => !c.contentGroup && !c.isLocked);
        expect(unlockedUnclassified).toHaveLength(5);
    });

    // The content-ops escape hatch: a premium (unclassified) article opened as a free
    // teaser is readable by everyone and does not consume the tier's unclassified slice.
    it("always unlocks isFreeOverride and does not consume the slice", async () => {
        const out = applyContentEntitlements(
            [
                unclassified("free1", { isFreeOverride: true }),
                unclassified("n1"),
                unclassified("n2"),
            ],
            ESubscriptionTier.FREE,
        );

        // The override is readable even though FREE's unclassified allowance is 0...
        expect(out.find((c) => c._id === "free1")!.isLocked).toBeUndefined();
        // ...and the real unclassified articles are still all locked for FREE.
        expect(out.find((c) => c._id === "n1")!.isLocked).toBe(true);
        expect(out.find((c) => c._id === "n2")!.isLocked).toBe(true);
    });
});

describe("product slicing and redaction", () => {
    const product = (id: string) =>
        ({
            _id: id,
            productName: `p-${id}`,
            productImageURL: "img",
            productAffiliateLink: "https://buy.example/secret",
            userCategory: [EUserCategory.PP],
            sortOrder: 0,
            validWeekStart: 1,
            validWeekEnd: 6,
            productCategory: "c",
            productDescription: "d",
            productPriceRange: "r",
            safetyFlag: "SAFE",
        }) as any;

    const catalog = () => ["a", "b", "c", "d"].map(product);

    it("unlocks the first two for FREE", async () => {
        const out = applyProductEntitlements(catalog(), getRule(ESubscriptionTier.FREE, ECapability.PRODUCTS_VIEW));
        expect(out.filter((p) => !p.isLocked)).toHaveLength(2);
        expect(out[0]!._id).toBe("a");
        expect(out[1]!._id).toBe("b");
    });

    // Blurring in the UI while shipping the link is not a paywall.
    it("removes the affiliate link from locked products", async () => {
        const out = applyProductEntitlements(catalog(), getRule(ESubscriptionTier.FREE, ECapability.PRODUCTS_VIEW));
        for (const p of out.filter((x) => x.isLocked)) {
            expect(p.productAffiliateLink).toBeUndefined();
        }
        expect(out[0]!.productAffiliateLink).toBe("https://buy.example/secret");
    });

    it("unlocks everything above FREE", async () => {
        for (const tier of [ESubscriptionTier.TRIAL, ESubscriptionTier.PREMIUM]) {
            const out = applyProductEntitlements(catalog(), getRule(tier, ECapability.PRODUCTS_VIEW));
            expect(out.every((p) => !p.isLocked)).toBe(true);
            expect(out.every((p) => p.productAffiliateLink)).toBe(true);
        }
    });
});
