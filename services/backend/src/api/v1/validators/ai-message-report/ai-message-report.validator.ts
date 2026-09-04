import Joi from "joi";

import { AI_MESSAGE_REPORT_REASONS } from "../../../../types/moderation.types";

/**
 * Only the reasons that mean something for model output are accepted — SPAM and
 * HARASSMENT describe what people do to each other, and a report carrying one would
 * arrive in the queue with nothing a reviewer could act on.
 *
 * `targetType` is not a field: this endpoint reports AI messages and nothing else, so
 * accepting it would only create a way to get it wrong.
 */
const aiMessageReportValidator = Joi.object({
    messageId: Joi.string().hex().length(24).required(),
    reason: Joi.string()
        .valid(...AI_MESSAGE_REPORT_REASONS)
        .required(),
    details: Joi.string().max(500).allow("", null).optional(),
}).unknown(false);

export default aiMessageReportValidator;
