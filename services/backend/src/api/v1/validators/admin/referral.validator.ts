import Joi from "joi";
import { EReferralOwnerType } from "../../../../types/referral.types";
import { EPlanCode } from "../../../../types/subscription.types";
import { EAccess, ECapability } from "../../../../services/entitlements/entitlement.config";

export const createOrganizationValidator = Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    // Derived from the name when omitted.
    slug: Joi.string().trim().lowercase().max(80).optional(),
    contactEmail: Joi.string().email().allow(null, "").optional(),
    contactPhone: Joi.string().trim().max(20).allow(null, "").optional(),
    notes: Joi.string().max(2000).allow(null, "").optional(),
    isActive: Joi.boolean().optional(),
}).unknown(false);

export const updateOrganizationValidator = Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    contactEmail: Joi.string().email().allow(null, "").optional(),
    contactPhone: Joi.string().trim().max(20).allow(null, "").optional(),
    notes: Joi.string().max(2000).allow(null, "").optional(),
    isActive: Joi.boolean().optional(),
    // Slug is the stable handle quoted in contracts; renaming it silently orphans every
    // reference ops holds outside this system.
    slug: Joi.forbidden(),
})
    .min(1)
    .unknown(false);

// LOCKED only. An ALLOWED override is a no-op by design (an override may never widen
// access), so accepting one here would let an admin configure something that silently
// does nothing.
const entitlementOverrideSchema = Joi.object({
    capability: Joi.string()
        .valid(...Object.values(ECapability))
        .required(),
    access: Joi.string().valid(EAccess.LOCKED).required(),
});

const objectId = Joi.string().hex().length(24);

export const createReferralProgramValidator = Joi.object({
    // Permissive on shape: live codes are a mix of generated (`AR12026`) and hand-set
    // (`DRSUJANA12026`) forms, so a tighter pattern would reject codes already printed
    // on partner material.
    code: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9]{3,24}$/)
        .required(),
    ownerType: Joi.string()
        .valid(...Object.values(EReferralOwnerType))
        .required(),
    // Exactly one owner, decided by ownerType. Expressed here because mongoose has no
    // clean way to say it.
    expertId: objectId.when("ownerType", {
        is: EReferralOwnerType.EXPERT,
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    organizationId: objectId.when("ownerType", {
        is: EReferralOwnerType.ORGANIZATION,
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
    displayName: Joi.string().trim().max(120).allow(null, "").optional(),
    isActive: Joi.boolean().optional(),
    startsAt: Joi.date().allow(null).optional(),
    endsAt: Joi.date().allow(null).optional(),
    grant: Joi.object({
        // Null is legitimate: a pin-only or suppress-only code grants nothing.
        planCode: Joi.string()
            .valid(...Object.values(EPlanCode))
            .allow(null)
            .optional(),
    }).optional(),
    seats: Joi.object({
        total: Joi.number().integer().min(1).allow(null).optional(),
    }).optional(),
    entitlementOverrides: Joi.array().items(entitlementOverrideSchema).optional(),
}).unknown(false);

export const updateReferralProgramValidator = Joi.object({
    displayName: Joi.string().trim().max(120).allow(null, "").optional(),
    isActive: Joi.boolean().optional(),
    startsAt: Joi.date().allow(null).optional(),
    endsAt: Joi.date().allow(null).optional(),
    "benefits.grant.planCode": Joi.string()
        .valid(...Object.values(EPlanCode))
        .allow(null)
        .optional(),
    "benefits.entitlementOverrides": Joi.array().items(entitlementOverrideSchema).optional(),
    // The code is denormalized onto every redemption row; changing it would orphan them.
    code: Joi.forbidden(),
    ownerType: Joi.forbidden(),
    // Seats change only through POST /:id/seats, which is additive. An absolute write
    // from two admins at once loses one of them.
    "benefits.seats.total": Joi.forbidden(),
    "benefits.seats.claimed": Joi.forbidden(),
    benefits: Joi.forbidden(),
})
    .min(1)
    .unknown(false);

export const addSeatsValidator = Joi.object({
    addSeats: Joi.number().integer().min(1).max(100000).required(),
}).unknown(false);
