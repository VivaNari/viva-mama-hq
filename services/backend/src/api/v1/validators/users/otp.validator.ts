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
});

export { sentOTPValidator, verifyOTPValidator };
