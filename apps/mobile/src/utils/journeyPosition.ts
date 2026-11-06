import { BABY_ROWS, MOTHER_ROWS } from '../data/journey/journeyRows';
import {
    JourneyBabyRow,
    JourneyHelpSet,
    JourneyMotherRow,
    JourneyStage,
} from '../data/journey/journeyTypes';
import { DeliveryOutcomeEnum, UserCategoryEnum } from '../types/user.types';

const MS_PER_DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const FULL_TERM_DAYS = 280;

/** Labour rarely outlasts this. After it, a false alarm must not leave her stuck on M-D1. */
const LABOUR_WINDOW_DAYS = 3;
/** Stays on the Delivery rows for the minimum hospital stay after a normal birth. */
const DELIVERY_STAGE_LAST_DAY = 2;
const ACUTE_POSTPARTUM_LAST_DAY = 42;
const MOTHERHOOD_FIRST_DAY = 365;
const JOURNEY_LAST_DAY = 731;

const FIRST_PREGNANCY_ROW_WEEK = 4;
const LAST_PREGNANCY_ROW_WEEK = 41;

/** Whole IST calendar days from `from` to `to`, as the backend's postpartum state counts. */
export const istDaysBetween = (from: Date, to: Date): number =>
    Math.floor((to.getTime() + IST_OFFSET_MS) / MS_PER_DAY) -
    Math.floor((from.getTime() + IST_OFFSET_MS) / MS_PER_DAY);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface JourneyUser {
    user_category?: UserCategoryEnum | null;
    onboarding_data?: {
        delivery_date?: Date | string | null;
        delivery_date_estimated?: boolean;
        delivery_outcome?: DeliveryOutcomeEnum | null;
        labour_started_at?: string | Date | null;
    } | null;
}

export type JourneyPosition =
    /** Neither pregnant nor postpartum: no row applies. */
    | { kind: 'notPregnant'; helpSet: JourneyHelpSet }
    /** Pregnant or postpartum, but no date to place her with. */
    | { kind: 'noDates'; helpSet: JourneyHelpSet }
    /** She lost her baby: no stage content and no baby view. */
    | { kind: 'loss'; helpSet: JourneyHelpSet }
    | {
          kind: 'pregnant';
          stage: JourneyStage;
          row: JourneyMotherRow;
          helpSet: JourneyHelpSet;
          week: number;
          daysToDue: number;
          inLabour: boolean;
          /** The due-date job moved her on, but she has not told us the baby is here. */
          awaitingBirth: boolean;
          progress: number;
      }
    | {
          kind: 'postpartum';
          stage: JourneyStage;
          row: JourneyMotherRow;
          helpSet: JourneyHelpSet;
          /** Days since the birth; the day of birth is day 0. */
          day: number;
          progress: number;
      };

const rowById = (id: string): JourneyMotherRow => {
    const row = MOTHER_ROWS.find(candidate => candidate.id === id);
    if (!row) throw new Error(`No journey row ${id}`);
    return row;
};

const pregnancyRow = (week: number): JourneyMotherRow =>
    rowById(`M-P${String(clamp(week, FIRST_PREGNANCY_ROW_WEEK, LAST_PREGNANCY_ROW_WEEK)).padStart(2, '0')}`);

/**
 * After day 42 the row for the latest touchpoint reached stays until the next one, so
 * M-PP6 holds until 10 weeks.
 */
const postpartumRow = (day: number): JourneyMotherRow => {
    if (day === 0) return rowById('M-D2');
    if (day <= DELIVERY_STAGE_LAST_DAY) return rowById('M-D3');
    if (day <= ACUTE_POSTPARTUM_LAST_DAY) return rowById(`M-PP${Math.ceil(day / 7)}`);

    const reached = MOTHER_ROWS.filter(row => row.when.unit === 'day' && row.when.value <= day);
    return reached[reached.length - 1] ?? rowById('M-PP6');
};

const postpartumStage = (day: number, row: JourneyMotherRow): JourneyStage =>
    // M-PP6 holds into the seventh week, by when she is in Late postpartum.
    day > ACUTE_POSTPARTUM_LAST_DAY && row.stage === 'acutePostpartum' ? 'latePostpartum' : row.stage;

const postpartumProgress = (day: number, stage: JourneyStage): number => {
    if (stage === 'delivery') return 0.5;
    if (stage === 'acutePostpartum') return day / ACUTE_POSTPARTUM_LAST_DAY;
    if (stage === 'latePostpartum') {
        return (day - ACUTE_POSTPARTUM_LAST_DAY) / (MOTHERHOOD_FIRST_DAY - ACUTE_POSTPARTUM_LAST_DAY);
    }
    return clamp((day - MOTHERHOOD_FIRST_DAY) / (JOURNEY_LAST_DAY - MOTHERHOOD_FIRST_DAY), 0, 1);
};

/**
 * Where she is on the 1000-day journey, worked out each time and never stored.
 * `user_category` stays what the rest of the app reads; this only chooses Journey content.
 */
export const journeyPosition = (user: JourneyUser | null | undefined, now: Date = new Date()): JourneyPosition => {
    const category = user?.user_category;
    const data = user?.onboarding_data;

    if (category !== UserCategoryEnum.NP && category !== UserCategoryEnum.PP) {
        return { kind: 'notPregnant', helpSet: 'motherLater' };
    }
    if (category === UserCategoryEnum.PP && data?.delivery_outcome === DeliveryOutcomeEnum.STILL_BIRTH) {
        return { kind: 'loss', helpSet: 'motherLater' };
    }
    if (!data?.delivery_date) {
        return { kind: 'noDates', helpSet: 'motherLater' };
    }

    const deliveryDate = new Date(data.delivery_date);
    const daysSinceDate = istDaysBetween(deliveryDate, now);

    if (category === UserCategoryEnum.PP && !data.delivery_date_estimated) {
        const day = Math.max(daysSinceDate, 0);
        const row = postpartumRow(day);
        const stage = postpartumStage(day, row);
        return {
            kind: 'postpartum',
            stage,
            row,
            helpSet: row.helpSet,
            day,
            progress: clamp(postpartumProgress(day, stage), 0, 1),
        };
    }

    // Still pregnant as far as Journey knows, even if the due date has passed.
    const gestationalDays = Math.max(FULL_TERM_DAYS + daysSinceDate, 0);
    const week = Math.floor(gestationalDays / 7);
    const labourStarted = data.labour_started_at ? new Date(data.labour_started_at) : null;
    const inLabour = !!labourStarted && istDaysBetween(labourStarted, now) <= LABOUR_WINDOW_DAYS;
    const row = inLabour ? rowById('M-D1') : pregnancyRow(week);

    return {
        kind: 'pregnant',
        stage: row.stage,
        row,
        helpSet: row.helpSet,
        week,
        daysToDue: -daysSinceDate,
        inLabour,
        awaitingBirth: category === UserCategoryEnum.PP,
        progress: inLabour ? 0.1 : clamp(week / 40, 0, 1),
    };
};

/** The baby's row before birth, by her gestational week. */
export const babyRowBeforeBirth = (week: number): JourneyBabyRow => {
    const id = `B-P${String(clamp(week, FIRST_PREGNANCY_ROW_WEEK, LAST_PREGNANCY_ROW_WEEK)).padStart(2, '0')}`;
    return BABY_ROWS.find(row => row.id === id) as JourneyBabyRow;
};

/** The baby's row from the birth, by days since it. Same holding rule as the mother's. */
export const babyRowFromBirth = (day: number): JourneyBabyRow => {
    const safeDay = Math.max(day, 0);
    if (safeDay <= ACUTE_POSTPARTUM_LAST_DAY && safeDay > 0) {
        return BABY_ROWS.find(row => row.id === `B-NB${Math.ceil(safeDay / 7)}`) as JourneyBabyRow;
    }
    const reached = BABY_ROWS.filter(row => row.when.unit === 'day' && row.when.value <= safeDay);
    // Day 0 is B-BIRTH. Days 43 to 69 hold on B-NB6, not on the birth row before them.
    if (safeDay > ACUTE_POSTPARTUM_LAST_DAY && reached.length === 1) {
        return BABY_ROWS.find(row => row.id === 'B-NB6') as JourneyBabyRow;
    }
    return reached[reached.length - 1] as JourneyBabyRow;
};
