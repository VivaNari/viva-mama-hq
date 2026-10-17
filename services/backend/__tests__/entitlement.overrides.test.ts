jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import usageCounterModel from "../src/models/usage-counter.model";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import {
    EAccess,
    ECapability,
    getRule,
    resolveRule,
} from "../src/services/entitlements/entitlement.config";
import { EDenialCode } from "../src/services/entitlements/entitlement.errors";
import { ESubscriptionTier, EUsageCounterKey } from "../src/types/subscription.types";

jest.setTimeout(120000);

async function makeUser(tier: ESubscriptionTier, overrides: unknown[] = []) {
    const future = new Date(Date.now() + 30 * 86_400_000);
    return UserModel.create({
        mobile_number: `9${Math.floor(Math.random() * 1_000_000_000)}`,
        subscription: {
            tier,
            trialEndAt: tier === ESubscriptionTier.TRIAL ? future : null,
            currentPeriodEnd: tier === ESubscriptionTier.PREMIUM ? future : null,
            hasUsedTrial: tier !== ESubscriptionTier.FREE,
        },
        entitlement_overrides: overrides,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("resolveRule", () => {
    it("is the tier's rule when there is no override", () => {
        for (const tier of Object.values(ESubscriptionTier)) {
            for (const capability of Object.values(ECapability)) {
                expect(resolveRule(tier, capability)).toEqual(getRule(tier, capability));
                expect(resolveRule(tier, capability, [])).toEqual(getRule(tier, capability));
            }
        }
    });

    it("locks a capability the tier allows", () => {
        const rule = resolveRule(ESubscriptionTier.PREMIUM, ECapability.PRODUCTS_VIEW, [
            { capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED },
        ]);
        expect(rule.access).toBe(EAccess.LOCKED);
        // The quota fields go with it: a LOCKED rule that kept a quotaKey would have
        // consumeCapability metering something nobody can reach.
        expect(rule.limit).toBeUndefined();
        expect(rule.quotaKey).toBeUndefined();
    });

    /**
     * The invariant the whole mechanism rests on. Overrides are written from a referral
     * program an admin edits — if one could widen access, anyone who can create a
     * program could mint premium for a user with no subscription row behind it, and
     * nothing in the tier accounting or the lifecycle sweep would ever notice.
     */
    it("never widens access — an ALLOWED override is a no-op", () => {
        // LOCKED tier + ALLOWED override → still locked. If this ever inverted, anyone
        // who can create a referral program could hand out premium with no subscription
        // row behind it, invisible to the tier accounting and the lifecycle sweep.
        const stillLocked = resolveRule(ESubscriptionTier.FREE, ECapability.CHECKIN_WEEKLY, [
            { capability: ECapability.CHECKIN_WEEKLY, access: EAccess.ALLOWED },
        ]);
        expect(stillLocked.access).toBe(EAccess.LOCKED);

        // And an ALLOWED override changes nothing at all, at any tier.
        for (const tier of Object.values(ESubscriptionTier)) {
            for (const capability of Object.values(ECapability)) {
                expect(resolveRule(tier, capability, [{ capability, access: EAccess.ALLOWED }]))
                    .toEqual(getRule(tier, capability));
            }
        }
    });

    it("leaves every other capability alone", () => {
        const overrides = [{ capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED }];
        expect(resolveRule(ESubscriptionTier.PREMIUM, ECapability.AI_CHAT, overrides)).toEqual(
            getRule(ESubscriptionTier.PREMIUM, ECapability.AI_CHAT),
        );
    });
});

/**
 * The seam's claim is that one edit in `resolveFor` covers every gate. Each of the three
 * consumers is asserted separately, because that claim is the reason the other three
 * were left untouched.
 */
describe("overrides reach every gate through resolveFor", () => {
    const lockProducts = [{ capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED }];

    it("resolveFor returns the narrowed rule", async () => {
        const user = await makeUser(ESubscriptionTier.PREMIUM, lockProducts);
        const { rule, tier } = await entitlementService.resolveFor(
            user._id,
            ECapability.PRODUCTS_VIEW,
        );
        expect(tier).toBe(ESubscriptionTier.PREMIUM);
        expect(rule.access).toBe(EAccess.LOCKED);
    });

    it("assertCapability denies", async () => {
        const user = await makeUser(ESubscriptionTier.PREMIUM, lockProducts);
        await expect(
            entitlementService.assertCapability(user._id, ECapability.PRODUCTS_VIEW),
        ).rejects.toMatchObject({ code: EDenialCode.LOCKED_FEATURE });
    });

    it("consumeCapability denies", async () => {
        const user = await makeUser(ESubscriptionTier.PREMIUM, [
            { capability: ECapability.AI_CHAT, access: EAccess.LOCKED },
        ]);
        await expect(
            entitlementService.consumeCapability(user._id, ECapability.AI_CHAT),
        ).rejects.toMatchObject({ code: EDenialCode.LOCKED_FEATURE });
    });

    it("refundQuota is a no-op on a locked capability, writing no counter", async () => {
        const user = await makeUser(ESubscriptionTier.FREE, [
            { capability: ECapability.AI_CHAT, access: EAccess.LOCKED },
        ]);

        // The LOCKED rule carries no quotaKey, so there is nothing to give back — and
        // nothing should be created by trying.
        await entitlementService.refundQuota(user._id, ECapability.AI_CHAT);

        const counter = await usageCounterModel
            .findOne({ user_id: user._id, key: EUsageCounterKey.AI_MESSAGE })
            .lean();
        expect(counter).toBeNull();
    });
});

describe("GET /subscription/me payload", () => {
    it("emits a bare LOCKED rule with no usage keys", async () => {
        const user = await makeUser(ESubscriptionTier.PREMIUM, [
            { capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED },
        ]);

        const entitlements = await entitlementService.getEntitlements(user._id);
        const products = entitlements.capabilities[ECapability.PRODUCTS_VIEW];

        expect(products.access).toBe(EAccess.LOCKED);
        expect(products.limit).toBeUndefined();
        expect(products.used).toBeUndefined();
        expect(products.remaining).toBeUndefined();

        // Tier is untouched — she is still PREMIUM everywhere else.
        expect(entitlements.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(entitlements.capabilities[ECapability.AI_CHAT].access).toBe(EAccess.ALLOWED);
    });
});
