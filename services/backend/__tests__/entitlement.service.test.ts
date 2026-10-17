jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import {
    EntitlementService,
    istDayKey,
    nextIstMidnightUtc,
} from "../src/services/entitlements/entitlement.service";
import {
    ECapability,
    EAccess,
    EFulfilment,
    EQuotaWindow,
    ENTITLEMENTS,
} from "../src/services/entitlements/entitlement.config";
import { IUser } from "../src/types";
import {
    EBillingMode,
    EPlanCode,
    ESubscriptionStatus,
    ESubscriptionTier,
    EUsageCounterKey,
} from "../src/types/subscription.types";

const service = new EntitlementService();
const NOW = new Date("2026-07-22T12:00:00.000Z");

function userWith(snapshot: Partial<IUser["subscription"]>): Pick<IUser, "subscription"> {
    return {
        subscription: {
            tier: ESubscriptionTier.FREE,
            status: null,
            planCode: null,
            subscription_id: null,
            billingMode: null,
            trialEndAt: null,
            currentPeriodEnd: null,
            hasUsedTrial: false,
            ...snapshot,
        },
    } as Pick<IUser, "subscription">;
}

describe("resolveTier", () => {
    it("defaults to FREE with no snapshot", () => {
        expect(service.resolveTier({} as IUser, NOW)).toBe(ESubscriptionTier.FREE);
    });

    it("returns TRIAL while the trial is running", () => {
        const user = userWith({
            tier: ESubscriptionTier.TRIAL,
            trialEndAt: new Date("2026-07-25T00:00:00.000Z"),
        });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.TRIAL);
    });

    // The whole reason tier is derived rather than trusted: a snapshot the cron has not
    // yet swept must not keep granting access.
    it("returns FREE for a TRIAL snapshot whose end date has passed", () => {
        const user = userWith({
            tier: ESubscriptionTier.TRIAL,
            trialEndAt: new Date("2026-07-20T00:00:00.000Z"),
        });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.FREE);
    });

    it("returns PREMIUM inside the paid period", () => {
        const user = userWith({
            tier: ESubscriptionTier.PREMIUM,
            planCode: EPlanCode.MONTHLY,
            currentPeriodEnd: new Date("2026-08-20T00:00:00.000Z"),
        });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.PREMIUM);
    });

    it("returns FREE for a PREMIUM snapshot whose period has elapsed", () => {
        const user = userWith({
            tier: ESubscriptionTier.PREMIUM,
            planCode: EPlanCode.MONTHLY,
            currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
        });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.FREE);
    });

    // Cancelling stops renewal; it does not revoke the period already paid for.
    it("keeps PREMIUM until period end after cancellation", () => {
        const user = userWith({
            tier: ESubscriptionTier.PREMIUM,
            status: ESubscriptionStatus.CANCELLED,
            billingMode: EBillingMode.MANUAL,
            currentPeriodEnd: new Date("2026-08-20T00:00:00.000Z"),
        });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.PREMIUM);
    });

    // Fail closed: a malformed snapshot must not grant open-ended access.
    it("returns FREE for a PREMIUM snapshot with no period end", () => {
        const user = userWith({ tier: ESubscriptionTier.PREMIUM, currentPeriodEnd: null });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.FREE);
    });

    it("treats the exact expiry instant as expired", () => {
        const user = userWith({ tier: ESubscriptionTier.TRIAL, trialEndAt: NOW });
        expect(service.resolveTier(user, NOW)).toBe(ESubscriptionTier.FREE);
    });
});

describe("IST day windows", () => {
    // IST midnight is 18:30 UTC the previous day. Getting this wrong shifts every free
    // user's daily AI reset by 5.5 hours.
    it("rolls the day key at 18:30 UTC, not at UTC midnight", () => {
        expect(istDayKey(new Date("2026-07-22T18:29:59.000Z"))).toBe("2026-07-22");
        expect(istDayKey(new Date("2026-07-22T18:30:00.000Z"))).toBe("2026-07-23");
    });

    it("keeps late-UTC-evening traffic on the following IST day", () => {
        expect(istDayKey(new Date("2026-07-22T23:00:00.000Z"))).toBe("2026-07-23");
    });

    it("returns the next IST midnight as a UTC instant", () => {
        expect(nextIstMidnightUtc(new Date("2026-07-22T12:00:00.000Z")).toISOString()).toBe(
            "2026-07-22T18:30:00.000Z",
        );
    });

    it("advances a full day when called exactly at IST midnight", () => {
        expect(nextIstMidnightUtc(new Date("2026-07-22T18:30:00.000Z")).toISOString()).toBe(
            "2026-07-23T18:30:00.000Z",
        );
    });
});

/**
 * Generated straight from ENTITLEMENTS so the config and these assertions cannot drift.
 */
describe("entitlement matrix", () => {
    const tiers = Object.values(ESubscriptionTier);

    it.each(tiers)("%s defines a rule for every capability", (tier) => {
        for (const capability of Object.values(ECapability)) {
            expect(ENTITLEMENTS[tier][capability]).toBeDefined();
        }
    });

    it("meters AI chat on FREE and leaves it unlimited above", () => {
        expect(ENTITLEMENTS[ESubscriptionTier.FREE][ECapability.AI_CHAT].limit).toBe(3);
        expect(ENTITLEMENTS[ESubscriptionTier.TRIAL][ECapability.AI_CHAT].limit).toBeNull();
        expect(ENTITLEMENTS[ESubscriptionTier.PREMIUM][ECapability.AI_CHAT].limit).toBeNull();
    });

    // Pins the SHAPE, not the allowance. How many check-ins the trial grants is a funnel
    // dial that should be tunable without editing a test; what must not change by accident
    // is that FREE is locked out entirely and TRIAL is metered against a finite,
    // period-scoped quota rather than being unlimited.
    it("locks the weekly check-in on FREE and meters it on TRIAL", () => {
        expect(ENTITLEMENTS[ESubscriptionTier.FREE][ECapability.CHECKIN_WEEKLY].access).toBe(
            EAccess.LOCKED,
        );

        const trial = ENTITLEMENTS[ESubscriptionTier.TRIAL][ECapability.CHECKIN_WEEKLY];
        expect(trial.access).toBe(EAccess.ALLOWED);
        expect(typeof trial.limit).toBe("number");
        expect(trial.limit).toBeGreaterThan(0);
        // PERIOD, not DAY — one allowance for the whole trial, so it cannot be reset by
        // waiting for midnight.
        expect(trial.window).toBe(EQuotaWindow.PERIOD);
        expect(trial.quotaKey).toBe(EUsageCounterKey.CHECKIN_START);

        expect(
            ENTITLEMENTS[ESubscriptionTier.PREMIUM][ECapability.CHECKIN_WEEKLY].limit,
        ).toBeNull();
    });

    // Settled product decision: the trial grants no consultation credits, so expert
    // bookings stay pay-per-session on both FREE and TRIAL.
    it("keeps expert consultations pay-per-session on FREE and TRIAL", () => {
        for (const tier of [ESubscriptionTier.FREE, ESubscriptionTier.TRIAL]) {
            expect(ENTITLEMENTS[tier][ECapability.CONSULTATION_EXPERT].fulfilment).toBe(
                EFulfilment.PAY_PER_SESSION,
            );
        }
        expect(
            ENTITLEMENTS[ESubscriptionTier.PREMIUM][ECapability.CONSULTATION_EXPERT].fulfilment,
        ).toBe(EFulfilment.CREDITS);
    });

    // Care-manager callbacks used to be LOCKED below PREMIUM, which turned a non-paying
    // user away outright. They now mirror expert consultations: pay per session without a
    // subscription, spend a credit with one.
    it("offers care-manager callbacks pay-per-session below PREMIUM", () => {
        for (const tier of [ESubscriptionTier.FREE, ESubscriptionTier.TRIAL]) {
            expect(ENTITLEMENTS[tier][ECapability.CONSULTATION_CARE_MANAGER].access).toBe(
                EAccess.ALLOWED,
            );
            expect(ENTITLEMENTS[tier][ECapability.CONSULTATION_CARE_MANAGER].fulfilment).toBe(
                EFulfilment.PAY_PER_SESSION,
            );
        }
        expect(
            ENTITLEMENTS[ESubscriptionTier.PREMIUM][ECapability.CONSULTATION_CARE_MANAGER]
                .fulfilment,
        ).toBe(EFulfilment.CREDITS);
    });

    it("treats both consultation types identically at every tier", () => {
        // The two capabilities are now the same deal end to end. If they ever diverge it
        // should be a deliberate edit here, not a silent drift in the matrix.
        for (const tier of tiers) {
            const expert = ENTITLEMENTS[tier][ECapability.CONSULTATION_EXPERT];
            const careManager = ENTITLEMENTS[tier][ECapability.CONSULTATION_CARE_MANAGER];
            expect(careManager.access).toBe(expert.access);
            expect(careManager.fulfilment).toBe(expert.fulfilment);
        }
    });

    it("never gates the mood log", () => {
        for (const tier of tiers) {
            expect(ENTITLEMENTS[tier][ECapability.MOOD_LOG].access).toBe(EAccess.ALLOWED);
            expect(ENTITLEMENTS[tier][ECapability.MOOD_LOG].limit).toBeNull();
        }
    });

    it("never gates reading the community", () => {
        for (const tier of tiers) {
            expect(ENTITLEMENTS[tier][ECapability.COMMUNITY_READ].access).toBe(EAccess.ALLOWED);
        }
    });

    it("caps free posts shorter than paid ones", () => {
        const free = ENTITLEMENTS[ESubscriptionTier.FREE][ECapability.COMMUNITY_POST].maxChars!;
        const premium =
            ENTITLEMENTS[ESubscriptionTier.PREMIUM][ECapability.COMMUNITY_POST].maxChars!;
        expect(free).toBeLessThan(premium);
    });

    // A metered rule with no quotaKey would silently never be counted.
    it("gives every limited, windowed capability a quota key", () => {
        for (const tier of tiers) {
            for (const capability of Object.values(ECapability)) {
                const rule = ENTITLEMENTS[tier][capability];
                if (rule.window) {
                    expect(rule.quotaKey).toBeDefined();
                    expect(rule.limit).not.toBeNull();
                }
            }
        }
    });
});
