import Joi from "joi";

import { DeliveryOutcomeEnum, DeliveryTypeEnum } from "../../../../types/user.types";

/** POST /user/baby-arrived. The controller checks the date is real and not in the future. */
export const babyArrivedValidator = Joi.object({
    delivery_date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required(),
    delivery_type: Joi.string()
        .valid(...Object.values(DeliveryTypeEnum))
        .required(),
    delivery_outcome: Joi.string()
        .valid(...Object.values(DeliveryOutcomeEnum))
        .required(),
});
