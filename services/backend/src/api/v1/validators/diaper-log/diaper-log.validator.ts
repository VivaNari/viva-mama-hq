import Joi from "joi";

import { DIAPER_KINDS } from "../../../../types/diaper-log.types";

/**
 * Diaper log request validation.
 *
 * `loggedAt` is a full instant rather than a date: the time of day is the whole point of
 * this log, and an entry queued offline at 03:10 and flushed at 07:00 has to keep the time
 * it happened. The IST calendar day it files under is derived from it server-side.
 */

const objectId = Joi.string().hex().length(24);

const isoDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "loggedOn must be in YYYY-MM-DD format" });

export const diaperLogCreateValidator = Joi.object({
    childId: objectId.required(),
    kind: Joi.string()
        .valid(...DIAPER_KINDS)
        .required(),
    // Joi's ISO mode, so "2026-09-13T03:10:00.000Z" is accepted and a bare "today" is not.
    loggedAt: Joi.date().iso().required(),
});

export const diaperLogDeleteValidator = Joi.object({
    childId: objectId.required(),
    loggedOn: isoDate.required(),
    entryId: objectId.required(),
});

// No validator for the history read: `requestValidator` inspects `req.body` only, so a
// schema for query parameters would never run. The controller parses the query itself,
// exactly as the mood-log and growth-log GETs do.
