import Joi from "joi";

const objectId = Joi.string().hex().length(24);

/** Text fields that ride along with the multipart file. */
export const attachmentUploadFieldsValidator = Joi.object({
    clientUploadId: Joi.string().uuid().required(),
});

export const attachmentConsentValidator = Joi.object({
    consentVersion: Joi.string().max(40).required(),
});

/**
 * The Viva AI part of POST /chat-flow/answer. Guided check-ins share the endpoint
 * and keep their own checks in the controller, so this only runs for CHATBOT turns.
 */
export const chatbotAnswerValidator = Joi.object({
    freeText: Joi.string().max(2000).allow("", null),
    attachmentIds: Joi.array().items(objectId).max(3).unique(),
    clientMessageId: Joi.string().uuid().allow(null),
    sessionId: Joi.string().max(100).allow("", null),
    conversationId: objectId.allow("", null),
    // The app sends its UI locale ("en", "hi", "hi-IN"); mapped to en/hi downstream.
    lang: Joi.string().max(10).allow("", null),
})
    .or("freeText", "attachmentIds")
    // Older app builds send these; the chatbot path ignores them.
    .unknown(true);
