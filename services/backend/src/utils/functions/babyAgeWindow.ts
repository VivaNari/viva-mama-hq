import type { VaccinationDueUnit } from "@vivamama/infant-schedules";

import { getISTCalendarDate } from "../../services/date/date.service";

/**
 * When a child has reached a vaccination visit or milestone band, on the calendar the MCP
 * card and the mobile screens already use.
 *
 * Ported from `apps/mobile/src/utils/infantLogHelpers.ts` (`getAgeInMonths` /
 * `vaccinationDueWindow`) rather than reimplemented, because the whole point of the daily
 * reminder job is to agree with what the Vaccination/Milestone Log screens show as due — a
 * second, slightly different age calculation here would be the exact kind of drift this
 * module exists to prevent. `@vivamama/growth-standards`' own `ageMonths` is deliberately
 * NOT reused for this: it is a 30.44-day average for WHO's percentile tables, and averaging
 * drifts a child into the wrong band right around every boundary — precisely the moment
 * this job has to get right.
 *
 * `now` is injectable, matching `postpartumWeek.ts`'s convention, so the cron job and its
 * tests can pin a clock.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Whole months since birth, on the calendar rather than a 30.44-day average.
 *
 * A baby born on 14 March is nine months old on 14 December, which is the arithmetic the
 * MCP card's own age bands assume.
 */
export const getAgeInMonths = (
    dateOfBirth: Date | string | null | undefined,
    now: Date = new Date(),
): number | null => {
    const dob = toDate(dateOfBirth);
    if (!dob) return null;

    const birth = getISTCalendarDate(dob);
    const today = getISTCalendarDate(now);

    let months =
        (today.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
        (today.getUTCMonth() - birth.getUTCMonth());
    // The month only counts once the day-of-month has come round again.
    if (today.getUTCDate() < birth.getUTCDate()) months -= 1;

    return Math.max(0, months);
};

/**
 * The date a vaccination visit's due window opens.
 *
 * Weeks are exact days; months are calendar months, clamped to the end of a short target
 * month — a baby born on the 31st has no "one month later" in every month, so the day is
 * clamped rather than allowed to spill into the month after the one the visit is due in.
 */
export const vaccinationVisitDueDate = (
    dateOfBirth: Date | string | null | undefined,
    due: { unit: VaccinationDueUnit; from: number },
): Date | null => {
    const dob = toDate(dateOfBirth);
    if (!dob) return null;

    const birth = getISTCalendarDate(dob);

    if (due.unit === "week") {
        return new Date(birth.getTime() + due.from * 7 * MS_PER_DAY);
    }

    const year = birth.getUTCFullYear();
    const month = birth.getUTCMonth();
    const day = birth.getUTCDate();

    const target = month + due.from;
    const targetYear = year + Math.floor(target / 12);
    const targetMonth = ((target % 12) + 12) % 12;
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

    return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
};

/** Whether a vaccination visit's due window has opened by `now`, IST calendar day. */
export const hasVaccinationVisitBecomeDue = (
    dateOfBirth: Date | string | null | undefined,
    due: { unit: VaccinationDueUnit; from: number },
    now: Date = new Date(),
): boolean => {
    const dueDate = vaccinationVisitDueDate(dateOfBirth, due);
    return dueDate !== null && getISTCalendarDate(now).getTime() >= dueDate.getTime();
};
