import Joi from "joi";

// Lenient by design: ONHS payloads are large and vary by use case, so we only assert
// this is a well-formed envelope for the expected action (right action + correlation
// ids + a message object) and let the handler read the rest. unknown(true) keeps the
// rich body intact (requestValidator does not strip), so nothing is lost downstream.
const becknActionValidator = (action: string) =>
    Joi.object({
        context: Joi.object({
            action: Joi.string().valid(action).required(),
            transactionId: Joi.string().required(),
            messageId: Joi.string().required(),
        })
            .unknown(true)
            .required(),
        message: Joi.object().unknown(true).required(),
    }).unknown(true);

export const becknSelectValidator = becknActionValidator("select");
export const becknInitValidator = becknActionValidator("init");
export const becknConfirmValidator = becknActionValidator("confirm");
export const becknStatusValidator = becknActionValidator("status");
