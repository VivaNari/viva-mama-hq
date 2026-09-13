import { TFunction } from "i18next";

import { IFeedEntry } from "../types/infantLog.types";

/**
 * Pure helpers behind the infant log screens.
 *
 * Kept out of the components so the arithmetic that a parent actually reads — how many
 * feeds today, how long the longest gap was — can be tested without rendering anything.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days since birth, floored at 0 so a clock skew never shows a negative age. */
export const getAgeInDays = (
  dateOfBirth: Date | string | undefined | null,
  now: Date = new Date(),
): number | null => {
  if (!dateOfBirth) return null;

  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  return Math.max(0, Math.floor((now.getTime() - dob.getTime()) / MS_PER_DAY));
};

/**
 * Which feeding log a child gets.
 *
 * The PRD splits feeding at six months: before it, one of three feeding types drives the
 * fields; after it, solids and water join the day. 183 days rather than a calendar month
 * count — the boundary is clinical guidance, not a birthday.
 *
 * An unknown date of birth falls to the 0–6 month log: it is the one that asks for less,
 * and the screen offers a manual switch either way.
 */
export const isSixMonthsOrOlder = (
  dateOfBirth: Date | string | undefined | null,
  now: Date = new Date(),
): boolean => {
  const days = getAgeInDays(dateOfBirth, now);
  return days !== null && days >= 183;
};

/**
 * Minutes past midnight for a "HH:MM" string, or null if it is not a time.
 *
 * Deliberately strict: the summary below counts entries and measures gaps, and a half-typed
 * "6:" silently parsing as 06:00 would report a feed that never happened.
 */
export const parseClockTime = (value: string | undefined | null): number | null => {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

/** "HH:MM" in 24-hour form, which is how the design renders every logged time. */
export const formatClockTime = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export interface IFeedingSummary {
  /** Rows with a readable time. A half-filled row is not a feed. */
  feeds: number;
  /** Largest span between consecutive feeds, in minutes. Null until there are two. */
  longestGapMinutes: number | null;
}

/**
 * The "Today" card on the feeding log.
 *
 * Times are sorted before measuring, so a parent who remembers the 06:40 feed after
 * entering the 09:50 one still gets the right gap. Feeds crossing midnight are not
 * modelled — each log is one calendar day, which is the unit the screen is built around.
 */
export const summariseFeeds = (entries: IFeedEntry[]): IFeedingSummary => {
  const times = entries
    .map((entry) => parseClockTime(entry.time))
    .filter((minutes): minutes is number => minutes !== null)
    .sort((a, b) => a - b);

  if (times.length < 2) {
    return { feeds: times.length, longestGapMinutes: null };
  }

  let longest = 0;
  for (let i = 1; i < times.length; i++) {
    longest = Math.max(longest, times[i] - times[i - 1]);
  }

  return { feeds: times.length, longestGapMinutes: longest };
};

/** Splits minutes into the hours/minutes pair the "3h 10m" label interpolates. */
export const splitDuration = (
  totalMinutes: number,
): { hours: number; minutes: number } => ({
  hours: Math.floor(totalMinutes / 60),
  minutes: totalMinutes % 60,
});

/**
 * The date chips on the growth log: today first, then the days before it.
 *
 * Only today is editable — the design greys the rest — but they stay visible so a parent
 * can see what was already recorded.
 */
export const recentDates = (count: number, now: Date = new Date()): Date[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    return date;
  });

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * India Standard Time, in minutes. The backend keys every calendar day on IST
 * (`getISTCalendarDate` in services/backend/src/services/date/date.service.ts), so the app
 * has to agree or the two disagree about which day "today" is. Device-local days looked
 * identical in India and drifted for anyone else — a user an hour ahead of IST could have
 * their own today rejected by the server as a future date.
 */
const IST_OFFSET_MINUTES = 330;

/** The Y/M/D an instant falls on in IST, read off a shifted UTC clock. */
export const istParts = (
  instant: Date,
): { year: number; month: number; day: number } => {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
};

/** "YYYY-MM-DD" for the IST calendar day — the shape the growth-log API takes. */
export const istDateKey = (instant: Date): string => {
  const { year, month, day } = istParts(instant);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/** Whether two instants fall on the same IST calendar day. */
export const isSameIstDay = (a: Date, b: Date): boolean =>
  istDateKey(a) === istDateKey(b);

const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

/**
 * Short date for a chip label — "13 Sep".
 *
 * Built from translated month abbreviations rather than
 * `toLocaleDateString(locale, { month: 'short', day: 'numeric' })`. Two reasons, both of
 * which this app has already hit: Hermes does not reliably honour Intl options and falls
 * back to a long default form, which blows a chip out to the width of "13 September 2026";
 * and the device locale is not the app locale, so a Hindi user reading an English app
 * would get Devanagari dates. MoodDateStrip avoids Intl in its own strip for the same
 * reason (see its WEEKDAY_LABELS comment).
 *
 * The day/month order lives in the translation string, so a locale that puts the month
 * first can say so.
 */
export const formatChipDate = (date: Date, t: TFunction): string => {
  const { month, day } = istParts(date);

  return t("infant.growth.dateChip", {
    day,
    month: t(`common.monthsShort.${MONTH_KEYS[month] ?? "jan"}`),
  });
};
