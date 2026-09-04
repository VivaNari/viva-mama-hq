import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { ECreditReason, ECreditType, IConsultationCredit } from "../../types/subscription.types";

/**
 * Append-only ledger of consultation credits.
 *
 * Deliberately NOT a `creditsRemaining` counter on the user: consultations get
 * cancelled and marked UNHANDLED, and those credits have to come back auditably.
 * Current balance is the most recent row's `balanceAfter` for a (user, type) pair.
 *
 * Rows are never updated or deleted. An expiry is a new row with a negative delta,
 * not a mutation.
 */
const consultationCreditSchema = new Schema<IConsultationCredit>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
            index: true,
        },
        subscription_id: {
            type: Schema.Types.ObjectId,
            ref: "subscriptions",
            required: true,
        },
        // Two independent buckets. Running out of EXPERT must not let the user spend
        // CARE_MANAGER credits on an expert — different fulfilment paths entirely.
        type: {
            type: String,
            enum: Object.values(ECreditType),
            required: true,
        },
        // See IConsultationCredit.seq — the optimistic-concurrency guard.
        seq: { type: Number, required: true, min: 1 },
        // Positive on GRANT/REFUND, negative on CONSUME/EXPIRE.
        delta: { type: Number, required: true },
        balanceAfter: { type: Number, required: true, min: 0 },
        reason: {
            type: String,
            enum: Object.values(ECreditReason),
            required: true,
        },
        consultation_id: {
            type: Schema.Types.ObjectId,
            ref: "consultations",
            default: null,
        },
        expiresAt: { type: Date, required: true },
    },
    generalSchemaOptions,
);

// THE concurrency guard. Two consumes racing on a 1-credit balance both compute the
// same next seq; the unique index lets exactly one insert win and forces the other to
// retry against the real balance. Without this, both would succeed and the user would
// spend a credit they did not have.
consultationCreditSchema.index({ user_id: 1, type: 1, seq: 1 }, { unique: true });
// Reading a balance is "highest seq for this (user, type)" — one indexed lookup rather
// than a scan over the user's whole credit history.
consultationCreditSchema.index({ user_id: 1, type: 1, seq: -1 });
// Drives the credit-expiry sweep in the daily lifecycle job.
consultationCreditSchema.index({ expiresAt: 1 });
// One CONSUME row per consultation, so a double-tapped "Book" cannot burn two credits
// even if the balance check somehow passes twice.
consultationCreditSchema.index(
    { consultation_id: 1, reason: 1 },
    { unique: true, partialFilterExpression: { reason: ECreditReason.CONSUME } },
);

export default consultationCreditSchema;
