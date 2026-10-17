import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EUsageCounterKey, IUsageCounter } from "../../types/subscription.types";

/**
 * One row per (user, quota key, window). Incremented with a single atomic
 * findOneAndUpdate($inc, upsert) so a double-tapped send cannot yield a 4th free
 * AI message — a read-then-write would race.
 *
 * Mongo rather than Redis because it is durable and matches the existing patterns
 * here; ioredis is already wired (config/redis.config.ts) if this ever gets hot.
 */
const usageCounterSchema = new Schema<IUsageCounter>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        key: {
            type: String,
            enum: Object.values(EUsageCounterKey),
            required: true,
        },
        // '2026-07-22' for an IST day window, or 'sub:<subscriptionId>' for a window
        // that spans a whole subscription period (the trial's single check-in).
        windowKey: { type: String, required: true },
        count: { type: Number, default: 0 },
        expiresAt: { type: Date, required: true },
    },
    generalSchemaOptions,
);

// The upsert target — must be unique or a race creates two counters for one window
// and the user gets double their quota.
usageCounterSchema.index({ user_id: 1, key: 1, windowKey: 1 }, { unique: true });
// TTL: expired windows delete themselves, so this collection stays bounded without
// a cleanup job.
usageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default usageCounterSchema;
