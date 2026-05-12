import Joi from "joi";

const sentOTPValidator = Joi.object({
    mobile_number: Joi.string()
        .pattern(/^\+?[1-9][0-9]{7,14}$/)
        .required(),
    country_code: Joi.string().required(),
});
const verifyOTPValidator = Joi.object({
    verification_key: Joi.string().required(),
    otp: Joi.string().required(),
    mobile_number: Joi.string()
        .pattern(/^\+?[1-9][0-9]{7,14}$/)
        .required(),
    country_code: Joi.string().required(),
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

export { sentOTPValidator, verifyOTPValidator };
