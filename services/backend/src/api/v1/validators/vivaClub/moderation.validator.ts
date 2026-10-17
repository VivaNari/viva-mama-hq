import Joi from "joi";

import {
    EReportAction,
    EReportReason,
    EReportTargetType,
} from "../../../../types/moderation.types";

export const createReportValidator = Joi.object({
    targetType: Joi.string()
        .valid(...Object.values(EReportTargetType))
        .required(),
    targetId: Joi.string().hex().length(24).required(),
    reason: Joi.string()
        .valid(...Object.values(EReportReason))
        .required(),
    // Only meaningful alongside OTHER, but accepted with any reason: a reporter adding
    // context to a HARASSMENT report is giving the reviewer exactly what they need.
    details: Joi.string().max(500).allow("", null).optional(),
}).unknown(false);

export const actionReportValidator = Joi.object({
    action: Joi.string()
        .valid(...Object.values(EReportAction))
        .required(),
    note: Joi.string().max(500).allow("", null).optional(),
}).unknown(false);
