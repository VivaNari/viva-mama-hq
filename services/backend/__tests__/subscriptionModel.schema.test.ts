jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import contentModel from "../src/models/content.model";
import productModel from "../src/models/product.model";
import subscriptionModel from "../src/models/subscription.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import { EUserCategory } from "../src/types";
import { ContentBodyTypeEnum, EContentGroup } from "../src/types/content.types";
import {
    EBillingMode,
    EBillingProvider,
    ECreditReason,
    ECreditType,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

/**
 * Schema-contract tests. `validateSync()` runs enum checks and validators entirely
 * in-memory, so these need no database — which matters because the repo has no
 * mongodb-memory-server and the existing payment tests mock the controller away.
 */

const baseContent = {
    featuredImage: "https://example.com/i.png",
    featuredTitle: "Week 1 After Birth",
    contentGroup: EContentGroup.WEEKLY_RECOVERY,
    validWeekStart: 1,
    validWeekEnd: 1,
    contentBody: [{ contentType: ContentBodyTypeEnum.PARAGRAPH, body: "text" }],
};

const baseProduct = {
    productImageURL: "https://example.com/p.png",
    productName: "Nursing pillow",
    productAffiliateLink: "https://example.com/buy",
    validWeekStart: 1,
    validWeekEnd: 6,
    productCategory: "Feeding",
    productDescription: "desc",
    productPriceRange: "500-1000",
    safetyFlag: "SAFE",
};

describe("content.category as an array", () => {
    it("accepts a single category", () => {
        const doc = new contentModel({ ...baseContent, category: [EUserCategory.PP] });
        expect(doc.validateSync()).toBeUndefined();
        expect(doc.category).toEqual([EUserCategory.PP]);
    });

    // The whole point of the change: one article serving both audiences instead of two
    // documents that drift apart.
    it("accepts PP and NP together", () => {
        const doc = new contentModel({
            ...baseContent,
            category: [EUserCategory.PP, EUserCategory.NP],
        });
        expect(doc.validateSync()).toBeUndefined();
        expect(doc.category).toEqual([EUserCategory.PP, EUserCategory.NP]);
    });

    // Documents written before the migration hold a bare string. Mongoose must hydrate
    // those into a single-element array, or every pre-migration row breaks on read.
    it("coerces a bare string into a single-element array", () => {
        const doc = new contentModel({ ...baseContent, category: EUserCategory.PP });
        expect(doc.validateSync()).toBeUndefined();
        expect(doc.category).toEqual([EUserCategory.PP]);
    });

    // [] matches no user at all — it must fail rather than silently produce an article
    // nobody can ever see.
    it("rejects an empty category array", () => {
        const doc = new contentModel({ ...baseContent, category: [] });
        expect(doc.validateSync()?.errors.category).toBeDefined();
    });

    it("rejects a value outside EUserCategory", () => {
        const doc = new contentModel({ ...baseContent, category: ["XX"] });
        expect(doc.validateSync()?.errors["category.0"]).toBeDefined();
    });

    // contentGroup is nullable: content can exist before it is classified. The P0
    // migration only auto-sets GLOBAL_HEALTH (the VIDEO heuristic) and leaves everything
    // else null for content-ops, rather than guessing WEEKLY_RECOVERY.
    it("defaults contentGroup to null when omitted, and accepts null", () => {
        const { contentGroup, ...withoutGroup } = baseContent;
        const doc = new contentModel({ ...withoutGroup, category: [EUserCategory.PP] });
        expect(doc.validateSync()).toBeUndefined();
        expect(doc.contentGroup).toBeNull();
    });

    it("rejects a contentGroup outside the enum", () => {
        const doc = new contentModel({
            ...baseContent,
            contentGroup: "NOT_A_GROUP",
            category: [EUserCategory.PP],
        });
        expect(doc.validateSync()?.errors.contentGroup).toBeDefined();
    });

    it("defaults sortOrder and isFreeOverride", () => {
        const doc = new contentModel({ ...baseContent, category: [EUserCategory.PP] });
        expect(doc.sortOrder).toBe(0);
        expect(doc.isFreeOverride).toBe(false);
    });
});

describe("product.userCategory as an array", () => {
    it("accepts PP and NP together", () => {
        const doc = new productModel({
            ...baseProduct,
            userCategory: [EUserCategory.PP, EUserCategory.NP],
        });
        expect(doc.validateSync()).toBeUndefined();
    });

    it("rejects an empty userCategory array", () => {
        const doc = new productModel({ ...baseProduct, userCategory: [] });
        expect(doc.validateSync()?.errors.userCategory).toBeDefined();
    });

    // Without a stable sort key the free slice ("first 2 unlocked") would shuffle
    // between loads, since Mongo's natural order changes on document rewrite.
    it("defaults sortOrder so the free slice is deterministic", () => {
        const doc = new productModel({ ...baseProduct, userCategory: [EUserCategory.PP] });
        expect(doc.sortOrder).toBe(0);
    });
});

describe("subscriptions", () => {
    const base = {
        user_id: "507f1f77bcf86cd799439011",
        tier: ESubscriptionTier.TRIAL,
        status: ESubscriptionStatus.TRIALING,
        billingMode: EBillingMode.MANUAL,
        provider: EBillingProvider.RAZORPAY_ORDERS,
    };

    it("accepts a trial row with no plan attached", () => {
        const doc = new subscriptionModel({ ...base, planCode: null });
        expect(doc.validateSync()).toBeUndefined();
    });

    // billingMode is stamped per row, never read from env at decision time — otherwise
    // flipping the env toggle would try to auto-charge trials with no mandate on file.
    it("requires billingMode", () => {
        const { billingMode, ...withoutMode } = base;
        const doc = new subscriptionModel(withoutMode);
        expect(doc.validateSync()?.errors.billingMode).toBeDefined();
    });

    it("defaults isCurrent to true so the one-live-row index applies", () => {
        const doc = new subscriptionModel(base);
        expect(doc.isCurrent).toBe(true);
    });

    it("rejects FREE as a subscription tier — free is the absence of a row", () => {
        const doc = new subscriptionModel({ ...base, tier: ESubscriptionTier.FREE });
        expect(doc.validateSync()?.errors.tier).toBeDefined();
    });
});

describe("consultation_credits ledger", () => {
    const base = {
        user_id: "507f1f77bcf86cd799439011",
        subscription_id: "507f1f77bcf86cd799439012",
        type: ECreditType.EXPERT,
        expiresAt: new Date(),
    };

    it("records a grant", () => {
        const doc = new consultationCreditModel({
            ...base,
            seq: 1,
            delta: 3,
            balanceAfter: 3,
            reason: ECreditReason.GRANT,
        });
        expect(doc.validateSync()).toBeUndefined();
    });

    it("records a consume as a negative delta", () => {
        const doc = new consultationCreditModel({
            ...base,
            seq: 2,
            delta: -1,
            balanceAfter: 2,
            reason: ECreditReason.CONSUME,
        });
        expect(doc.validateSync()).toBeUndefined();
    });

    // A negative balance means a consume slipped past the balance guard.
    it("rejects a negative balanceAfter", () => {
        const doc = new consultationCreditModel({
            ...base,
            seq: 2,
            delta: -1,
            balanceAfter: -1,
            reason: ECreditReason.CONSUME,
        });
        expect(doc.validateSync()?.errors.balanceAfter).toBeDefined();
    });

    // seq is the optimistic-concurrency guard; a row without one could not participate
    // in the unique-index race that keeps two bookings from spending the same credit.
    it("requires seq", () => {
        const doc = new consultationCreditModel({
            ...base,
            delta: 1,
            balanceAfter: 1,
            reason: ECreditReason.GRANT,
        });
        expect(doc.validateSync()?.errors.seq).toBeDefined();
    });
});
