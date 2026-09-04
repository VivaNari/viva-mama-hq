jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));
jest.mock("razorpay", () =>
    jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })),
);
jest.mock(require.resolve("../src/utils/sendPushNotification"), () => ({
    __esModule: true,
    sendPushNotification: jest.fn(async () => undefined),
}));

import mongoose from "mongoose";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import UserModel from "../src/models/user.model";
import expertModel from "../src/models/expert.model";
import expertCategoryModel from "../src/models/expert-category.model";
import { EExpertCategory } from "../src/types/expert.types";
import organizationModel from "../src/models/organization.model";
import referralProgramModel from "../src/models/referral-program.model";
import referralRedemptionModel from "../src/models/referral-redemption.model";
import subscriptionModel from "../src/models/subscription.model";
import subscriptionPlanModel from "../src/models/subscription-plan.model";
import consultationCreditModel from "../src/models/consultation-credit.model";
import { ReferralError, referralService } from "../src/services/referral/referral.service";
import { entitlementService } from "../src/services/entitlements/entitlement.service";
import { subscriptionService } from "../src/services/subscription/subscription.service";
import { subscriptionPlanService } from "../src/services/subscription/subscription-plan.service";
import { subscriptionLifecycle } from "../src/cron-jobs/subscriptionLifecycle";
import {
    EAccess,
    ECapability,
} from "../src/services/entitlements/entitlement.config";
import {
    EReferralGrantSkipReason,
    EReferralOwnerType,
    EReferralRedemptionStatus,
} from "../src/types/referral.types";
import {
    EBillingMode,
    EBillingProvider,
    EPlanCode,
    ESubscriptionGrantSource,
    ESubscriptionStatus,
    ESubscriptionTier,
} from "../src/types/subscription.types";

jest.setTimeout(120000);

const PLAN_DURATION_DAYS = 30;

async function seedPlan() {
    return subscriptionPlanModel.create({
        code: EPlanCode.MONTHLY,
        displayName: "Monthly",
        description: null,
        // The live catalog reprices in the database; the test reads durationDays back
        // rather than assuming 30 anywhere below.
        amountPaise: 99_900,
        durationDays: PLAN_DURATION_DAYS,
        credits: { expert: 1, careManager: 1 },
        razorpayPlanId: null,
        isActive: true,
        sortOrder: 1,
        translations: {},
    });
}

async function makeExpert(name = "Dr Sujana Roy") {
    // `key` is enum-validated against EExpertCategory, and unique — so it is created
    // once and reused rather than generated per expert.
    const category =
        (await expertCategoryModel.findOne({ key: EExpertCategory.GYNECOLOGIST })) ??
        (await expertCategoryModel.create({
            key: EExpertCategory.GYNECOLOGIST,
            name: "Gynecologist",
            description: "d",
            coveredAreas: [],
            isActive: true,
        }));

    return expertModel.create({
        name,
        speciality: "Gynecology",
        category: category._id,
        referralCode: null,
        yearsOfExperience: 10,
        photograph: "img",
        remuneration: 500,
        isActive: true,
    });
}

async function makeUser(n = 1) {
    return UserModel.create({ mobile_number: `9${String(n).padStart(9, "0")}` });
}

async function makeProgram(
    overrides: Record<string, unknown> = {},
    expertId?: mongoose.Types.ObjectId,
) {
    const expert = expertId ?? (await makeExpert())._id;
    return referralProgramModel.create({
        code: "DRSUJANA12026",
        ownerType: EReferralOwnerType.EXPERT,
        owner_expert_id: expert,
        displayName: "Dr Sujana Roy",
        isActive: true,
        benefits: {
            grant: { planCode: EPlanCode.MONTHLY },
            seats: { total: null, claimed: 0 },
            entitlementOverrides: [],
        },
        ...overrides,
    });
}

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearTestDb);

describe("referral redemption — granting", () => {
    it("grants the program's plan with no payment behind it", async () => {
        const plan = await seedPlan();
        const program = await makeProgram();
        const user = await makeUser(1);

        const result = await referralService.redeem(user._id, "DRSUJANA12026");

        expect(result.grant).not.toBeNull();
        expect(result.grant!.planCode).toBe(EPlanCode.MONTHLY);
        expect(result.grantSkippedReason).toBeNull();

        const subscription = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(subscription!.tier).toBe(ESubscriptionTier.PREMIUM);
        expect(subscription!.status).toBe(ESubscriptionStatus.ACTIVE);
        expect(subscription!.provider).toBe(EBillingProvider.INTERNAL_GRANT);
        // Never env.BILLING_MODE: there is no mandate behind a grant.
        expect(subscription!.billingMode).toBe(EBillingMode.MANUAL);
        expect(subscription!.grantSource).toBe(ESubscriptionGrantSource.REFERRAL);
        expect(String(subscription!.referral_program_id)).toBe(String(program._id));
        expect(subscription!.providerOrderId).toBeNull();

        // Term is the plan's own duration, read from the plan rather than hardcoded —
        // and measured from currentPeriodStart, which is what it is actually defined
        // against. Measuring from a wall-clock stamp taken before the call makes this
        // pass only when both land in the same millisecond.
        const termDays =
            (subscription!.currentPeriodEnd!.getTime() -
                subscription!.currentPeriodStart!.getTime()) /
            (24 * 60 * 60 * 1000);
        expect(termDays).toBe(plan.durationDays);

        // The app skips the plan catalog for a granted user, so nothing else would ever
        // set this and she would be stuck in onboarding.
        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.is_onboarded.is_subscription_completed).toBe(true);
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.PREMIUM);

        // The seat was bought at the plan's price, which includes its credits.
        const credits = await consultationCreditModel.countDocuments({ user_id: user._id });
        expect(credits).toBeGreaterThan(0);
    });

    it("pins the referring expert exactly as the old endpoint did", async () => {
        await seedPlan();
        const expert = await makeExpert();
        await makeProgram({}, expert._id);
        const user = await makeUser(2);

        await referralService.redeem(user._id, "drsujana12026");

        const fresh = await UserModel.findById(user._id).lean();
        // Lowercase in, canonical form stored — a code pasted from an email must match.
        expect(fresh!.expert_referral_code).toBe("DRSUJANA12026");
        expect(String(fresh!.referred_by_expert_id)).toBe(String(expert._id));
    });

    it("applies the program's capability overrides to the user", async () => {
        await seedPlan();
        await makeProgram({
            benefits: {
                grant: { planCode: null },
                seats: { total: null, claimed: 0 },
                entitlementOverrides: [
                    { capability: ECapability.PRODUCTS_VIEW, access: EAccess.LOCKED },
                ],
            },
        });
        const user = await makeUser(3);

        const result = await referralService.redeem(user._id, "DRSUJANA12026");

        expect(result.grant).toBeNull();
        expect(result.grantSkippedReason).toBe(EReferralGrantSkipReason.NO_GRANT_CONFIGURED);
        expect(result.suppressedCapabilities).toContain(ECapability.PRODUCTS_VIEW);

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.capabilities[ECapability.PRODUCTS_VIEW].access).toBe(EAccess.LOCKED);
    });
});

describe("referral redemption — seat pools", () => {
    /**
     * The reason the seat claim is a conditional findOneAndUpdate rather than a
     * read-then-write. Nothing about this is provable without a real engine.
     */
    it("lets exactly the pool size through under concurrency", async () => {
        await seedPlan();
        const program = await makeProgram({
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 2, claimed: 0 },
                entitlementOverrides: [],
            },
        });

        const users = await Promise.all([1, 2, 3, 4, 5].map((n) => makeUser(n)));

        const results = await Promise.all(
            users.map((u) =>
                referralService
                    .redeem(u._id, "DRSUJANA12026")
                    .then((r) => (r.grant ? "granted" : "skipped"))
                    .catch(() => "error"),
            ),
        );

        expect(results.filter((r) => r === "granted")).toHaveLength(2);
        expect(results.filter((r) => r === "error")).toHaveLength(0);

        const after = await referralProgramModel.findById(program._id).lean();
        expect(after!.benefits.seats.claimed).toBe(2);
        expect(await subscriptionModel.countDocuments({})).toBe(2);
    });

    it("still redeems once the pool is empty — she is just not granted", async () => {
        await seedPlan();
        const expert = await makeExpert();
        await makeProgram(
            {
                benefits: {
                    grant: { planCode: EPlanCode.MONTHLY },
                    seats: { total: 1, claimed: 1 },
                    entitlementOverrides: [],
                },
            },
            expert._id,
        );
        const user = await makeUser(9);

        const result = await referralService.redeem(user._id, "DRSUJANA12026");

        expect(result.grant).toBeNull();
        expect(result.grantSkippedReason).toBe(EReferralGrantSkipReason.SEATS_EXHAUSTED);

        // The degraded-success contract: the 501st employee must still finish onboarding
        // with her doctor pinned, or she is walled out with nothing support can do.
        const fresh = await UserModel.findById(user._id).lean();
        expect(String(fresh!.referred_by_expert_id)).toBe(String(expert._id));
        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(0);
    });

    it("does not spend a seat on someone who is already subscribed", async () => {
        await seedPlan();
        const program = await makeProgram({
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 5, claimed: 0 },
                entitlementOverrides: [],
            },
        });
        const user = await makeUser(10);

        await subscriptionService.grantFromReferral({
            userId: user._id,
            planCode: EPlanCode.MONTHLY,
            programId: program._id,
        });
        const existing = await subscriptionModel.findOne({ user_id: user._id }).lean();

        const result = await referralService.redeem(user._id, "DRSUJANA12026");

        expect(result.grantSkippedReason).toBe(EReferralGrantSkipReason.ALREADY_SUBSCRIBED);
        const after = await referralProgramModel.findById(program._id).lean();
        expect(after!.benefits.seats.claimed).toBe(0);
        const unchanged = await subscriptionModel.findOne({ user_id: user._id }).lean();
        expect(unchanged!.currentPeriodEnd).toEqual(existing!.currentPeriodEnd);
    });
});

describe("referral redemption — one per user", () => {
    it("survives a double-tapped submit", async () => {
        await seedPlan();
        await makeProgram();
        const user = await makeUser(11);

        // Concurrent, so this exercises the E11000 path rather than the read fast path.
        const [a, b] = await Promise.all([
            referralService.redeem(user._id, "DRSUJANA12026"),
            referralService.redeem(user._id, "DRSUJANA12026"),
        ]);

        expect(await referralRedemptionModel.countDocuments({ user_id: user._id })).toBe(1);
        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(1);
        // Whichever lost the race still answers successfully.
        expect([a.alreadyRedeemed, b.alreadyRedeemed]).toContain(true);
    });

    it("rejects a second, different code", async () => {
        await seedPlan();
        await makeProgram();
        const otherExpert = await makeExpert("Dr Other");
        await referralProgramModel.create({
            code: "OTHER12026",
            ownerType: EReferralOwnerType.EXPERT,
            owner_expert_id: otherExpert._id,
            isActive: true,
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 3, claimed: 0 },
                entitlementOverrides: [],
            },
        });

        const user = await makeUser(12);
        await referralService.redeem(user._id, "DRSUJANA12026");

        await expect(referralService.redeem(user._id, "OTHER12026")).rejects.toMatchObject({
            code: "REFERRAL_ALREADY_REDEEMED",
        });

        const other = await referralProgramModel.findOne({ code: "OTHER12026" }).lean();
        expect(other!.benefits.seats.claimed).toBe(0);
    });
});

describe("referral redemption — rejections", () => {
    it("rejects an unknown code instead of silently storing it", async () => {
        const user = await makeUser(13);

        await expect(referralService.redeem(user._id, "NOPE123")).rejects.toBeInstanceOf(
            ReferralError,
        );

        // The endpoint this replaces stored the junk string and returned 200. Now that a
        // code can carry a free month, she has to be told she mistyped it.
        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.expert_referral_code).toBeNull();
        expect(await referralRedemptionModel.countDocuments({})).toBe(0);
    });

    it("rejects an inactive program and an expired window", async () => {
        await seedPlan();
        await makeProgram({ isActive: false });
        const user = await makeUser(14);

        await expect(referralService.redeem(user._id, "DRSUJANA12026")).rejects.toMatchObject({
            code: "REFERRAL_PROGRAM_INACTIVE",
        });

        await referralProgramModel.updateOne(
            { code: "DRSUJANA12026" },
            { $set: { isActive: true, endsAt: new Date(Date.now() - 1000) } },
        );

        await expect(referralService.redeem(user._id, "DRSUJANA12026")).rejects.toMatchObject({
            code: "REFERRAL_PROGRAM_EXPIRED",
        });
    });
});

describe("referral redemption — failure compensation", () => {
    it("keeps the redemption, frees the seat and records the failure when the grant throws", async () => {
        await seedPlan();
        const expert = await makeExpert();
        const program = await makeProgram(
            {
                benefits: {
                    grant: { planCode: EPlanCode.MONTHLY },
                    seats: { total: 3, claimed: 0 },
                    entitlementOverrides: [],
                },
            },
            expert._id,
        );
        const user = await makeUser(15);

        const spy = jest
            .spyOn(subscriptionPlanService, "getByCode")
            .mockResolvedValue(null as any);

        const result = await referralService.redeem(user._id, "DRSUJANA12026");
        spy.mockRestore();

        expect(result.grant).toBeNull();
        expect(result.grantSkippedReason).toBe(EReferralGrantSkipReason.GRANT_FAILED);

        const ledger = await referralRedemptionModel.findOne({ user_id: user._id }).lean();
        expect(ledger!.status).toBe(EReferralRedemptionStatus.FAILED);
        expect(ledger!.seatClaimed).toBe(false);

        const after = await referralProgramModel.findById(program._id).lean();
        expect(after!.benefits.seats.claimed).toBe(0);

        // A failed grant must never wedge onboarding — the pinning still applied.
        const fresh = await UserModel.findById(user._id).lean();
        expect(String(fresh!.referred_by_expert_id)).toBe(String(expert._id));
    });

    it("retries a failed grant from the admin path", async () => {
        await seedPlan();
        await makeProgram();
        const user = await makeUser(16);

        const spy = jest
            .spyOn(subscriptionPlanService, "getByCode")
            .mockResolvedValue(null as any);
        await referralService.redeem(user._id, "DRSUJANA12026");
        spy.mockRestore();

        const failed = await referralRedemptionModel.findOne({ user_id: user._id }).lean();
        const retried = await referralService.retryGrant(failed!._id);

        expect(retried.status).toBe(EReferralRedemptionStatus.COMPLETED);
        expect(await subscriptionModel.countDocuments({ user_id: user._id })).toBe(1);
    });
});

describe("referral redemption — revoke", () => {
    it("frees the seat and lets the user redeem again", async () => {
        await seedPlan();
        const program = await makeProgram({
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 2, claimed: 0 },
                entitlementOverrides: [],
            },
        });
        const user = await makeUser(17);

        await referralService.redeem(user._id, "DRSUJANA12026");
        const ledger = await referralRedemptionModel.findOne({ user_id: user._id }).lean();

        await referralService.revoke(ledger!._id);

        const after = await referralProgramModel.findById(program._id).lean();
        expect(after!.benefits.seats.claimed).toBe(0);
        expect(await referralRedemptionModel.countDocuments({ user_id: user._id })).toBe(0);

        // The one-per-user index slot is free again — this is the support answer for a
        // user who entered the wrong code.
        await expect(referralService.redeem(user._id, "DRSUJANA12026")).resolves.toBeTruthy();
    });
});

describe("referral grants and the lifecycle", () => {
    it("expires like any other subscription once the term is up", async () => {
        const plan = await seedPlan();
        await makeProgram();
        const user = await makeUser(18);

        await referralService.redeem(user._id, "DRSUJANA12026");
        const granted = await subscriptionModel.findOne({ user_id: user._id }).lean();

        const afterEnd = new Date(granted!.currentPeriodEnd!.getTime() + 1000);
        await subscriptionLifecycle(afterEnd);

        const expired = await subscriptionModel.findById(granted!._id).lean();
        expect(expired!.status).toBe(ESubscriptionStatus.EXPIRED);
        expect(expired!.isCurrent).toBe(false);

        const fresh = await UserModel.findById(user._id).lean();
        expect(fresh!.subscription.tier).toBe(ESubscriptionTier.FREE);
        expect(plan.durationDays).toBe(PLAN_DURATION_DAYS);
    });

    it("burns the trial, as a paid term does", async () => {
        await seedPlan();
        await makeProgram();
        const user = await makeUser(19);

        await referralService.redeem(user._id, "DRSUJANA12026");

        const entitlements = await entitlementService.getEntitlements(user._id);
        expect(entitlements.hasUsedTrial).toBe(true);
        await expect(subscriptionService.startTrial(user._id)).rejects.toBeTruthy();
    });
});

describe("organization-owned codes", () => {
    it("records the organization and pins nobody", async () => {
        await seedPlan();
        const org = await organizationModel.create({ name: "Acme Health", slug: "acme-health" });
        await referralProgramModel.create({
            code: "ACME500",
            ownerType: EReferralOwnerType.ORGANIZATION,
            owner_organization_id: org._id,
            isActive: true,
            benefits: {
                grant: { planCode: EPlanCode.MONTHLY },
                seats: { total: 500, claimed: 0 },
                entitlementOverrides: [],
            },
        });
        const user = await makeUser(20);

        const result = await referralService.redeem(user._id, "ACME500");

        expect(result.ownerType).toBe(EReferralOwnerType.ORGANIZATION);
        expect(result.grant).not.toBeNull();

        const fresh = await UserModel.findById(user._id).lean();
        // No expert to pin, so the whole directory stays visible — which is correct.
        expect(fresh!.referred_by_expert_id).toBeNull();
        expect(String(fresh!.referred_by_organization_id)).toBe(String(org._id));
    });
});
