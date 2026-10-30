import Joi from "joi";

import {
    ANC_CHECKS,
    APPEND_LOG_TYPES,
    DAILY_LOG_TYPES,
    LOG_SOURCES,
    MEAL_FOODS,
    MEAL_TIMES,
    MEDICINE_FREQUENCIES,
    MEDICINE_PRESETS,
    PUMPING_SIDES,
    SUGAR_TIMINGS,
    TAppendLogType,
    TDailyLogType,
} from "../../../../types/mother-log.types";
import {
    REMINDER_CATEGORIES,
    REMINDER_FREQUENCIES,
    REMINDER_TIMES,
} from "../../../../types/reminder.types";

/**
 * Mother log request validation.
 *
 * Every log type shares one endpoint, so `fields` is validated against the shape its
 * `logType` names. Ranges follow the "Data fields & ranges" tab of the 1000-day master
 * schedule: they catch a typo (a BP of 1300), not a clinical judgement, so a genuinely
 * high reading inside the range is always accepted.
 *
 * Objects reject unknown keys (Joi's default), so a client sending `ml` on a BP reading
 * gets a 400 rather than a stored field nobody reads.
 */

const integer = (min: number, max: number) => Joi.number().integer().min(min).max(max).required();
const decimal = (min: number, max: number) => Joi.number().min(min).max(max).required();

const FIELD_SCHEMAS: Record<TAppendLogType | TDailyLogType, Joi.ObjectSchema> = {
    bp: Joi.object({ systolic: integer(60, 250), diastolic: integer(40, 150) }),
    sugar: Joi.object({
        value: integer(20, 500),
        timing: Joi.string()
            .valid(...SUGAR_TIMINGS)
            .required(),
    }),
    weight: Joi.object({ weightKg: decimal(30, 200) }),
    hb: Joi.object({ value: decimal(2, 20) }),
    temperature: Joi.object({ valueF: decimal(90, 110) }),
    urine_protein: Joi.object({ value: integer(0, 4) }),
    fetal_heart_rate: Joi.object({ bpm: integer(60, 220) }),
    pumping: Joi.object({
        side: Joi.string()
            .valid(...PUMPING_SIDES)
            .required(),
        minutes: integer(1, 120),
        ml: integer(0, 500),
    }),
    meal: Joi.object({
        mealTime: Joi.string()
            .valid(...MEAL_TIMES)
            .required(),
        foods: Joi.array()
            .items(Joi.string().valid(...MEAL_FOODS))
            .unique()
            .min(1)
            .required(),
    }),
    anc_visit: Joi.object({
        checks: Joi.array()
            .items(Joi.string().valid(...ANC_CHECKS))
            .unique()
            .min(1)
            .required(),
    }),
    water: Joi.object({ glasses: integer(0, 30) }),
    kicks: Joi.object({ count: integer(0, 200) }),
};

const fieldsFor = (types: readonly (TAppendLogType | TDailyLogType)[]) =>
    Joi.alternatives()
        .conditional("logType", {
            switch: types.map((type) => ({ is: type, then: FIELD_SCHEMAS[type] })),
        })
        .required();

/** POST /mother-logs: one appended entry. */
export const motherLogCreateValidator = Joi.object({
    logType: Joi.string()
        .valid(...APPEND_LOG_TYPES)
        .required(),
    fields: fieldsFor(APPEND_LOG_TYPES),
    // Joi's ISO mode, so "2026-10-27T03:10:00.000Z" is accepted and "today" is not.
    // Omitted means now.
    loggedAt: Joi.date().iso(),
    source: Joi.string().valid(...LOG_SOURCES),
});

/** PUT /mother-logs/daily: today's running total for a tap counter. */
export const motherLogDailyValidator = Joi.object({
    logType: Joi.string()
        .valid(...DAILY_LOG_TYPES)
        .required(),
    fields: fieldsFor(DAILY_LOG_TYPES),
    source: Joi.string().valid(...LOG_SOURCES),
});

/**
 * A log the chatbot read out of her message, before it becomes a confirm card.
 *
 * The chatbot mirrors these shapes, but this server owns them: every proposal is held
 * to the same per-type fields as a manual entry, and one that fails is dropped rather
 * than shown to her.
 */
export const chatLogProposalValidator = Joi.object({
    logType: Joi.string()
        .valid(...APPEND_LOG_TYPES, ...DAILY_LOG_TYPES, "medicine_dose")
        .required(),
    fields: Joi.alternatives()
        .conditional("logType", {
            switch: [
                ...[...APPEND_LOG_TYPES, ...DAILY_LOG_TYPES].map((type) => ({
                    is: type,
                    then: FIELD_SCHEMAS[type],
                })),
                { is: "medicine_dose", then: Joi.object({}) },
            ],
        })
        .required(),
    mode: Joi.when("logType", {
        is: Joi.valid(...DAILY_LOG_TYPES),
        then: Joi.string().valid("add", "set").default("add"),
        otherwise: Joi.forbidden(),
    }),
    medicineRef: Joi.when("logType", {
        is: "medicine_dose",
        then: Joi.object({
            presetKey: Joi.string().valid(...MEDICINE_PRESETS),
            name: Joi.string().trim().min(1).max(60),
        })
            .xor("presetKey", "name")
            .required(),
        otherwise: Joi.forbidden(),
    }),
});

/** POST /chat/log-proposals/confirm: her Yes or No on one item of a confirm card. */
export const chatLogConfirmValidator = Joi.object({
    messageId: Joi.string().hex().length(24).required(),
    proposalId: Joi.string().hex().length(24).required(),
    accept: Joi.boolean().required(),
});

/** PUT /mother-logs/anc-schedule/:itemId */
export const ancScheduleItemValidator = Joi.object({
    done: Joi.boolean().required(),
});

/** POST /mother-medicines: a preset or a name she typed, never both. */
export const motherMedicineCreateValidator = Joi.object({
    presetKey: Joi.string().valid(...MEDICINE_PRESETS),
    name: Joi.string().trim().min(1).max(60),
    frequency: Joi.string()
        .valid(...MEDICINE_FREQUENCIES)
        .required(),
}).xor("presetKey", "name");

/** PUT /mother-medicines/:id/taken */
export const motherMedicineTakenValidator = Joi.object({
    taken: Joi.boolean().required(),
    source: Joi.string().valid(...LOG_SOURCES),
});

/**
 * POST /mother-reminders. The start date is always today and is set by the server;
 * `endWeeks` absent or null means ongoing.
 */
export const motherReminderCreateValidator = Joi.object({
    category: Joi.string()
        .valid(...REMINDER_CATEGORIES)
        .required(),
    detail: Joi.when("category", {
        is: "other",
        then: Joi.string().trim().min(1).max(80).required(),
        otherwise: Joi.forbidden(),
    }),
    timeOfDay: Joi.string()
        .valid(...REMINDER_TIMES)
        .required(),
    frequency: Joi.string()
        .valid(...REMINDER_FREQUENCIES)
        .required(),
    weekdays: Joi.when("frequency", {
        is: "custom",
        then: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).required(),
        otherwise: Joi.forbidden(),
    }),
    endWeeks: Joi.number().integer().min(1).max(52).allow(null),
});
