import {
    IMotherReminder,
    REMINDER_SEND_TOLERANCE_MINUTES,
    REMINDER_SLOT_MINUTES,
    REMINDER_TIMES,
    TReminderTime,
} from "../../types/reminder.types";
import { formatDateToISO, getISTCalendarDate, parseISODateToStartOfDay } from "../date/date.service";

const DAY_MS = 86_400_000;
const IST_OFFSET_MINUTES = 330;

/** The IST calendar day ("YYYY-MM-DD") and minutes past IST midnight for an instant. */
export const istClock = (now: Date = new Date()): { today: string; minutes: number } => {
    const wall = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
    return {
        today: formatDateToISO(getISTCalendarDate(now)),
        minutes: wall.getUTCHours() * 60 + wall.getUTCMinutes(),
    };
};

/** "YYYY-MM-DD" plus a number of days. */
export const addDays = (day: string, days: number): string =>
    formatDateToISO(new Date((parseISODateToStartOfDay(day) as Date).getTime() + days * DAY_MS));

const weekdayOf = (day: string): number => (parseISODateToStartOfDay(day) as Date).getUTCDay();

const daysBetween = (from: string, to: string): number =>
    Math.round(
        ((parseISODateToStartOfDay(to) as Date).getTime() -
            (parseISODateToStartOfDay(from) as Date).getTime()) /
            DAY_MS,
    );

/** Whether a reminder repeats on this IST day. The time of day is checked separately. */
export const isDueOn = (
    reminder: Pick<IMotherReminder, "frequency" | "weekdays" | "startDate" | "endDate">,
    day: string,
): boolean => {
    if (day < reminder.startDate) return false;
    if (reminder.endDate && day > reminder.endDate) return false;

    switch (reminder.frequency) {
        case "daily":
            return true;
        case "alternateDays":
            return daysBetween(reminder.startDate, day) % 2 === 0;
        case "weekly":
            return weekdayOf(day) === weekdayOf(reminder.startDate);
        case "custom":
            return reminder.weekdays.includes(weekdayOf(day));
        default:
            return false;
    }
};

/** The slots whose time has passed within the send tolerance. */
export const slotsToSend = (minutes: number): TReminderTime[] =>
    REMINDER_TIMES.filter((slot) => {
        const lateBy = minutes - REMINDER_SLOT_MINUTES[slot];
        return lateBy >= 0 && lateBy <= REMINDER_SEND_TOLERANCE_MINUTES;
    });

export const slotPassed = (slot: TReminderTime, minutes: number): boolean =>
    minutes >= REMINDER_SLOT_MINUTES[slot];
