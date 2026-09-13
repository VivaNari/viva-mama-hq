/**
 * Smoke tests for the five infant log screens.
 *
 * They render against the real i18n bundle (jest.setup.js loads it), so a key that exists
 * in the code but not in en.json shows up here as the raw key string rather than as a
 * reviewer noticing it in the simulator. That is most of the value: these screens carry
 * ~180 new strings.
 *
 * Behaviour is covered where a tap changes what a parent reads — the diaper quick log and
 * the milestone counter. The rest is layout, which a snapshot would freeze without
 * checking anything worth checking.
 *
 * Run:  npx jest infantLogScreens
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import DiaperLog from '../src/screens/DiaperLog';
import FeedingLog from '../src/screens/FeedingLog';
import GrowthLog from '../src/screens/GrowthLog';
import MilestoneLog from '../src/screens/MilestoneLog';
import VaccinationLog from '../src/screens/VaccinationLog';
import { InfantLogRouteParams } from '../src/types/infantLog.types';

// `mock`-prefixed so Jest allows the hoisted factory below to close over it.
let mockRouteParams: InfantLogRouteParams = {};

jest.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams }),
    useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

jest.mock('../src/analytics', () => ({
    AnalyticsEvent: { VACCINATION_LOG_UPDATED: 'vaccination_log_updated' },
    track: jest.fn(),
}));

/** Days back from today, as an ISO string — the shape route params carry. */
const dobDaysAgo = (days: number): string =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
    mockRouteParams = {};
});

describe('GrowthLog', () => {
    it('renders the three measurements with their units', () => {
        const { getByText, getAllByText } = render(<GrowthLog />);

        expect(getByText('Measurements')).toBeTruthy();
        expect(getAllByText('Head circumference').length).toBeGreaterThan(0);
        expect(getAllByText('Height / length').length).toBeGreaterThan(0);
        expect(getAllByText('Weight').length).toBeGreaterThan(0);
        expect(getByText('grams')).toBeTruthy();
    });

    /** Birth measurements are the last numbers on file until a growth series exists. */
    it('shows the last recorded value beside a field when one was passed', () => {
        mockRouteParams = { lastMeasurements: { weight_grams: 3250 } };

        const { getByText } = render(<GrowthLog />);

        expect(getByText('last: 3250 grams')).toBeTruthy();
    });

    it('warns when a measurement lands outside the plausible range', () => {
        const { getByLabelText, getByText, queryByText } = render(<GrowthLog />);

        fireEvent.changeText(getByLabelText('Weight'), '3600');
        expect(queryByText(/Enter a value between/)).toBeNull();

        // 3.6 — a weight typed in kilograms, which is the mistake the bound exists for.
        fireEvent.changeText(getByLabelText('Weight'), '3.6');
        expect(getByText('Enter a value between 500 and 20000.')).toBeTruthy();
    });

    /**
     * The percentile tiles keep their place in the layout but stay unscored until the WHO
     * LMS tables land. An invented percentile is the one thing on this screen a mother
     * would act on without having typed it.
     */
    it('does not invent a percentile', () => {
        const { getAllByText } = render(<GrowthLog />);

        expect(getAllByText('Awaiting WHO data')).toHaveLength(3);
    });
});

describe('FeedingLog', () => {
    it('starts a young baby on the 0–6 month log', () => {
        mockRouteParams = { childDob: dobDaysAgo(30) };

        const { getByText, queryByText } = render(<FeedingLog />);

        expect(getByText('Feeding type')).toBeTruthy();
        expect(getByText('Exclusively breastfeeding')).toBeTruthy();
        expect(queryByText('Solids')).toBeNull();
    });

    it('starts an older baby on the solids log, addressed by name', () => {
        mockRouteParams = { childDob: dobDaysAgo(200), childName: 'Aarav' };

        const { getByText } = render(<FeedingLog />);

        expect(
            getByText(
                'Aarav is 6 months+ — solids and water are now part of the daily log.',
            ),
        ).toBeTruthy();
        expect(getByText('Solids')).toBeTruthy();
    });

    it('switches between the two versions from the link at the foot', () => {
        mockRouteParams = { childDob: dobDaysAgo(30) };

        const { getByText, queryByText } = render(<FeedingLog />);

        fireEvent.press(getByText('Preview 6 months+ version →'));

        expect(getByText('Water')).toBeTruthy();
        expect(queryByText('Feeding type')).toBeNull();
    });

    /**
     * The feeding type decides which fields a row offers — the PRD's "based on the chosen
     * option we will enable the mother to insert the logs". A mother who is exclusively
     * breastfeeding is not asked about a bottle.
     */
    it('offers only the sides that match the chosen feeding type', () => {
        mockRouteParams = { childDob: dobDaysAgo(30) };

        const { getByText, queryByText } = render(<FeedingLog />);

        expect(getByText('Left')).toBeTruthy();
        expect(queryByText('Bottle')).toBeNull();

        fireEvent.press(getByText('Mixed feeding'));

        expect(getByText('Bottle')).toBeTruthy();
    });

    it('counts the feeds and the longest gap from what was entered', () => {
        mockRouteParams = { childDob: dobDaysAgo(30) };

        const { getByText, getAllByLabelText } = render(<FeedingLog />);

        fireEvent.changeText(getAllByLabelText('Time')[0], '06:40');
        fireEvent.press(getByText('Add more'));
        fireEvent.changeText(getAllByLabelText('Time')[1], '09:50');

        expect(getByText('2')).toBeTruthy();
        expect(getByText('3h 10m')).toBeTruthy();
    });

    it('adds up the water tally and can reset it after a mis-tap', () => {
        mockRouteParams = { childDob: dobDaysAgo(200) };

        const { getByText, queryByText } = render(<FeedingLog />);

        fireEvent.press(getByText('+30 ml'));
        fireEvent.press(getByText('+15 ml'));
        expect(getByText('45')).toBeTruthy();

        fireEvent.press(getByText('Reset'));
        expect(getByText('0')).toBeTruthy();
        expect(queryByText('Reset')).toBeNull();
    });
});

describe('DiaperLog', () => {
    it('logs a diaper on one tap and lets it be removed again', () => {
        const { getByText, getAllByText, getByLabelText, queryByText } = render(
            <DiaperLog />,
        );

        expect(getByText('Nothing logged yet today.')).toBeTruthy();

        fireEvent.press(getByLabelText('Wet'));

        expect(getByText('1 total')).toBeTruthy();
        // Once in the quick-log tile's counter, once on the entry row.
        expect(getAllByText('Wet').length).toBeGreaterThan(1);

        fireEvent.press(getByLabelText('Remove entry'));

        expect(queryByText('1 total')).toBeNull();
        expect(getByText('Nothing logged yet today.')).toBeTruthy();
    });

    it('counts each kind separately', () => {
        const { getByLabelText, getByText } = render(<DiaperLog />);

        fireEvent.press(getByLabelText('Wet'));
        fireEvent.press(getByLabelText('Wet'));
        fireEvent.press(getByLabelText('Both'));

        expect(getByText('2 today')).toBeTruthy();
        expect(getByText('3 total')).toBeTruthy();
    });
});

describe('VaccinationLog', () => {
    it('shows the schedule for the sector chosen at onboarding, addressed by name', () => {
        mockRouteParams = { vaccinationSector: 'private', childName: 'Aarav' };

        const { getByText } = render(<VaccinationLog />);

        expect(getByText('Private sector schedule')).toBeTruthy();
        expect(getByText('Has Aarav been vaccinated with:')).toBeTruthy();
        expect(getByText('Hepatitis B1')).toBeTruthy();
    });

    /**
     * The two schedules do not share visit keys ('12m' is private-only), so switching has
     * to land on the new list's first visit rather than keep the current key.
     */
    it('swaps the whole schedule when the sector is switched', () => {
        mockRouteParams = { vaccinationSector: 'private' };

        const { getByText, queryByText, getByLabelText } = render(<VaccinationLog />);

        fireEvent.press(getByLabelText('Switch vaccination schedule'));

        expect(getByText('Government sector schedule')).toBeTruthy();
        expect(getByText('Hepatitis B — birth dose')).toBeTruthy();
        expect(queryByText('Hepatitis B1')).toBeNull();
    });

    it('falls back to a neutral name when no child was passed', () => {
        const { getByText } = render(<VaccinationLog />);

        expect(getByText('Has your baby been vaccinated with:')).toBeTruthy();
    });
});

describe('MilestoneLog', () => {
    it('renders the first age band with its milestones', () => {
        const { getByText } = render(<MilestoneLog />);

        expect(getByText('Holds head up')).toBeTruthy();
        expect(getByText('0 of 4 logged')).toBeTruthy();
    });

    it('logs a milestone and lets it be un-logged again', () => {
        const { getAllByText, getByText } = render(<MilestoneLog />);

        fireEvent.press(getAllByText('Log this')[0]);

        expect(getByText('1 of 4 logged')).toBeTruthy();
        expect(getByText('Logged')).toBeTruthy();

        fireEvent.press(getByText('Logged'));

        expect(getByText('0 of 4 logged')).toBeTruthy();
    });

    it('changes band when another age chip is chosen', () => {
        const { getByText, queryByText } = render(<MilestoneLog />);

        fireEvent.press(getByText('7–12 months'));

        expect(getByText('Crawls')).toBeTruthy();
        expect(queryByText('Holds head up')).toBeNull();
    });

    /** The illustrations are still outstanding; the cards say so rather than look broken. */
    it('names the missing illustration on every card', () => {
        const { getByText } = render(<MilestoneLog />);

        expect(getByText('photo: baby lifting head')).toBeTruthy();
        expect(
            getByText(
                'Illustrations pending from Dr Harsha — each card takes one image plus the milestone name.',
            ),
        ).toBeTruthy();
    });
});
