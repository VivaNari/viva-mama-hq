import { TFunction } from 'i18next';
import Toast from 'react-native-toast-message';

import { recordError } from '../analytics';
import { startOfDay, toISODateKey } from './dateKey';

/** Today's calendar key, the `from`/`to` that selects today's entries. */
export const todayKey = (): string => toISODateKey(startOfDay(new Date()));

/** The error toast every log screen shows when a load or save fails. */
export const showLogError = (
    t: TFunction,
    kind: 'load' | 'save' | 'delete',
    error: unknown,
    where: string,
) => {
    recordError(error, where);
    Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t(`logs.common.${kind}Failed`),
        position: 'bottom',
    });
};

/**
 * "Today · 10:32" for today's entries, "21 Oct · 08:15" for older ones, so a list of
 * recent readings across days reads unambiguously.
 */
export const formatLogTime = (loggedAt: string, t: TFunction, locale: string): string => {
    const at = new Date(loggedAt);
    const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const isToday = toISODateKey(startOfDay(at)) === todayKey();
    const day = isToday
        ? t('logs.readings.today')
        : at.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${day} · ${time}`;
};
