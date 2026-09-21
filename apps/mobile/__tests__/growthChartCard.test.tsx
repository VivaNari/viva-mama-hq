/**
 * The growth card, rendered.
 *
 * Two things are worth checking through a render rather than in isolation: that the four
 * indicator tabs actually swap the chart and its copy, and that every new string resolves
 * against the real i18n bundle — these surfaces added ~45 keys, and a key present in code
 * but missing from en.json shows up here as the raw key text.
 *
 * The safety rules are asserted too. They are product requirements, not styling: a
 * percentile is a number a mother will read as a verdict unless the copy stops her.
 *
 * Run:  npx jest growthChartCard
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Indicator, IndicatorResult } from '@vivamama/growth-standards';

import GrowthChartCard from '../src/components/growth/GrowthChartCard';
import { ChildPoint } from '../src/components/growth/chartGeometry';

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const result = (
    indicator: Indicator,
    overrides: Partial<IndicatorResult> = {},
): IndicatorResult =>
    ({
        indicator,
        status: 'OK',
        value: 7.8,
        key: 6.01,
        z: -0.1604,
        zRaw: -0.1604,
        percentile: 43.6,
        ...overrides,
    }) as IndicatorResult;

const emptySeries = (): Record<Indicator, ChildPoint[]> => ({
    weight_for_age: [],
    length_for_age: [],
    head_circumference_for_age: [],
    weight_for_length: [],
});

const allScored = (): Record<Indicator, IndicatorResult> => ({
    weight_for_age: result('weight_for_age'),
    length_for_age: result('length_for_age'),
    head_circumference_for_age: result('head_circumference_for_age'),
    weight_for_length: result('weight_for_length'),
});

const renderCard = (
    props: Partial<React.ComponentProps<typeof GrowthChartCard>> = {},
) =>
    render(
        <GrowthChartCard
            sex="Male"
            childName="Aarav"
            seriesByIndicator={emptySeries()}
            latestByIndicator={allScored()}
            {...props}
        />,
    );

describe('GrowthChartCard', () => {
    it('opens on weight-for-age with the percentile as an ordinal', () => {
        const { getByText } = renderCard();

        expect(getByText('Weight-for-age')).toBeTruthy();
        expect(getByText('44th percentile')).toBeTruthy();
    });

    /** "44th percentile" is jargon; the sentence under it is what a parent reads. */
    it('explains the percentile in counting terms', () => {
        const { getByText } = renderCard();

        expect(
            getByText(
                'Aarav weighs more than 44 of every 100 babies the same age and sex. Healthy babies sit anywhere across this range.',
            ),
        ).toBeTruthy();
    });

    it('switches indicator, copy and all, from the tab strip', () => {
        const { getByText, queryByText } = renderCard();

        fireEvent.press(getByText('Head'));

        expect(getByText('Head circumference-for-age')).toBeTruthy();
        expect(
            getByText(
                'Head size tracks brain growth in the first two years, which is why it is measured at every visit.',
            ),
        ).toBeTruthy();
        expect(queryByText('Weight-for-age')).toBeNull();
    });

    it('labels the axis in centimetres for weight-for-length', () => {
        const { getByText } = renderCard();

        expect(getByText('Age in months')).toBeTruthy();

        fireEvent.press(getByText('Weight/Length'));

        expect(getByText('Length in cm')).toBeTruthy();
    });

    /**
     * The most common non-scoring case in the first weeks: WHO's weight-for-length table
     * starts at 45 cm. The copy has to be mechanical and reassuring, never alarming.
     */
    it('explains a too-short baby without alarming the mother', () => {
        const { getByText } = renderCard({
            latestByIndicator: {
                ...allScored(),
                weight_for_length: result('weight_for_length', {
                    status: 'OUT_OF_RANGE',
                    value: 2.4,
                    key: 43,
                    z: null,
                    zRaw: null,
                    percentile: null,
                } as Partial<IndicatorResult>),
            },
        });

        fireEvent.press(getByText('Weight/Length'));

        expect(
            getByText(
                'The WHO weight-for-length standard starts at 45 cm. Aarav is 43.0 cm, so this chart begins once they are a little longer.',
            ),
        ).toBeTruthy();
    });

    it('asks for a measurement rather than showing a blank', () => {
        const { getByText } = renderCard({
            latestByIndicator: {
                ...allScored(),
                weight_for_age: result('weight_for_age', {
                    status: 'MISSING_INPUT',
                    value: null,
                    key: null,
                    z: null,
                    zRaw: null,
                    percentile: null,
                } as Partial<IndicatorResult>),
            },
        });

        expect(getByText('Not measured yet')).toBeTruthy();
        expect(getByText('Record a measurement to see where Aarav sits.')).toBeTruthy();
    });

    /** WHO publishes boys' and girls' tables only. */
    it('says why there is no chart when the child has no WHO reference', () => {
        const { getByText } = renderCard({ sex: 'Other' });

        expect(
            getByText(
                'The WHO growth standards are published for boys and girls, so this chart is not available for Aarav.',
            ),
        ).toBeTruthy();
    });

    /**
     * Out in the tails the digits are false precision. The band label replaces the number
     * rather than printing "the 0.003rd percentile", which no parent can act on.
     */
    it('shows a band instead of a number out in the tails', () => {
        const { getByText, queryByText } = renderCard({
            latestByIndicator: {
                ...allScored(),
                weight_for_age: result('weight_for_age', {
                    z: -4.2,
                    zRaw: -4.2,
                    percentile: 0.0013,
                }),
            },
        });

        expect(getByText('Below the 1st')).toBeTruthy();
        expect(queryByText('0th percentile')).toBeNull();
    });

    describe('safety rules', () => {
        /** These are product requirements, not copy preferences. */
        it('always shows the disclaimer and the WHO attribution', () => {
            const { getByText } = renderCard();

            expect(
                getByText(
                    'Percentiles are for information only and are not a medical assessment. Always consult a qualified healthcare professional.',
                ),
            ).toBeTruthy();
            expect(
                getByText('Reference curves: WHO Child Growth Standards (2006).'),
            ).toBeTruthy();
        });

        /**
         * Three children in every hundred are healthy at the 3rd percentile. Calling a
         * position "normal" turns a place on a distribution into a verdict.
         */
        it('never calls a measurement normal or abnormal', () => {
            const { queryByText } = renderCard();

            for (const word of [/\bnormal\b/i, /\babnormal\b/i, /\bhealthy weight\b/i]) {
                expect(queryByText(word)).toBeNull();
            }
        });
    });

    /**
     * The action line under the chart.
     *
     * The comparison sentence itself is never tinted, whichever way the measurement lands.
     * It ends with "healthy babies sit anywhere across this range", so amber on it would
     * have the colour contradict the words, and green on it would grade a position. Only
     * the action carries a colour, and only when there is one.
     */
    describe('the action line', () => {
        const ACTION = 'Worth mentioning at your next clinic visit.';

        const low = (indicator: Indicator) => ({
            ...allScored(),
            [indicator]: result(indicator, { z: -2.4, percentile: 0.8 }),
        });

        it('says nothing at all for a measurement inside the range', () => {
            const { queryByText } = renderCard({ ageMonths: 6 });

            expect(queryByText(ACTION)).toBeNull();
        });

        /** No green anywhere: being average is not an achievement to congratulate. */
        it('offers no reassurance line to balance it', () => {
            const { queryByText } = renderCard({ ageMonths: 6 });

            for (const phrase of [/on track/i, /doing well/i, /looks good/i]) {
                expect(queryByText(phrase)).toBeNull();
            }
        });

        it('appears for a weight below the reference, at any age', () => {
            const { getByText } = renderCard({
                latestByIndicator: low('weight_for_age'),
                ageMonths: 0,
            });

            expect(getByText(ACTION)).toBeTruthy();
            // And the neutral sentence is still there, untouched, beside it.
            expect(getByText(/of every 100 babies the same age and sex/)).toBeTruthy();
        });

        it('holds back a low length in the newborn weeks', () => {
            const { getByText, queryByText } = renderCard({
                latestByIndicator: low('length_for_age'),
                ageMonths: 0,
            });

            fireEvent.press(getByText('Length'));
            expect(queryByText(ACTION)).toBeNull();
        });

        it('offers it for the same length once the child is three months', () => {
            const { getByText } = renderCard({
                latestByIndicator: low('length_for_age'),
                ageMonths: 3,
            });

            fireEvent.press(getByText('Length'));
            expect(getByText(ACTION)).toBeTruthy();
        });

        /**
         * Matches the wellbeing card, which stays silent on both. Flagging them here would
         * re-open that decision through the back door and let the two surfaces disagree.
         */
        it.each(['Head', 'Weight/Length'])('stays silent on the %s tab', (tab) => {
            const { getByText, queryByText } = renderCard({
                latestByIndicator: {
                    ...allScored(),
                    head_circumference_for_age: result('head_circumference_for_age', {
                        z: -2.8,
                        percentile: 0.3,
                    }),
                    weight_for_length: result('weight_for_length', {
                        z: -2.8,
                        percentile: 0.3,
                    }),
                },
                ageMonths: 12,
            });

            fireEvent.press(getByText(tab));
            expect(queryByText(ACTION)).toBeNull();
        });

        /**
         * The extreme sentence carries its own "worth mentioning" tail. With the action
         * line beside it that was the same instruction twice, a word apart, stacked.
         */
        it('does not repeat the instruction the extreme sentence already carries', () => {
            const { getByText, queryByText } = renderCard({
                latestByIndicator: {
                    ...allScored(),
                    length_for_age: result('length_for_age', { z: -3.6, percentile: 0.02 }),
                },
                ageMonths: 4,
            });

            fireEvent.press(getByText('Length'));

            expect(getByText(ACTION)).toBeTruthy();
            expect(getByText(/sits outside the range these curves cover\.$/)).toBeTruthy();
            expect(queryByText(/Worth mentioning at your next visit\./)).toBeNull();
        });

        /** But it keeps that tail where no action line will render to carry it. */
        it('keeps the instruction in the sentence when no action line renders', () => {
            const { getByText } = renderCard({
                latestByIndicator: {
                    ...allScored(),
                    length_for_age: result('length_for_age', { z: -3.6, percentile: 0.02 }),
                },
                ageMonths: 1,
            });

            fireEvent.press(getByText('Length'));

            expect(getByText(/Worth mentioning at your next visit\./)).toBeTruthy();
        });

        /** A large baby is not a finding with an action behind it. */
        it('never appears for a measurement above the reference', () => {
            const { queryByText } = renderCard({
                latestByIndicator: {
                    ...allScored(),
                    weight_for_age: result('weight_for_age', { z: 3.2, percentile: 99.9 }),
                },
                ageMonths: 6,
            });

            expect(queryByText(ACTION)).toBeNull();
        });
    });
});
