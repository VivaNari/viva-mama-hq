import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EAnalyticsEvent, IAnalyticsEvent } from "../../types/analytics.types";
import { EPlanCode, ESubscriptionTier } from "../../types/subscription.types";

/**
 * Append-only funnel event log. Never read on a request path — only by the funnel
 * aggregate — so it carries no denormalized state and needs no compound uniqueness.
 */
const analyticsEventSchema = new Schema<IAnalyticsEvent>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        event: {
            type: String,
            enum: Object.values(EAnalyticsEvent),
            required: true,
        },
        tier: {
            type: String,
            enum: [...Object.values(ESubscriptionTier), null],
            default: null,
        },
        capability: { type: String, default: null },
        planCode: {
            type: String,
            enum: [...Object.values(EPlanCode), null],
            default: null,
        },
        // Deliberately Mixed and deliberately never PII: this collection is for
        // aggregate analysis, and anything identifying beyond user_id would make it a
        // liability rather than a tool.
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    generalSchemaOptions,
);

// Drives the funnel counts.
analyticsEventSchema.index({ event: 1, createdAt: -1 });
// "Which gate is firing most" — the question that tells you what to price.
analyticsEventSchema.index({ event: 1, capability: 1, createdAt: -1 });
// Per-user timelines, e.g. did this trial user ever see a paywall before lapsing.
analyticsEventSchema.index({ user_id: 1, createdAt: -1 });

export default analyticsEventSchema;
