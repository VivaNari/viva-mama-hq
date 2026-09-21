/**
 * The Infant dashboard tab — the surface the growth chart is actually shown on.
 *
 * Covered here because it is where the pieces meet: the selected child drives a fetch, the
 * fetch drives the chart, and the same child has to reach the log screens as route params.
 * Every piece has its own test; none of them prove they are wired to each other.
 *
 * Run:  npx jest dashboardInfantTab
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import DashboardInfantTab from '../src/components/dashboard/DashboardInfantTab';
import { IGrowthLog } from '../src/types/growthLog.types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    // Stands in for React Navigation's useFocusEffect, which fires the effect while the
    // screen is focused. Screens are always focused under test, so running it as a plain
    // effect — cleanup and all — matches the real behaviour closely enough.
    useFocusEffect: (effect: () => void | (() => void)) =>
        require('react').useEffect(effect, [effect]),
}));

const { getGrowthLogs } = require('../src/api/infantGrowth.api');

jest.mock('../src/api/infantGrowth.api', () => ({
    getGrowthLogs: jest.fn(),
    upsertGrowthLog: jest.fn(),
    deleteGrowthLog: jest.fn(),
}));

const { getInfantWellbeing } = require('../src/api/infantWellbeing.api');

jest.mock('../src/api/infantWellbeing.api', () => ({
    getInfantWellbeing: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

/** A boy roughly six months old, matching the reference worked example. */
const dobSixMonthsAgo = new Date(
    Date.now() - 183 * 24 * 60 * 60 * 1000,
).toISOString();

const userData = (overrides: object = {}): any => ({
    user: {
        childs: [
            {
                _id: 'child-1',
                name: 'Aarav',
                date_of_birth: dobSixMonthsAgo,
                sex: 'Male',
                onboarding_status: 'COMPLETED',
                birth_measurements: {
                    weight_grams: 3300,
                    length_cm: 50,
                    head_circumference_cm: 34.5,
                },
                ...overrides,
            },
        ],
    },
});

const growthLog = (): IGrowthLog =>
    ({
        _id: 'g1',
        childId: 'child-1',
        measuredOn: '2026-09-13',
        ageInDays: 183,
        sex: 'Male',
        measurements: { weight_kg: 7.8, length_cm: 67.6, head_circumference_cm: 43.3 },
        percentiles: {
            weight_for_age: {
                status: 'OK',
                value: 7.8,
                key: 6.01,
                z: -0.1604,
                zRaw: -0.1604,
                percentile: 43.6,
            },
            length_for_age: {
                status: 'OK',
                value: 67.6,
                key: 6.01,
                z: 0.1,
                zRaw: 0.1,
                percentile: 54,
            },
            head_circumference_for_age: {
                status: 'OK',
                value: 43.3,
                key: 6.01,
                z: -0.2,
                zRaw: -0.2,
                percentile: 42,
            },
            weight_for_length: {
                status: 'OK',
                value: 7.8,
                key: 67.6,
                z: -0.3,
                zRaw: -0.3,
                percentile: 38,
            },
        },
        standard: { source: 'WHO-2006', version: 'who-2006.1' },
        createdAt: '',
        updatedAt: '',
    }) as IGrowthLog;

beforeEach(() => {
    jest.clearAllMocks();
    getGrowthLogs.mockResolvedValue([]);
    // Card hidden unless a test asks for it, so the existing expectations stay untouched.
    getInfantWellbeing.mockRejectedValue(new Error('not under test'));
});

/** A wellbeing payload in the shape the API returns it. */
const wellbeing = (over: object = {}): any => ({
    childId: 'child-1',
    status: 'on_track',
    firstRun: false,
    summaryKey: 'infant.wellbeing.summary.onTrack',
    tiles: [
        {
            domain: 'growth',
            status: 'on_track',
            reason: 'tracked',
            valueKey: 'infant.wellbeing.growth.percentile',
            valueParams: { percentile: 42 },
        },
        {
            domain: 'feeding',
            status: 'on_track',
            reason: 'feeds_on_track',
            valueKey: 'infant.wellbeing.feeding.today',
            valueParams: { count: 3 },
        },
        {
            domain: 'vaccines',
            status: 'on_track',
            reason: 'vaccines_upToDate',
            valueKey: 'infant.wellbeing.vaccines.next',
            valueParams: { visit: '6w' },
        },
        {
            domain: 'milestones',
            status: 'on_track',
            reason: 'milestones_logged',
            valueKey: 'infant.wellbeing.milestones.progress',
            valueParams: { logged: 2, total: 4 },
        },
    ],
    ...over,
});

describe('DashboardInfantTab', () => {
    it('prompts to add a baby when there are no children', () => {
        const { getByText } = render(<DashboardInfantTab userData={{ user: { childs: [] } } as any} />);

        expect(getByText('No baby added yet')).toBeTruthy();
        expect(getGrowthLogs).not.toHaveBeenCalled();
    });

    it('fetches growth logs for the selected child', async () => {
        render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalledWith('child-1'));
    });

    it('shows the stored percentile on the growth card', async () => {
        getGrowthLogs.mockResolvedValue([growthLog()]);

        const { getByText } = render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getByText('44th percentile')).toBeTruthy());
        expect(getByText('Weight-for-age')).toBeTruthy();
    });

    /** The stat tiles should track the newest measurement, not the birth numbers. */
    it('shows the latest measurements rather than the birth ones', async () => {
        getGrowthLogs.mockResolvedValue([growthLog()]);

        const { getByText, queryByText } = render(<DashboardInfantTab userData={userData()} />);

        // 7.8 kg stored, displayed in the grams a clinic reports.
        await waitFor(() => expect(getByText('7800 grams')).toBeTruthy());
        expect(getByText('67.6 cm')).toBeTruthy();
        expect(queryByText('3300 grams')).toBeNull();
    });

    it('falls back to the birth measurements for a child with no logs yet', async () => {
        const { getByText } = render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getByText('3300 grams')).toBeTruthy());
        expect(getByText('50 cm')).toBeTruthy();
    });

    /**
     * A failed fetch leaves the chart drawing its reference curves with no child points —
     * the same thing a child with no logs sees. It must not blank the tab.
     */
    it('still renders the card when the fetch fails', async () => {
        getGrowthLogs.mockRejectedValue(new Error('offline'));

        const { getByText } = render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getByText('Weight-for-age')).toBeTruthy());
        expect(getByText('Not measured yet')).toBeTruthy();
    });

    /** WHO publishes boys' and girls' tables only; the card must say so, not break. */
    it('explains itself for a child whose sex has no WHO reference', async () => {
        const { getByText } = render(
            <DashboardInfantTab userData={userData({ sex: 'Other' })} />,
        );

        await waitFor(() =>
            expect(
                getByText(
                    'The WHO growth standards are published for boys and girls, so this chart is not available for Aarav.',
                ),
            ).toBeTruthy(),
        );
    });

    it('renders the five infant check-in tiles', async () => {
        const { getByText } = render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getByText('Growth Log')).toBeTruthy());
        for (const tile of ['Feeding Log', 'Diaper Log', 'Vaccination Log', 'Milestone Log']) {
            expect(getByText(tile)).toBeTruthy();
        }
    });

    describe('the wellbeing card', () => {
        it('shows one status and the four domain tiles', async () => {
            getInfantWellbeing.mockResolvedValue(wellbeing());

            const { getByText } = render(<DashboardInfantTab userData={userData()} />);

            await waitFor(() => expect(getByText('Overall wellbeing')).toBeTruthy());
            expect(getByText('On track')).toBeTruthy();
            expect(getByText('42nd')).toBeTruthy();
            expect(getByText('3 today')).toBeTruthy();
            expect(getByText('2 / 4')).toBeTruthy();
        });

        /**
         * "31th" shipped to a real phone. The suffix is arithmetic, not translation, and
         * the growth chart directly below this card had the helper for it all along.
         */
        it.each([
            [1, '1st'],
            [2, '2nd'],
            [3, '3rd'],
            [11, '11th'],
            [21, '21st'],
            [31, '31st'],
            [38, '38th'],
        ])('renders the %ith percentile as %s', async (percentile, expected) => {
            getInfantWellbeing.mockResolvedValue(
                wellbeing({
                    tiles: [
                        {
                            domain: 'growth',
                            status: 'on_track',
                            reason: 'tracked',
                            valueKey: 'infant.wellbeing.growth.percentile',
                            valueParams: { percentile },
                        },
                    ],
                }),
            );

            const { getByText } = render(<DashboardInfantTab userData={userData()} />);

            await waitFor(() => expect(getByText(expected)).toBeTruthy());
        });

        /** The number and the dot must describe the same measurement. */
        it('names the measurement that is below the reference', async () => {
            getInfantWellbeing.mockResolvedValue(
                wellbeing({
                    status: 'attention',
                    summaryKey: 'infant.wellbeing.summary.one.growth',
                    tiles: [
                        {
                            domain: 'growth',
                            status: 'attention',
                            reason: 'below_reference',
                            valueKey: 'infant.wellbeing.growth.percentile',
                            valueParams: { percentile: 1 },
                            actionKey: 'infant.wellbeing.growth.actionDiscuss',
                            actionParams: { measure: 'length_for_age' },
                        },
                    ],
                }),
            );

            const { getByText } = render(<DashboardInfantTab userData={userData()} />);

            await waitFor(() =>
                expect(
                    getByText(
                        "Aarav's length is below the WHO reference range. Worth mentioning at your next clinic visit.",
                    ),
                ).toBeTruthy(),
            );
        });

        /**
         * The server sends "6w"; the label already exists in the locale files. Rendering the
         * raw key would put "Due 6w" in front of a mother.
         */
        it('resolves a visit key into its printed label', async () => {
            getInfantWellbeing.mockResolvedValue(wellbeing());

            const { getByText } = render(<DashboardInfantTab userData={userData()} />);

            await waitFor(() => expect(getByText('Due 6 weeks')).toBeTruthy());
        });

        it('shows the action when a domain needs attention', async () => {
            getInfantWellbeing.mockResolvedValue(
                wellbeing({
                    status: 'attention',
                    summaryKey: 'infant.wellbeing.summary.one.vaccines',
                    tiles: [
                        {
                            domain: 'vaccines',
                            status: 'attention',
                            reason: 'vaccines_overdue',
                            valueKey: 'infant.wellbeing.vaccines.overdue',
                            valueParams: { count: 3 },
                            actionKey: 'infant.wellbeing.vaccines.actionOverdue',
                            actionParams: { count: 3, visit: '6w' },
                        },
                    ],
                }),
            );

            const { getByText } = render(<DashboardInfantTab userData={userData()} />);

            await waitFor(() => expect(getByText('Needs a look')).toBeTruthy());
            expect(getByText('3 overdue')).toBeTruthy();
            expect(
                getByText(
                    '3 doses from the 6 weeks visit are not recorded yet. Book a visit, or log them if they have been given.',
                ),
            ).toBeTruthy();
        });

        /** A mother who has logged nothing gets one invitation, not four warnings. */
        it('holds its tongue for a brand-new child', async () => {
            getInfantWellbeing.mockResolvedValue(
                wellbeing({
                    firstRun: true,
                    summaryKey: 'infant.wellbeing.summary.firstRun',
                    tiles: [],
                }),
            );

            const { getByText, queryByText } = render(
                <DashboardInfantTab userData={userData()} />,
            );

            await waitFor(() => expect(getByText('Overall wellbeing')).toBeTruthy());
            expect(queryByText('On track')).toBeNull();
            expect(queryByText('Needs a look')).toBeNull();
            expect(
                getByText(
                    "Start logging Aarav's feeds, weight and vaccines, and this card will show how things are going at a glance.",
                ),
            ).toBeTruthy();
        });

        /** The four log screens underneath are the source of truth and still reachable. */
        it('hides itself rather than complaining when the summary will not load', async () => {
            getInfantWellbeing.mockRejectedValue(new Error('offline'));

            const { getByText, queryByText } = render(
                <DashboardInfantTab userData={userData()} />,
            );

            await waitFor(() => expect(getByText('Growth Log')).toBeTruthy());
            expect(queryByText('Overall wellbeing')).toBeNull();
        });
    });
});
