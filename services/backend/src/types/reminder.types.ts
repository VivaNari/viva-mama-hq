import { Schema } from "mongoose";

import { ECareModel } from "./user.types";

export const REMINDER_CATEGORIES = ["medicine", "meals", "exercise", "tests", "other"] as const;
export const REMINDER_TIMES = ["morning", "afternoon", "evening", "night"] as const;
export const REMINDER_FREQUENCIES = ["daily", "alternateDays", "weekly", "custom"] as const;

export type TReminderCategory = (typeof REMINDER_CATEGORIES)[number];
export type TReminderTime = (typeof REMINDER_TIMES)[number];
export type TReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

/** When each slot fires, in minutes after IST midnight. The app shows the same times. */
export const REMINDER_SLOT_MINUTES: Record<TReminderTime, number> = {
    morning: 8 * 60,
    afternoon: 13 * 60,
    evening: 18 * 60,
    night: 21 * 60,
};

/**
 * How late a reminder may still go out. Long enough that a missed scheduler run is
 * covered by the next one; short enough that a "morning" push never lands at noon.
 */
export const REMINDER_SEND_TOLERANCE_MINUTES = 60;

export const MAX_ACTIVE_REMINDERS = 20;

export interface IMotherReminder {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    category: TReminderCategory;
    /** Her own words; only for "other". */
    detail: string | null;
    timeOfDay: TReminderTime;
    frequency: TReminderFrequency;
    /** 0 (Sunday) – 6, for "custom" only. */
    weekdays: number[];
    /** IST calendar days, "YYYY-MM-DD". A null end date means ongoing. */
    startDate: string;
    endDate: string | null;
    careModel: ECareModel | null;
    /** The IST day this reminder last went out; claims the send for that day. */
    lastSentDate: string | null;
    createdAt: Date;
    updatedAt: Date;
}
