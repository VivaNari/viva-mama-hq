import Joi from "joi";
import { ICareManager } from "../../../../types/care-manager.types";

const createCareManagerValidator = Joi.object<ICareManager>({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().required(),
    imageUrl: Joi.string().uri().required(),
});

export default createCareManagerValidator;
