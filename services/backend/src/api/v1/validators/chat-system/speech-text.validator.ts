import Joi from "joi";

/** Same ceiling as the chatbot's own check, so an oversized text stops here. */
export const speechTextValidator = Joi.object({
    text: Joi.string().trim().min(1).max(10000).required(),
});
