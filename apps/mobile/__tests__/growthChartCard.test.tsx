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
});
