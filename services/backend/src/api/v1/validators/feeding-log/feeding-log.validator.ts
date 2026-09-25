import Joi from "joi";

import {
    DELIVERY_METHODS,
    FEEDING_ENTRY_KINDS,
    FEED_SIDES,
    FOOD_REACTIONS,
    MILK_SOURCES,
    SOLID_QUANTITY_UNITS,
    SOLID_TEXTURES,
} from "../../../../types/feeding-log.types";
import { FeedingMethodEnum } from "../../../../types/user.types";

/**
 * Feeding log request validation.
 *
 * The three entry kinds share one endpoint and one validator, discriminated on `kind`, so
 * the route table stays the trio every other log has. What that buys has to be paid for
 * here: `feed` is itself discriminated a second time on `deliveryMethod`, because minutes
 * at the breast and millilitres in a vessel are different fields and neither is optional
 * on the side it belongs to.
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
 * `side` and `minutes` belong to the breast and `ml` to every vessel, and each is forbidden
 * on the other. Forbidding rather than ignoring: a client sending `{deliveryMethod:
 * 'bottle', minutes: 20}` has a bug, and quietly dropping the field would store a bottle
 * feed with no volume and tell nobody.
 *
 * `deliveryMethod` is optional because a mixed feed has none — the screen asks a mother
 * feeding both only what was given and how much. An absent one therefore still requires
 * `ml`, which is what the `is: "direct"` test rather than a presence test gives us.
 */
const feedPayload = {
    milkSource: Joi.string()
        .valid(...MILK_SOURCES)
        .required(),
    deliveryMethod: Joi.string().valid(...DELIVERY_METHODS),
    side: Joi.when("deliveryMethod", {
        is: "direct",
        then: Joi.string()
            .valid(...FEED_SIDES)
            .required(),
        otherwise: Joi.forbidden(),
    }),
    minutes: Joi.when("deliveryMethod", {
        is: "direct",
        then: Joi.number().integer().min(1).max(180).required(),
        otherwise: Joi.forbidden(),
    }),
    ml: Joi.when("deliveryMethod", {
        is: "direct",
        then: Joi.forbidden(),
        otherwise: Joi.number().integer().min(1).max(500).required(),
    }),
    // Joi's ISO mode, so "2026-09-15T03:10:00.000Z" is accepted and a bare "today" is not.
    feedAt: Joi.date().iso().required(),
};

/**
 * A solid food.
 *
 * Everything but the food's name is optional. A mother logging a first taste one-handed
 * should not be held at the form by a portion she never measured, and the name is the part
 * a rash is later attributed to. `quantityUnit` is required alongside a `quantity`, though:
 * a bare "2" is not a portion anyone can read back.
 */
const solidPayload = {
    food: Joi.string().trim().min(1).max(80).required(),
    // Optional and multi-select: "liked it" and "loose stool" are not mutually exclusive,
    // and a mother who has not judged the reaction yet should not be forced to.
    reactions: Joi.array()
        .items(Joi.string().valid(...FOOD_REACTIONS))
        .unique()
        .max(FOOD_REACTIONS.length)
        .default([]),
    quantity: Joi.number().integer().min(1).max(20),
    quantityUnit: Joi.string()
        .valid(...SOLID_QUANTITY_UNITS)
        .when("quantity", { is: Joi.exist(), then: Joi.required() }),
    texture: Joi.string().valid(...SOLID_TEXTURES),
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
