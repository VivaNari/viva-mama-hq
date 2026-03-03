import Joi from "joi";
import { ISupport } from "../../../../types/support-schema.types";

const createSupportValidator = Joi.object<ISupport>({
    supportType: Joi.string().required(),
    message: Joi.string().required(),
});

export default createSupportValidator;
