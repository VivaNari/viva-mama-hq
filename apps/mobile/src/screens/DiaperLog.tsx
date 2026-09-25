import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import Toast from 'react-native-toast-message';

import { addDiaperEntry, getDiaperLogs, removeDiaperEntry } from '../api/infantDiaper.api';
import CustomDatePicker from '../components/CustomDatePicker';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogDatePickerChip from '../components/infant/LogDatePickerChip';
import LogInfoBanner from '../components/infant/LogInfoBanner';
import LogSectionCard from '../components/infant/LogSectionCard';
import { DIAPER_KINDS } from '../data/infantDiaperData';
import { useLogDateStrip } from '../hooks/useLogDateStrip';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { IDiaperEntry, IDiaperLog, TDiaperKind } from '../types/diaperLog.types';
import { InfantLogRouteParams } from '../types/infantLog.types';
import {
    formatChipDate,
    formatClockTime,
    istDateKey,
    mergeByDay,
} from '../utils/infantLogHelpers';

/** A locally-added entry that has not come back from the server yet. */
const isPending = (entry: IDiaperEntry) => entry._id.startsWith('pending-');

/**
 * Diaper Log (PRD 4.5) — pee and poop.
 *
 * The only log with no Save button, and deliberately so: a diaper is changed one-handed
 * while holding a baby, so a tap on Wet / Dirty / Both records it with the current time
 * immediately. The undo is the ✕ on the entry, not a form to come back to.
 *
 * Because of that, writes are optimistic. A spinner between the tap and the row appearing
 * would undo the whole point of the screen, so the entry is added locally, sent, and
 * rolled back with a toast if the send fails.
 *
 * Earlier days are readable but closed, the same rule the growth log follows — the server
 * enforces it too, so hiding the tiles here is a courtesy rather than the guard.
 */
const DiaperLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const strip = useLogDateStrip(params.childDob);
    const { selectedDate, isToday } = strip;

    const [days, setDays] = useState<IDiaperLog[]>([]);
    const [loading, setLoading] = useState(false);

    const selectedKey = istDateKey(selectedDate);
    const beforeBirth = strip.isBeforeBirth(selectedDate);

    const loadLogs = useCallback(async () => {
        if (!params.childId) return;

        setLoading(true);
        try {
            // Bounded to the days the strip can reach. A child two months into logging has
            // sixty days of entries, and the screen renders seven of them.
            const week = await getDiaperLogs(
                params.childId,
                strip.windowFrom,
                strip.windowTo,
            );
            setDays(prev => mergeByDay(prev, week, row => row.loggedOn));
        } catch (error) {
            console.log('[DiaperLog] Failed to load diaper logs', error);
            Toast.show({ type: 'error', text1: t('infant.diaper.loadFailed') });
        } finally {
            setLoading(false);
        }
    }, [params.childId, strip.windowFrom, strip.windowTo, t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    /**
     * A day picked from the calendar, fetched on its own.
     *
     * A separate single-day request rather than widening the range above: reaching back
     * three months should cost one day's data, not three months of it.
     */
    useEffect(() => {
        const dayKey = strip.extraDayKey;
        if (!dayKey || !params.childId) return;

        let cancelled = false;

        getDiaperLogs(params.childId, dayKey, dayKey)
            .then(rows => {
                if (!cancelled) {
                    setDays(prev => mergeByDay(prev, rows, row => row.loggedOn));
                }
            })
            .catch(error => {
                console.log('[DiaperLog] Failed to load the picked day', error);
                Toast.show({ type: 'error', text1: t('infant.diaper.loadFailed') });
            });

        return () => {
            cancelled = true;
        };
    }, [strip.extraDayKey, params.childId, t]);

    /**
     * Rewrite one day's entries in place, creating the day if this is its first change.
     *
     * Every optimistic mutation goes through here so the rollback path is the same shape as
     * the write path — an add that fails is just another rewrite of the same day.
     */
    const mutateDay = useCallback(
        (dayKey: string, update: (entries: IDiaperEntry[]) => IDiaperEntry[]) =>
            setDays(prev => {
                const existing = prev.find(day => day.loggedOn === dayKey);

                if (existing) {
                    return prev.map(day =>
                        day.loggedOn === dayKey
                            ? { ...day, entries: update(day.entries) }
                            : day,
                    );
                }

                return [
                    ...prev,
                    {
                        _id: `local-${dayKey}`,
                        childId: params.childId ?? '',
                        loggedOn: dayKey,
                        entries: update([]),
                        totals: { wet: 0, dirty: 0, both: 0, total: 0 },
                        createdAt: '',
                        updatedAt: '',
                    } as IDiaperLog,
                ];
            }),
        [params.childId],
    );

    /** The selected day's changes, most recent first — the order the design lists them. */
    const entries = useMemo(() => {
        const day = days.find(item => item.loggedOn === selectedKey);
        if (!day) return [];

        return [...day.entries].sort(
            (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
        );
    }, [days, selectedKey]);

    const countFor = (kind: TDiaperKind) =>
        entries.filter(entry => entry.kind === kind).length;

    const configFor = (kind: TDiaperKind) =>
        DIAPER_KINDS.find(item => item.kind === kind) ?? DIAPER_KINDS[0];

    const addEntry = async (kind: TDiaperKind) => {
        // Checked here and not only via the tiles' `disabled` prop. That prop is a visual
        // state, not a guard — anything that reaches this handler would otherwise write to
        // a day the server is going to reject anyway, and the optimistic row would appear
        // and then vanish.
        if (!isToday) return;

        if (!params.childId) {
            Toast.show({ type: 'error', text1: t('infant.diaper.noChild') });
            return;
        }

        const loggedAt = new Date();
        // Date.now() alone collides when two taps land in the same millisecond, which React
        // then renders with duplicate keys.
        const pendingId = `pending-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        const optimistic: IDiaperEntry = {
            _id: pendingId,
            kind,
            loggedAt: loggedAt.toISOString(),
        };

        mutateDay(selectedKey, current => [...current, optimistic]);

        try {
            const created = await addDiaperEntry({
                childId: params.childId,
                kind,
                loggedAt: loggedAt.toISOString(),
            });

            // Swap the placeholder for the stored entry, which carries the id the ✕ needs.
            mutateDay(created.loggedOn, current =>
                current.map(entry => (entry._id === pendingId ? created.entry : entry)),
            );
        } catch (error) {
            console.log('[DiaperLog] Failed to save diaper entry', error);
            mutateDay(selectedKey, current =>
                current.filter(entry => entry._id !== pendingId),
            );
            Toast.show({ type: 'error', text1: t('infant.diaper.saveFailed') });
        }
    };

    const removeEntry = async (entry: IDiaperEntry) => {
        if (!params.childId || isPending(entry)) return;

        // Removed first, restored if the request fails — the ✕ is an undo, and an undo that
        // waits for a round trip does not feel like one.
        mutateDay(selectedKey, current =>
            current.filter(item => item._id !== entry._id),
        );

        try {
            await removeDiaperEntry({
                childId: params.childId,
                loggedOn: selectedKey,
                entryId: entry._id,
            });
        } catch (error) {
            console.log('[DiaperLog] Failed to remove diaper entry', error);
            mutateDay(selectedKey, current => [...current, entry]);
            Toast.show({ type: 'error', text1: t('infant.diaper.removeFailed') });
        }
    };

    /**
     * Past days are selectable and open read-only; greying them out of reach would let a
     * parent see that the 12th exists but never what was recorded on it.
     *
     * Days before the child was born are the exception. There is nothing behind them and
     * never can be, so they are the one case where a chip should not open.
     */
    const dateTabs = strip.dates.map((date, index) => ({
        // Keyed on the IST day, not the instant. A chip is a day, and keying on
        // toISOString() meant a date chosen from the calendar — which arrives at
        // midnight — matched no chip, leaving the strip with nothing highlighted.
        key: istDateKey(date),
        label: index === 0 ? t('infant.today') : formatChipDate(date, t),
        disabled: strip.isBeforeBirth(date),
    }));

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={dateTabs}
                activeKey={istDateKey(selectedDate)}
                onChange={strip.selectByKey}
                trailing={<LogDatePickerChip onPress={strip.openPicker} />}
            />

            <CustomDatePicker
                show={strip.pickerVisible}
                setShow={visible => (visible ? strip.openPicker() : strip.closePicker())}
                selectedDate={selectedDate}
                onSelect={strip.pickDate}
                // The calendar itself refuses anything before the child existed or after
                // today, so an impossible day cannot be chosen in the first place.
                minimumDate={strip.minimumDate}
                maximumDate={strip.maximumDate}
            />

            <ScrollView
                contentContainerStyle={infantLogStyles.content}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <ActivityIndicator color={colors.darkPurple} style={styles.loader} />
                ) : beforeBirth ? (
                    // Both the chips and the calendar refuse these days, so this is only
                    // reachable with a date of birth in the future. Saying so beats
                    // rendering an empty log that looks like lost data.
                    <LogSectionCard title={t('infant.diaper.todayTitle')}>
                        <Text style={[styles.empty, globalStyles.fontRegular]}>
                            {t('infant.beforeBirth', {
                                name: params.childName ?? t('infant.childFallback'),
                            })}
                        </Text>
                    </LogSectionCard>
                ) : (
                    <>
                        <LogSectionCard
                            title={t('infant.diaper.quickLogTitle')}
                            caption={
                                isToday
                                    ? t('infant.diaper.quickLogCaption')
                                    : t('infant.diaper.readOnlyDay')
                            }
                        >
                            <View style={styles.quickRow}>
                                {DIAPER_KINDS.map(kind => (
                                    <TouchableOpacity
                                        key={kind.kind}
                                        activeOpacity={0.8}
                                        disabled={!isToday}
                                        onPress={() => addEntry(kind.kind)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(kind.labelKey)}
                                        accessibilityState={{ disabled: !isToday }}
                                        style={[
                                            styles.quickTile,
                                            { backgroundColor: kind.background },
                                            // Kept on screen rather than hidden: the counts
                                            // are the point of a past day, and a card that
                                            // loses its controls reads as broken.
                                            !isToday && styles.quickTileDisabled,
                                        ]}
                                    >
                                        <MaterialDesignIcons
                                            name={kind.icon as any}
                                            size={26}
                                            color={kind.foreground}
                                        />

                                        <Text
                                            style={[
                                                styles.quickLabel,
                                                { color: kind.foreground },
                                                globalStyles.fontSemiBold,
                                            ]}
                                        >
                                            {t(kind.labelKey)}
                                        </Text>

                                        <Text
                                            style={[
                                                styles.quickCount,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t('infant.diaper.countToday', {
                                                count: countFor(kind.kind),
                                            })}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </LogSectionCard>

                        <LogSectionCard
                            title={
                                isToday
                                    ? t('infant.diaper.todayTitle')
                                    : formatChipDate(selectedDate, t)
                            }
                            headerRight={
                                <Text style={[styles.total, globalStyles.fontRegular]}>
                                    {t('infant.diaper.total', { count: entries.length })}
                                </Text>
                            }
                        >
                            {entries.length === 0 ? (
                                <Text style={[styles.empty, globalStyles.fontRegular]}>
                                    {isToday
                                        ? t('infant.diaper.empty')
                                        : t('infant.diaper.emptyPast')}
                                </Text>
                            ) : (
                                entries.map((entry, index) => {
                                    const kind = configFor(entry.kind);

                                    return (
                                        <View
                                            key={entry._id}
                                            style={[
                                                styles.entry,
                                                index === entries.length - 1 &&
                                                    styles.entryLast,
                                                isPending(entry) && styles.entryPending,
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.entryIcon,
                                                    { backgroundColor: kind.background },
                                                ]}
                                            >
                                                <MaterialDesignIcons
                                                    name={kind.icon as any}
                                                    size={18}
                                                    color={kind.foreground}
                                                />
                                            </View>

                                            <View style={styles.entryText}>
                                                <Text
                                                    style={[
                                                        styles.entryTitle,
                                                        globalStyles.fontSemiBold,
                                                    ]}
                                                >
                                                    {t(kind.labelKey)}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.entrySubtitle,
                                                        globalStyles.fontRegular,
                                                    ]}
                                                >
                                                    {t(kind.descriptionKey)}
                                                </Text>
                                            </View>

                                            <Text
                                                style={[
                                                    styles.entryTime,
                                                    globalStyles.fontSemiBold,
                                                ]}
                                            >
                                                {formatClockTime(new Date(entry.loggedAt))}
                                            </Text>

                                            {isToday && (
                                                <TouchableOpacity
                                                    activeOpacity={0.7}
                                                    disabled={isPending(entry)}
                                                    onPress={() => removeEntry(entry)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={t(
                                                        'infant.diaper.remove',
                                                    )}
                                                    // Generous slop: this sits next to
                                                    // nothing else and is pressed
                                                    // one-handed.
                                                    hitSlop={10}
                                                >
                                                    <MaterialDesignIcons
                                                        name="close"
                                                        size={18}
                                                        color={colors.gray}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </LogSectionCard>

                        <LogInfoBanner text={t('infant.diaper.guidance')} />
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loader: {
        marginTop: 32,
    },

    quickRow: {
        flexDirection: 'row',
        gap: 10,
    },

    quickTile: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 6,
    },

    quickTileDisabled: {
        opacity: 0.45,
    },

    quickLabel: {
        fontSize: 15,
    },

    quickCount: {
        fontSize: 11,
        color: colors.darkGray,
    },

    total: {
        fontSize: 12,
        color: colors.gray,
    },

    empty: {
        fontSize: 13,
        color: colors.gray,
    },

    entry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
    },

    entryLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },

    /** In flight. Faint rather than absent, so a slow network is visible but not alarming. */
    entryPending: {
        opacity: 0.5,
    },

    entryIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    entryText: {
        flex: 1,
    },

    entryTitle: {
        fontSize: 14,
        color: colors.black,
    },

    entrySubtitle: {
        marginTop: 1,
        fontSize: 12,
        color: colors.gray,
    },

    entryTime: {
        fontSize: 13,
        color: colors.darkGray,
    },
});

export default DiaperLog;
