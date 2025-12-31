import Joi from "joi";
import { ICallbackRequest } from "../../../../types/callback-request.types";

const addcallbackRequestValidator = Joi.object<ICallbackRequest>({
    careManagerId: Joi.string().required(),
    requestStatus: Joi.string().valid("PENDING", "COMPLETED", "UNHANDLED").optional(),
});

export default addcallbackRequestValidator;
