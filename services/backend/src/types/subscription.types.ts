import { Schema, Types } from "mongoose";
import { FlowLanguage } from "./chat.types";

/**
 * Anything usable as an ObjectId in a query.
 *
 * The interfaces here declare id fields as `Schema.Types.ObjectId` to match the existing
 * convention across the codebase, but that is the schema type *constructor* — the value
 * a document actually carries at runtime is a `Types.ObjectId`. Service signatures accept
 * this union so callers can pass either without a cast at every call site.
 */
export type TObjectIdLike = string | Types.ObjectId | Schema.Types.ObjectId;

/**
 * The tier a user is resolved to on every request. Note this is NOT stored as the
 * source of truth — `EntitlementService.resolveTier` derives it from the subscription
 * row's dates so an un-run cron can never hand somebody free premium. The copy on
 * `user.subscription.tier` is a denormalized snapshot for the hot path.
 */
export enum ESubscriptionTier {
    FREE = "FREE",
    TRIAL = "TRIAL",
    PREMIUM = "PREMIUM",
}

/** Lifecycle status of a `subscriptions` row. EXPIRED/CANCELLED are terminal. */
export enum ESubscriptionStatus {
    TRIALING = "trialing",
    ACTIVE = "active",
    EXPIRED = "expired",
    CANCELLED = "cancelled",
    /** AUTOPAY only: a mandate charge failed and Razorpay is retrying. */
    HALTED = "halted",
}

/** See env.BILLING_MODE. Stamped onto each subscription row at creation. */
export enum EBillingMode {
    MANUAL = "MANUAL",
    AUTOPAY = "AUTOPAY",
    /**
     * Google Play Billing. Structurally unlike the two Razorpay rails: there is no
     * server-created order to open a sheet against, and no signature to verify — the
     * client buys through Play and hands back an opaque purchase token which only
     * Google can resolve.
     *
     * Consequence worth stating once: on this rail **Google owns the billing calendar**.
     * Free-trial length, grace periods, account hold, pauses and upgrade proration all
     * move the expiry date, so `currentPeriodEnd` is read from Play and never computed
     * from `plan.durationDays`. See activateFromPlayPurchase.
     */
    PLAY = "PLAY",
}

export enum EBillingProvider {
    RAZORPAY_ORDERS = "razorpay_orders",
    RAZORPAY_SUBSCRIPTIONS = "razorpay_subscriptions",
    GOOGLE_PLAY = "google_play",
    /**
     * No payment rail at all — the row was granted by us (a referral program today,
     * a support comp tomorrow). Given its own value rather than reusing
     * `razorpay_orders` so a grant is never mistaken for a checkout that lost its
     * order id. `getBillingProvider` keys off `billingMode`, not this, so nothing
     * ever tries to resolve an IBillingProvider for it.
     */
    INTERNAL_GRANT = "internal_grant",
}

/** How a subscription row came to exist. Drives reminders and trial accounting. */
export enum ESubscriptionGrantSource {
    PURCHASE = "PURCHASE",
    TRIAL = "TRIAL",
    REFERRAL = "REFERRAL",
}

export enum EPlanCode {
    /**
     * Everything a paid plan grants except the consultation credits. Still resolves to
     * the PREMIUM tier — the difference is the plan's zero credit buckets, not a
     * capability, so booking falls back to pay-per-session on its own.
     */
    LITE = "LITE",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    HALF_YEARLY = "HALF_YEARLY",
}

/**
 * Consultation credits live in two separate buckets, never one shared counter —
 * they are different fulfilment paths (`experts` vs `care_managers`), so running out
 * of EXPERT credits must not let a user spend CARE_MANAGER credits on an expert.
 */
export enum ECreditType {
    EXPERT = "EXPERT",
    CARE_MANAGER = "CARE_MANAGER",
}

export enum ECreditReason {
    GRANT = "GRANT",
    CONSUME = "CONSUME",
    REFUND = "REFUND",
    EXPIRE = "EXPIRE",
}

/** Quota keys tracked in `usage_counters`. */
export enum EUsageCounterKey {
    AI_MESSAGE = "ai.message",
    CHECKIN_START = "checkin.start",
}

/** How a consultation was paid for — needed to know whether to refund a credit. */
export enum EConsultationPaymentMode {
    CREDIT = "CREDIT",
    PAID = "PAID",
}

/** What a payment order was raised for, now that two flows share the collection. */
export enum EPaymentOrderPurpose {
    SUBSCRIPTION = "SUBSCRIPTION",
    CONSULTATION = "CONSULTATION",
}

export interface IPlanCredits {
    expert: number;
    careManager: number;
}

export interface ISubscriptionPlanTranslationBundle {
    displayName?: string;
    description?: string;
}

export type ISubscriptionPlanTranslations = Partial<
    Record<FlowLanguage, ISubscriptionPlanTranslationBundle>
>;

/**
 * The plan catalog. Lives in Mongo, not in code and not in the app, so a price
 * change never needs an app-store release.
 */
export interface ISubscriptionPlan {
    _id: Schema.Types.ObjectId;
    code: EPlanCode;
    displayName: string;
    description: string | null;
    amountPaise: number;
    durationDays: number;
    /**
     * Stored as explicit per-bucket numbers rather than a total that gets halved:
     * an odd total has no well-defined half, and this leaves room to sell an
     * uneven split later without a schema change.
     */
    credits: IPlanCredits;
    /** AUTOPAY only — the Razorpay plan this maps to. Null under MANUAL. */
    razorpayPlanId: string | null;
    /**
     * PLAY only. The Play Console subscription product and the base plan inside it.
     *
     * These are the mapping from what Google says was bought back to a plan in this
     * catalog, so an unrecognised pair must be an error rather than a default — silently
     * falling back to the cheapest plan on a typo hands a user the wrong tier and the
     * wrong credits, and nothing downstream would flag it.
     *
     * Seeded from PLAY_PRODUCTS (services/subscription/billing/play-products.ts).
     */
    playProductId: string | null;
    playBasePlanId: string | null;
    isActive: boolean;
    sortOrder: number;
    translations?: ISubscriptionPlanTranslations;
}

/**
 * One row per subscription lifecycle; history is preserved rather than overwritten.
 * The AUTOPAY-only fields are present from day one (nullable) so flipping
 * env.BILLING_MODE needs no migration.
 */
export interface ISubscription {
    _id: Schema.Types.ObjectId;
    user_id: Schema.Types.ObjectId;
    /** Null while trialing — a trial is not yet tied to a plan. */
    planCode: EPlanCode | null;
    tier: ESubscriptionTier.TRIAL | ESubscriptionTier.PREMIUM;
    status: ESubscriptionStatus;
    /**
     * Stamped at creation from env.BILLING_MODE and never rewritten. Every lifecycle
     * decision reads this, not the env — otherwise flipping the toggle would try to
     * auto-charge trials that were started without a mandate on file.
     */
    billingMode: EBillingMode;
    provider: EBillingProvider;
    trialStartAt: Date | null;
    trialEndAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    providerOrderId: string | null;
    providerSubscriptionId: string | null;
    mandateStatus: string | null;
    /**
     * PLAY only. The purchase token Google issued for this subscription.
     *
     * Not bookkeeping — it is the join key. A Real-Time Developer Notification carries
     * only `purchaseToken` and `subscriptionId` and **no user id**, so without this
     * stored and indexed there is no way to find the row a renewal, cancellation or
     * refund belongs to. It is also what makes re-verification idempotent.
     */
    playPurchaseToken: string | null;
    cancelledAt: Date | null;
    /**
     * Mirrors "status is non-terminal", purely so the one-live-subscription-per-user
     * unique index can use a plain equality partial filter. Kept in step with `status`
     * by SubscriptionService on every transition.
     */
    isCurrent: boolean;
    /**
     * Why this row exists. A REFERRAL row was never paid for, so renewal reminders
     * must skip it — there is nothing to renew and no mandate behind it.
     */
    grantSource: ESubscriptionGrantSource;
    /** Set only on a REFERRAL row: which program granted it. */
    referral_program_id: Schema.Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Append-only ledger. Deliberately not a `creditsRemaining` counter: consultations
 * get cancelled and marked UNHANDLED, and those credits have to come back auditably.
 * Balance is the latest row's `balanceAfter`, guarded on write.
 */
export interface IConsultationCredit {
    _id: Schema.Types.ObjectId;
    user_id: Schema.Types.ObjectId;
    subscription_id: Schema.Types.ObjectId;
    type: ECreditType;
    /**
     * Position in this (user, type) bucket's ledger, starting at 1.
     *
     * This is the concurrency guard. A unique index on (user_id, type, seq) means two
     * concurrent consumes that both read balance=1 compute the same next seq, and
     * exactly one insert survives — the loser retries and sees the real balance. Without
     * it, read-then-write lets two bookings spend the same credit.
     */
    seq: number;
    /** +n on GRANT/REFUND, -n on CONSUME/EXPIRE. */
    delta: number;
    balanceAfter: number;
    reason: ECreditReason;
    consultation_id: Schema.Types.ObjectId | null;
    expiresAt: Date;
    createdAt?: Date;
}

/** A single quota window. Self-cleaning via a TTL index on `expiresAt`. */
export interface IUsageCounter {
    _id: Schema.Types.ObjectId;
    user_id: Schema.Types.ObjectId;
    key: EUsageCounterKey;
    /** '2026-07-22' for an IST day window, or 'sub:<subscriptionId>' for a period window. */
    windowKey: string;
    count: number;
    expiresAt: Date;
}

/**
 * AUTOPAY only. Razorpay retries webhook delivery; without an idempotency record a
 * redelivered `subscription.charged` would grant a second set of credits.
 */
export interface IWebhookEvent {
    _id: Schema.Types.ObjectId;
    providerEventId: string;
    provider: EBillingProvider;
    type: string;
    payload: Record<string, unknown>;
    processedAt: Date | null;
    error: string | null;
    createdAt?: Date;
}

/**
 * Denormalized onto `user` so the auth/hot path never joins. `SubscriptionService`
 * is the only writer.
 */
export interface IUserSubscriptionSnapshot {
    tier: ESubscriptionTier;
    status: ESubscriptionStatus | null;
    planCode: EPlanCode | null;
    subscription_id: Schema.Types.ObjectId | null;
    billingMode: EBillingMode | null;
    trialEndAt: Date | null;
    currentPeriodEnd: Date | null;
    /** A trial is once per user, forever — this is never reset. */
    hasUsedTrial: boolean;
}
