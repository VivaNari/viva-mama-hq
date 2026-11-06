import { Schema } from "mongoose";

import { ECareModel, EUserCategory } from "./user.types";

/**
 * The mother's own logs, all in one collection (the PRD's single logging engine).
 * Each entry carries a `logType` and a `fields` object whose shape that type decides;
 * the request validator is what holds each type to its shape.
 */

/** Appended: every save is a new entry. */
export const APPEND_LOG_TYPES = [
    "bp",
    "sugar",
    "weight",
    "hb",
    "temperature",
    "urine_protein",
    "fetal_heart_rate",
    "pumping",
    "meal",
    "anc_visit",
    "pnc_visit",
] as const;

/** One running total per day, overwritten on each save (tap counters). */
export const DAILY_LOG_TYPES = ["water", "kicks"] as const;

/** Written only through their own endpoints (medicines, ANC and PNC schedules). */
export const TOGGLE_LOG_TYPES = ["medicine_dose", "anc_schedule_item", "pnc_schedule_item"] as const;

export const MOTHER_LOG_TYPES = [
    ...APPEND_LOG_TYPES,
    ...DAILY_LOG_TYPES,
    ...TOGGLE_LOG_TYPES,
] as const;

export type TAppendLogType = (typeof APPEND_LOG_TYPES)[number];
export type TDailyLogType = (typeof DAILY_LOG_TYPES)[number];
export type TMotherLogType = (typeof MOTHER_LOG_TYPES)[number];

export const LOG_SOURCES = ["manual", "chat", "onboarding"] as const;
export type TLogSource = (typeof LOG_SOURCES)[number];

export const SUGAR_TIMINGS = ["fasting", "post_meal"] as const;
export const PUMPING_SIDES = ["left", "right", "both"] as const;
export const MEAL_TIMES = ["breakfast", "lunch", "evening_snack", "dinner"] as const;
export const MEAL_FOODS = [
    "dal",
    "rice",
    "vegetables",
    "roti",
    "curd",
    "fruit",
    "egg",
    "paneer",
    "khichdi",
    "poha",
    "nuts",
] as const;
/** Kicks counted to this number complete the day's session. */
export const KICK_GOAL = 10;

export const MEDICINE_PRESETS = ["iron_folic_acid", "calcium", "vitamin_d", "insulin"] as const;
export const MEDICINE_FREQUENCIES = ["once_a_day", "sos", "twice_a_day", "thrice_a_day"] as const;

export type TMedicinePreset = (typeof MEDICINE_PRESETS)[number];
export type TMedicineFrequency = (typeof MEDICINE_FREQUENCIES)[number];

export interface IMotherLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    logType: TMotherLogType;
    /** The IST calendar day, as a UTC-midnight marker. */
    logDate: Date;
    loggedAt: Date;
    source: TLogSource;
    /** Her route and stage when she logged, so history keeps its context. */
    careModel: ECareModel | null;
    stage: EUserCategory | null;
    /** True only on water and kicks totals; selects them for the one-per-day index. */
    isDailyTotal?: boolean;
    fields: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMotherMedicine {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    /** A known preset, or null when she typed her own name. */
    presetKey: TMedicinePreset | null;
    name: string | null;
    frequency: TMedicineFrequency;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
