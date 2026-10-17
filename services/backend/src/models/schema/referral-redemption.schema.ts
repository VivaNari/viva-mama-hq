import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import {
    EReferralOwnerType,
    EReferralRedemptionStatus,
    IReferralRedemption,
} from "../../types/referral.types";
import { EPlanCode } from "../../types/subscription.types";
import { EAccess, ECapability } from "../../services/entitlements/entitlement.config";

const appliedOverrideSchema = new Schema(
    {
        capability: { type: String, enum: Object.values(ECapability), required: true },
        access: { type: String, enum: Object.values(EAccess), required: true },
    },
    { _id: false },
);

/**
 * The redemption ledger: who redeemed what, when, and what they got.
 *
 * It is not bookkeeping alone. The unique index on `user_id` is the concurrency control
 * for the whole flow — two simultaneous submits both pass the read check, and the
 * second insert's E11000 is what tells us it was a double-tap rather than a second
 * legitimate redemption. Without it the seat pool leaks and a user can be granted twice.
 */
const referralRedemptionSchema = new Schema<IReferralRedemption>(
    {
        // No `index: true` — the unique index below already leads on user_id, and
        // declaring it twice makes mongoose warn about a duplicate.
        user_id: { type: Schema.Types.ObjectId, ref: "users", required: true },
        // Null for a backfilled row whose historic code matches no program. Those are
        // real redemptions that happened; we record them rather than invent programs.
        program_id: {
            type: Schema.Types.ObjectId,
            ref: "referral_programs",
            default: null,
        },
        // Denormalized so a row stays readable after its program is edited or renamed.
        code: { type: String, required: true, uppercase: true, trim: true },
        ownerType: {
            type: String,
            enum: [...Object.values(EReferralOwnerType), null],
            default: null,
        },
        owner_expert_id: { type: Schema.Types.ObjectId, ref: "experts", default: null },
        owner_organization_id: {
            type: Schema.Types.ObjectId,
            ref: "organizations",
            default: null,
        },
        // True only when a finite pool was actually decremented, so a revoke knows
        // whether there is a seat to give back.
        seatClaimed: { type: Boolean, default: false },
        grantedPlanCode: {
            type: String,
            enum: [...Object.values(EPlanCode), null],
            default: null,
        },
        granted_subscription_id: {
            type: Schema.Types.ObjectId,
            ref: "subscriptions",
            default: null,
        },
        status: {
            type: String,
            enum: Object.values(EReferralRedemptionStatus),
            default: EReferralRedemptionStatus.PENDING,
        },
        failureReason: { type: String, default: null },
        // Snapshotted, not joined: editing a program later must never silently rewrite
        // what a past redemption granted.
        appliedOverrides: { type: [appliedOverrideSchema], default: [] },
        redeemedAt: { type: Date, default: () => new Date() },
    },
    generalSchemaOptions,
);

// One redemption per user, ever. This index IS the double-submit guard.
referralRedemptionSchema.index({ user_id: 1 }, { unique: true });
// Seat-usage and redemption reporting.
referralRedemptionSchema.index({ program_id: 1, createdAt: -1 });
referralRedemptionSchema.index({ code: 1 });

export default referralRedemptionSchema;
