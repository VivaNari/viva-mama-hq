import { DeliveryOutcomeEnum, UserCategoryEnum } from '../src/types/user.types';
import {
    JourneyUser,
    babyRowBeforeBirth,
    babyRowFromBirth,
    journeyPosition,
} from '../src/utils/journeyPosition';

// 09:00 IST on 2026-11-06.
const NOW = new Date('2026-11-06T03:30:00.000Z');
const offsetDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

const pregnant = (daysToDue: number, extra: object = {}): JourneyUser => ({
    user_category: UserCategoryEnum.NP,
    onboarding_data: { delivery_date: offsetDays(daysToDue), ...extra },
});
const postpartum = (day: number, extra: object = {}): JourneyUser => ({
    user_category: UserCategoryEnum.PP,
    onboarding_data: { delivery_date: offsetDays(-day), ...extra },
});

const rowOf = (user: JourneyUser) => {
    const position = journeyPosition(user, NOW);
    if (position.kind !== 'pregnant' && position.kind !== 'postpartum') throw new Error(position.kind);
    return position.row.id;
};
const stageOf = (user: JourneyUser) => (journeyPosition(user, NOW) as any).stage;

describe('during pregnancy', () => {
    it('shows the row for her gestational week', () => {
        expect(rowOf(pregnant(12 * 7))).toBe('M-P28');
        expect(stageOf(pregnant(12 * 7))).toBe('pregnancy');
    });

    it('clamps to the first and last pregnancy rows', () => {
        expect(rowOf(pregnant(38 * 7))).toBe('M-P04');
        expect(rowOf(pregnant(0))).toBe('M-P40');
    });

    it('moves to the next row on the day the week turns', () => {
        expect(rowOf(pregnant(12 * 7 - 1))).toBe('M-P28');
        expect(rowOf(pregnant(12 * 7 + 1))).toBe('M-P27');
    });
});

describe('labour', () => {
    it('shows M-D1 once she taps, in the Delivery stage', () => {
        const user = pregnant(3, { labour_started_at: offsetDays(0) });
        expect(rowOf(user)).toBe('M-D1');
        expect(stageOf(user)).toBe('delivery');
    });

    it('goes back to pregnancy content after a false alarm', () => {
        expect(rowOf(pregnant(3, { labour_started_at: offsetDays(-5) }))).toBe('M-P39');
    });
});

describe('after the birth', () => {
    it.each([
        [0, 'M-D2', 'delivery'],
        [1, 'M-D3', 'delivery'],
        [2, 'M-D3', 'delivery'],
        [3, 'M-PP1', 'acutePostpartum'],
        [7, 'M-PP1', 'acutePostpartum'],
        [8, 'M-PP2', 'acutePostpartum'],
        [42, 'M-PP6', 'acutePostpartum'],
        [43, 'M-PP6', 'latePostpartum'],
        [69, 'M-PP6', 'latePostpartum'],
        [70, 'M-T10w', 'latePostpartum'],
        [97, 'M-T10w', 'latePostpartum'],
        [98, 'M-T14w', 'latePostpartum'],
        [365, 'M-T12m', 'latePostpartum'],
        [457, 'M-T15m', 'motherhood'],
        [800, 'M-T24m', 'motherhood'],
    ])('on day %i shows %s in %s', (day, row, stage) => {
        expect(rowOf(postpartum(day))).toBe(row);
        expect(stageOf(postpartum(day))).toBe(stage);
    });
});

describe('a date only the due-date job set', () => {
    const estimated = (daysPast: number) => postpartum(daysPast, { delivery_date_estimated: true });

    it('stays on pregnancy content, and asks', () => {
        const position = journeyPosition(estimated(2), NOW) as any;
        expect(position.kind).toBe('pregnant');
        expect(position.row.id).toBe('M-P40');
        expect(position.awaitingBirth).toBe(true);
    });

    it('moves on to M-P41 and holds there', () => {
        expect(rowOf(estimated(7))).toBe('M-P41');
        expect(rowOf(estimated(40))).toBe('M-P41');
    });

    it('shows postpartum content once the date is confirmed', () => {
        expect(rowOf(postpartum(5, { delivery_date_estimated: false }))).toBe('M-PP1');
    });
});

describe('when no stage applies', () => {
    it('gives no stage content after a stillbirth, whatever the date', () => {
        const position = journeyPosition(postpartum(10, { delivery_outcome: DeliveryOutcomeEnum.STILL_BIRTH }), NOW);
        expect(position.kind).toBe('loss');
        expect(position.helpSet).toBe('motherLater');
    });

    it('gives a plain card to someone neither pregnant nor postpartum', () => {
        expect(journeyPosition({ user_category: UserCategoryEnum.NN }, NOW).kind).toBe('notPregnant');
        expect(journeyPosition(null, NOW).kind).toBe('notPregnant');
    });

    it('does not guess without a date', () => {
        expect(journeyPosition({ user_category: UserCategoryEnum.NP, onboarding_data: {} }, NOW).kind).toBe('noDates');
    });
});

describe('help sets', () => {
    it.each([
        [pregnant(30 * 7), 'pregnancyEarly'],
        [pregnant(7), 'pregnancyLate'],
        [postpartum(10), 'postpartum'],
        [postpartum(500), 'motherLater'],
    ])('picks the set for the stage', (user, set) => {
        expect(journeyPosition(user, NOW).helpSet).toBe(set);
    });
});

describe('the baby rows', () => {
    it('follows her gestational week before birth', () => {
        expect(babyRowBeforeBirth(28).id).toBe('B-P28');
        expect(babyRowBeforeBirth(2).id).toBe('B-P04');
    });

    it.each([
        [0, 'B-BIRTH'],
        [1, 'B-NB1'],
        [7, 'B-NB1'],
        [8, 'B-NB2'],
        [42, 'B-NB6'],
        [50, 'B-NB6'],
        [70, 'B-10w'],
        [190, 'B-6m'],
        [500, 'B-16-18m'],
        [900, 'B-24m'],
    ])('on day %i shows %s', (day, row) => {
        expect(babyRowFromBirth(day).id).toBe(row);
    });
});
