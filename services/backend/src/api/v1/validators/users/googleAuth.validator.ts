import Joi from "joi";

const googleAuthValidator = Joi.object({
    idToken: Joi.string().required(),
    FCM_token: Joi.string().optional(),
});

export default googleAuthValidator;
