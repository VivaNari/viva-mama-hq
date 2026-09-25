import { GrowthBand, GrowthStatus, Indicator } from '@vivamama/growth-standards';

/**
 * Mapping from the standards package's identifiers to the strings a mother reads.
 *
 * Kept separate from the chart so the wording can be reviewed on its own. The rules this
 * copy follows, which are not negotiable:
 *
 *  - never say "normal" or "abnormal". Three children in every hundred are healthy at the
 *    3rd percentile; the word turns a position into a verdict;
 *  - never colour-code a percentile as good or bad;
 *  - explain what the number means in counting terms ("heavier than 44 of every 100"),
 *    because "44th percentile" is jargon;
 *  - every failure to score gets its own sentence, so nothing ever reads as a blank.
 */

export const INDICATOR_ORDER: readonly Indicator[] = [
    'weight_for_age',
    'length_for_age',
    'head_circumference_for_age',
    'weight_for_length',
];

/** Short label for the tab strip. */
export const indicatorTabKey = (indicator: Indicator): string =>
    `infant.growth.tab.${indicator}`;

/** Full title, used as the card heading. */
export const indicatorTitleKey = (indicator: Indicator): string =>
    `infant.growth.title.${indicator}`;

/** What this indicator is for — one sentence, plain language. */
export const indicatorExplainerKey = (indicator: Indicator): string =>
    `infant.growth.explainer.${indicator}`;

/**
 * The comparison sentence, phrased per indicator because the verb changes:
 * heavier / longer / larger.
 */
export const indicatorComparisonKey = (indicator: Indicator): string =>
    `infant.growth.comparison.${indicator}`;

/** Why an indicator has no number. One key per non-OK status. */
export const statusMessageKey = (
    indicator: Indicator,
    status: Exclude<GrowthStatus, 'OK'>,
): string => {
    if (status === 'OUT_OF_RANGE' && indicator === 'weight_for_length') {
        // By far the most common out-of-range case: WHO's weight-for-length table starts at
        // 45 cm, so newborns and preterm babies fall outside it for the first weeks. It gets
        // its own reassuring wording rather than the generic one.
        return 'infant.growth.status.weightForLengthTooShort';
    }

    return `infant.growth.status.${status}`;
};

/** Band label, for when a percentile is too extreme to quote as a number. */
export const bandLabelKey = (band: GrowthBand): string => `infant.growth.band.${band}`;

/**
 * English ordinal suffix for a percentile.
 *
 * Lives here rather than in the locale file because it is arithmetic, not translation:
 * 1st/2nd/3rd/11th/21st cannot be expressed as an interpolation. Locales that do not use
 * ordinal suffixes simply ignore the value — the Hindi string is phrased to not need it.
 */
export const ordinalSuffix = (value: number): string => {
    const whole = Math.round(value);
    const lastTwo = whole % 100;

    // 11th, 12th, 13th break the pattern the last digit would otherwise give.
    if (lastTwo >= 11 && lastTwo <= 13) return 'th';

    switch (whole % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
};
