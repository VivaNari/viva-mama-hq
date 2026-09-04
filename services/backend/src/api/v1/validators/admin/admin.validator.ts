import Joi from "joi";

export const adminLoginValidator = Joi.object({
    email: Joi.string().trim().email().required().messages({
        "string.email": "Enter a valid email address",
        "string.empty": "Email is required",
        "any.required": "Email is required",
    }),
    // The minimum guards the seed script's own policy, not the stored hash — an
    // account created before this rule would simply never authenticate again.
    password: Joi.string().min(8).required().messages({
        "string.min": "Password must be at least 8 characters",
        "string.empty": "Password is required",
        "any.required": "Password is required",
    }),
}).unknown(false);

export default adminLoginValidator;
