import Joi from "joi";
import { CLIENT_REPORTABLE_EVENTS } from "../../../../types/analytics.types";

/**
 * `tier` is deliberately absent: it is resolved server-side. Accepting it from the
 * client would let a stale or crafted value corrupt every segment of the funnel.
 */
export const recordAnalyticsEventValidator = Joi.object({
    event: Joi.string()
        .valid(...CLIENT_REPORTABLE_EVENTS)
        .required(),
    capability: Joi.string().optional(),
    metadata: Joi.object().optional(),
}).unknown(false);
