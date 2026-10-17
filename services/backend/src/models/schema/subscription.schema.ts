import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import {
    EBillingMode,
    EBillingProvider,
    EPlanCode,
    ESubscriptionGrantSource,
    ESubscriptionStatus,
    ESubscriptionTier,
    ISubscription,
} from "../../types/subscription.types";

/**
 * One row per subscription lifecycle. Rows are never mutated into a new lifecycle —
 * an expired subscription stays expired and a new row is created — so the collection
 * doubles as billing history.
 *
 * The AUTOPAY-only fields (providerSubscriptionId, mandateStatus) exist from day one
 * as nullables so flipping env.BILLING_MODE later needs no migration.
 */
const subscriptionSchema = new Schema<ISubscription>(
    {
        // No `index: true` here — the partial-unique and { user_id, status } indexes
        // below both lead on user_id, and declaring it twice makes mongoose warn about
        // a duplicate index.
        user_id: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        // Null while trialing: a trial is not tied to a plan until the user pays.
        planCode: {
            type: String,
            enum: [...Object.values(EPlanCode), null],
            default: null,
        },
        tier: {
            type: String,
            enum: [ESubscriptionTier.TRIAL, ESubscriptionTier.PREMIUM],
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(ESubscriptionStatus),
            required: true,
        },
        // Stamped at creation from env.BILLING_MODE and never rewritten. Every lifecycle
        // decision reads THIS, never the env — otherwise flipping the toggle to AUTOPAY
        // would try to auto-charge trials that were started with no mandate on file.
        billingMode: {
            type: String,
            enum: Object.values(EBillingMode),
            required: true,
        },
        provider: {
            type: String,
            enum: Object.values(EBillingProvider),
            required: true,
        },
        trialStartAt: { type: Date, default: null },
        trialEndAt: { type: Date, default: null },
        currentPeriodStart: { type: Date, default: null },
        currentPeriodEnd: { type: Date, default: null },
        providerOrderId: { type: String, default: null },
        providerSubscriptionId: { type: String, default: null },
        mandateStatus: { type: String, default: null },
        // PLAY only. The join key for Real-Time Developer Notifications, which carry a
        // purchase token and no user id. Indexed below.
        playPurchaseToken: { type: String, default: null },
        cancelledAt: { type: Date, default: null },
        // Mirrors "status is non-terminal". Exists only so the unique index below can
        // use a plain equality filter: $in inside partialFilterExpression needs Mongo
        // 6.0+, and this must not depend on the deployed server version.
        // SubscriptionService keeps it in step with `status` on every transition.
        isCurrent: { type: Boolean, default: true },
        // Defaults to PURCHASE so every pre-existing row reads correctly without a
        // backfill — the only rows that are not purchases are the ones written after
        // this field shipped, and those set it explicitly.
        grantSource: {
            type: String,
            enum: Object.values(ESubscriptionGrantSource),
            default: ESubscriptionGrantSource.PURCHASE,
        },
        referral_program_id: {
            type: Schema.Types.ObjectId,
            ref: "referral_programs",
            default: null,
        },
    },
    generalSchemaOptions,
);

// A user may have at most one live subscription. Enforced by the database rather than
// a read-then-write check in the service, which races under a double-tapped subscribe.
subscriptionSchema.index(
    { user_id: 1 },
    { unique: true, partialFilterExpression: { isCurrent: true } },
);
subscriptionSchema.index({ user_id: 1, status: 1 });
// Drives the daily lifecycle sweep.
subscriptionSchema.index({ status: 1, trialEndAt: 1 });
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ providerSubscriptionId: 1 }, { sparse: true });
// The RTDN lookup path, and the guard against one purchase token ever resolving to two
// subscriptions — exactly what a replayed verify call would otherwise create.
//
// Partial, not sparse. `sparse` skips documents where the field is ABSENT, but the schema
// default writes an explicit `null`, so every Razorpay row carries the key and they all
// collide on it. Filtering to string-valued tokens indexes only the rows that have one.
subscriptionSchema.index(
    { playPurchaseToken: 1 },
    { unique: true, partialFilterExpression: { playPurchaseToken: { $type: "string" } } },
);

export default subscriptionSchema;
