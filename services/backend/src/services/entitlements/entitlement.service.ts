import usageCounterModel from "../../models/usage-counter.model";
import UserModel from "../../models/user.model";
import subscriptionModel from "../../models/subscription.model";
import { IUser } from "../../types";
import {
    ECreditType,
    ESubscriptionTier,
    EUsageCounterKey,
    IUserSubscriptionSnapshot,
    TObjectIdLike,
} from "../../types/subscription.types";
import {
    ECapability,
    EAccess,
    EQuotaWindow,
    ENTITLEMENTS,
    ICapabilityOverride,
    ICapabilityRule,
    getRule,
    resolveRule,
} from "./entitlement.config";
import { creditService } from "./credit.service";
import { EDenialCode, EntitlementDeniedError } from "./entitlement.errors";

/**
 * India has no daylight saving, so a fixed +05:30 offset is exactly correct — no
 * timezone database needed. Revisit only if the product ships outside India, at which
 * point the reset needs a per-user timezone (none is stored on `user` today).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' for the IST day containing `now`. */
export function istDayKey(now: Date = new Date()): string {
    return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant of the next IST midnight — when a DAY quota resets. */
export function nextIstMidnightUtc(now: Date = new Date()): Date {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    const nextIstMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1);
    return new Date(nextIstMidnight - IST_OFFSET_MS);
}

export interface IResolvedCapability extends ICapabilityRule {
    used?: number;
    remaining?: number | null;
    resetAt?: Date | null;
}

export interface IEntitlements {
    tier: ESubscriptionTier;
    status: IUserSubscriptionSnapshot["status"];
    planCode: IUserSubscriptionSnapshot["planCode"];
    billingMode: IUserSubscriptionSnapshot["billingMode"];
    trialEndAt: Date | null;
    currentPeriodEnd: Date | null;
    hasUsedTrial: boolean;
    capabilities: Record<ECapability, IResolvedCapability>;
    credits: { expert: number; careManager: number };
}

export class EntitlementService {
    /**
     * The authoritative tier for a user, right now.
     *
     * Dates are evaluated lazily rather than trusted from `snapshot.tier`: a row still
     * marked PREMIUM whose period has elapsed resolves to FREE here. That means
     * correctness never depends on the daily lifecycle cron having run — the cron is
     * for notifications and keeping the snapshot fresh, not for access control.
     *
     * A cancelled subscription keeps its tier until `currentPeriodEnd`, which falls out
     * of this naturally: cancellation sets `cancelledAt` and leaves the period alone.
     */
    public resolveTier(
        user: Pick<IUser, "subscription">,
        now: Date = new Date(),
    ): ESubscriptionTier {
        const snapshot = user?.subscription;
        if (!snapshot) return ESubscriptionTier.FREE;

        if (snapshot.tier === ESubscriptionTier.TRIAL) {
            return snapshot.trialEndAt && snapshot.trialEndAt.getTime() > now.getTime()
                ? ESubscriptionTier.TRIAL
                : ESubscriptionTier.FREE;
        }

        if (snapshot.tier === ESubscriptionTier.PREMIUM) {
            // A PREMIUM snapshot with no period end is malformed; fail closed to FREE
            // rather than granting open-ended access.
            return snapshot.currentPeriodEnd && snapshot.currentPeriodEnd.getTime() > now.getTime()
                ? ESubscriptionTier.PREMIUM
                : ESubscriptionTier.FREE;
        }

        return ESubscriptionTier.FREE;
    }

    /**
     * Current balance for each credit bucket. Delegates to CreditService so there is a
     * single definition of "what the balance is" — it reads the highest `seq` row, which
     * is the same ordering the concurrency guard writes against.
     */
    public async getCreditBalances(
        userId: TObjectIdLike,
    ): Promise<{ expert: number; careManager: number }> {
        return creditService.getBalances(userId);
    }

    public async getCreditBalance(userId: TObjectIdLike, type: ECreditType): Promise<number> {
        return creditService.getBalance(userId, type);
    }

    /**
     * The window key a metered capability counts against: an IST calendar day, or the
     * subscription period (so the trial's single check-in cannot be reset by waiting).
     */
    public windowKeyFor(
        window: EQuotaWindow,
        snapshot: IUserSubscriptionSnapshot | undefined,
        now: Date = new Date(),
    ): string {
        if (window === EQuotaWindow.PERIOD) {
            // Falling back to the user-level key rather than a date: a PERIOD allowance
            // with no subscription must still be one allowance, not one per day.
            return snapshot?.subscription_id ? `sub:${snapshot.subscription_id}` : "sub:none";
        }
        return istDayKey(now);
    }

    /**
     * Resolve a user's tier and the rule for one capability, in a single read.
     *
     * The rule comes back already narrowed by the user's overrides, which is why
     * `assertCapability`, `consumeCapability` and `refundQuota` need no override logic
     * of their own — all three go through here.
     */
    public async resolveFor(
        userId: TObjectIdLike,
        capability: ECapability,
        now: Date = new Date(),
    ): Promise<{
        tier: ESubscriptionTier;
        rule: ICapabilityRule;
        snapshot: IUserSubscriptionSnapshot | undefined;
    }> {
        const user = await UserModel.findById(userId)
            .select("subscription entitlement_overrides")
            .lean();
        const snapshot = user?.subscription as IUserSubscriptionSnapshot | undefined;
        const tier = this.resolveTier({ subscription: snapshot } as IUser, now);
        const overrides = user?.entitlement_overrides as ICapabilityOverride[] | undefined;
        return { tier, rule: resolveRule(tier, capability, overrides), snapshot };
    }

    /**
     * Throw unless the tier includes this capability at all. No metering.
     */
    public async assertCapability(
        userId: TObjectIdLike,
        capability: ECapability,
        now: Date = new Date(),
    ): Promise<ESubscriptionTier> {
        const { tier, rule } = await this.resolveFor(userId, capability, now);

        if (rule.access === EAccess.LOCKED) {
            throw new EntitlementDeniedError(EDenialCode.LOCKED_FEATURE, {
                capability,
                tier,
                upsell: ESubscriptionTier.PREMIUM,
            });
        }

        return tier;
    }

    /**
     * Spend one unit of a metered capability, or throw.
     *
     * The increment is a single conditional upsert, not read-then-write. The filter
     * carries `count < limit`, so when the allowance is already spent the update matches
     * nothing, the upsert attempts an insert, and the unique index on
     * (user_id, key, windowKey) rejects it — which is exactly the signal that the quota
     * is gone. That is what stops a double-tapped send from yielding a 4th free message.
     */
    public async consumeCapability(
        userId: TObjectIdLike,
        capability: ECapability,
        now: Date = new Date(),
    ): Promise<{ used: number; limit: number | null; remaining: number | null }> {
        const { tier, rule, snapshot } = await this.resolveFor(userId, capability, now);

        if (rule.access === EAccess.LOCKED) {
            throw new EntitlementDeniedError(EDenialCode.LOCKED_FEATURE, {
                capability,
                tier,
                upsell: ESubscriptionTier.PREMIUM,
            });
        }

        // Unlimited, or not metered by a counter (content/product slices are sliced at
        // read time instead). Nothing to spend.
        if (!rule.quotaKey || !rule.window || rule.limit == null) {
            return { used: 0, limit: null, remaining: null };
        }

        const windowKey = this.windowKeyFor(rule.window, snapshot, now);
        const resetAt =
            rule.window === EQuotaWindow.DAY
                ? nextIstMidnightUtc(now)
                : (snapshot?.currentPeriodEnd ?? snapshot?.trialEndAt ?? null);

        try {
            const counter = await usageCounterModel.findOneAndUpdate(
                { user_id: userId, key: rule.quotaKey, windowKey, count: { $lt: rule.limit } },
                {
                    $inc: { count: 1 },
                    // A DAY counter can be dropped once its day is over; a PERIOD counter
                    // must outlive the period or the trial's single check-in would come
                    // back. Falling back to the day boundary keeps the TTL sane either way.
                    $setOnInsert: { expiresAt: resetAt ?? nextIstMidnightUtc(now) },
                },
                { upsert: true, new: true },
            );

            const used = counter?.count ?? 1;
            return { used, limit: rule.limit, remaining: Math.max(0, rule.limit - used) };
        } catch (err: any) {
            if (err?.code !== 11000) throw err;

            throw new EntitlementDeniedError(EDenialCode.QUOTA_EXCEEDED, {
                capability,
                tier,
                limit: rule.limit,
                used: rule.limit,
                resetAt,
                upsell: ESubscriptionTier.PREMIUM,
            });
        }
    }

    /** Give back a unit when the work it paid for did not happen. */
    public async refundQuota(
        userId: TObjectIdLike,
        capability: ECapability,
        now: Date = new Date(),
    ): Promise<void> {
        const { rule, snapshot } = await this.resolveFor(userId, capability, now);
        if (!rule.quotaKey || !rule.window) return;

        await usageCounterModel.updateOne(
            {
                user_id: userId,
                key: rule.quotaKey,
                windowKey: this.windowKeyFor(rule.window, snapshot, now),
                count: { $gt: 0 },
            },
            { $inc: { count: -1 } },
        );
    }

    private async getUsedCount(
        userId: TObjectIdLike,
        key: EUsageCounterKey,
        windowKey: string,
    ): Promise<number> {
        const counter = await usageCounterModel
            .findOne({ user_id: userId, key, windowKey })
            .select("count")
            .lean();
        return counter?.count ?? 0;
    }

    /**
     * The full entitlement picture for one user: tier, dates, credit balances, every
     * capability's limit, and current usage against the metered ones.
     *
     * This is what GET /subscription/me returns. The app renders every number from it
     * and hardcodes none of them.
     */
    public async getEntitlements(
        userId: TObjectIdLike,
        now: Date = new Date(),
    ): Promise<IEntitlements> {
        const user = await UserModel.findById(userId)
            .select("subscription entitlement_overrides")
            .lean();
        if (!user) throw new Error("User not found");

        const snapshot = user.subscription as IUserSubscriptionSnapshot | undefined;
        const tier = this.resolveTier({ subscription: snapshot } as IUser, now);
        const overrides = user.entitlement_overrides as ICapabilityOverride[] | undefined;

        const [credits, capabilities, hasAnySub] = await Promise.all([
            this.getCreditBalances(userId),
            this.resolveCapabilities(userId, tier, snapshot, now, overrides),
            subscriptionModel.exists({ user_id: userId }),
        ]);

        return {
            tier,
            status: snapshot?.status ?? null,
            planCode: snapshot?.planCode ?? null,
            billingMode: snapshot?.billingMode ?? null,
            trialEndAt: snapshot?.trialEndAt ?? null,
            currentPeriodEnd: snapshot?.currentPeriodEnd ?? null,
            hasUsedTrial: snapshot?.hasUsedTrial || !!hasAnySub,
            capabilities,
            credits,
        };
    }

    private async resolveCapabilities(
        userId: TObjectIdLike,
        tier: ESubscriptionTier,
        snapshot: IUserSubscriptionSnapshot | undefined,
        now: Date,
        overrides?: ICapabilityOverride[] | null,
    ): Promise<Record<ECapability, IResolvedCapability>> {
        const resolved = {} as Record<ECapability, IResolvedCapability>;

        for (const capability of Object.values(ECapability)) {
            const rule = resolveRule(tier, capability, overrides);
            const entry: IResolvedCapability = { ...rule };

            // Only metered capabilities carry usage. A capability with no quotaKey is
            // either unlimited, locked, or sliced by item count rather than rate.
            if (
                rule.access === EAccess.ALLOWED &&
                rule.quotaKey &&
                rule.window &&
                rule.limit != null
            ) {
                const windowKey = this.windowKeyFor(rule.window, snapshot, now);
                const used = await this.getUsedCount(userId, rule.quotaKey, windowKey);
                entry.used = used;
                entry.remaining = Math.max(0, rule.limit - used);
                entry.resetAt =
                    rule.window === EQuotaWindow.DAY
                        ? nextIstMidnightUtc(now)
                        : (snapshot?.currentPeriodEnd ?? snapshot?.trialEndAt ?? null);
            }

            resolved[capability] = entry;
        }

        return resolved;
    }
}

export const entitlementService = new EntitlementService();
export { ENTITLEMENTS };
