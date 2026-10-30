export type ReminderCategory = 'medicine' | 'meals' | 'exercise' | 'tests' | 'other';
export type ReminderTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type ReminderFrequency = 'daily' | 'alternateDays' | 'weekly' | 'custom';

/** When each slot's notification goes out (IST). The server sends at the same times. */
export const REMINDER_SLOT_TIMES: Record<ReminderTime, string> = {
  morning: '8:00 am',
  afternoon: '1:00 pm',
  evening: '6:00 pm',
  night: '9:00 pm',
};

export interface MotherReminder {
  _id: string;
  category: ReminderCategory;
  /** Her own words; only for "other". */
  detail: string | null;
  timeOfDay: ReminderTime;
  frequency: ReminderFrequency;
  /** 0 (Sunday) – 6, for "custom" only. */
  weekdays: number[];
  /** "YYYY-MM-DD"; a null end date means ongoing. */
  startDate: string;
  endDate: string | null;
  careModel: string | null;
}

export interface NewReminder {
  category: ReminderCategory;
  detail?: string;
  timeOfDay: ReminderTime;
  frequency: ReminderFrequency;
  weekdays?: number[];
  /** Null: ongoing. */
  endWeeks: number | null;
}
