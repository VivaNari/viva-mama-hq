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
 * Measurement bounds mirror those in child-onboarding.projection.ts and the client's
 * MEASUREMENT_NODE_BOUNDS. All three must move together.
 */
export const childUpdateValidator = Joi.object({
    name: Joi.string(),
    date_of_birth: Joi.date().less("now"),
    sex: Joi.string().valid(ESex.MALE, ESex.FEMALE, ESex.OTHER),
    birth_measurements: Joi.object({
        head_circumference_cm: Joi.number().min(20).max(60),
        length_cm: Joi.number().min(30).max(100),
        weight_grams: Joi.number().min(500).max(8000),
    }).min(1),
}).min(1);

export default childValidator;
