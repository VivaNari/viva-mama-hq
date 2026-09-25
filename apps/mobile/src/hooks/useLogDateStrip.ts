import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { istDateKey, isSameIstDay, recentDates } from '../utils/infantLogHelpers';

/**
 * The date strip shared by the growth and diaper logs.
 *
 * Both screens show the same thing — a week of recent days, a way to reach any earlier day,
 * and a floor at the child's birthday — so the rules live here once rather than being
 * re-derived on each screen and drifting apart.
 */

/** Today plus the six days before it. */
export const STRIP_DAYS = 7;

export interface LogDateStrip {
    /** The days the strip renders, today first, with any picked day last. */
    dates: Date[];
    selectedDate: Date;
    /** Select by IST day key, which is what the chips are keyed on. */
    selectByKey: (key: string) => void;

    /** Whether a given day is before the child was born, and so has nothing to show. */
    isBeforeBirth: (date: Date) => boolean;
    /** Whether the selected day is today — the only day either log is writable on. */
    isToday: boolean;

    pickerVisible: boolean;
    openPicker: () => void;
    closePicker: () => void;
    pickDate: (date: Date) => void;

    /** Bounds for the picker: never before the child existed, never after today. */
    minimumDate: Date | undefined;
    maximumDate: Date;

    /** The contiguous week to fetch on open, as "YYYY-MM-DD". */
    windowFrom: string;
    windowTo: string;
    /**
     * A picked day outside that week, to be fetched on its own.
     *
     * Null when the picked day is already inside the window. Kept separate so that reaching
     * back three months costs one extra day's request rather than three months of them.
     */
    extraDayKey: string | null;
}

export const useLogDateStrip = (childDob?: string | null): LogDateStrip => {
    /**
     * The instant the week is measured back from.
     *
     * State rather than a one-off `new Date()`, because a log screen outlives the day it
     * was opened on. This one especially: a diaper log is read at 2am and again at 4am, so
     * sitting open across IST midnight is ordinary use, not an edge case. Frozen at mount,
     * the chip labelled "Today" would quietly become yesterday — the tiles would still look
     * tappable and the save would fail on the server's closed-day rule, surfacing as a
     * generic error rather than "the day changed under you".
     */
    const [anchor, setAnchor] = useState(() => new Date());
    const [pickedDate, setPickedDate] = useState<Date | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    const recent = useMemo(() => recentDates(STRIP_DAYS, anchor), [anchor]);
    const [selectedDate, setSelectedDate] = useState<Date>(recent[0]);

    /**
     * Re-anchor if the IST day has rolled since the strip was built.
     *
     * Compares day keys rather than replacing the anchor unconditionally, so the common
     * case — returning to a screen on the same day — changes no state and triggers no
     * refetch. A rollover also moves the selection to the new today, which is where a
     * parent who left the screen on "Today" expects to be.
     */
    const syncToToday = useCallback(() => {
        const now = new Date();
        setAnchor((previous) => (isSameIstDay(previous, now) ? previous : now));
    }, []);

    /**
     * Follow the rollover onto the new today.
     *
     * A separate effect rather than a `setSelectedDate` inside the updater above: a state
     * updater has to be pure, and React is free to call it twice. Comparing day keys here
     * keeps the move to a real rollover, so re-selecting is not undone on every render.
     */
    const anchorKey = istDateKey(anchor);
    const lastAnchorKey = useRef(anchorKey);

    useEffect(() => {
        if (lastAnchorKey.current === anchorKey) return;

        lastAnchorKey.current = anchorKey;
        setSelectedDate(anchor);
    }, [anchor, anchorKey]);

    // Covers coming back to the screen, and the phone being unlocked after a night asleep.
    useFocusEffect(syncToToday);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (status) => {
            if (status === 'active') syncToToday();
        });

        return () => subscription.remove();
    }, [syncToToday]);

    const birthDate = useMemo(() => {
        if (!childDob) return undefined;

        const parsed = new Date(childDob);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }, [childDob]);

    /**
     * Compared on IST calendar days rather than instants.
     *
     * A date of birth carries a time — a baby born at 14:00 today would otherwise make
     * today itself "before birth" for any entry keyed to the start of the day.
     */
    const isBeforeBirth = useCallback(
        (date: Date): boolean => {
            if (!birthDate) return false;
            return istDateKey(date) < istDateKey(birthDate);
        },
        [birthDate],
    );

    const inWindow = useCallback(
        (date: Date): boolean => recent.some((day) => isSameIstDay(day, date)),
        [recent],
    );

    // The picked day goes on the end, after the week and before the pick button, so the
    // contiguous run a parent reads first is not interrupted by a date months away.
    const dates = useMemo(
        () => (pickedDate && !inWindow(pickedDate) ? [...recent, pickedDate] : recent),
        [recent, pickedDate, inWindow],
    );

    /**
     * Select by day key, not by instant.
     *
     * Chips used to be keyed on `toISOString()`, which carries the time of day the Date was
     * built at. The calendar hands back midnight, so picking a day already on the strip
     * produced a selection that matched no chip: the right data loaded with nothing
     * highlighted. A day is the unit here, so a day is the key.
     */
    const selectByKey = useCallback(
        (key: string) => {
            const match = dates.find((date) => istDateKey(date) === key);
            if (match) setSelectedDate(match);
        },
        [dates],
    );

    const pickDate = useCallback((date: Date) => {
        setPickedDate(date);
        setSelectedDate(date);
    }, []);

    return {
        dates,
        selectedDate,
        selectByKey,

        isBeforeBirth,
        isToday: isSameIstDay(selectedDate, new Date()),

        pickerVisible,
        openPicker: useCallback(() => setPickerVisible(true), []),
        closePicker: useCallback(() => setPickerVisible(false), []),
        pickDate,

        minimumDate: birthDate,
        maximumDate: recent[0],

        windowFrom: istDateKey(recent[recent.length - 1]),
        windowTo: istDateKey(recent[0]),
        extraDayKey:
            pickedDate && !inWindow(pickedDate) ? istDateKey(pickedDate) : null,
    };
};
