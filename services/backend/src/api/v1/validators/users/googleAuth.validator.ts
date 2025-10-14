import Joi from "joi";

const googleAuthValidator = Joi.object({
    idToken: Joi.string().required(),
});

export default googleAuthValidator;
