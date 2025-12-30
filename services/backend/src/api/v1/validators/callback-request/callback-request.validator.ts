import Joi from "joi";
import { ICallbackRequest } from "../../../../types/callback-request.types";

const addcallbackRequestValidator = Joi.object<ICallbackRequest>({
    // Define your validation schema here
    userId: Joi.string().required(),
    careManagerId: Joi.string().required(),
    requestedAt: Joi.date().optional(),
    requestStatus: Joi.string().valid("PENDING", "COMPLETED", "UNHANDLED").optional(),
});

export default addcallbackRequestValidator;
