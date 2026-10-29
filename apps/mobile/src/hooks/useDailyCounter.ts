import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { getMotherLogs, setDailyMotherLog } from '../api/motherLogs.api';
import { DailyLogType } from '../types/motherLog.types';
import { showLogError, todayKey } from '../utils/motherLogHelpers';

// Fast taps settle into one request; the total is sent, so nothing is double-counted.
const SAVE_DELAY_MS = 500;

const FIELD: Record<DailyLogType, 'glasses' | 'count'> = {
    water: 'glasses',
    kicks: 'count',
};

/**
 * Today's running total for a tap counter (water glasses, baby kicks).
 *
 * Taps update the number at once and are saved shortly after. A failed save shows an
 * error and re-reads the server's value, so the screen never shows a total that was
 * not stored.
 */
export const useDailyCounter = (logType: DailyLogType, max: number) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const field = FIELD[logType];

    const load = useCallback(async () => {
        try {
            const today = todayKey();
            const [entry] = await getMotherLogs({ types: [logType], from: today, to: today, limit: 1 });
            setValue(entry?.fields?.[field] ?? 0);
        } catch (error) {
            showLogError(t, 'load', error, `useDailyCounter.load.${logType}`);
        } finally {
            setLoading(false);
        }
    }, [field, logType, t]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    // A pending save still goes out if she leaves the screen mid-burst.
    const pending = useRef<number | null>(null);
    const flush = useCallback(async () => {
        if (pending.current === null) return;
        const total = pending.current;
        pending.current = null;
        try {
            await setDailyMotherLog(logType, { [field]: total });
        } catch (error) {
            showLogError(t, 'save', error, `useDailyCounter.save.${logType}`);
            load();
        }
    }, [field, load, logType, t]);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
            flush();
        },
        [flush],
    );

    const set = (next: number) => {
        const clamped = Math.max(0, Math.min(max, next));
        setValue(clamped);
        pending.current = clamped;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
    };

    return {
        value,
        loading,
        increment: () => set(value + 1),
        decrement: () => set(value - 1),
    };
};
