import { DAYS_PER_MONTH } from "./constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between two dates, counted on the calendar rather than the clock.
 *
 * Subtracting raw millisecond timestamps is off by a day either side of a DST transition,
 * because one of the two local days is 23 or 25 hours long. At six months that error is
 * worth about 0.2 of a percentile and nobody would notice; at three days old it is a third
 * of the child's life. Comparing UTC midnights removes the clock from the question
 * entirely.
 *
 * Floors at 0: a device whose clock is running behind the server must not report a child
 * as not yet born.
 */
export const ageInDaysUtc = (
    dateOfBirth: Date | string,
    measuredAt: Date | string = new Date(),
): number | null => {
    const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
    const at = measuredAt instanceof Date ? measuredAt : new Date(measuredAt);

    if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null;

    const dobUtc = Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate());
    const atUtc = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());

    return Math.max(0, Math.round((atUtc - dobUtc) / MS_PER_DAY));
};

/**
 * Age in months as WHO's age-indexed tables key on it.
 *
 * Fractional by design — see {@link DAYS_PER_MONTH}. Rounding to a whole month here is the
 * single easiest way to stop matching the published reference values.
 */
export const ageMonths = (ageInDays: number): number => ageInDays / DAYS_PER_MONTH;
