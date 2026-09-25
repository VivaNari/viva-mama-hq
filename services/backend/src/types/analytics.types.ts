import { Schema } from "mongoose";
import { ESubscriptionTier, EPlanCode } from "./subscription.types";

/**
 * The subscription funnel, as events.
 *
 * The free tier cannot be tuned without this: "3 AI messages a day" is only the right
 * number if you can see how many users hit the wall and how many of them convert.
 *
 * Server-originated events are recorded where they happen, so they cannot be lost to a
 * client that crashed or a user who force-quit. Only the two impression events come
 * from the app, because a paywall being *seen* has no server-side trace.
 */
export enum EAnalyticsEvent {
    /** Client: the paywall sheet became visible. */
    PAYWALL_SHOWN = "paywall.shown",
    /** Client: the primary CTA on the paywall was tapped. */
    PAYWALL_CTA_TAPPED = "paywall.cta_tapped",

    /** Server: a gate refused a request. The denominator for every conversion rate. */
    CAPABILITY_DENIED = "capability.denied",

    TRIAL_STARTED = "trial.started",
    TRIAL_EXPIRED = "trial.expired",
    FREE_SELECTED = "free.selected",
    CHECKOUT_CREATED = "checkout.created",
    SUBSCRIPTION_ACTIVATED = "subscription.activated",
    SUBSCRIPTION_CANCELLED = "subscription.cancelled",
    SUBSCRIPTION_EXPIRED = "subscription.expired",
    CREDIT_CONSUMED = "credit.consumed",
}

/** Events the app is allowed to report. Anything else is rejected. */
export const CLIENT_REPORTABLE_EVENTS: EAnalyticsEvent[] = [
    EAnalyticsEvent.PAYWALL_SHOWN,
    EAnalyticsEvent.PAYWALL_CTA_TAPPED,
];

export interface IAnalyticsEvent {
    _id: Schema.Types.ObjectId;
    user_id: Schema.Types.ObjectId;
    event: EAnalyticsEvent;
    /** The tier the user was on when it happened — the whole point of the analysis. */
    tier: ESubscriptionTier | null;
    /** Which gate fired, for denial events. */
    capability: string | null;
    planCode: EPlanCode | null;
    /** Free-form extras (denial code, amount, days-into-trial). Never PII. */
    metadata: Record<string, unknown>;
    createdAt?: Date;
}

/** Shape returned by the funnel aggregate. */
export interface IFunnelSummary {
    from: Date;
    to: Date;
    trialsStarted: number;
    trialsExpired: number;
    freeSelected: number;
    checkoutsCreated: number;
    subscriptionsActivated: number;
    /** Activations ÷ trials started, as a percentage. The number that matters. */
    trialConversionRate: number;
    /** Activations ÷ checkouts created — how much is lost in the payment sheet. */
    checkoutCompletionRate: number;
    denialsByCapability: Array<{ capability: string; count: number }>;
    paywallImpressions: number;
}
