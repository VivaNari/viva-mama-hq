import analyticsEventModel from "../../models/analytics-event.model";
import { EAnalyticsEvent, IAnalyticsEvent, IFunnelSummary } from "../../types/analytics.types";
import { EPlanCode, ESubscriptionTier, TObjectIdLike } from "../../types/subscription.types";
import logger, { createModuleLogger } from "../../utils/logger";

const log = createModuleLogger(logger, "analytics.service");

export interface ITrackParams {
    userId: TObjectIdLike;
    event: EAnalyticsEvent;
    tier?: ESubscriptionTier | null;
    capability?: string | null;
    planCode?: EPlanCode | null;
    metadata?: Record<string, unknown>;
}

function rate(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}

export class AnalyticsService {
    /**
     * Record an event. Never throws, never blocks.
     *
     * Deliberately not awaited by callers: a paywall must not fail to appear, and a
     * subscription must not fail to activate, because the analytics write timed out.
     * Failures are logged and dropped — losing a funnel row is an acceptable cost,
     * breaking the feature it measures is not.
     */
    public track(params: ITrackParams): void {
        analyticsEventModel
            .create({
                user_id: params.userId,
                event: params.event,
                tier: params.tier ?? null,
                capability: params.capability ?? null,
                planCode: params.planCode ?? null,
                metadata: params.metadata ?? {},
            })
            .catch((error) => {
                log.warn({ error, event: params.event }, "Analytics write failed");
            });
    }

    /**
     * Awaitable variant, for the client-reporting endpoint where the caller genuinely
     * wants to know the event landed.
     */
    public async trackAndWait(params: ITrackParams): Promise<IAnalyticsEvent> {
        return (await analyticsEventModel.create({
            user_id: params.userId,
            event: params.event,
            tier: params.tier ?? null,
            capability: params.capability ?? null,
            planCode: params.planCode ?? null,
            metadata: params.metadata ?? {},
        })) as unknown as IAnalyticsEvent;
    }

    /**
     * The funnel over a window.
     *
     * Trial conversion is computed over events in the window rather than by cohort:
     * a trial started on day 1 converts on day 8, so a 7-day window would report a
     * misleadingly low rate. Use a window comfortably longer than the trial when
     * reading this number.
     */
    public async getFunnel(from: Date, to: Date): Promise<IFunnelSummary> {
        const range = { createdAt: { $gte: from, $lte: to } };

        const [counts, denials] = await Promise.all([
            analyticsEventModel.aggregate<{ _id: EAnalyticsEvent; count: number }>([
                { $match: range },
                { $group: { _id: "$event", count: { $sum: 1 } } },
            ]),
            analyticsEventModel.aggregate<{ _id: string; count: number }>([
                {
                    $match: {
                        ...range,
                        event: EAnalyticsEvent.CAPABILITY_DENIED,
                        capability: { $ne: null },
                    },
                },
                { $group: { _id: "$capability", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);

        const by = (event: EAnalyticsEvent) => counts.find((c) => c._id === event)?.count ?? 0;

        const trialsStarted = by(EAnalyticsEvent.TRIAL_STARTED);
        const checkoutsCreated = by(EAnalyticsEvent.CHECKOUT_CREATED);
        const subscriptionsActivated = by(EAnalyticsEvent.SUBSCRIPTION_ACTIVATED);

        return {
            from,
            to,
            trialsStarted,
            trialsExpired: by(EAnalyticsEvent.TRIAL_EXPIRED),
            freeSelected: by(EAnalyticsEvent.FREE_SELECTED),
            checkoutsCreated,
            subscriptionsActivated,
            trialConversionRate: rate(subscriptionsActivated, trialsStarted),
            checkoutCompletionRate: rate(subscriptionsActivated, checkoutsCreated),
            denialsByCapability: denials.map((d) => ({
                capability: d._id,
                count: d.count,
            })),
            paywallImpressions: by(EAnalyticsEvent.PAYWALL_SHOWN),
        };
    }
}

export const analyticsService = new AnalyticsService();
