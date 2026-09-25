/**
 * The date strip behind the growth and diaper logs.
 *
 * Tested as a hook rather than through a screen because the behaviour that matters most
 * here is temporal: what the strip does when the calendar day changes underneath it. That
 * needs the system clock moved, which is far easier to do without a rendered screen and
 * its fetches in the way.
 *
 * Run:  npx jest logDateStrip
 */

import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { STRIP_DAYS, useLogDateStrip } from '../src/hooks/useLogDateStrip';
import { istDateKey } from '../src/utils/infantLogHelpers';

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void | (() => void)) =>
        require('react').useEffect(effect, [effect]),
}));

/**
 * 18:20 UTC is 23:50 IST the same day; 18:40 UTC is 00:10 IST the next one. Twenty minutes
 * apart, either side of the boundary the whole app keys its days on.
 */
const LATE_ON_12TH = new Date('2026-09-12T18:20:00.000Z');
const JUST_AFTER_MIDNIGHT = new Date('2026-09-12T18:40:00.000Z');

/**
 * The handler the hook registers, captured off AppState.
 *
 * RN's AppState has no `emit` to fire from the outside, so the listener is taken as it is
 * registered and called directly — which is what the platform does anyway.
 */
let appStateHandler: (status: string) => void = () => undefined;

beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
        _event: string,
        handler: (status: string) => void,
    ) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
    }) as never);
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

/** The app coming back to the foreground. */
const foreground = () => act(() => appStateHandler('active'));

describe('crossing IST midnight', () => {
    /**
     * A diaper log is read at 2am and again at 4am, so sitting open across midnight is
     * ordinary use. Anchored once at mount, "Today" silently became yesterday: the tiles
     * still looked tappable and the write then failed the server's closed-day rule.
     */
    it('re-anchors the week when the app returns after the day rolled', () => {
        jest.useFakeTimers();
        jest.setSystemTime(LATE_ON_12TH);

        const { result } = renderHook(() => useLogDateStrip(null));

        expect(result.current.windowTo).toBe('2026-09-12');
        expect(istDateKey(result.current.selectedDate)).toBe('2026-09-12');
        expect(result.current.isToday).toBe(true);

        jest.setSystemTime(JUST_AFTER_MIDNIGHT);
        foreground();

        expect(result.current.windowTo).toBe('2026-09-13');
        // The selection follows, because a parent who left the screen on "Today" means the
        // day they are in now, not the one that just ended.
        expect(istDateKey(result.current.selectedDate)).toBe('2026-09-13');
        expect(result.current.isToday).toBe(true);
    });

    it('leaves the week alone when the app returns on the same day', () => {
        jest.useFakeTimers();
        jest.setSystemTime(LATE_ON_12TH);

        const { result } = renderHook(() => useLogDateStrip(null));
        const before = result.current.dates;

        jest.setSystemTime(new Date('2026-09-12T18:25:00.000Z'));
        foreground();

        // Same array instance: no re-anchor means no refetch on every return to the screen.
        expect(result.current.dates).toBe(before);
    });

    it('ignores the app going to the background', () => {
        jest.useFakeTimers();
        jest.setSystemTime(LATE_ON_12TH);

        const { result } = renderHook(() => useLogDateStrip(null));

        jest.setSystemTime(JUST_AFTER_MIDNIGHT);
        act(() => appStateHandler('background'));

        expect(result.current.windowTo).toBe('2026-09-12');
    });
});

describe('the week it asks for', () => {
    it('spans today back six days', () => {
        jest.useFakeTimers();
        jest.setSystemTime(LATE_ON_12TH);

        const { result } = renderHook(() => useLogDateStrip(null));

        expect(result.current.dates).toHaveLength(STRIP_DAYS);
        expect(result.current.windowTo).toBe('2026-09-12');
        expect(result.current.windowFrom).toBe('2026-09-06');
    });
});

describe('the birth floor', () => {
    it('compares calendar days, not instants', () => {
        jest.useFakeTimers();
        jest.setSystemTime(LATE_ON_12TH);

        // Born at 14:00 IST today. Today itself must not read as "before birth" — every
        // entry is keyed to the start of its day, so an instant comparison would exclude
        // the day the child was actually born on.
        const { result } = renderHook(() =>
            useLogDateStrip('2026-09-12T08:30:00.000Z'),
        );

        expect(result.current.isBeforeBirth(new Date('2026-09-12T18:20:00.000Z'))).toBe(false);
        expect(result.current.isBeforeBirth(new Date('2026-09-11T18:20:00.000Z'))).toBe(true);
    });

    it('has no floor when the child has no date of birth on file', () => {
        const { result } = renderHook(() => useLogDateStrip(undefined));

        expect(result.current.minimumDate).toBeUndefined();
        expect(result.current.isBeforeBirth(new Date('2020-01-01'))).toBe(false);
    });
});
