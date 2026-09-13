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
        await waitFor(() => expect(getByText('7800 g')).toBeTruthy());
        expect(getByText('67.6 cm')).toBeTruthy();
        expect(queryByText('3300 g')).toBeNull();
    });

    it('falls back to the birth measurements for a child with no logs yet', async () => {
        const { getByText } = render(<DashboardInfantTab userData={userData()} />);

        await waitFor(() => expect(getByText('3300 g')).toBeTruthy());
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
});
