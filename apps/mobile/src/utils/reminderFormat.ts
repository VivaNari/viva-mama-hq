import { TFunction } from 'i18next';

import { fromISODateKey } from './dateKey';
import { ReminderFrequency } from '../types/reminder.types';

// Monday first, as the weekday chips read; values are JS weekdays (0 = Sunday).
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** "19:30" → "7:30 pm". */
export const formatReminderTime = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'am' : 'pm';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

/** A Date's local clock time as "HH:MM", for the time picker. */
export const toReminderTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** "HH:MM" as today's Date, to open the time picker on it. */
export const reminderTimeAsDate = (time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/** "Fri 6 Nov" for a "YYYY-MM-DD" day. */
export const formatReminderDay = (day: string, locale: string): string =>
  fromISODateKey(day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * How often, in words: "Daily", "Every Mon", "Mon, Thu", or the day for a one-time
 * reminder. `startDate` gives weekly its weekday and once its day; today when absent.
 */
export const reminderFrequencyLabel = (
  t: TFunction,
  locale: string,
  frequency: ReminderFrequency,
  weekdays: number[] = [],
  startDate?: string,
): string => {
  if (frequency === 'custom') {
    return WEEKDAYS.filter(day => weekdays.includes(day))
      .map(day => t(`logs.reminders.weekdays.${day}`))
      .join(', ');
  }
  const start = startDate ? fromISODateKey(startDate) : new Date();
  if (frequency === 'weekly') {
    return t('logs.reminders.weeklyOn', { day: t(`logs.reminders.weekdays.${start.getDay()}`) });
  }
  if (frequency === 'once' && startDate) return formatReminderDay(startDate, locale);
  return t(`logs.reminders.frequencies.${frequency}`);
};
