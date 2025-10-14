import Joi from "joi";

const sentOTPValidator = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?[1-9][0-9]{7,14}$/)
        .required(),
});
const verifyOTPValidator = Joi.object({
    verification_key: Joi.string().required(),
    otp: Joi.string().required(),
    phone: Joi.string()
        .pattern(/^\+?[1-9][0-9]{7,14}$/)
        .required(),
});

export { sentOTPValidator, verifyOTPValidator };
