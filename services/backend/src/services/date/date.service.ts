export const addMinutesToDate = (date: number, minutes: number) => new Date(date + minutes * 60000);

export const compareDate = (expiration: Date, current: Date) =>
    expiration.getTime() > current.getTime();

// India Standard Time offset from UTC, in minutes (+05:30).
const IST_OFFSET_MINUTES = 330;

/**
 * Parse a strict ISO date-only string ("YYYY-MM-DD") into a UTC-midnight Date
 * that represents that calendar day with no time-of-day component.
 * Returns null if the string is not a real calendar date.
 */
export const parseISODateToStartOfDay = (dateStr: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    // Reject values that JS rolled over (e.g. 2026-02-30 -> Mar 2).
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
};

/**
 * Format a stored calendar Date back into "YYYY-MM-DD" (UTC parts).
 */
export const formatDateToISO = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/**
 * Given any instant, return a UTC-midnight Date representing the IST calendar
 * day it falls on. Used so "today" and the onboarding floor compare at
 * calendar-day granularity in the user's timezone.
 */
export const getISTCalendarDate = (instant: Date = new Date()): Date => {
    const istWallClock = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60000);
    return new Date(
        Date.UTC(
            istWallClock.getUTCFullYear(),
            istWallClock.getUTCMonth(),
            istWallClock.getUTCDate(),
        ),
    );
};
