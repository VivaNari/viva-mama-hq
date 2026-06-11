import Joi from "joi";

// Body validator for creating/updating a mood log.
// logDate is an ISO date-only string ("YYYY-MM-DD"); the calendar-range checks
// (not in the future, not before the user joined) are enforced in the service.
export const moodLogUpsertValidator = Joi.object({
    mood: Joi.number().integer().min(1).max(5).required(),
    logDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
            "string.pattern.base": "logDate must be in YYYY-MM-DD format",
        }),
});

// Body validator for deleting a mood log (identified by its calendar day).
export const moodLogDeleteValidator = Joi.object({
    logDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
            "string.pattern.base": "logDate must be in YYYY-MM-DD format",
        }),
});
