/** The shapes of the generated `journeyRows.ts`. */

export type JourneyStage =
    | 'pregnancy'
    | 'delivery'
    | 'acutePostpartum'
    | 'latePostpartum'
    | 'motherhood';

export const JOURNEY_STAGES: JourneyStage[] = [
    'pregnancy',
    'delivery',
    'acutePostpartum',
    'latePostpartum',
    'motherhood',
];

export type JourneyHelpSet =
    | 'pregnancyEarly'
    | 'pregnancyLate'
    | 'postpartum'
    | 'motherLater'
    | 'newborn'
    | 'child';

/**
 * When a row applies. `pregnancyWeek` is her gestational week. `postpartumWeek` is 1-indexed,
 * so week 1 is days 0-6. `day` is days since birth, and that row holds until the next one.
 * `delivery` is the row's position in the labour-to-discharge sequence.
 */
export interface JourneyWhen {
    unit: 'pregnancyWeek' | 'delivery' | 'postpartumWeek' | 'day';
    value: number;
}

export type RememberAction =
    | 'medicine'
    | 'reminders'
    | 'mood'
    | 'kicks'
    | 'records'
    | 'summary'
    | 'library'
    | 'experts'
    | 'chat'
    | 'call'
    | 'tick';

export type BabyLogAction = 'feeding' | 'growth' | 'vaccination' | 'milestone';

export interface JourneyMotherRow {
    id: string;
    stage: JourneyStage;
    when: JourneyWhen;
    helpSet: JourneyHelpSet;
    remember: { govt: RememberAction[]; private: RememberAction[] };
}

export interface JourneyBabyRow {
    id: string;
    when: JourneyWhen;
    helpSet: JourneyHelpSet;
    /** What Card 3 opens from the birth. Null before birth, when it opens nothing. */
    log: { govt: BabyLogAction; private: BabyLogAction } | null;
}
