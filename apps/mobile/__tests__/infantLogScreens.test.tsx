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

jest.mock('../src/analytics', () => ({
    AnalyticsEvent: { VACCINATION_LOG_UPDATED: 'vaccination_log_updated' },
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
