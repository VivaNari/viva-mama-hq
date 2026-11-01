export type ReminderCategory = 'medicine' | 'meals' | 'exercise' | 'tests' | 'other';
export type ReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type ReminderFrequency = 'daily' | 'alternateDays' | 'weekly' | 'custom' | 'once';

/**
 * The quick picks behind the Morning / Afternoon / Evening / Night chips, as "HH:MM"
 * (24-hour, IST). She can adjust the time after picking one.
 */
export const REMINDER_QUICK_TIMES: Record<ReminderTime, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
};

export interface MotherReminder {
  _id: string;
  category: ReminderCategory;
  /** Her own words; only for "other". */
  detail: string | null;
  /** "HH:MM", 24-hour, IST. */
  time: string;
  frequency: ReminderFrequency;
  /** 0 (Sunday) – 6, for "custom" only. */
  weekdays: number[];
  /** "YYYY-MM-DD"; a null end date means ongoing. A one-time reminder has both on its day. */
  startDate: string;
  endDate: string | null;
  careModel: string | null;
  /** The day it last went out, "YYYY-MM-DD". */
  lastSentDate: string | null;
}

export interface NewReminder {
  category: ReminderCategory;
  detail?: string;
  /** "HH:MM", 24-hour. */
  time: string;
  frequency: ReminderFrequency;
  weekdays?: number[];
  /** "YYYY-MM-DD", for "once" only. */
  date?: string;
  /** Null: ongoing. Not for "once". */
  endWeeks?: number | null;
}
