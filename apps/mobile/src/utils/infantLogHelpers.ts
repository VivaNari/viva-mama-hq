import { TFunction } from "i18next";

import { IFeedEntry, IFeedingTotals } from "../types/feedingLog.types";
import { IVaccinationDue } from "../types/infantLog.types";

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

/** "HH:MM" in 24-hour form, which is how the design renders every logged time. */
export const formatClockTime = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/**
 * The "Today" card on the feeding log.
 *
 * The server sends the same figures back with every day it returns, and this is not a
 * second opinion: it is what fills the gap while an optimistic entry is still in flight,
 * so the count under a mother's thumb moves the moment she taps rather than a round trip
 * later. The two must agree, which is why the arithmetic here mirrors `totalsFor` in
 * `services/feeding-log/feeding-log.service.ts` exactly.
 *
 * Feeds are sorted before the gap is measured, so a mother who remembers the 06:40 feed
 * after entering the 09:50 one still gets the right answer. Feeds crossing midnight are not
 * modelled — each log is one IST calendar day, the unit the screen is built around.
 */
export const summariseFeedDay = (day: {
  feeds?: IFeedEntry[];
  solids?: { _id: string }[];
  water?: { ml: number }[];
}): IFeedingTotals => {
  const times = (day.feeds ?? [])
    .map((entry) => new Date(entry.feedAt).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => a - b);

  let longestGapMinutes: number | null = null;
  for (let i = 1; i < times.length; i++) {
    const current = times[i];
    const previous = times[i - 1];
    if (current === undefined || previous === undefined) continue;

    const gap = Math.round((current - previous) / 60000);
    longestGapMinutes =
      longestGapMinutes === null ? gap : Math.max(longestGapMinutes, gap);
  }

  return {
    feeds: times.length,
    longestGapMinutes,
    solids: (day.solids ?? []).length,
    waterMl: (day.water ?? []).reduce((sum, entry) => sum + (entry.ml ?? 0), 0),
  };
};

/** Splits minutes into the hours/minutes pair the "3h 10m" label interpolates. */
export const splitDuration = (
  totalMinutes: number,
): { hours: number; minutes: number } => ({
  hours: Math.floor(totalMinutes / 60),
  minutes: totalMinutes % 60,
});

/**
 * The date chips on the growth and diaper logs: today first, then the days before it.
 *
 * Only today is editable, but the rest are selectable rather than greyed out — a chip a
 * parent can see and not open tells them a day exists without ever showing what is on it.
 */
export const recentDates = (count: number, now: Date = new Date()): Date[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    return date;
  });

/**
 * Fold newly-fetched day rows into the ones already held, newest data winning.
 *
 * The date strips fetch the recent week on open and any picked day on its own, so two
 * responses describe overlapping-but-different sets of days. Merging on the day key keeps
 * a picked day from being dropped by the next week refresh, and keeps a refreshed day from
 * appearing twice.
 */
export const mergeByDay = <T>(
  existing: T[],
  incoming: T[],
  keyOf: (row: T) => string,
): T[] => {
  const byKey = new Map(existing.map((row) => [keyOf(row), row]));
  for (const row of incoming) byKey.set(keyOf(row), row);

  return [...byKey.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
};

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

  return t("infant.dateChip", {
    day,
    month: t(`common.monthsShort.${MONTH_KEYS[month] ?? "jan"}`),
  });
};


/** An instant that reads as midnight of the given IST calendar day. */
const istMidnight = (year: number, month: number, day: number): Date =>
  // Date.UTC normalises an out-of-range day or month for us, which is what makes the week
  // arithmetic below a one-liner: day + 42 rolls into the next month by itself.
  new Date(Date.UTC(year, month, day) - IST_OFFSET_MINUTES * 60000);

/**
 * When a visit on the immunisation schedule falls due.
 *
 * The card gives an age, not a date — "6 weeks", "16–24 months" — and a parent needs the
 * date. The two units are handled differently on purpose:
 *
 *  - Weeks are exact. Six weeks after birth is forty-two days after birth, always.
 *  - Months are calendar months. Nine months after 14 March is 14 December, not 274 days
 *    later, and a parent checking the card against a birthday expects the day to match.
 *
 * Which leaves one edge the calendar has and the arithmetic does not: a baby born on the
 * 31st has no "one month later". The day is clamped to the end of the target month, so 31
 * January plus one month is 28 February rather than spilling into March — a visit must not
 * appear to fall due in the month after the one the card names.
 *
 * Returns null when the date of birth is missing or unparseable, which is the screen's cue
 * to say nothing rather than to guess: a wrong due date on a vaccination screen is worse
 * than no due date.
 */
export const vaccinationDueWindow = (
  dateOfBirth: Date | string | undefined | null,
  due: IVaccinationDue,
): { from: Date; to: Date } | null => {
  if (!dateOfBirth) return null;

  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const { year, month, day } = istParts(dob);

  const offset = (amount: number): Date => {
    if (due.unit === "week") return istMidnight(year, month, day + amount * 7);

    const target = month + amount;
    const targetYear = year + Math.floor(target / 12);
    const targetMonth = ((target % 12) + 12) % 12;
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

    return istMidnight(targetYear, targetMonth, Math.min(day, lastDay));
  };

  return { from: offset(due.from), to: offset(due.to) };
};

/**
 * Full date for a line of prose — "14 Jul 2027".
 *
 * The year is what separates this from `formatChipDate`, and a vaccination schedule needs
 * it: the visits run two years out, and "14 Jul" alone leaves a parent working out which
 * July. Built from translated month abbreviations for the same two reasons given there.
 */
export const formatFullDate = (date: Date, t: TFunction): string => {
  const { year, month, day } = istParts(date);

  return t("infant.dateFull", {
    day,
    month: t(`common.monthsShort.${MONTH_KEYS[month] ?? "jan"}`),
    year,
  });
};
