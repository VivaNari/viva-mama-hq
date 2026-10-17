import { ESubscriptionTier, EUsageCounterKey } from "../../types/subscription.types";

/**
 * THE ENTITLEMENT MATRIX — the single source of truth for what each tier can do.
 *
 * This file is data, not logic. Everything that gates a feature reads from here, the
 * app renders its limits from here (via GET /subscription/me), and the matrix tests are
 * generated from here so config and tests cannot drift.
 *
 * Tuning the funnel — 3 free AI messages, 2 unlocked products, a 150-char post cap —
 * must never require an app-store release, so no number below may be duplicated in the
 * client.
 */

export enum ECapability {
    AI_CHAT = "ai.chat",
    CHECKIN_WEEKLY = "checkin.weekly",
    CONTENT_GLOBAL_HEALTH = "content.globalHealth",
    CONTENT_WEEKLY_RECOVERY = "content.weeklyRecovery",
    CONTENT_OTHER = "content.other",
    PRODUCTS_VIEW = "products.view",
    COMMUNITY_READ = "community.read",
    COMMUNITY_POST = "community.post",
    MOOD_LOG = "moodLog",
    CONSULTATION_EXPERT = "consultation.expert",
    CONSULTATION_CARE_MANAGER = "consultation.careManager",
}

export enum EAccess {
    /** Feature is not available at this tier at all. */
    LOCKED = "LOCKED",
    ALLOWED = "ALLOWED",
}

export enum EQuotaWindow {
    /** Resets at midnight IST. */
    DAY = "DAY",
    /** One allowance for the whole subscription period (the trial's single check-in). */
    PERIOD = "PERIOD",
}

/** How a consultation is paid for at this tier. */
export enum EFulfilment {
    PAY_PER_SESSION = "PAY_PER_SESSION",
    CREDITS = "CREDITS",
}

export interface ICapabilityRule {
    access: EAccess;
    /**
     * Max uses per window, or null for unlimited. For content/products this is the
     * number of items unlocked rather than a rate.
     */
    limit?: number | null;
    window?: EQuotaWindow;
    /** Which usage_counters row backs `limit`. Only set for metered capabilities. */
    quotaKey?: EUsageCounterKey;
    /** Character cap for user-authored text. */
    maxChars?: number;
    fulfilment?: EFulfilment;
}

export type TEntitlementMatrix = Record<ESubscriptionTier, Record<ECapability, ICapabilityRule>>;

const UNLIMITED = { access: EAccess.ALLOWED, limit: null } as const;
const LOCKED = { access: EAccess.LOCKED } as const;

export const ENTITLEMENTS: TEntitlementMatrix = {
    [ESubscriptionTier.FREE]: {
        [ECapability.AI_CHAT]: {
            access: EAccess.ALLOWED,
            limit: 3,
            window: EQuotaWindow.DAY,
            quotaKey: EUsageCounterKey.AI_MESSAGE,
        },
        // The Viva Recovery Score is the core premium loop; giving it away free leaves
        // the paywall with little to sell.
        [ECapability.CHECKIN_WEEKLY]: LOCKED,
        [ECapability.CONTENT_GLOBAL_HEALTH]: UNLIMITED,
        // All recovery articles for the user's current week are open. The content-ops
        // paywall is structural: unclassified (null contentGroup) articles are filtered
        // All recovery articles for the user's current week are open.
        [ECapability.CONTENT_WEEKLY_RECOVERY]: UNLIMITED,
        // Unclassified articles act as the paywall teaser. FREE gets 0.
        [ECapability.CONTENT_OTHER]: LOCKED,
        [ECapability.PRODUCTS_VIEW]: { access: EAccess.ALLOWED, limit: 2 },
        [ECapability.COMMUNITY_READ]: UNLIMITED,
        [ECapability.COMMUNITY_POST]: { access: EAccess.ALLOWED, limit: null, maxChars: 150 },
        [ECapability.MOOD_LOG]: UNLIMITED,
        [ECapability.CONSULTATION_EXPERT]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.PAY_PER_SESSION,
        },
        // Was LOCKED, which turned a non-paying user away entirely. Now the same
        // pay-per-session deal as an expert: no credit bucket at this tier, so the fee on
        // the counsellor's document is charged instead. The premium bucket keeps its
        // value because a credit still means not paying.
        [ECapability.CONSULTATION_CARE_MANAGER]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.PAY_PER_SESSION,
        },
    },

    [ESubscriptionTier.TRIAL]: {
        [ECapability.AI_CHAT]: UNLIMITED,
        [ECapability.CHECKIN_WEEKLY]: {
            access: EAccess.ALLOWED,
            limit: 1,
            window: EQuotaWindow.PERIOD,
            quotaKey: EUsageCounterKey.CHECKIN_START,
        },
        [ECapability.CONTENT_GLOBAL_HEALTH]: UNLIMITED,
        [ECapability.CONTENT_WEEKLY_RECOVERY]: UNLIMITED,
        [ECapability.CONTENT_OTHER]: { access: EAccess.ALLOWED, limit: 5 },
        [ECapability.PRODUCTS_VIEW]: UNLIMITED,
        [ECapability.COMMUNITY_READ]: UNLIMITED,
        [ECapability.COMMUNITY_POST]: { access: EAccess.ALLOWED, limit: null, maxChars: 500 },
        [ECapability.MOOD_LOG]: UNLIMITED,
        // Settled requirement: the trial grants NO consultation credits. "Doctor
        // consultation as per the one time consultation" means the trial keeps the
        // existing pay-per-session flow, exactly as FREE.
        [ECapability.CONSULTATION_EXPERT]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.PAY_PER_SESSION,
        },
        // The trial grants no consultation credits of either kind, so both consultation
        // types behave exactly as they do on FREE.
        [ECapability.CONSULTATION_CARE_MANAGER]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.PAY_PER_SESSION,
        },
    },

    [ESubscriptionTier.PREMIUM]: {
        [ECapability.AI_CHAT]: UNLIMITED,
        [ECapability.CHECKIN_WEEKLY]: UNLIMITED,
        [ECapability.CONTENT_GLOBAL_HEALTH]: UNLIMITED,
        [ECapability.CONTENT_WEEKLY_RECOVERY]: UNLIMITED,
        [ECapability.CONTENT_OTHER]: UNLIMITED,
        [ECapability.PRODUCTS_VIEW]: UNLIMITED,
        [ECapability.COMMUNITY_READ]: UNLIMITED,
        [ECapability.COMMUNITY_POST]: { access: EAccess.ALLOWED, limit: null, maxChars: 500 },
        [ECapability.MOOD_LOG]: UNLIMITED,
        // Credits first, then fall back to paying per session once they run out.
        [ECapability.CONSULTATION_EXPERT]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.CREDITS,
        },
        [ECapability.CONSULTATION_CARE_MANAGER]: {
            access: EAccess.ALLOWED,
            fulfilment: EFulfilment.CREDITS,
        },
    },
};

/** Trial length in days. */
export const TRIAL_DURATION_DAYS = 7;

export function getRule(tier: ESubscriptionTier, capability: ECapability): ICapabilityRule {
    return ENTITLEMENTS[tier][capability];
}

/**
 * A per-user suppression of one capability, carried by a referral program and
 * denormalized onto `user.entitlement_overrides`.
 *
 * The matrix above stays the only place a tier's allowance is defined. This is a
 * second, restrictive dimension on top of it — never a replacement.
 *
 * LOCKED is the only thing an override can say, deliberately. A numeric limit was the
 * obvious next field and it is a trap: an unmetered rule (PREMIUM's `ai.chat` is
 * `{ ALLOWED, limit: null }` with no `quotaKey`) carries nothing for
 * `consumeCapability` to count against, so "limit: 5" on one of those would read as
 * configured, appear in GET /subscription/me, and enforce nothing whatsoever. Whoever
 * wants per-user limits should give the capability a quota key in the matrix first,
 * and extend this then.
 */
export interface ICapabilityOverride {
    capability: ECapability;
    access: EAccess;
}

/**
 * The tier's rule for a capability, narrowed by any per-user override.
 *
 * THE INVARIANT: an override may only ever take access AWAY. An `ALLOWED` override is
 * a no-op, never a grant.
 *
 * That is not a stylistic choice. Overrides are written from a referral program, which
 * an admin edits — if they could widen, anyone able to create a program could mint
 * premium for a user with no subscription row behind it, and none of the tier
 * accounting, the paywall or the lifecycle cron would ever know. Narrowing-only keeps
 * the tier matrix the sole grantor of access, so the worst a bad override can do is
 * give a user less than she is entitled to, which is visible and fixable.
 */
export function resolveRule(
    tier: ESubscriptionTier,
    capability: ECapability,
    overrides?: ICapabilityOverride[] | null,
): ICapabilityRule {
    const base = getRule(tier, capability);
    if (!overrides?.length) return base;

    const override = overrides.find((o) => o.capability === capability);
    if (!override || override.access !== EAccess.LOCKED) return base;

    // Drop limit/window/quotaKey with it: a LOCKED rule that still carried a quota key
    // would have consumeCapability metering a capability nobody can reach.
    return { access: EAccess.LOCKED };
}
