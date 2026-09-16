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
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import DiaperLog from '../src/screens/DiaperLog';
import FeedingLog from '../src/screens/FeedingLog';
import GrowthLog from '../src/screens/GrowthLog';
import MilestoneLog from '../src/screens/MilestoneLog';
import VaccinationLog from '../src/screens/VaccinationLog';
import { InfantLogRouteParams } from '../src/types/infantLog.types';
import { istDateKey, istParts } from '../src/utils/infantLogHelpers';

// `mock`-prefixed so Jest allows the hoisted factory below to close over it.
let mockRouteParams: InfantLogRouteParams = {};

jest.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams }),
    useNavigation: () => ({ navigate: jest.fn() }),
    // Stands in for React Navigation's useFocusEffect, which fires the effect while the
    // screen is focused. Screens are always focused under test, so running it as a plain
    // effect — cleanup and all — matches the real behaviour closely enough.
    useFocusEffect: (effect: () => void | (() => void)) =>
        require('react').useEffect(effect, [effect]),
}));

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: any) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const { getGrowthLogs, upsertGrowthLog } = require('../src/api/infantGrowth.api');

jest.mock('../src/api/infantGrowth.api', () => ({
    getGrowthLogs: jest.fn().mockResolvedValue([]),
    upsertGrowthLog: jest.fn().mockResolvedValue({}),
    deleteGrowthLog: jest.fn().mockResolvedValue(undefined),
}));

const {
    getDiaperLogs,
    addDiaperEntry,
    removeDiaperEntry,
} = require('../src/api/infantDiaper.api');

jest.mock('../src/api/infantDiaper.api', () => ({
    getDiaperLogs: jest.fn().mockResolvedValue([]),
    addDiaperEntry: jest.fn(),
    removeDiaperEntry: jest.fn().mockResolvedValue(undefined),
}));

const {
    getMilestoneLogs,
    achieveMilestone,
    forgetMilestone,
} = require('../src/api/infantMilestone.api');

jest.mock('../src/api/infantMilestone.api', () => ({
    getMilestoneLogs: jest.fn().mockResolvedValue([]),
    achieveMilestone: jest.fn(),
    forgetMilestone: jest.fn().mockResolvedValue(undefined),
}));

const {
    getVaccinationLogs,
    recordVaccineDose,
    removeVaccineDose,
} = require('../src/api/infantVaccination.api');

jest.mock('../src/api/infantVaccination.api', () => ({
    getVaccinationLogs: jest.fn().mockResolvedValue([]),
    recordVaccineDose: jest.fn(),
    removeVaccineDose: jest.fn().mockResolvedValue(undefined),
}));

const {
    getFeedingLogs,
    addFeed,
    addSolid,
    addWater,
    removeFeedingEntry,
    updateFeedingSettings,
} = require('../src/api/infantFeeding.api');

jest.mock('../src/api/infantFeeding.api', () => ({
    getFeedingLogs: jest.fn(),
    addFeed: jest.fn(),
    addSolid: jest.fn(),
    addWater: jest.fn(),
    removeFeedingEntry: jest.fn().mockResolvedValue(undefined),
    updateFeedingSettings: jest.fn(),
}));

jest.mock('../src/analytics', () => ({
    AnalyticsEvent: {
        VACCINATION_LOG_UPDATED: 'vaccination_log_updated',
        FEEDING_LOG_SUBMITTED: 'feeding_log_submitted',
        FEEDING_SOLIDS_STARTED: 'feeding_solids_started',
    },
    track: jest.fn(),
}));

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// The app keys days on IST to match the server, so these helpers must too — otherwise the
// suite passes in India and fails on a CI box in any other timezone.
const dateKey = (date: Date): string => istDateKey(date);

const todayKey = (): string => dateKey(new Date());

/** The chip label the strip renders for a given day. */
const formatChipLabel = (date: Date): string => {
    const { month, day } = istParts(date);
    return `${day} ${MONTHS[month]}`;
};

/** Days back from today, as an ISO string — the shape route params carry. */
const dobDaysAgo = (days: number): string =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/** The IST day key `days` days before today — the far edge of a date strip. */
const keyDaysAgo = (days: number): string =>
    dateKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

/**
 * Both date strips show today plus the six days before it.
 *
 * Asserted rather than hardcoded per test so that widening or narrowing a strip fails in
 * one obvious place instead of scattering magic numbers through the suite.
 */
const STRIP_DAYS = 7;

/**
 * The calendar, as `jest.setup.js` mocks it — a host element carrying the real component's
 * props. Querying it is how the bounds handed to the picker get asserted, since a mocked
 * calendar has no dates to try tapping.
 */
const picker = (root: ReturnType<typeof render>) =>
    root.UNSAFE_getAllByProps({ mode: 'date' })[0];

/** Drive the mocked calendar the way the real one reports a chosen date. */
const choose = (root: ReturnType<typeof render>, date: Date) =>
    act(() => {
        picker(root).props.onChange({ type: 'set' }, date);
    });

/**
 * The chip carrying a given label, found by walking up from its text to the pressable.
 *
 * Needed because a date label is not unique on screen — the diaper card titles a past day
 * with the same "15 Jun" its chip shows — and because the accessibility state lives on the
 * touchable, several levels above the Text that matches.
 */
const chipFor = (root: ReturnType<typeof render>, label: string) => {
    let node: any = root.getAllByText(label)[0];
    while (node && node.props?.accessibilityRole !== 'tab') node = node.parent;
    return node;
};

beforeEach(() => {
    mockRouteParams = {};
});

describe('GrowthLog', () => {
    /**
     * The strip used to show three days while the fetch asked for the child's entire
     * history — the screen downloaded months of entries to render three of them. The window
     * and the request have to agree, so both are asserted together.
     */
    it('asks for exactly the week of days the strip can reach', async () => {
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };
        getGrowthLogs.mockClear();

        const { getByText } = render(<GrowthLog />);

        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());
        expect(getGrowthLogs).toHaveBeenCalledWith(
            'child-1',
            keyDaysAgo(STRIP_DAYS - 1),
            todayKey(),
        );

        // The far chip is reachable, so the data behind it is worth having fetched.
        expect(
            getByText(formatChipLabel(new Date(Date.now() - (STRIP_DAYS - 1) * 86400000))),
        ).toBeTruthy();
    });

    it('opens a picked day beyond the week and fetches only that day', async () => {
        const longAgo = new Date(Date.now() - 60 * 86400000);
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };
        getGrowthLogs.mockResolvedValue([]);

        const root = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        getGrowthLogs.mockResolvedValue([
            {
                _id: 'g1',
                childId: 'child-1',
                measuredOn: dateKey(longAgo),
                ageInDays: 140,
                sex: 'Male',
                measurements: { weight_kg: 6.4, length_cm: 64, head_circumference_cm: 42 },
                percentiles: {},
                standard: { source: 'WHO-2006', version: 'who-2006.1' },
                createdAt: '',
                updatedAt: '',
            },
        ]);

        fireEvent.press(root.getByLabelText('Pick a date'));
        choose(root, longAgo);

        await waitFor(() =>
            expect(getGrowthLogs).toHaveBeenCalledWith(
                'child-1',
                dateKey(longAgo),
                dateKey(longAgo),
            ),
        );

        // That day's stored measurements hydrate the form, read-only.
        await waitFor(() =>
            expect(root.getByLabelText('Weight').props.value).toBe('6400'),
        );
        expect(root.getByLabelText('Weight').props.editable).toBe(false);
    });

    it('disables the days before the child was born', async () => {
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(2) };
        getGrowthLogs.mockResolvedValue([]);

        const root = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        expect(
            chipFor(root, formatChipLabel(new Date(Date.now() - 86400000))).props
                .accessibilityState.disabled,
        ).toBe(false);
        expect(
            chipFor(root, formatChipLabel(new Date(Date.now() - 5 * 86400000))).props
                .accessibilityState.disabled,
        ).toBe(true);
    });

    it('renders the three measurements with their units', () => {
        const { getByText, getAllByText } = render(<GrowthLog />);

        expect(getByText('Measurements')).toBeTruthy();
        expect(getAllByText('Head circumference').length).toBeGreaterThan(0);
        expect(getAllByText('Height / length').length).toBeGreaterThan(0);
        expect(getAllByText('Weight').length).toBeGreaterThan(0);
        expect(getByText('grams')).toBeTruthy();
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
     * The percentile tiles used to read "Awaiting WHO data" because there were no tables to
     * score against. They are live now — but the rule they were placeholders for still
     * holds: a number appears only when it was actually computed, never as a stand-in.
     */
    it('shows no percentile until there is something to score', () => {
        const { getAllByText } = render(<GrowthLog />);

        expect(getAllByText('—')).toHaveLength(3);
    });

    /**
     * The summary tiles are a third of the card wide. The full field names — "Head
     * circumference", "Height / length" — wrap in that space, and the second breaks at the
     * slash, leaving three tiles of different heights. They use the short labels the
     * dashboard already uses; the full names are right above, on the inputs they summarise.
     */
    it('labels the percentile tiles short enough to fit one line', () => {
        const { getByText } = render(<GrowthLog />);

        expect(getByText('HEAD')).toBeTruthy();
        expect(getByText('HEIGHT')).toBeTruthy();
        expect(getByText('WEIGHT')).toBeTruthy();
    });

    /**
     * The screen used to clear the form on save and never read anything back, so the
     * measurements a mother had just entered vanished and reopening the screen looked like
     * nothing had ever been logged.
     */
    it('shows what is already stored for today', async () => {
        mockRouteParams = { childId: 'c1', childName: 'Aarav', childSex: 'Male' };
        getGrowthLogs.mockResolvedValueOnce([
            {
                _id: 'g1',
                childId: 'c1',
                measuredOn: todayKey(),
                ageInDays: 183,
                sex: 'Male',
                measurements: { weight_kg: 7.8, length_cm: 67.6, head_circumference_cm: 43.3 },
                percentiles: {},
                standard: { source: 'WHO-2006', version: 'who-2006.1' },
                createdAt: '',
                updatedAt: '',
            },
        ]);

        const { getByLabelText } = render(<GrowthLog />);

        // Kilograms on the wire, grams in the field a clinic's number goes into.
        await waitFor(() => expect(getByLabelText('Weight').props.value).toBe('7800'));
        expect(getByLabelText('Height / length').props.value).toBe('67.6');
        expect(getByLabelText('Head circumference').props.value).toBe('43.3');
    });

    /**
     * Past chips were `disabled`, so a parent could see that the 12th existed but never
     * what was recorded on it. They open read-only instead.
     */
    it('opens a past day read-only instead of refusing the tap', async () => {
        mockRouteParams = { childId: 'c1', childName: 'Aarav', childSex: 'Male' };

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        getGrowthLogs.mockResolvedValueOnce([
            {
                _id: 'g0',
                childId: 'c1',
                measuredOn: dateKey(yesterday),
                ageInDays: 182,
                sex: 'Male',
                measurements: { weight_kg: 7.7, length_cm: null, head_circumference_cm: null },
                percentiles: {},
                standard: { source: 'WHO-2006', version: 'who-2006.1' },
                createdAt: '',
                updatedAt: '',
            },
        ]);

        const { getByText, getByLabelText, queryByText } = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        fireEvent.press(getByText(formatChipLabel(yesterday)));

        await waitFor(() =>
            expect(getByLabelText('Weight').props.value).toBe('7700'),
        );
        expect(getByLabelText('Weight').props.editable).toBe(false);
        expect(getByText("Only today's entry can be changed.")).toBeTruthy();
        // Save belongs to today only; a permanently dead button would just puzzle people.
        expect(queryByText('Save log')).toBeNull();
    });

    /**
     * A past day with nothing recorded still shows its three fields, disabled. They were
     * styled white-on-white, so an empty read-only field was invisible and the card looked
     * like it had lost its inputs.
     */
    it('still shows the fields on a past day with nothing recorded', async () => {
        mockRouteParams = { childId: 'c1', childName: 'Aarav', childSex: 'Male' };

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { getByText, getByLabelText } = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        fireEvent.press(getByText(formatChipLabel(yesterday)));

        await waitFor(() =>
            expect(getByText("Only today's entry can be changed.")).toBeTruthy(),
        );

        for (const label of ['Head circumference', 'Height / length', 'Weight']) {
            const input = getByLabelText(label);
            expect(input).toBeTruthy();
            expect(input.props.editable).toBe(false);
            expect(input.props.value).toBe('');
            // An em dash reads as "not recorded"; the sample number would read as a value.
            expect(input.props.placeholder).toBe('—');
        }
    });

    /** The exact path reported: type, save, and the numbers must still be on screen. */
    it('keeps the entry on screen after saving it', async () => {
        mockRouteParams = { childId: 'c1', childName: 'Aarav', childSex: 'Male' };

        const saved = {
            _id: 'g1',
            childId: 'c1',
            measuredOn: todayKey(),
            ageInDays: 183,
            sex: 'Male' as const,
            measurements: { weight_kg: 7.8, length_cm: null, head_circumference_cm: null },
            percentiles: {},
            standard: { source: 'WHO-2006', version: 'who-2006.1' },
            createdAt: '',
            updatedAt: '',
        };

        getGrowthLogs.mockResolvedValueOnce([]).mockResolvedValue([saved]);
        upsertGrowthLog.mockResolvedValue(saved);

        const { getByLabelText, getByText } = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        fireEvent.changeText(getByLabelText('Weight'), '7800');
        fireEvent.press(getByText('Save log'));

        await waitFor(() => expect(upsertGrowthLog).toHaveBeenCalled());
        // Used to be cleared here, which read as "the save was lost".
        await waitFor(() => expect(getByLabelText('Weight').props.value).toBe('7800'));
    });

    /**
     * The reported bug: three empty inputs above three tiles reading 81st / 77th / Off
     * scale, which came from a birth entry six days earlier. The tiles now describe the day
     * on screen and nothing else.
     */
    it('does not show another day\'s percentiles above an empty form', async () => {
        mockRouteParams = { childId: 'c1', childName: 'Aarav', childSex: 'Female' };

        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 6);

        getGrowthLogs.mockResolvedValueOnce([
            {
                _id: 'birth',
                childId: 'c1',
                measuredOn: dateKey(lastWeek),
                ageInDays: 0,
                sex: 'Female',
                measurements: { weight_kg: 3.5, length_cm: 50.5, head_circumference_cm: 34.9 },
                percentiles: {
                    weight_for_age: { status: 'OK', value: 3.5, key: 0, z: 1, zRaw: 1, percentile: 81 },
                    length_for_age: { status: 'OK', value: 50.5, key: 0, z: 0.7, zRaw: 0.7, percentile: 77 },
                    head_circumference_for_age: { status: 'OK', value: 34.9, key: 0, z: 0.8, zRaw: 0.8, percentile: 79 },
                    weight_for_length: { status: 'OK', value: 3.5, key: 50.5, z: 0, zRaw: 0, percentile: 50 },
                },
                standard: { source: 'WHO-2006', version: 'who-2006.1' },
                createdAt: '',
                updatedAt: '',
            },
        ]);

        const { getAllByText, queryByText } = render(<GrowthLog />);
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        // Today has no entry, so the tiles have nothing to report.
        await waitFor(() => expect(getAllByText('—')).toHaveLength(3));
        expect(queryByText('81st percentile')).toBeNull();
        expect(queryByText('77th percentile')).toBeNull();
    });

    /** A chip reading "13 September 2026" stretches the strip off the screen. */
    it('keeps the date chips short', () => {
        const { getByText } = render(<GrowthLog />);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const day = String(yesterday.getDate());

        expect(getByText('Today')).toBeTruthy();
        expect(getByText(new RegExp(`^${day} \\w{3}$`))).toBeTruthy();
    });

    /**
     * The live preview runs @vivamama/growth-standards on the device — the same module the
     * server scores the saved row with. 7.80 kg at 183 days is the worked example from the
     * client's reference site, which reports the 44th percentile.
     */
    it('scores a measurement as it is typed, matching the reference implementation', async () => {
        mockRouteParams = {
            childId: 'c1',
            childName: 'Aarav',
            childSex: 'Male',
            childDob: new Date(
                Date.now() - 183 * 24 * 60 * 60 * 1000,
            ).toISOString(),
        };

        const { getByLabelText, getAllByText } = render(<GrowthLog />);

        // The screen fetches history on mount; let that settle before asserting.
        await waitFor(() => expect(getGrowthLogs).toHaveBeenCalled());

        fireEvent.changeText(getByLabelText('Weight'), '7800');

        expect(getAllByText('44th percentile')).toHaveLength(1);
    });
});

describe('FeedingLog', () => {
    /** The settings envelope the screen opens with. */
    const settings = (over: Partial<Record<string, unknown>> = {}) => ({
        feedingMethod: 'only_breastmilk',
        feedingMethodSource: 'child',
        solidsStartedOn: null,
        solidsAvailable: false,
        ...over,
    });

    const respondWith = (over: Partial<Record<string, unknown>> = {}, days: unknown[] = []) =>
        getFeedingLogs.mockResolvedValue({ settings: settings(over), days });

    /** One stored day in the shape the API returns. */
    const day = (
        loggedOn: string,
        parts: { feeds?: unknown[]; solids?: unknown[]; water?: unknown[] } = {},
    ) => ({
        _id: `day-${loggedOn}`,
        childId: 'child-1',
        loggedOn,
        feedingMethod: 'only_breastmilk',
        feeds: parts.feeds ?? [],
        solids: parts.solids ?? [],
        water: parts.water ?? [],
        totals: { feeds: 0, longestGapMinutes: null, solids: 0, waterMl: 0 },
        createdAt: '',
        updatedAt: '',
    });

    const breastFeed = (id: string, at: Date, minutes = 12) => ({
        _id: id,
        source: 'breast',
        side: 'left',
        minutes,
        feedAt: at.toISOString(),
    });

    beforeEach(() => {
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(30) };

        // The suite does not set `clearMocks`, so call history survives between tests.
        getFeedingLogs.mockClear();
        addFeed.mockClear();
        addSolid.mockClear();
        addWater.mockClear();
        removeFeedingEntry.mockClear();
        updateFeedingSettings.mockClear();

        respondWith();
    });

    it('opens on the method the server resolved', async () => {
        respondWith({ feedingMethod: 'mixed' });

        const { getByText, getAllByRole } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        expect(getByText('Feeding type')).toBeTruthy();

        const selected = getAllByRole('radio').filter(
            (node) => node.props.accessibilityState?.selected,
        );
        expect(selected).toHaveLength(1);
    });

    /**
     * The whole point of sharing the mother's vocabulary: her onboarding answer arrives as
     * the child's default, and the screen says where it came from rather than presenting
     * it as something she chose here.
     */
    it('says when the default came from her onboarding answer', async () => {
        respondWith({ feedingMethodSource: 'onboarding' });

        const { getByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        expect(getByText('From your onboarding answer — change it any time.')).toBeTruthy();
    });

    /**
     * The PRD's "based on the chosen option we will enable the mother to insert the logs".
     * A mother who is exclusively breastfeeding is not asked about a bottle.
     */
    it('offers only the choices that match the chosen method', async () => {
        const { getByText, queryByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        expect(getByText('Left')).toBeTruthy();
        expect(queryByText('Bottle')).toBeNull();

        updateFeedingSettings.mockResolvedValue(settings({ feedingMethod: 'mixed' }));
        fireEvent.press(getByText('Mixed feeding'));

        await waitFor(() => expect(getByText('Bottle')).toBeTruthy());
        expect(updateFeedingSettings).toHaveBeenCalledWith({
            childId: 'child-1',
            feedingMethod: 'mixed',
        });
    });

    it('writes a feed optimistically and keeps the stored row', async () => {
        const at = new Date();
        addFeed.mockResolvedValue({
            childId: 'child-1',
            loggedOn: dateKey(at),
            kind: 'feed',
            entry: breastFeed('feed-1', at, 20),
            totals: { feeds: 1, longestGapMinutes: null, solids: 0, waterMl: 0 },
        });

        const { getByText, getByLabelText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.press(getByText('Left'));
        fireEvent.changeText(getByLabelText('min'), '20');
        fireEvent.press(getByText('Add feed'));

        await waitFor(() => expect(addFeed).toHaveBeenCalled());
        expect(addFeed.mock.calls[0][0]).toMatchObject({
            childId: 'child-1',
            source: 'breast',
            side: 'left',
            minutes: 20,
        });
        expect(getByText('Left · 20 min')).toBeTruthy();
    });

    /** An optimistic row that the server refuses has to leave again. */
    it('rolls the feed back when the write fails', async () => {
        addFeed.mockRejectedValue(new Error('offline'));

        const { getByText, queryByText, getByLabelText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.press(getByText('Left'));
        fireEvent.changeText(getByLabelText('min'), '20');
        fireEvent.press(getByText('Add feed'));

        await waitFor(() => expect(queryByText('Left · 20 min')).toBeNull());
        expect(getByText('No feeds logged yet today.')).toBeTruthy();
    });

    /**
     * The settings decide which controls a feed row offers. Falling back to exclusive
     * breastfeeding would show a bottle-feeding mother Left and Right and no way to say so —
     * the entries would still store correctly, but the form in front of her would be wrong
     * and nothing would say so.
     */
    it('asks rather than guessing when the settings will not load', async () => {
        getFeedingLogs.mockRejectedValue(new Error('offline'));

        const { getByText, queryByText } = render(<FeedingLog />);

        await waitFor(() =>
            expect(
                getByText(
                    "We couldn't load how you're feeding your baby, so this page isn't showing the right options yet.",
                ),
            ).toBeTruthy(),
        );

        expect(queryByText('Left')).toBeNull();
        expect(queryByText('Feeding type')).toBeNull();

        // And it can be retried without leaving the screen.
        respondWith();
        fireEvent.press(getByText('Try again'));

        await waitFor(() => expect(getByText('Feeding type')).toBeTruthy());
    });

    it('refuses to send a feed with no amount', async () => {
        const { getByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.press(getByText('Left'));
        fireEvent.press(getByText('Add feed'));

        expect(addFeed).not.toHaveBeenCalled();
    });

    it('counts the feeds and the longest gap from what is stored', async () => {
        const now = new Date();
        const key = dateKey(now);
        respondWith({}, [
            day(key, {
                feeds: [
                    breastFeed('a', new Date(now.getTime() - 190 * 60000)),
                    breastFeed('b', now),
                ],
            }),
        ]);

        const { getByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        expect(getByText('2')).toBeTruthy();
        expect(getByText('3h 10m')).toBeTruthy();
    });

    /* --------------------------- the six-month gate --------------------------- */

    describe('the six-month gate', () => {
        /**
         * The reason this screen has no manual override any more.
         *
         * WHO and IAP both advise exclusive milk feeding to six completed months, so under
         * six months solids and water are not hidden behind a link a curious parent can
         * find — they are not rendered at all.
         */
        it('offers no solids, no water and no way to reach them under six months', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(120) };

            const { getByText, queryByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            expect(queryByText('Solids')).toBeNull();
            expect(queryByText('Water')).toBeNull();
            expect(queryByText('Ready for solids?')).toBeNull();
            expect(
                getByText(
                    'Only milk for the first six months — no solids and no water. They appear here once your baby turns six months old.',
                ),
            ).toBeTruthy();
        });

        /** Six months old is not the same as eating. The screen asks and waits. */
        it('asks before opening the solids sections', async () => {
            mockRouteParams = {
                childId: 'child-1',
                childDob: dobDaysAgo(200),
                childName: 'Aarav',
            };
            respondWith({ solidsAvailable: true });

            const { getByText, queryByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            expect(getByText('Ready for solids?')).toBeTruthy();
            expect(queryByText('Solids')).toBeNull();
            expect(queryByText('Water')).toBeNull();
        });

        /**
         * "Not yet" is a real answer, and it has to do something visible — a card that
         * looks like a choice and swallows the tap reads as broken. It is held for this
         * visit only: a baby not on solids this week may be next week.
         */
        it('puts the question away for this visit when she says not yet', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };
            respondWith({ solidsAvailable: true });

            const { getByText, queryByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            fireEvent.press(getByText('Not yet'));

            expect(queryByText('Ready for solids?')).toBeNull();
            expect(queryByText('Solids')).toBeNull();
            // Nothing was written: she said not yet, not "never".
            expect(updateFeedingSettings).not.toHaveBeenCalled();
        });

        it('opens them once she says solids have started', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };
            respondWith({ solidsAvailable: true });
            updateFeedingSettings.mockResolvedValue(
                settings({ solidsAvailable: true, solidsStartedOn: dateKey(new Date()) }),
            );

            const { getByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            fireEvent.press(getByText("We've started"));

            await waitFor(() => expect(getByText('Solids')).toBeTruthy());
            expect(getByText('Water')).toBeTruthy();
            expect(updateFeedingSettings.mock.calls[0][0].solidsStartedOn).toBe(
                dateKey(new Date()),
            );
        });

        /**
         * Additive, not a replacement. Milk is still the main meal from six to twelve
         * months, and the original design dropped the feed section at exactly the point
         * the baby is still getting most of its nutrition from it.
         */
        it('keeps the milk section once solids are on', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(220) };
            respondWith({ solidsAvailable: true, solidsStartedOn: '2026-08-01' });

            const { getByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            expect(getByText('Milk feeds')).toBeTruthy();
            expect(getByText('Still breastfeeding?')).toBeTruthy();
            expect(getByText('Solids')).toBeTruthy();
            expect(getByText('Water')).toBeTruthy();
        });

        /** A mother whose baby refuses solids must be able to take the answer back. */
        it('can be turned off again without losing what was logged', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(220) };
            respondWith({ solidsAvailable: true, solidsStartedOn: '2026-08-01' });
            updateFeedingSettings.mockResolvedValue(
                settings({ solidsAvailable: true, solidsStartedOn: null }),
            );

            const { getByText } = render(<FeedingLog />);
            await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

            fireEvent.press(getByText('Not started yet'));

            await waitFor(() => expect(getByText('Ready for solids?')).toBeTruthy());
            expect(updateFeedingSettings.mock.calls[0][0].solidsStartedOn).toBeNull();
        });
    });

    it('adds up the water tally from what is stored', async () => {
        const now = new Date();
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(220) };
        respondWith({ solidsAvailable: true, solidsStartedOn: '2026-08-01' }, [
            day(dateKey(now), {
                water: [
                    { _id: 'w1', ml: 30, drankAt: now.toISOString() },
                    { _id: 'w2', ml: 15, drankAt: now.toISOString() },
                ],
            }),
        ]);

        const { getByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        expect(getByText('45')).toBeTruthy();
    });

    it('logs a sip of water and can undo the last one', async () => {
        const now = new Date();
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(220) };
        respondWith({ solidsAvailable: true, solidsStartedOn: '2026-08-01' });
        addWater.mockResolvedValue({
            childId: 'child-1',
            loggedOn: dateKey(now),
            kind: 'water',
            entry: { _id: 'w1', ml: 30, drankAt: now.toISOString() },
            totals: { feeds: 0, longestGapMinutes: null, solids: 0, waterMl: 30 },
        });

        const { getByText, queryByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.press(getByText('+30 ml'));
        await waitFor(() => expect(getByText('30')).toBeTruthy());

        fireEvent.press(getByText('Undo last'));

        await waitFor(() => expect(removeFeedingEntry).toHaveBeenCalled());
        expect(removeFeedingEntry.mock.calls[0][0]).toMatchObject({
            kind: 'water',
            entryId: 'w1',
        });
        // The link rather than the total: "0" is also the feed count and the solids count,
        // and an empty tally is exactly when there is nothing left to undo.
        await waitFor(() => expect(queryByText('Undo last')).toBeNull());
    });

    it('records a solid with the reactions to it', async () => {
        const now = new Date();
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(220) };
        respondWith({ solidsAvailable: true, solidsStartedOn: '2026-08-01' });
        addSolid.mockResolvedValue({
            childId: 'child-1',
            loggedOn: dateKey(now),
            kind: 'solid',
            entry: {
                _id: 's1',
                food: 'Mashed banana',
                reactions: ['liked'],
                feedAt: now.toISOString(),
            },
            totals: { feeds: 0, longestGapMinutes: null, solids: 1, waterMl: 0 },
        });

        const { getByText, getByLabelText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.changeText(getByLabelText('Food'), 'Mashed banana');
        fireEvent.press(getByText('Liked it'));
        fireEvent.press(getByText('Add food'));

        await waitFor(() => expect(addSolid).toHaveBeenCalled());
        expect(addSolid.mock.calls[0][0]).toMatchObject({
            food: 'Mashed banana',
            reactions: ['liked'],
        });
        expect(getByText('Mashed banana')).toBeTruthy();
    });

    /**
     * Past days are readable and closed, the rule the growth and diaper logs follow. The
     * server enforces it too, so hiding the composer here is a courtesy rather than a guard.
     */
    it('shows a past day without a way to write to it', async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const key = dateKey(yesterday);
        respondWith({}, [
            day(key, { feeds: [breastFeed('a', yesterday, 16)] }),
        ]);

        const { getByText, queryByText } = render(<FeedingLog />);
        await waitFor(() => expect(getFeedingLogs).toHaveBeenCalled());

        fireEvent.press(getByText(formatChipLabel(yesterday)));

        expect(getByText('Left · 16 min')).toBeTruthy();
        expect(queryByText('Add feed')).toBeNull();
        expect(getByText('Earlier days are read-only.')).toBeTruthy();
    });
});

describe('DiaperLog', () => {
    /** One stored entry for the given day, in the shape the API returns. */
    const day = (loggedOn: string, entries: { _id: string; kind: string; at: Date }[]) => ({
        _id: `day-${loggedOn}`,
        childId: 'child-1',
        loggedOn,
        entries: entries.map((entry) => ({
            _id: entry._id,
            kind: entry.kind,
            loggedAt: entry.at.toISOString(),
        })),
        totals: { wet: 0, dirty: 0, both: 0, total: entries.length },
        createdAt: '',
        updatedAt: '',
    });

    beforeEach(() => {
        mockRouteParams = { childId: 'child-1' };

        // The suite does not set `clearMocks`, so call history survives between tests —
        // without this, "the tiles are inert" sees the taps the previous test made.
        getDiaperLogs.mockClear();
        addDiaperEntry.mockClear();
        removeDiaperEntry.mockClear();

        getDiaperLogs.mockResolvedValue([]);
        removeDiaperEntry.mockResolvedValue(undefined);

        // Echo back whatever was sent, with a server-shaped id — the swap from the
        // optimistic row to the stored one is what gives the ✕ an id it can delete by.
        let created = 0;
        addDiaperEntry.mockImplementation(
            async ({ kind, loggedAt }: { kind: string; loggedAt: string }) => ({
                childId: 'child-1',
                loggedOn: todayKey(),
                entry: { _id: `server-${(created += 1)}`, kind, loggedAt },
                totals: { wet: 0, dirty: 0, both: 0, total: created },
            }),
        );
    });

    it('asks for exactly the week of days the strip can reach', async () => {
        render(<DiaperLog />);

        await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());
        expect(getDiaperLogs).toHaveBeenCalledWith(
            'child-1',
            keyDaysAgo(STRIP_DAYS - 1),
            todayKey(),
        );
    });

    describe('picking a date beyond the week', () => {
        it('opens that day and fetches only it', async () => {
            const longAgo = new Date(Date.now() - 90 * 86400000);
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };

            const root = render(<DiaperLog />);
            const { getByLabelText, getByText } = root;

            await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());

            getDiaperLogs.mockResolvedValue([
                day(dateKey(longAgo), [{ _id: 'old-1', kind: 'both', at: longAgo }]),
            ]);

            fireEvent.press(getByLabelText('Pick a date'));
            choose(root, longAgo);

            // One day's worth, not ninety — the picked day is fetched on its own rather
            // than by widening the week's range back to it.
            await waitFor(() =>
                expect(getDiaperLogs).toHaveBeenCalledWith(
                    'child-1',
                    dateKey(longAgo),
                    dateKey(longAgo),
                ),
            );

            await waitFor(() => expect(getByText('1 total')).toBeTruthy());
            // It also joins the strip, so it can be returned to without picking again.
            expect(chipFor(root, formatChipLabel(longAgo))).toBeTruthy();
        });

        /**
         * Regression: chips were keyed on `toISOString()`, which carries the time of day
         * the Date was built at, while the calendar hands back midnight. Picking a day
         * already on the strip produced an activeKey matching no chip — the right data
         * loaded with the whole strip showing nothing selected.
         */
        it('keeps a chip highlighted when the picked day is already on the strip', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };

            const root = render(<DiaperLog />);
            await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());

            const selected = () =>
                root
                    .getAllByRole('tab')
                    .filter((node: any) => node.props.accessibilityState?.selected);

            expect(selected()).toHaveLength(1);

            // Midnight, the way a calendar reports a date.
            const threeBack = new Date(Date.now() - 3 * 86400000);
            threeBack.setHours(0, 0, 0, 0);

            fireEvent.press(root.getByLabelText('Pick a date'));
            choose(root, threeBack);

            expect(selected()).toHaveLength(1);
            expect(chipFor(root, formatChipLabel(threeBack)).props.accessibilityState.selected).toBe(
                true,
            );
            // Already in the week, so it is not appended as an eighth day.
            expect(root.getAllByRole('tab')).toHaveLength(STRIP_DAYS);
        });

        /**
         * The gap is not filled in. Picking a day twenty back adds that one chip, not the
         * thirteen days between it and the week — the strip stays a fixed week plus at most
         * one reached-for day, however far back that day is.
         */
        it('adds exactly one chip, however far back the date is', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(200) };

            const root = render(<DiaperLog />);
            await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());
            expect(root.getAllByRole('tab')).toHaveLength(STRIP_DAYS);

            const twentyBack = new Date(Date.now() - 20 * 86400000);
            fireEvent.press(root.getByLabelText('Pick a date'));
            choose(root, twentyBack);

            await waitFor(() =>
                expect(root.getAllByRole('tab')).toHaveLength(STRIP_DAYS + 1),
            );

            // And a second pick replaces the first rather than accumulating, so the strip
            // cannot grow without bound as a parent browses.
            const fortyBack = new Date(Date.now() - 40 * 86400000);
            fireEvent.press(root.getByLabelText('Pick a date'));
            choose(root, fortyBack);

            await waitFor(() =>
                expect(chipFor(root, formatChipLabel(fortyBack))).toBeTruthy(),
            );
            expect(root.getAllByRole('tab')).toHaveLength(STRIP_DAYS + 1);
            expect(root.queryAllByText(formatChipLabel(twentyBack))).toHaveLength(0);
        });

        it('will not offer a date before the child was born, or after today', async () => {
            const dob = new Date(Date.now() - 40 * 86400000);
            mockRouteParams = { childId: 'child-1', childDob: dob.toISOString() };

            const root = render(<DiaperLog />);

            await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());
            fireEvent.press(root.getByLabelText('Pick a date'));

            expect(dateKey(picker(root).props.minimumDate)).toBe(dateKey(dob));
            expect(dateKey(picker(root).props.maximumDate)).toBe(todayKey());
        });
    });

    /**
     * A baby three days old has four chips in its week that predate it. They are the one
     * case where a chip should not open — there is nothing behind them and never can be.
     */
    it('disables the days before the child was born', async () => {
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(2) };

        const root = render(<DiaperLog />);

        await waitFor(() => expect(getDiaperLogs).toHaveBeenCalled());

        const afterBirth = new Date(Date.now() - 1 * 86400000);
        const beforeBirth = new Date(Date.now() - 5 * 86400000);

        expect(
            chipFor(root, formatChipLabel(afterBirth)).props.accessibilityState.disabled,
        ).toBe(false);
        expect(
            chipFor(root, formatChipLabel(beforeBirth)).props.accessibilityState.disabled,
        ).toBe(true);
    });

    it('reaches a week back, not three days', async () => {
        const sixDaysAgo = new Date(Date.now() - 6 * 86400000);
        getDiaperLogs.mockResolvedValue([
            day(dateKey(sixDaysAgo), [{ _id: 'old-1', kind: 'wet', at: sixDaysAgo }]),
        ]);

        const { getByText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText(formatChipLabel(sixDaysAgo))).toBeTruthy());
        fireEvent.press(getByText(formatChipLabel(sixDaysAgo)));

        await waitFor(() => expect(getByText('1 total')).toBeTruthy());
    });

    it('logs a diaper on one tap and lets it be removed again', async () => {
        const { getByText, getAllByText, getByLabelText, queryByText } = render(
            <DiaperLog />,
        );

        await waitFor(() => expect(getByText('Nothing logged yet today.')).toBeTruthy());

        fireEvent.press(getByLabelText('Wet'));

        // Appears before the request resolves — the whole point of the screen is that a
        // tap is instant.
        await waitFor(() => expect(getByText('1 total')).toBeTruthy());
        // Once in the quick-log tile's counter, once on the entry row.
        expect(getAllByText('Wet').length).toBeGreaterThan(1);

        fireEvent.press(getByLabelText('Remove entry'));

        await waitFor(() => expect(queryByText('1 total')).toBeNull());
        expect(getByText('Nothing logged yet today.')).toBeTruthy();
        expect(removeDiaperEntry).toHaveBeenCalledWith(
            expect.objectContaining({ childId: 'child-1', entryId: 'server-1' }),
        );
    });

    it('counts each kind separately', async () => {
        const { getByLabelText, getByText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText('Nothing logged yet today.')).toBeTruthy());

        fireEvent.press(getByLabelText('Wet'));
        fireEvent.press(getByLabelText('Wet'));
        fireEvent.press(getByLabelText('Both'));

        await waitFor(() => expect(getByText('3 total')).toBeTruthy());
        expect(getByText('2 today')).toBeTruthy();
    });

    /**
     * The cost of writing optimistically: a failed request must take its row back, or the
     * parent is looking at a change the server never recorded.
     */
    it('takes the entry back when the save fails', async () => {
        // Held open rather than rejected up front, so the assertions can sit either side of
        // the failure: the row must appear immediately, then disappear. Rejecting inside
        // `act` is also what makes this deterministic — a floating rejection updates state
        // outside React's control and the flush lands whenever it lands.
        let fail: (error: Error) => void = () => undefined;
        addDiaperEntry.mockReturnValue(
            new Promise((_resolve, reject) => {
                fail = reject;
            }),
        );

        const { getByLabelText, getByText, queryByText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText('Nothing logged yet today.')).toBeTruthy());

        fireEvent.press(getByLabelText('Wet'));
        expect(getByText('1 total')).toBeTruthy();

        await act(async () => {
            fail(new Error('offline'));
        });

        expect(queryByText('1 total')).toBeNull();
        expect(getByText('Nothing logged yet today.')).toBeTruthy();
    });

    it('shows what was logged on a past day', async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        getDiaperLogs.mockResolvedValue([
            day(dateKey(yesterday), [
                { _id: 'old-1', kind: 'wet', at: yesterday },
                { _id: 'old-2', kind: 'dirty', at: yesterday },
            ]),
        ]);

        const { getByText, queryByLabelText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText(formatChipLabel(yesterday))).toBeTruthy());
        fireEvent.press(getByText(formatChipLabel(yesterday)));

        await waitFor(() => expect(getByText('2 total')).toBeTruthy());

        // Read-only: the day's entries are visible but there is no way to change them.
        expect(queryByLabelText('Remove entry')).toBeNull();
        expect(getByText("Only today's diapers can be changed.")).toBeTruthy();
    });

    /**
     * The quick-log tiles stay on screen on a past day rather than disappearing. A card
     * that loses its controls reads as broken, and the per-kind counts on those tiles are
     * most of what a past day is for.
     */
    it('keeps the quick-log tiles visible but inert on a past day', async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        getDiaperLogs.mockResolvedValue([day(dateKey(yesterday), [])]);

        const { getByText, getByLabelText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText(formatChipLabel(yesterday))).toBeTruthy());
        fireEvent.press(getByText(formatChipLabel(yesterday)));

        await waitFor(() =>
            expect(getByText('Nothing was logged on this day.')).toBeTruthy(),
        );

        fireEvent.press(getByLabelText('Wet'));
        expect(addDiaperEntry).not.toHaveBeenCalled();
    });

    it('hydrates today from what the server already has', async () => {
        getDiaperLogs.mockResolvedValue([
            day(todayKey(), [{ _id: 'stored-1', kind: 'both', at: new Date() }]),
        ]);

        const { getByText } = render(<DiaperLog />);

        await waitFor(() => expect(getByText('1 total')).toBeTruthy());
        expect(getByText('Pee and poop')).toBeTruthy();
    });
});

describe('VaccinationLog', () => {
    beforeEach(() => {
        // A newborn, so the screen opens on the birth visit. That is no longer the default
        // for every child — see "opens on the visit the child has reached" below.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(5) };
        getVaccinationLogs.mockClear();
        recordVaccineDose.mockClear();
        removeVaccineDose.mockClear();
        getVaccinationLogs.mockResolvedValue([]);
        recordVaccineDose.mockImplementation(async ({ vaccineKey }: { vaccineKey: string }) => ({
            _id: 'v1',
            childId: 'child-1',
            vaccineKey,
            givenOn: todayKey(),
            createdAt: '',
            updatedAt: '',
        }));
        removeVaccineDose.mockResolvedValue(undefined);
    });

    /**
     * The content is the MCP card's, generated into infantVaccinationData.ts. These
     * assertions are against the card's own wording, so a regeneration that mangled a row
     * or dropped one fails here rather than in a simulator.
     */
    it('renders the birth visit from the MCP card', async () => {
        const { getByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getVaccinationLogs).toHaveBeenCalledWith('child-1'));

        expect(getByText('BCG')).toBeTruthy();
        expect(getByText('Tuberculosis')).toBeTruthy();
        expect(getByText('Hepatitis B')).toBeTruthy();
        expect(getByText('Give within 24 hours of birth')).toBeTruthy();
        expect(getByText('0 of 3 given')).toBeTruthy();
    });

    /**
     * "Dose 1" rather than the card's bare "1", and no chip at all on a single dose.
     *
     * The card writes the same idea five ways and the generator collapses those into four
     * kinds; this is the only place that mapping becomes something a parent reads.
     */
    it('labels the doses the card numbers, and leaves the single ones unlabelled', async () => {
        // Old enough to have reached the 6-week visit this test presses into — the
        // beforeEach's newborn default only has the birth visit as a tab.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(60) };

        const { getByText, getAllByText, queryByText } = render(<VaccinationLog />);

        // Old enough that the screen no longer opens on the birth visit by default —
        // asked for explicitly, same as "works out when the visit falls due" above.
        await waitFor(() => expect(getByText('6 weeks · 0/5')).toBeTruthy());
        fireEvent.press(getByText('Birth · 0/3'));
        expect(getByText('BCG')).toBeTruthy();

        // Birth: BCG is a single dose, the other two are birth doses.
        expect(queryByText('Dose 1')).toBeNull();
        expect(getAllByText('Birth dose')).toHaveLength(2);

        fireEvent.press(getByText('6 weeks · 0/5'));

        expect(getByText('Pentavalent')).toBeTruthy();
        expect(getAllByText('Dose 1').length).toBeGreaterThan(0);
    });

    it('shows only the visits through two years', async () => {
        // Old enough to have reached every visit, including the last one this test checks
        // for — otherwise the beforeEach's newborn default hides it as not-yet-due.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(900) };

        const { getByText, queryByText } = render(<VaccinationLog />);

        // Old enough that the screen opens on the last visit, not the birth one, so BCG
        // is not what signals the load — the chip strip itself is.
        await waitFor(() => expect(getVaccinationLogs).toHaveBeenCalledWith('child-1'));

        expect(getByText('16–24 months · 0/5')).toBeTruthy();
        // The card runs to sixteen years; the generator excludes everything past two.
        expect(queryByText(/5–6 years/)).toBeNull();
        expect(queryByText(/10 years/)).toBeNull();
    });

    /**
     * The due date is the one thing on this screen the card does not print — it is derived
     * from the child's date of birth, and it is the reason a parent opens the screen before
     * a visit rather than after one.
     */
    it('works out when the visit falls due from the date of birth', async () => {
        // Fixed rather than relative to "now", because the due-date labels asserted below
        // are calendar-exact — but old enough (well past two years) that every visit is a
        // reached, pressable tab regardless of which real day this test runs on.
        const dob = new Date('2015-03-14T06:00:00Z');
        mockRouteParams = { childId: 'child-1', childDob: dob.toISOString() };

        const { getByText } = render(<VaccinationLog />);

        // This child is years old, so the screen opens on the last visit; the birth visit
        // has to be asked for.
        await waitFor(() => expect(getByText('Birth · 0/3')).toBeTruthy());
        fireEvent.press(getByText('Birth · 0/3'));

        expect(getByText('BCG')).toBeTruthy();
        expect(getByText('Due at birth')).toBeTruthy();

        // Six weeks after 14 March 2015 is 25 April 2015 — days, because weeks are exact.
        fireEvent.press(getByText('6 weeks · 0/5'));
        expect(getByText('Due around 25 Apr 2015')).toBeTruthy();

        // Nine to twelve calendar months later, landing on the same day of the month.
        fireEvent.press(getByText('9–12 months · 0/5'));
        expect(getByText('Due between 14 Dec 2015 and 14 Mar 2016')).toBeTruthy();
    });

    /** A wrong due date on a vaccination screen is worse than no due date. */
    it('says nothing about due dates when the date of birth did not come through', async () => {
        mockRouteParams = { childId: 'child-1' };

        const { getByText, queryByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getByText('BCG')).toBeTruthy());
        expect(queryByText('Due at birth')).toBeNull();
    });

    it('records a dose on one tap and lets it be un-recorded again', async () => {
        const { getByLabelText, getByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getByText('0 of 3 given')).toBeTruthy());

        fireEvent(getByLabelText('BCG'), 'valueChange', true);

        await waitFor(() => expect(getByText('1 of 3 given')).toBeTruthy());
        expect(recordVaccineDose).toHaveBeenCalledWith({
            childId: 'child-1',
            vaccineKey: 'bcg',
        });
        // A digit, because BCG's own note from the card is "Given at birth".
        expect(getByText(/^Given \d/)).toBeTruthy();

        fireEvent(getByLabelText('BCG'), 'valueChange', false);

        await waitFor(() => expect(getByText('0 of 3 given')).toBeTruthy());
        expect(removeVaccineDose).toHaveBeenCalledWith({
            childId: 'child-1',
            vaccineKey: 'bcg',
        });
    });

    /**
     * Optimistic, like the diaper and milestone logs: a failed write has to take its tick
     * back. The rejection is held open and fired inside `act` so the flush is deterministic.
     */
    it('takes the tick back when the save fails', async () => {
        let fail: (error: Error) => void = () => undefined;
        recordVaccineDose.mockReturnValue(
            new Promise((_resolve, reject) => {
                fail = reject;
            }),
        );

        const { getByLabelText, getByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getByText('0 of 3 given')).toBeTruthy());

        fireEvent(getByLabelText('BCG'), 'valueChange', true);
        expect(getByText('1 of 3 given')).toBeTruthy();

        await act(async () => {
            fail(new Error('offline'));
        });

        expect(getByText('0 of 3 given')).toBeTruthy();
    });

    /**
     * The schedule is chosen at baby onboarding and is fixed for that child.
     *
     * It used to be a switch on this screen, and it is not one any more: a dose is a
     * clinical event that happened on a particular schedule, and letting the schedule be
     * re-picked afterwards would make the record's meaning depend on a setting. Three of
     * Pentavalent are not three of DTwP + Hib + Hepatitis B.
     */
    describe('the schedule the child is on', () => {
        it('renders the government schedule and offers no way out of it', async () => {
            // Old enough to have reached the 6-week visit this test presses into.
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(60) };

            const { getByText, queryByText, queryByLabelText } = render(<VaccinationLog />);

            // Old enough that the screen no longer opens on the birth visit by default —
            // asked for explicitly, same as "works out when the visit falls due" above.
            await waitFor(() => expect(getByText('Government sector schedule')).toBeTruthy());
            fireEvent.press(getByText('Birth · 0/3'));

            expect(getByText('BCG')).toBeTruthy();
            expect(getByText('set when you added your baby')).toBeTruthy();
            expect(queryByLabelText('Switch vaccination schedule')).toBeNull();

            fireEvent.press(getByText('6 weeks · 0/5'));
            expect(getByText('Pentavalent')).toBeTruthy();
            expect(queryByText('DTwP/DTaP')).toBeNull();
        });

        it('renders the private schedule for a private-sector child', async () => {
            // Old enough to have reached the 6-week visit this test presses into.
            mockRouteParams = {
                childId: 'child-1',
                childDob: dobDaysAgo(60),
                vaccinationSector: 'private',
            };

            const { getByText, queryByText } = render(<VaccinationLog />);

            // Old enough that the screen no longer opens on the birth visit by default —
            // asked for explicitly, same as "works out when the visit falls due" above.
            await waitFor(() => expect(getByText('Private sector schedule')).toBeTruthy());
            fireEvent.press(getByText('Birth · 0/3'));

            expect(getByText('BCG')).toBeTruthy();

            fireEvent.press(getByText('6 weeks · 0/6'));
            expect(getByText('DTwP/DTaP')).toBeTruthy();
            expect(queryByText('Pentavalent')).toBeNull();
        });

        /**
         * The government schedule is the card every Indian family is handed, and the server
         * applies the same fallback — the two must not disagree about which doses exist.
         */
        it('falls back to the government schedule when no sector was stored', async () => {
            mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(5) };

            const { getByText } = render(<VaccinationLog />);

            await waitFor(() => expect(getByText('BCG')).toBeTruthy());
            expect(getByText('Government sector schedule')).toBeTruthy();
        });

        /**
         * The nine shared keys are no longer visible to a user — nobody switches — but they
         * are still one row each, which is what lets the API check a key against a sector
         * with a plain membership test.
         */
        it('shows a shared dose as given on whichever schedule the child is on', async () => {
            getVaccinationLogs.mockResolvedValue([
                {
                    _id: 'v1',
                    childId: 'child-1',
                    vaccineKey: 'bcg',
                    givenOn: todayKey(),
                    createdAt: '',
                    updatedAt: '',
                },
            ]);

            const publicChild = render(<VaccinationLog />);
            await waitFor(() =>
                expect(publicChild.getByText('1 of 3 given')).toBeTruthy(),
            );
            publicChild.unmount();

            mockRouteParams = {
                childId: 'child-1',
                childDob: dobDaysAgo(5),
                vaccinationSector: 'private',
            };

            const privateChild = render(<VaccinationLog />);
            await waitFor(() =>
                expect(privateChild.getByText('1 of 3 given')).toBeTruthy(),
            );
        });
    });

    /**
     * A mother of a four-month-old should not have to scroll past the birth visit every
     * time. The visit she has reached is the useful place to land — she is recording what
     * has happened, not reading ahead.
     */
    it('opens on the visit the child has reached', async () => {
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(120) };

        const { getByText, queryByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getVaccinationLogs).toHaveBeenCalled());

        // Four months old: past the 14-week visit, not yet at 9–12 months.
        expect(getByText('14 weeks · 3½ months')).toBeTruthy();
        expect(queryByText('BCG')).toBeNull();
    });

    it('opens on the first visit when the date of birth did not come through', async () => {
        mockRouteParams = { childId: 'child-1' };

        const { getByText } = render(<VaccinationLog />);

        await waitFor(() => expect(getByText('BCG')).toBeTruthy());
    });

    it('falls back to a neutral name when no child was passed', async () => {
        mockRouteParams = {};

        const { getByText } = render(<VaccinationLog />);

        expect(getByText('Has your baby been vaccinated with:')).toBeTruthy();
    });
});

describe('MilestoneLog', () => {
    beforeEach(() => {
        // A newborn, so the screen opens on the first band. The band a child is in is now
        // derived from the date of birth, so this has to be pinned rather than left to
        // whatever today happens to be — see "opens on the band the child is in" below.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(20) };
        getMilestoneLogs.mockClear();
        achieveMilestone.mockClear();
        forgetMilestone.mockClear();
        getMilestoneLogs.mockResolvedValue([]);
        achieveMilestone.mockImplementation(async ({ milestoneKey }: { milestoneKey: string }) => ({
            _id: 'm1',
            childId: 'child-1',
            milestoneKey,
            achievedOn: todayKey(),
            createdAt: '',
            updatedAt: '',
        }));
        forgetMilestone.mockResolvedValue(undefined);
    });

    /**
     * The content is the India MCP card's, generated into infantMilestoneData.ts. These
     * assertions are against the card's own wording, so a regeneration that mangled the
     * text or dropped a row fails here.
     */
    it('renders the first age band from the MCP card', async () => {
        const { getByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getMilestoneLogs).toHaveBeenCalledWith('child-1'));

        expect(getByText('Develops a social smile')).toBeTruthy();
        expect(getByText('Raises head at times, when on tummy')).toBeTruthy();
        expect(getByText('0 of 6 logged')).toBeTruthy();
    });

    /**
     * A mother of an eighteen-month-old should not land on the newborn band every time.
     * The band she has reached is where she is logging from.
     */
    it('opens on the band the child is in', async () => {
        // Eighteen months and a bit, so the 18-month band is the last one reached.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(560) };

        const { getByText, queryByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getMilestoneLogs).toHaveBeenCalled());

        expect(getByText('Stands and takes several independent steps')).toBeTruthy();
        expect(queryByText('Develops a social smile')).toBeNull();
    });

    it('opens on the first band when the date of birth did not come through', async () => {
        mockRouteParams = { childId: 'child-1' };

        const { getByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getByText('Develops a social smile')).toBeTruthy());
    });

    it('logs a milestone and lets it be un-logged again', async () => {
        const { getAllByText, getByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getByText('0 of 6 logged')).toBeTruthy());

        fireEvent.press(getAllByText('Log this')[0]);

        await waitFor(() => expect(getByText('1 of 6 logged')).toBeTruthy());
        expect(achieveMilestone).toHaveBeenCalledWith(
            expect.objectContaining({ childId: 'child-1' }),
        );

        fireEvent.press(getByText('Logged'));

        await waitFor(() => expect(getByText('0 of 6 logged')).toBeTruthy());
        expect(forgetMilestone).toHaveBeenCalled();
    });

    /**
     * Optimistic, like the diaper log: a failed write has to take its tick back.
     *
     * The rejection is held open and fired inside `act` rather than rejected up front. That
     * is what makes the test deterministic — a floating rejection updates state outside
     * React's control and the flush lands whenever it lands — and it also lets the tick be
     * asserted present before it is asserted gone, which is the actual behaviour.
     */
    it('takes the tick back when the save fails', async () => {
        let fail: (error: Error) => void = () => undefined;
        achieveMilestone.mockReturnValue(
            new Promise((_resolve, reject) => {
                fail = reject;
            }),
        );

        const { getAllByText, getByText, queryByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getByText('0 of 6 logged')).toBeTruthy());

        fireEvent.press(getAllByText('Log this')[0]);
        expect(getByText('1 of 6 logged')).toBeTruthy();

        await act(async () => {
            fail(new Error('offline'));
        });

        expect(queryByText('1 of 6 logged')).toBeNull();
        expect(getByText('0 of 6 logged')).toBeTruthy();
    });

    it('shows what the server already has logged', async () => {
        getMilestoneLogs.mockResolvedValue([
            {
                _id: 'm1',
                childId: 'child-1',
                milestoneKey: 'develops_a_social_smile',
                achievedOn: todayKey(),
                createdAt: '',
                updatedAt: '',
            },
        ]);

        const { getByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getByText('1 of 6 logged')).toBeTruthy());
        expect(getByText('Logged')).toBeTruthy();
    });

    it('changes band when another age chip is chosen', async () => {
        // Old enough that every band is a reached, pressable tab — the beforeEach's
        // newborn default only has the 2-3 month one. This also means the screen no
        // longer opens on 2-3 months by default, so that band is pressed into first.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(900) };

        const { getByText, queryByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getMilestoneLogs).toHaveBeenCalled());

        fireEvent.press(getByText('2–3 months'));
        expect(getByText('Develops a social smile')).toBeTruthy();

        fireEvent.press(getByText('10–12 months'));

        expect(getByText('Raises arms to be picked up')).toBeTruthy();
        expect(queryByText('Develops a social smile')).toBeNull();
    });

    /**
     * Six bands, through two years. The card itself carries a seventh at three years; it is
     * excluded in the catalogue generator, so its chip must not appear here either — a tab
     * with no milestones behind it would be worse than no tab.
     */
    it('covers six bands, through two years, and not the third year', async () => {
        // Old enough to have reached every shipped band, including the last one this test
        // checks for.
        mockRouteParams = { childId: 'child-1', childDob: dobDaysAgo(900) };

        const { getByText, queryByText } = render(<MilestoneLog />);

        await waitFor(() => expect(getByText('2–3 months')).toBeTruthy());

        for (const label of ['4–6 months', '7–9 months', '10–12 months', '18 months']) {
            expect(getByText(label)).toBeTruthy();
        }

        expect(queryByText('3 years')).toBeNull();
    });

    /**
     * Warning signs are the other half of every band on the card. Closed by default: this
     * screen is opened to celebrate something, and six things that might be wrong is not
     * what it should lead with.
     */
    describe('warning signs', () => {
        it('stays closed until asked for', async () => {
            const { getByText, queryByText } = render(<MilestoneLog />);

            await waitFor(() =>
                expect(getByText('When to check with a health worker')).toBeTruthy(),
            );

            expect(queryByText('No social smile')).toBeNull();
        });

        it("opens to the band's own signs", async () => {
            const { getByText } = render(<MilestoneLog />);

            await waitFor(() =>
                expect(getByText('When to check with a health worker')).toBeTruthy(),
            );

            fireEvent.press(getByText('When to check with a health worker'));

            expect(getByText('No social smile')).toBeTruthy();
            expect(getByText('Persistent squinting after 2 months')).toBeTruthy();
        });

        it('never tells a parent something is wrong, only who to ask', async () => {
            const { getByText } = render(<MilestoneLog />);

            await waitFor(() =>
                expect(getByText('When to check with a health worker')).toBeTruthy(),
            );
            fireEvent.press(getByText('When to check with a health worker'));

            expect(
                getByText(/Babies vary a great deal, and one of these on its own/),
            ).toBeTruthy();
        });
    });

    it('credits the card the content comes from', async () => {
        const { getByText } = render(<MilestoneLog />);

        await waitFor(() =>
            expect(
                getByText(/India Mother and Child Protection Card \(2018\)/),
            ).toBeTruthy(),
        );
    });
});

