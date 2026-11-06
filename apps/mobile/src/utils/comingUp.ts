import { CareKind, CareSchedule } from '@vivamama/care-schedules';

import { JourneyPosition } from './journeyPosition';

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** The card holds two rows, as in the design. */
const CARD_ROWS = 2;

export interface ComingUpRow {
    id: string;
    /** Weeks on the ANC schedule, days on the PNC schedule. */
    start: number;
    end: number;
    /** How far off it is, in the same unit. 0 means it is due now. */
    startsIn: number;
    /** Set on a row that repeats on this day of the month and cannot be ticked. */
    dayOfMonth?: number;
}

export interface ComingUp {
    rows: ComingUpRow[];
    /** Still to come but not shown; the full schedule has them. */
    more: number;
}

/** Which schedule she is on and how far along it. Null when she has no schedule. */
export const schedulePlace = (position: JourneyPosition): { kind: CareKind; at: number } | null => {
    if (position.kind === 'postpartum') return { kind: 'pnc', at: position.day };
    if (position.kind !== 'pregnant') return null;
    // In labour, what comes next is the first checks after the birth.
    return position.inLabour ? { kind: 'pnc', at: 0 } : { kind: 'anc', at: position.week };
};

/**
 * The next steps from her recommended schedule. Ticked items are dropped, and so are items
 * whose window has passed: someone who joins late is shown what is still due, not nagged
 * about what she missed.
 *
 * A monthly row such as PMSMA takes the second place while it is in its window, because it
 * would otherwise always lose out to the visit items.
 */
export const comingUp = (schedule: CareSchedule, at: number, doneIds: ReadonlySet<string>): ComingUp => {
    const items: ComingUpRow[] = schedule.groups
        .flatMap(group => group.items)
        .filter(item => !doneIds.has(item.id) && item.end >= at)
        .sort((a, b) => Number(!!a.ongoing) - Number(!!b.ongoing) || a.start - b.start || a.end - b.end)
        .map(item => ({
            id: item.id,
            start: item.start,
            end: item.end,
            startsIn: Math.max(item.start - at, 0),
        }));

    const monthly: ComingUpRow[] = schedule.recurring
        .filter(item => at >= item.start && at <= item.end)
        .map(item => ({
            id: item.id,
            start: item.start,
            end: item.end,
            startsIn: 0,
            dayOfMonth: item.dayOfMonth,
        }));

    const rows =
        monthly.length > 0
            ? [...items.slice(0, CARD_ROWS - monthly.length), ...monthly].slice(0, CARD_ROWS)
            : items.slice(0, CARD_ROWS);

    return { rows, more: items.length + monthly.length - rows.length };
};

/** "YYYY-MM-DD" on the IST calendar. */
const istDateKey = (time: number): string => new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * The day a "Remind me" should fire: when the item's window opens, the next such day of the
 * month for a monthly row, or tomorrow for something already due.
 */
export const reminderDate = (
    row: ComingUpRow,
    kind: CareKind,
    now: Date = new Date(),
): string => {
    const tomorrow = now.getTime() + MS_PER_DAY;

    if (row.dayOfMonth) {
        const [year, month, day] = istDateKey(now.getTime()).split('-').map(Number) as [number, number, number];
        // Today's date has nothing left to remind about, so it rolls to next month as well.
        const monthsAhead = day < row.dayOfMonth ? 0 : 1;
        return new Date(Date.UTC(year, month - 1 + monthsAhead, row.dayOfMonth)).toISOString().slice(0, 10);
    }
    if (row.startsIn === 0) return istDateKey(tomorrow);

    const daysAhead = kind === 'anc' ? row.startsIn * 7 : row.startsIn;
    return istDateKey(now.getTime() + daysAhead * MS_PER_DAY);
};
