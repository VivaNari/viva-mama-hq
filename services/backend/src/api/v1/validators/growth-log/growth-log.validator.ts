import Joi from "joi";

/**
 * Growth log request validation.
 *
 * The measurement bounds here are typo-catchers, not clinical judgements: they exist to
 * reject a weight typed in grams or a length typed in metres, and are deliberately wide
 * enough that a genuinely small or large child still records. Anything inside them is
 * accepted as entered, and whether it can be scored against WHO is decided downstream by
 * the standards package, which reports OUT_OF_RANGE rather than clamping.
 */

const objectId = Joi.string().hex().length(24);

const isoDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({ "string.pattern.base": "measuredOn must be in YYYY-MM-DD format" });

const MEASUREMENT_KEYS = ["weight_kg", "length_cm", "head_circumference_cm"] as const;

export const growthLogUpsertValidator = Joi.object({
    childId: objectId.required(),
    measuredOn: isoDate.required(),

    // Metric only. The app collects kg and cm; the standards package normalises internally,
    // so imperial input can be added later without touching this contract.
    weight_kg: Joi.number().min(0.5).max(30).allow(null),
    length_cm: Joi.number().min(30).max(130).allow(null),
    head_circumference_cm: Joi.number().min(20).max(65).allow(null),
})
    /**
     * A log with no measurements at all is not a log — it would store a row whose four
     * indicators are all MISSING_INPUT.
     *
     * Deliberately a custom check rather than Joi's `.or()`. `.or()` asks whether a key is
     * *present*, and an explicit `null` counts as present — while the app always sends all
     * three keys, nulling the ones left blank. So `.or()` never fired for the real client,
     * and a field containing unparseable text ("abc" -> null) sailed through as an empty
     * row. This asks whether a number actually arrived.
     */
    .custom((value, helpers) => {
        const hasMeasurement = MEASUREMENT_KEYS.some(
            (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
        );

        return hasMeasurement ? value : helpers.error("any.custom");
    })
    .messages({
        "any.custom":
            "Provide at least one of weight_kg, length_cm or head_circumference_cm",
    });

export const growthLogDeleteValidator = Joi.object({
    childId: objectId.required(),
    measuredOn: isoDate.required(),
});

// No validator for the history read: `requestValidator` checks `req.body` only, so a schema
// for query parameters would never run. The controller parses the query itself, as the
// mood-log GET does.
