import { CareRoute } from '@vivamama/care-schedules';

import { scheduleFor } from '../src/utils/careSchedule';
import { comingUp, reminderDate, schedulePlace } from '../src/utils/comingUp';

const context = { deliveryType: null, deliveryOutcome: null, hasGdm: false };
const anc = (route: CareRoute) => scheduleFor('anc', route, context);
const pnc = (route: CareRoute) => scheduleFor('pnc', route, context);
const ids = (result: { rows: { id: string }[] }) => result.rows.map(row => row.id);

describe('comingUp', () => {
    it('gives a public woman at week 28 a visit item and PMSMA', () => {
        const result = comingUp(anc('public'), 28, new Set(['g2e']));
        expect(ids(result)).toEqual(['g3c', 'pmsma']);
        expect(result.rows[0]?.startsIn).toBe(0);
        expect(result.rows[1]?.dayOfMonth).toBe(9);
    });

    it('gives a private woman at week 28 the two earliest items, with no PMSMA', () => {
        const result = comingUp(anc('private'), 28, new Set());
        expect(ids(result)).toEqual(['p2b', 'p3a']);
    });

    it('drops what she has ticked', () => {
        expect(ids(comingUp(anc('private'), 28, new Set(['p2b'])))).toEqual(['p3a', 'p3b']);
    });

    it('does not nag a late joiner about windows that have passed', () => {
        const result = comingUp(anc('public'), 30, new Set());
        expect(ids(result)).not.toContain('g1a');
        expect(ids(result)).not.toContain('g2e');
    });

    it('says how far off an upcoming item is', () => {
        const [row] = comingUp(anc('private'), 14, new Set()).rows;
        expect(row?.id).toBe('p2c');
        expect(row?.startsIn).toBe(1);
    });

    it('leaves PMSMA out before week 13 and after week 40', () => {
        expect(ids(comingUp(anc('public'), 10, new Set()))).not.toContain('pmsma');
        expect(ids(comingUp(anc('public'), 41, new Set()))).not.toContain('pmsma');
    });

    it('counts what the card has no room for', () => {
        const result = comingUp(pnc('public'), 0, new Set());
        expect(result.rows).toHaveLength(2);
        expect(result.more).toBeGreaterThan(0);
    });

    it('puts the next visit ahead of daily tablets', () => {
        expect(ids(comingUp(pnc('public'), 5, new Set()))).toEqual(['n2b', 'n2c']);
    });

    it('still shows the tablets once no visit is close', () => {
        const rows = comingUp(pnc('public'), 57, new Set(['n5a', 'n5b', 'n5c', 'n5d', 'n5e', 'n5f'])).rows;
        expect(rows.map(row => row.id)).toEqual(['n4a', 'n4b']);
    });

    it('is empty when everything is done or past', () => {
        expect(comingUp(pnc('public'), 800, new Set())).toEqual({ rows: [], more: 0 });
    });

    it('keeps her schedule going to 24 months', () => {
        expect(ids(comingUp(pnc('private'), 720, new Set()))).toEqual(['m5h']);
    });
});

describe('schedulePlace', () => {
    const base = { stage: 'pregnancy', row: {}, helpSet: 'pregnancyLate', progress: 0 } as any;

    it('is the ANC schedule while pregnant', () => {
        const place = schedulePlace({ ...base, kind: 'pregnant', week: 28, daysToDue: 84, inLabour: false, awaitingBirth: false });
        expect(place).toEqual({ kind: 'anc', at: 28 });
    });

    it('is the start of the PNC schedule in labour', () => {
        const place = schedulePlace({ ...base, kind: 'pregnant', week: 39, daysToDue: 7, inLabour: true, awaitingBirth: false });
        expect(place).toEqual({ kind: 'pnc', at: 0 });
    });

    it('is the PNC schedule by day after the birth', () => {
        expect(schedulePlace({ ...base, kind: 'postpartum', day: 12 })).toEqual({ kind: 'pnc', at: 12 });
    });

    it('is nothing after a loss', () => {
        expect(schedulePlace({ kind: 'loss', helpSet: 'motherLater' })).toBeNull();
    });
});

describe('reminderDate', () => {
    // 09:00 IST on 2026-11-06.
    const NOW = new Date('2026-11-06T03:30:00.000Z');
    const row = { id: 'x', start: 0, end: 0, startsIn: 0 };

    it('is tomorrow for something already due', () => {
        expect(reminderDate(row, 'anc', NOW)).toBe('2026-11-07');
    });

    it('is when the window opens, in weeks or days', () => {
        expect(reminderDate({ ...row, startsIn: 2 }, 'anc', NOW)).toBe('2026-11-20');
        expect(reminderDate({ ...row, startsIn: 2 }, 'pnc', NOW)).toBe('2026-11-08');
    });

    it('is the next 9th for a monthly row', () => {
        expect(reminderDate({ ...row, dayOfMonth: 9 }, 'anc', NOW)).toBe('2026-11-09');
        expect(reminderDate({ ...row, dayOfMonth: 9 }, 'anc', new Date('2026-11-20T03:30:00.000Z'))).toBe('2026-12-09');
    });
});
