import Joi from "joi";

import { MILESTONE_KEYS } from "../../../../constants/milestone-keys";

/**
 * Milestone log request validation.
 *
 * `milestoneKey` is checked against the generated catalogue rather than accepted as free
 * text. It is half the primary key of this collection, so an unrecognised value would store
 * a row no screen can render and nobody would ever see to report.
 */

const objectId = Joi.string().hex().length(24);

const isoDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "achievedOn must be in YYYY-MM-DD format" });

const milestoneKey = Joi.string()
    .valid(...MILESTONE_KEYS)
    .required()
    .messages({ "any.only": "Unknown milestone" });

export const milestoneLogAchieveValidator = Joi.object({
    childId: objectId.required(),
    milestoneKey,
    // Optional: the app sends nothing for "she did this today", the common case.
    achievedOn: isoDate,
});

export const milestoneLogForgetValidator = Joi.object({
    childId: objectId.required(),
    milestoneKey,
});

// No validator for the read: `requestValidator` inspects `req.body` only, so a schema for
// query parameters would never run. The controller parses the query itself.
