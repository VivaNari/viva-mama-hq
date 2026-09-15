import Joi from "joi";

import {
    FEEDING_ENTRY_KINDS,
    FEED_SIDES,
    FEED_SOURCES,
    FOOD_REACTIONS,
} from "../../../../types/feeding-log.types";
import { FeedingMethodEnum } from "../../../../types/user.types";

/**
 * Feeding log request validation.
 *
 * The three entry kinds share one endpoint and one validator, discriminated on `kind`, so
 * the route table stays the trio every other log has. What that buys has to be paid for
 * here: `feed` is itself discriminated a second time on `source`, because minutes on the
 * breast and millilitres in a bottle are different fields and neither is optional on the
 * side it belongs to.
 *
 * `feedAt` is a full instant rather than a date. The time of day is the whole point of a
 * feeding schedule, and an entry recorded at 07:00 for the 03:10 feed has to keep 03:10.
 * The IST calendar day it files under is derived from it server-side.
 */

const objectId = Joi.string().hex().length(24);

const isoDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "date must be in YYYY-MM-DD format" });

/**
 * A milk feed.
 *
 * `side` and `minutes` belong to the breast and `ml` to the bottle, and each is forbidden
 * on the other. Forbidding rather than ignoring: a client sending `{source: 'bottle',
 * minutes: 20}` has a bug, and quietly dropping the field would store a bottle feed with no
 * volume and tell nobody.
 */
const feedPayload = {
    source: Joi.string()
        .valid(...FEED_SOURCES)
        .required(),
    side: Joi.when("source", {
        is: "breast",
        then: Joi.string()
            .valid(...FEED_SIDES)
            .required(),
        otherwise: Joi.forbidden(),
    }),
    minutes: Joi.when("source", {
        is: "breast",
        then: Joi.number().integer().min(1).max(180).required(),
        otherwise: Joi.forbidden(),
    }),
    ml: Joi.when("source", {
        is: "bottle",
        then: Joi.number().integer().min(1).max(500).required(),
        otherwise: Joi.forbidden(),
    }),
    // Joi's ISO mode, so "2026-09-15T03:10:00.000Z" is accepted and a bare "today" is not.
    feedAt: Joi.date().iso().required(),
};

const solidPayload = {
    food: Joi.string().trim().min(1).max(80).required(),
    // Optional and multi-select: "liked it" and "loose stool" are not mutually exclusive,
    // and a mother who has not judged the reaction yet should not be forced to.
    reactions: Joi.array()
        .items(Joi.string().valid(...FOOD_REACTIONS))
        .unique()
        .max(FOOD_REACTIONS.length)
        .default([]),
    feedAt: Joi.date().iso().required(),
};

const waterPayload = {
    ml: Joi.number().integer().min(1).max(500).required(),
    drankAt: Joi.date().iso().required(),
};

export const feedingLogCreateValidator = Joi.object({
    childId: objectId.required(),
    kind: Joi.string()
        .valid(...FEEDING_ENTRY_KINDS)
        .required(),
})
    .when(Joi.object({ kind: Joi.valid("feed") }).unknown(), { then: Joi.object(feedPayload) })
    .when(Joi.object({ kind: Joi.valid("solid") }).unknown(), { then: Joi.object(solidPayload) })
    .when(Joi.object({ kind: Joi.valid("water") }).unknown(), { then: Joi.object(waterPayload) });

export const feedingLogDeleteValidator = Joi.object({
    childId: objectId.required(),
    loggedOn: isoDate.required(),
    kind: Joi.string()
        .valid(...FEEDING_ENTRY_KINDS)
        .required(),
    entryId: objectId.required(),
});

/**
 * The per-child settings write.
 *
 * `solidsStartedOn` accepts an explicit null — that is how a mother says solids have not
 * started after all — so it cannot be `optional()` alone, which would make "not sent" and
 * "cleared" the same request.
 *
 * At least one of the two must be present: an empty patch is a client bug, and answering it
 * with 200 would hide it.
 */
export const feedingLogSettingsValidator = Joi.object({
    childId: objectId.required(),
    feedingMethod: Joi.string().valid(...Object.values(FeedingMethodEnum)),
    solidsStartedOn: isoDate.allow(null),
}).or("feedingMethod", "solidsStartedOn");

// No validator for the history read: `requestValidator` inspects `req.body` only, so a
// schema for query parameters would never run. The controller parses the query itself,
// exactly as the mood-log, growth-log and diaper-log GETs do.
