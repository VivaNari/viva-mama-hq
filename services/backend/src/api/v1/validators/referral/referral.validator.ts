import Joi from "joi";

/**
 * Kept permissive on shape. The live code set is a mix of generated codes
 * (`${initials}${counter}2026`, e.g. AR12026) and hand-set ones agreed with a partner
 * (DRSUJANA12026), so a tight pattern would reject real codes. Length and charset are
 * bounded; matching a real program is the server's job, not Joi's.
 */
export const redeemReferralValidator = Joi.object({
    referralCode: Joi.string().trim().uppercase().min(3).max(24).required(),
}).unknown(false);
