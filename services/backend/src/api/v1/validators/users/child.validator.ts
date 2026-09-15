import Joi from "joi";
import { ESex } from "../../../../types";

/**
 * Direct child creation. name and date_of_birth are required here even though the schema
 * leaves them optional — the schema had to relax so baby onboarding could push a DRAFT
 * child before the first question is answered, and this is where the original contract
 * for a one-shot create is still enforced.
 *
 * ESex.OTHER stays accepted on this endpoint. The baby-onboarding chat deliberately offers
 * only Female and Male, but that is a property of the flow definition, not of the field.
 */
const childValidator = Joi.object({
    name: Joi.string().required(),
    date_of_birth: Joi.date().less("now").required(),
    sex: Joi.string().valid(ESex.MALE, ESex.FEMALE, ESex.OTHER).required(),
});

/**
 * Partial update. Every field is optional, but at least one must be present — an empty
 * PATCH is a caller bug, not a no-op worth accepting silently.
 *
 * ─── What cannot be edited, and why ────────────────────────────────────────────────
 *
 * `date_of_birth`, `sex` and `vaccination_sector` are set once, at baby onboarding, and are
 * frozen after. They are not merely fields: growth percentiles are computed against the
 * date of birth and the sex, vaccination due dates and the immunisation schedule come from
 * them, the six-month solids gate is derived from the date of birth, and every date strip
 * is floored at it. Editing one does not change a value, it invalidates a history — and a
 * stale percentile still looks like a perfectly plausible number, so nothing would surface
 * the error.
 *
 * They are `forbidden()` rather than absent so a client that sends one is told, instead of
 * having the field quietly dropped and reporting success for a change that did not happen.
 * Correcting one means deleting the child and adding them again, which is deliberate: it
 * makes the cost visible rather than spreading it silently across five log collections.
 *
 * Birth measurements ARE editable. They have a derived copy — the day-0 point on the growth
 * chart is a real `growth_logs` row — but unlike the frozen three that copy can simply be
 * rewritten, and `ChildService.updateChild` does exactly that after the write.
 *
 * Measurement bounds mirror those in child-onboarding.projection.ts and the client's
 * MEASUREMENT_NODE_BOUNDS. All three must move together.
 */
export const childUpdateValidator = Joi.object({
    name: Joi.string().trim().min(1).max(60),
    date_of_birth: Joi.forbidden().messages({
        "any.unknown": "date_of_birth cannot be changed after onboarding",
    }),
    sex: Joi.forbidden().messages({
        "any.unknown": "sex cannot be changed after onboarding",
    }),
    vaccination_sector: Joi.forbidden().messages({
        "any.unknown": "vaccination_sector cannot be changed after onboarding",
    }),
    birth_measurements: Joi.object({
        head_circumference_cm: Joi.number().min(20).max(60),
        length_cm: Joi.number().min(30).max(100),
        weight_grams: Joi.number().min(500).max(8000),
    }).min(1),
}).min(1);

export default childValidator;
