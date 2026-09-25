import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EReferralOwnerType, IReferralProgram } from "../../types/referral.types";
import { EPlanCode } from "../../types/subscription.types";
import { EAccess, ECapability } from "../../services/entitlements/entitlement.config";

// LOCKED is the only meaningful value; see ICapabilityOverride for why a numeric
// limit is deliberately not offered here.
const capabilityOverrideSchema = new Schema(
    {
        capability: { type: String, enum: Object.values(ECapability), required: true },
        access: { type: String, enum: Object.values(EAccess), required: true },
    },
    { _id: false },
);

/**
 * A referral code and the benefits it carries.
 *
 * The code is the entity. `expert.referralCode` stays as a read-only mirror so every
 * existing expert-facing read keeps working, but uniqueness and configuration live
 * here — an organization has no expert document to hang them off, and one owner may
 * run two campaigns.
 */
const referralProgramSchema = new Schema<IReferralProgram>(
    {
        // Uppercased on write so redemption can match on a single canonical form; the
        // app uppercases too, but a code pasted from an email must not miss.
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        ownerType: {
            type: String,
            enum: Object.values(EReferralOwnerType),
            required: true,
        },
        // Exactly one of these is set; which one is decided by ownerType and enforced
        // by the validator, not the schema — mongoose has no clean way to express it.
        owner_expert_id: { type: Schema.Types.ObjectId, ref: "experts", default: null },
        owner_organization_id: {
            type: Schema.Types.ObjectId,
            ref: "organizations",
            default: null,
        },
        displayName: { type: String, default: null, trim: true },
        isActive: { type: Boolean, default: true },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        benefits: {
            grant: {
                // Null means the code grants no subscription — it only pins the expert
                // and/or applies overrides. That is a legitimate configuration, not an
                // incomplete one.
                planCode: {
                    type: String,
                    enum: [...Object.values(EPlanCode), null],
                    default: null,
                },
            },
            seats: {
                // Null is unlimited. A number is a hard pool, decremented by exactly one
                // conditional $inc per grant — see ReferralService.claimSeat.
                total: { type: Number, default: null, min: 1 },
                claimed: { type: Number, default: 0, min: 0 },
            },
            entitlementOverrides: { type: [capabilityOverrideSchema], default: [] },
        },
    },
    generalSchemaOptions,
);

referralProgramSchema.index({ owner_expert_id: 1 }, { sparse: true });
referralProgramSchema.index({ owner_organization_id: 1 }, { sparse: true });
// Drives the admin list's default filter.
referralProgramSchema.index({ isActive: 1, endsAt: 1 });

export default referralProgramSchema;
