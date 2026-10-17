import Joi from "joi";

import { VACCINE_KEYS } from "../../../../constants/vaccine-keys";

/**
 * Vaccination log request validation.
 *
 * `vaccineKey` is checked against the generated schedule rather than accepted as free text.
 * It is half the primary key of this collection, so an unrecognised value would store a row
 * no screen can render and nobody would ever see to report.
 */

const objectId = Joi.string().hex().length(24);

const isoDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "givenOn must be in YYYY-MM-DD format" });

const vaccineKey = Joi.string()
    .valid(...VACCINE_KEYS)
    .required()
    .messages({ "any.only": "Unknown vaccine dose" });

export const vaccinationLogRecordValidator = Joi.object({
    childId: objectId.required(),
    vaccineKey,
    // Optional: the app sends nothing for "given today", which is the common case at a
    // clinic. A parent entering the card afterwards sends the date the clinic wrote on it.
    givenOn: isoDate,
});

export const vaccinationLogRemoveValidator = Joi.object({
    childId: objectId.required(),
    vaccineKey,
});

// No validator for the read: `requestValidator` inspects `req.body` only, so a schema for
// query parameters would never run. The controller parses the query itself.
