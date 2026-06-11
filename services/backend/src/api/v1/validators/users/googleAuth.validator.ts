import Joi from "joi";

const googleAuthValidator = Joi.object({
    idToken: Joi.string().required(),
    FCM_token: Joi.string().optional(),
    consents: Joi.array()
        .items(
            Joi.object({
                type: Joi.string().valid("privacy_policy", "terms_of_use").required(),
                version: Joi.string().required(),
            }),
        )
        .optional(),
});

export default googleAuthValidator;
