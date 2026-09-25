import { getISTCalendarDate } from "../../services/date/date.service";

/**
 * The single definition of "what week is this user in".
 *
 * Everything here is a pure function of the delivery date and the clock — nothing reads
 * prior state. That is deliberate: the cron jobs that persist these values must be
 * idempotent, so a run that is repeated, delayed, or skipped for three days all converge
 * on the same answer. The previous implementation incremented from the last flow instance
 * (`targetWeek = latest + 1`), which drifted permanently the moment a run was missed.
 *
 * `now` is injectable so the jobs and their tests can pin a clock. The old
 * `calculateUserCurrentWeek` read `Date.now()` internally, which is why none of this was
 * testable.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;

/** Naegele's rule: a full-term pregnancy is 40 weeks from the last menstrual period. */
const FULL_TERM_DAYS = 280;

/**
 * Check-ins stop after a year postpartum. The start/answer endpoints already reject
 * weeks above this, so creating instances beyond it would strand the user with an
 * enabled button and a 400.
 */
export const MAX_CHECKIN_WEEK = 52;

export type TPostpartumMode = "pregnancy" | "postpartum";

export interface IPostpartumState {
    mode: TPostpartumMode;
    /** Postpartum week (1-indexed — delivery day is week 1) or gestational week. */
    weeks: number;
    /** Day index inside the current week, 0-6. */
    days: number;
    /** Days ELAPSED since the current check-in opened. 0 on opening day, up to 6. */
    previousCheckinDueDays: number;
    /** Days REMAINING until the next check-in opens. 0 on opening day, else 6 down to 1. */
    upcomingCheckinDueDays: number;
    /** Weeks left until the due date. Only meaningful while pregnant. */
    npWeeksRemaining: number;
}

/**
 * Whole calendar days between two instants, measured on IST day boundaries rather than
 * elapsed milliseconds. A user who delivered "yesterday" is 1 day postpartum from IST
 * midnight, regardless of what time of day either value carries.
 */
export const istCalendarDaysBetween = (from: Date, to: Date): number => {
    const fromDay = getISTCalendarDate(from).getTime();
    const toDay = getISTCalendarDate(to).getTime();
    return Math.round((toDay - fromDay) / MS_PER_DAY);
};

export const calculatePostpartumState = (
    deliveryDate: Date,
    now: Date = new Date(),
): IPostpartumState => {
    const daysSinceDelivery = istCalendarDaysBetween(new Date(deliveryDate), now);

    if (daysSinceDelivery < 0) {
        const daysUntilDelivery = -daysSinceDelivery;

        // Clamp: a delivery date more than 40 weeks out otherwise yields negative
        // gestational weeks, which the old implementation happily returned.
        const gestationalDays = Math.max(0, FULL_TERM_DAYS - daysUntilDelivery);

        return {
            mode: "pregnancy",
            weeks: Math.floor(gestationalDays / DAYS_PER_WEEK),
            days: gestationalDays % DAYS_PER_WEEK,
            // No check-ins before delivery.
            previousCheckinDueDays: 0,
            upcomingCheckinDueDays: 0,
            npWeeksRemaining: Math.ceil(daysUntilDelivery / DAYS_PER_WEEK),
        };
    }

    const dayInWeek = daysSinceDelivery % DAYS_PER_WEEK;

    return {
        mode: "postpartum",
        weeks: Math.floor(daysSinceDelivery / DAYS_PER_WEEK) + 1,
        days: dayInWeek,
        // The two counters are complements: `previous` counts up from the day the
        // check-in opened, `upcoming` counts down to the next one. Both read 0 on
        // opening day; thereafter they sum to 7.
        previousCheckinDueDays: dayInWeek,
        upcomingCheckinDueDays: (DAYS_PER_WEEK - dayInWeek) % DAYS_PER_WEEK,
        npWeeksRemaining: 0,
    };
};

/**
 * Dotted-path `$set` payload for `user.current_weekdays`.
 *
 * Always update through this rather than assigning the whole subdocument: a whole-object
 * `$set` drops the two due-day counters (and used to leak the non-schema `mode` key).
 */
export const toCurrentWeekdaysUpdate = (state: IPostpartumState): Record<string, number> => ({
    "current_weekdays.weeks": state.weeks,
    "current_weekdays.days": state.days,
    "current_weekdays.previous_checkin_due_days": state.previousCheckinDueDays,
    "current_weekdays.upcoming_checkin_due_days": state.upcomingCheckinDueDays,
});

/**
 * Days left to answer the check-in that is currently open. Derived rather than stored,
 * since it is just the complement of how far into the week she is.
 */
export const daysLeftToAnswer = (state: IPostpartumState): number =>
    state.mode === "postpartum" ? DAYS_PER_WEEK - state.days : 0;

/** True when this week's check-in should exist at all. */
export const isCheckinEligibleWeek = (state: IPostpartumState): boolean =>
    state.mode === "postpartum" && state.weeks >= 1 && state.weeks <= MAX_CHECKIN_WEEK;
