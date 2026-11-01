import { Schema } from "mongoose";

import { ECareModel } from "./user.types";

export const REMINDER_CATEGORIES = ["medicine", "meals", "exercise", "tests", "other"] as const;
export const REMINDER_TIMES = ["morning", "afternoon", "evening", "night"] as const;
export const REMINDER_FREQUENCIES = ["daily", "alternateDays", "weekly", "custom", "once"] as const;

export type TReminderCategory = (typeof REMINDER_CATEGORIES)[number];
export type TReminderTime = (typeof REMINDER_TIMES)[number];
export type TReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

/**
 * The quick-pick times behind the Morning / Afternoon / Evening / Night chips, in
 * minutes after IST midnight. Also the time used when she asks for "at night" without
 * a clock time.
 */
export const REMINDER_QUICK_TIMES: Record<TReminderTime, number> = {
    morning: 8 * 60,
    afternoon: 13 * 60,
    evening: 18 * 60,
    night: 21 * 60,
};

/**
 * How late a reminder may still go out. Long enough that a missed scheduler run is
 * covered by the next ones; short enough that a morning push never lands at noon.
 */
export const REMINDER_SEND_TOLERANCE_MINUTES = 60;

export const MAX_ACTIVE_REMINDERS = 20;

/** "HH:MM" (24-hour) to minutes after midnight; null when malformed. */
export const parseReminderTime = (time: string): number | null => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const formatReminderTime = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export interface IMotherReminder {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    category: TReminderCategory;
    /** Her own words; only for "other". */
    detail: string | null;
    /** Minutes after IST midnight, 0–1439. */
    timeMinutes: number;
    frequency: TReminderFrequency;
    /** 0 (Sunday) – 6, for "custom" only. */
    weekdays: number[];
    /**
     * IST calendar days, "YYYY-MM-DD". A null end date means ongoing; a one-time
     * reminder has both set to its day.
     */
    startDate: string;
    endDate: string | null;
    careModel: ECareModel | null;
    /** The IST day this reminder last went out; claims the send for that day. */
    lastSentDate: string | null;
    createdAt: Date;
    updatedAt: Date;
}
