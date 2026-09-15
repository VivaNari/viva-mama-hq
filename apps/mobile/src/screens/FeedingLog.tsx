import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import Toast from 'react-native-toast-message';

import { AnalyticsEvent, track } from '../analytics';
import {
    addFeed,
    addSolid,
    addWater,
    getFeedingLogs,
    removeFeedingEntry,
    updateFeedingSettings,
} from '../api/infantFeeding.api';
import CustomDatePicker from '../components/CustomDatePicker';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogDatePickerChip from '../components/infant/LogDatePickerChip';
import LogInfoBanner from '../components/infant/LogInfoBanner';
import LogSectionCard from '../components/infant/LogSectionCard';
import {
    CHOICES_FOR_METHOD,
    CHOICE_LABEL_KEYS,
    FEEDING_METHODS,
    FOOD_REACTIONS,
    WATER_INCREMENTS_ML,
} from '../data/infantFeedingData';
import { useLogDateStrip } from '../hooks/useLogDateStrip';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import {
    IFeedEntry,
    IFeedingDay,
    IFeedingSettings,
    ISolidEntry,
    IWaterEntry,
    TFeedingEntryKind,
    TFoodReaction,
} from '../types/feedingLog.types';
import { InfantLogRouteParams, TFeedChoice } from '../types/infantLog.types';
import { FeedingMethodEnum } from '../types/user.types';
import {
    formatChipDate,
    formatClockTime,
    istDateKey,
    mergeByDay,
    splitDuration,
    summariseFeedDay,
} from '../utils/infantLogHelpers';

/**
 * Feeding Log (PRD 4.3).
 *
 * The most feature-rich of the five logs: three kinds of entry, a per-child setting that
 * decides which fields a feed row offers, and a mode that opens at six months.
 *
 * ## What the six-month switch does, and what it does not
 *
 * Before six months this screen logs milk and nothing else. Solids and water are not
 * hidden behind a link a curious parent can find — they are not rendered, and the server
 * refuses them too. WHO and IAP both advise exclusive milk feeding to six completed
 * months, and a log that offers to record a four-month-old's first cereal is the app
 * appearing to endorse it.
 *
 * From six months the sections are offered, but they do not simply appear: the screen asks
 * whether solids have actually started and waits for an answer. The date that answer sets
 * is itself worth having — "started solids at six months" is a line on the MCP card — and
 * the question is one tap, asked once, with no badge and no notification behind it.
 *
 * What the switch deliberately does NOT do is take the milk section away. The original
 * design replaced feeds with solids at six months; milk is still the primary nutrition
 * from six to twelve months, so the 6m+ layout is additive and the feed schedule stays.
 *
 * ## Why there is no Save button
 *
 * Each entry commits on its own, as on every other log here. A whole-day Save would also
 * be a correctness problem rather than only a habit: partner accounts exist, so two people
 * logging the same baby's day at once is ordinary, and a day-shaped write would drop
 * whichever entry lost the race. Writes are optimistic with a rollback, because a spinner
 * between the tap and the row is not what a one-handed screen should feel like.
 *
 * Earlier days are readable but closed, the rule the growth and diaper logs already follow
 * — the server enforces it too, so hiding the composer here is a courtesy, not the guard.
 */

/** A locally-added entry that has not come back from the server yet. */
const isPending = (id: string) => id.startsWith('pending-');

/** Date.now() alone collides when two taps land in the same millisecond. */
const pendingId = () =>
    `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const EMPTY_TOTALS = { feeds: 0, longestGapMinutes: null, solids: 0, waterMl: 0 };

const FeedingLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const childName = params.childName?.trim() || t('infant.childFallback');

    const strip = useLogDateStrip(params.childDob);
    const { selectedDate, isToday } = strip;
    const selectedKey = istDateKey(selectedDate);
    const beforeBirth = strip.isBeforeBirth(selectedDate);

    const [days, setDays] = useState<IFeedingDay[]>([]);
    const [settings, setSettings] = useState<IFeedingSettings | null>(null);
    const [loading, setLoading] = useState(false);

    // Composer state. Not the log — what has not been committed yet.
    const [feedChoice, setFeedChoice] = useState<TFeedChoice | null>(null);
    const [feedAmount, setFeedAmount] = useState('');
    const [feedAt, setFeedAt] = useState<Date>(() => new Date());
    const [timePickerOpen, setTimePickerOpen] = useState(false);

    const [solidFood, setSolidFood] = useState('');
    const [solidReactions, setSolidReactions] = useState<TFoodReaction[]>([]);

    /**
     * "Not yet", held for this visit only.
     *
     * Deliberately not persisted. A baby who is not on solids this week may well be next
     * week, and a permanent dismissal would mean the question is asked once and the
     * sections never appear again. Local state asks again on the next open, which is a
     * quiet card rather than a nag — there is no badge and no notification behind it.
     */
    const [promptDismissed, setPromptDismissed] = useState(false);

    /**
     * Kept in a ref as well as in state so the rollback path reads the list as it is at
     * the moment a request fails rather than as it was when the handler was created.
     */
    const daysRef = useRef<IFeedingDay[]>([]);
    daysRef.current = days;

    const method = settings?.feedingMethod ?? FeedingMethodEnum.ONLY_BREASTMILK;

    /**
     * Whether solids and water are on this screen at all.
     *
     * Two conditions, and both are the server's as well. `solidsAvailable` is the age gate;
     * `solidsStartedOn` is the mother's own statement that complementary feeding has begun.
     */
    const solidsAvailable = settings?.solidsAvailable ?? false;
    const solidsStarted = Boolean(settings?.solidsStartedOn);
    const showSolids = solidsAvailable && solidsStarted;

    const loadLogs = useCallback(async () => {
        if (!params.childId) return;

        setLoading(true);
        try {
            // Bounded to the days the strip can reach, as on the diaper log.
            const res = await getFeedingLogs(
                params.childId,
                strip.windowFrom,
                strip.windowTo,
            );
            setSettings(res.settings);
            setDays(prev => mergeByDay(prev, res.days, row => row.loggedOn));
        } catch (error) {
            console.log('[FeedingLog] Failed to load feeding logs', error);
            Toast.show({ type: 'error', text1: t('infant.feeding.loadFailed') });
        } finally {
            setLoading(false);
        }
    }, [params.childId, strip.windowFrom, strip.windowTo, t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    /**
     * A day picked from the calendar, fetched on its own — reaching back three months
     * should cost one day's data rather than three months of it.
     */
    useEffect(() => {
        const dayKey = strip.extraDayKey;
        if (!dayKey || !params.childId) return;

        let cancelled = false;

        getFeedingLogs(params.childId, dayKey, dayKey)
            .then(res => {
                if (!cancelled) {
                    setDays(prev => mergeByDay(prev, res.days, row => row.loggedOn));
                }
            })
            .catch(error => {
                console.log('[FeedingLog] Failed to load the picked day', error);
                Toast.show({ type: 'error', text1: t('infant.feeding.loadFailed') });
            });

        return () => {
            cancelled = true;
        };
    }, [strip.extraDayKey, params.childId, t]);

    /**
     * Rewrite one day in place, creating it if this is its first entry.
     *
     * Every optimistic mutation goes through here so the rollback path is the same shape as
     * the write path — an add that fails is just another rewrite of the same day.
     */
    const mutateDay = useCallback(
        (dayKey: string, update: (day: IFeedingDay) => IFeedingDay) =>
            setDays(prev => {
                const existing = prev.find(day => day.loggedOn === dayKey);

                if (existing) {
                    return prev.map(day => (day.loggedOn === dayKey ? update(day) : day));
                }

                return [
                    ...prev,
                    update({
                        _id: `local-${dayKey}`,
                        childId: params.childId ?? '',
                        loggedOn: dayKey,
                        feedingMethod: method,
                        feeds: [],
                        solids: [],
                        water: [],
                        totals: EMPTY_TOTALS,
                        createdAt: '',
                        updatedAt: '',
                    }),
                ];
            }),
        [params.childId, method],
    );

    /** The selected day, or an empty stand-in so the cards render the same either way. */
    const day = useMemo<IFeedingDay>(
        () =>
            days.find(item => item.loggedOn === selectedKey) ?? {
                _id: `empty-${selectedKey}`,
                childId: params.childId ?? '',
                loggedOn: selectedKey,
                feedingMethod: method,
                feeds: [],
                solids: [],
                water: [],
                totals: EMPTY_TOTALS,
                createdAt: '',
                updatedAt: '',
            },
        [days, selectedKey, params.childId, method],
    );

    /**
     * Totals are recomputed locally rather than read off `day.totals`.
     *
     * The server sends them with every day, but an optimistic entry has not been to the
     * server yet, and a count that lags the row above it by a round trip reads as a bug.
     */
    const totals = useMemo(() => summariseFeedDay(day), [day]);

    /** Most recent first, the order the design lists a day in. */
    const byTimeDesc = <T extends { feedAt?: string; drankAt?: string }>(entries: T[]) =>
        [...entries].sort(
            (a, b) =>
                new Date(b.feedAt ?? b.drankAt ?? 0).getTime() -
                new Date(a.feedAt ?? a.drankAt ?? 0).getTime(),
        );

    const guardWritable = (): boolean => {
        if (!isToday) return false;

        if (!params.childId) {
            Toast.show({ type: 'error', text1: t('infant.feeding.noChild') });
            return false;
        }

        return true;
    };

    /* ------------------------------- settings ------------------------------- */

    const changeMethod = async (next: FeedingMethodEnum) => {
        if (!params.childId || next === method) return;

        const previous = settings;
        // Optimistic, like every other write here: the radio must move under the thumb.
        setSettings(current => (current ? { ...current, feedingMethod: next } : current));
        // The composer's choices are method-dependent, so a choice the new method does not
        // offer has to go rather than be silently submitted.
        setFeedChoice(null);

        try {
            const updated = await updateFeedingSettings({
                childId: params.childId,
                feedingMethod: next,
            });
            setSettings(updated);
            // The verb only. Which method she chose is health data and stays on the device.
            track(AnalyticsEvent.FEEDING_LOG_SUBMITTED);
        } catch (error) {
            console.log('[FeedingLog] Failed to change the feeding method', error);
            setSettings(previous);
            Toast.show({ type: 'error', text1: t('infant.feeding.saveFailed') });
        }
    };

    const setSolidsStarted = async (started: boolean) => {
        if (!params.childId) return;

        const previous = settings;
        const startedOn = started ? istDateKey(new Date()) : null;

        setSettings(current =>
            current ? { ...current, solidsStartedOn: startedOn } : current,
        );

        try {
            const updated = await updateFeedingSettings({
                childId: params.childId,
                solidsStartedOn: startedOn,
            });
            setSettings(updated);
            if (started) track(AnalyticsEvent.FEEDING_SOLIDS_STARTED);
        } catch (error) {
            console.log('[FeedingLog] Failed to change the solids start date', error);
            setSettings(previous);
            Toast.show({ type: 'error', text1: t('infant.feeding.saveFailed') });
        }
    };

    /* -------------------------------- entries ------------------------------- */

    const submitFeed = async () => {
        if (!guardWritable() || !params.childId) return;

        const amount = Number(feedAmount);
        if (!feedChoice || !Number.isFinite(amount) || amount <= 0) {
            Toast.show({ type: 'error', text1: t('infant.feeding.feedIncomplete') });
            return;
        }

        const source = feedChoice === 'bottle' ? 'bottle' : 'breast';
        const payload = {
            childId: params.childId,
            source: source as 'breast' | 'bottle',
            ...(source === 'breast'
                ? { side: feedChoice as 'left' | 'right', minutes: Math.round(amount) }
                : { ml: Math.round(amount) }),
            feedAt: feedAt.toISOString(),
        };

        const localId = pendingId();
        const optimistic: IFeedEntry = {
            _id: localId,
            source: payload.source,
            ...(source === 'breast'
                ? { side: feedChoice as 'left' | 'right', minutes: Math.round(amount) }
                : { ml: Math.round(amount) }),
            feedAt: payload.feedAt,
        };

        mutateDay(selectedKey, current => ({
            ...current,
            feeds: [...current.feeds, optimistic],
        }));

        // Cleared up front so the next feed can be typed while this one is in flight.
        setFeedAmount('');
        setFeedAt(new Date());

        try {
            const created = await addFeed(payload);
            mutateDay(created.loggedOn, current => ({
                ...current,
                feeds: current.feeds.map(entry =>
                    entry._id === localId ? (created.entry as IFeedEntry) : entry,
                ),
            }));
            track(AnalyticsEvent.FEEDING_LOG_SUBMITTED);
        } catch (error) {
            console.log('[FeedingLog] Failed to save the feed', error);
            mutateDay(selectedKey, current => ({
                ...current,
                feeds: current.feeds.filter(entry => entry._id !== localId),
            }));
            Toast.show({ type: 'error', text1: t('infant.feeding.saveFailed') });
        }
    };

    const submitSolid = async () => {
        if (!guardWritable() || !params.childId) return;

        const food = solidFood.trim();
        if (!food) {
            Toast.show({ type: 'error', text1: t('infant.feeding.solidIncomplete') });
            return;
        }

        const at = new Date().toISOString();
        const localId = pendingId();
        const reactions = [...solidReactions];

        mutateDay(selectedKey, current => ({
            ...current,
            solids: [...current.solids, { _id: localId, food, reactions, feedAt: at }],
        }));

        setSolidFood('');
        setSolidReactions([]);

        try {
            const created = await addSolid({
                childId: params.childId,
                food,
                reactions,
                feedAt: at,
            });
            mutateDay(created.loggedOn, current => ({
                ...current,
                solids: current.solids.map(entry =>
                    entry._id === localId ? (created.entry as ISolidEntry) : entry,
                ),
            }));
            track(AnalyticsEvent.FEEDING_LOG_SUBMITTED);
        } catch (error) {
            console.log('[FeedingLog] Failed to save the solid', error);
            mutateDay(selectedKey, current => ({
                ...current,
                solids: current.solids.filter(entry => entry._id !== localId),
            }));
            Toast.show({ type: 'error', text1: t('infant.feeding.saveFailed') });
        }
    };

    const submitWater = async (ml: number) => {
        if (!guardWritable() || !params.childId) return;

        const at = new Date().toISOString();
        const localId = pendingId();

        mutateDay(selectedKey, current => ({
            ...current,
            water: [...current.water, { _id: localId, ml, drankAt: at }],
        }));

        try {
            const created = await addWater({ childId: params.childId, ml, drankAt: at });
            mutateDay(created.loggedOn, current => ({
                ...current,
                water: current.water.map(entry =>
                    entry._id === localId ? (created.entry as IWaterEntry) : entry,
                ),
            }));
            track(AnalyticsEvent.FEEDING_LOG_SUBMITTED);
        } catch (error) {
            console.log('[FeedingLog] Failed to save the water', error);
            mutateDay(selectedKey, current => ({
                ...current,
                water: current.water.filter(entry => entry._id !== localId),
            }));
            Toast.show({ type: 'error', text1: t('infant.feeding.saveFailed') });
        }
    };

    /**
     * Remove one entry.
     *
     * Removed first and restored if the request fails — the ✕ is an undo, and an undo that
     * waits for a round trip does not feel like one.
     */
    const removeEntry = async (kind: TFeedingEntryKind, entryId: string) => {
        if (!params.childId || isPending(entryId)) return;

        const field = kind === 'feed' ? 'feeds' : kind === 'solid' ? 'solids' : 'water';
        const before = daysRef.current.find(item => item.loggedOn === selectedKey);
        const removed = (before?.[field] as { _id: string }[] | undefined)?.find(
            entry => entry._id === entryId,
        );

        mutateDay(selectedKey, current => ({
            ...current,
            [field]: (current[field] as { _id: string }[]).filter(
                entry => entry._id !== entryId,
            ),
        }));

        try {
            await removeFeedingEntry({
                childId: params.childId,
                loggedOn: selectedKey,
                kind,
                entryId,
            });
        } catch (error) {
            console.log('[FeedingLog] Failed to remove the entry', error);
            if (removed) {
                mutateDay(selectedKey, current => ({
                    ...current,
                    [field]: [...(current[field] as { _id: string }[]), removed],
                }));
            }
            Toast.show({ type: 'error', text1: t('infant.feeding.removeFailed') });
        }
    };

    /* -------------------------------- render -------------------------------- */

    const toggleReaction = (key: TFoodReaction) =>
        setSolidReactions(prev =>
            prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
        );

    /** Minutes at the breast, millilitres in a bottle. Never one field meaning both. */
    const amountPlaceholder = (choice: TFeedChoice | null): string =>
        choice === 'bottle'
            ? t('infant.feeding.amountMl')
            : t('infant.feeding.amountMinutes');

    const feedSummary = (entry: IFeedEntry): string =>
        entry.source === 'bottle'
            ? t('infant.feeding.feedBottle', { ml: entry.ml ?? 0 })
            : t('infant.feeding.feedBreast', {
                  side: t(CHOICE_LABEL_KEYS[(entry.side ?? 'left') as TFeedChoice]),
                  minutes: entry.minutes ?? 0,
              });

    const removeButton = (kind: TFeedingEntryKind, entryId: string) =>
        isToday ? (
            <TouchableOpacity
                activeOpacity={0.7}
                disabled={isPending(entryId)}
                onPress={() => removeEntry(kind, entryId)}
                accessibilityRole="button"
                accessibilityLabel={t('infant.feeding.remove')}
                hitSlop={10}
            >
                <MaterialDesignIcons name="close" size={18} color={colors.gray} />
            </TouchableOpacity>
        ) : null;

    const renderMethodCard = () => (
        <LogSectionCard
            title={
                solidsAvailable
                    ? t('infant.feeding.stillBreastfeedingTitle')
                    : t('infant.feeding.typeTitle')
            }
            caption={
                solidsAvailable
                    ? t('infant.feeding.stillBreastfeedingCaption')
                    : t('infant.feeding.typeCaption')
            }
            footnote={
                settings?.feedingMethodSource === 'onboarding'
                    ? t('infant.feeding.fromOnboarding')
                    : undefined
            }
        >
            {FEEDING_METHODS.map(option => {
                const selected = option.key === method;

                return (
                    <TouchableOpacity
                        key={option.key}
                        activeOpacity={0.8}
                        disabled={!isToday}
                        onPress={() => changeMethod(option.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: !isToday }}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                    >
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                            {selected && <View style={styles.radioDot} />}
                        </View>

                        <View style={styles.flex}>
                            <Text style={[styles.optionLabel, globalStyles.fontSemiBold]}>
                                {t(option.labelKey)}
                            </Text>
                            <Text style={[styles.optionHint, globalStyles.fontRegular]}>
                                {t(option.descriptionKey)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </LogSectionCard>
    );

    const renderFeedsCard = () => {
        const feeds = byTimeDesc(day.feeds);
        const choices = CHOICES_FOR_METHOD[method] ?? [];

        return (
            <LogSectionCard
                title={t('infant.feeding.scheduleTitle')}
                caption={isToday ? undefined : t('infant.feeding.readOnlyDay')}
                headerRight={
                    <Text style={[styles.total, globalStyles.fontRegular]}>
                        {t('infant.feeding.feedCount', { count: totals.feeds })}
                    </Text>
                }
            >
                {feeds.length === 0 ? (
                    <Text style={[styles.empty, globalStyles.fontRegular]}>
                        {isToday
                            ? t('infant.feeding.noFeeds')
                            : t('infant.feeding.noFeedsPast')}
                    </Text>
                ) : (
                    feeds.map((entry, index) => (
                        <View
                            key={entry._id}
                            style={[
                                styles.entry,
                                index === feeds.length - 1 && styles.entryLast,
                                isPending(entry._id) && styles.entryPending,
                            ]}
                        >
                            <View style={styles.entryText}>
                                <Text
                                    style={[
                                        styles.entryTitle,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {feedSummary(entry)}
                                </Text>
                            </View>

                            <Text style={[styles.entryTime, globalStyles.fontSemiBold]}>
                                {formatClockTime(new Date(entry.feedAt))}
                            </Text>

                            {removeButton('feed', entry._id)}
                        </View>
                    ))
                )}

                {isToday && (
                    <View style={styles.composer}>
                        <View style={styles.feedRow}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setTimePickerOpen(true)}
                                accessibilityRole="button"
                                accessibilityLabel={t('infant.feeding.feedTime')}
                                style={[infantLogStyles.input, styles.timeButton]}
                            >
                                <Text
                                    style={[styles.timeText, globalStyles.fontRegular]}
                                >
                                    {formatClockTime(feedAt)}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.sideGroup}>
                                {choices.map(choice => {
                                    const selected = feedChoice === choice;

                                    return (
                                        <TouchableOpacity
                                            key={choice}
                                            activeOpacity={0.8}
                                            onPress={() => setFeedChoice(choice)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            style={styles.side}
                                        >
                                            <Text
                                                style={[
                                                    styles.sideLabel,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {t(CHOICE_LABEL_KEYS[choice])}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.radio,
                                                    selected && styles.radioSelected,
                                                ]}
                                            >
                                                {selected && (
                                                    <View style={styles.radioDot} />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TextInput
                                value={feedAmount}
                                onChangeText={setFeedAmount}
                                placeholder={amountPlaceholder(feedChoice)}
                                placeholderTextColor={colors.gray}
                                keyboardType="number-pad"
                                style={[
                                    infantLogStyles.input,
                                    styles.amountInput,
                                    globalStyles.fontRegular,
                                ]}
                                accessibilityLabel={amountPlaceholder(feedChoice)}
                            />
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={submitFeed}
                            style={infantLogStyles.addMore}
                            accessibilityRole="button"
                        >
                            <MaterialDesignIcons
                                name="plus"
                                size={16}
                                color={colors.darkPurple}
                            />
                            <Text
                                style={[
                                    infantLogStyles.addMoreText,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.addFeed')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LogSectionCard>
        );
    };

    /**
     * The question that opens the second half of the screen.
     *
     * Asked rather than assumed: turning six months old does not mean a baby has started
     * solids, and the date the answer records is itself something the MCP card asks for.
     */
    const renderSolidsPrompt = () => (
        <LogSectionCard
            title={t('infant.feeding.solidsPromptTitle')}
            caption={t('infant.feeding.solidsPromptCaption', { name: childName })}
        >
            <View style={infantLogStyles.row}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSolidsStarted(true)}
                    accessibilityRole="button"
                    style={[styles.choice, styles.choiceSelected]}
                >
                    <Text
                        style={[
                            styles.choiceLabel,
                            styles.choiceLabelSelected,
                            globalStyles.fontSemiBold,
                        ]}
                    >
                        {t('infant.feeding.solidsStarted')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPromptDismissed(true)}
                    accessibilityRole="button"
                    style={styles.choice}
                >
                    <Text style={[styles.choiceLabel, globalStyles.fontRegular]}>
                        {t('infant.feeding.solidsNotYet')}
                    </Text>
                </TouchableOpacity>
            </View>
        </LogSectionCard>
    );

    const renderSolidsCard = () => {
        const solids = byTimeDesc(day.solids);

        return (
            <LogSectionCard
                title={t('infant.feeding.solidsTitle')}
                headerRight={
                    isToday ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setSolidsStarted(false)}
                            accessibilityRole="button"
                        >
                            <Text
                                style={[
                                    infantLogStyles.linkText,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.solidsStop')}
                            </Text>
                        </TouchableOpacity>
                    ) : undefined
                }
            >
                {solids.length === 0 ? (
                    <Text style={[styles.empty, globalStyles.fontRegular]}>
                        {t('infant.feeding.noSolids')}
                    </Text>
                ) : (
                    solids.map((entry, index) => (
                        <View
                            key={entry._id}
                            style={[
                                styles.entry,
                                index === solids.length - 1 && styles.entryLast,
                                isPending(entry._id) && styles.entryPending,
                            ]}
                        >
                            <View style={styles.entryText}>
                                <Text
                                    style={[
                                        styles.entryTitle,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {entry.food}
                                </Text>
                                {entry.reactions.length > 0 && (
                                    <Text
                                        style={[
                                            styles.entrySubtitle,
                                            globalStyles.fontRegular,
                                        ]}
                                    >
                                        {entry.reactions
                                            .map(key =>
                                                t(
                                                    FOOD_REACTIONS.find(
                                                        item => item.key === key,
                                                    )?.labelKey ?? key,
                                                ),
                                            )
                                            .join(' · ')}
                                    </Text>
                                )}
                            </View>

                            <Text style={[styles.entryTime, globalStyles.fontSemiBold]}>
                                {formatClockTime(new Date(entry.feedAt))}
                            </Text>

                            {removeButton('solid', entry._id)}
                        </View>
                    ))
                )}

                {isToday && (
                    <View style={styles.composer}>
                        <TextInput
                            value={solidFood}
                            onChangeText={setSolidFood}
                            placeholder={t('infant.feeding.foodPlaceholder')}
                            placeholderTextColor={colors.gray}
                            maxLength={80}
                            style={[infantLogStyles.input, globalStyles.fontRegular]}
                            accessibilityLabel={t('infant.feeding.foodPlaceholder')}
                        />

                        <Text style={[styles.subheading, globalStyles.fontSemiBold]}>
                            {t('infant.feeding.reactionTitle')}
                        </Text>

                        <View style={styles.chipWrap}>
                            {FOOD_REACTIONS.map(reaction => {
                                const selected = solidReactions.includes(reaction.key);

                                return (
                                    <TouchableOpacity
                                        key={reaction.key}
                                        activeOpacity={0.8}
                                        onPress={() => toggleReaction(reaction.key)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: selected }}
                                        style={[
                                            styles.reaction,
                                            selected && styles.reactionSelected,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.reactionLabel,
                                                selected && styles.reactionLabelSelected,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(reaction.labelKey)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={submitSolid}
                            style={infantLogStyles.addMore}
                            accessibilityRole="button"
                        >
                            <MaterialDesignIcons
                                name="plus"
                                size={16}
                                color={colors.darkPurple}
                            />
                            <Text
                                style={[
                                    infantLogStyles.addMoreText,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.addSolid')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LogSectionCard>
        );
    };

    const renderWaterCard = () => {
        // The last sip is the only one with an undo, which is what the design's single
        // total allows: there is nowhere to show a list, so there is nowhere to pick from.
        const latest = byTimeDesc(day.water)[0];

        return (
            <LogSectionCard
                title={t('infant.feeding.waterTitle')}
                headerRight={
                    isToday && latest && !isPending(latest._id) ? (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => removeEntry('water', latest._id)}
                            accessibilityRole="button"
                        >
                            <Text
                                style={[
                                    infantLogStyles.linkText,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {t('infant.feeding.waterUndo')}
                            </Text>
                        </TouchableOpacity>
                    ) : undefined
                }
            >
                <View style={styles.waterTotalRow}>
                    <Text style={[styles.waterTotal, globalStyles.fontBold]}>
                        {totals.waterMl}
                    </Text>
                    <Text style={[styles.waterUnit, globalStyles.fontRegular]}>
                        {t('infant.feeding.waterToday')}
                    </Text>
                </View>

                <Text style={[infantLogStyles.caption, globalStyles.fontRegular]}>
                    {t('infant.feeding.waterCaption')}
                </Text>

                {isToday && (
                    <View style={styles.waterButtons}>
                        {WATER_INCREMENTS_ML.map(amount => (
                            <TouchableOpacity
                                key={amount}
                                activeOpacity={0.8}
                                onPress={() => submitWater(amount)}
                                accessibilityRole="button"
                                style={styles.waterButton}
                            >
                                <Text
                                    style={[
                                        styles.waterButtonLabel,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {t('infant.feeding.waterIncrement', { amount })}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </LogSectionCard>
        );
    };

    const renderTodayCard = () => {
        const gap =
            totals.longestGapMinutes === null
                ? t('infant.feeding.gapNone')
                : t('infant.feeding.gapValue', splitDuration(totals.longestGapMinutes));

        return (
            <LogSectionCard
                title={
                    isToday
                        ? t('infant.feeding.todayTitle')
                        : formatChipDate(selectedDate, t)
                }
            >
                <View style={infantLogStyles.row}>
                    <View style={infantLogStyles.stat}>
                        <Text
                            style={[infantLogStyles.statLabel, globalStyles.fontRegular]}
                        >
                            {t('infant.feeding.statFeeds')}
                        </Text>
                        <Text style={[infantLogStyles.statValue, globalStyles.fontBold]}>
                            {totals.feeds}
                        </Text>
                    </View>

                    <View style={infantLogStyles.stat}>
                        <Text
                            style={[infantLogStyles.statLabel, globalStyles.fontRegular]}
                        >
                            {t('infant.feeding.statLongestGap')}
                        </Text>
                        <Text style={[infantLogStyles.statValue, globalStyles.fontBold]}>
                            {gap}
                        </Text>
                    </View>

                    {showSolids && (
                        <View style={infantLogStyles.stat}>
                            <Text
                                style={[
                                    infantLogStyles.statLabel,
                                    globalStyles.fontRegular,
                                ]}
                            >
                                {t('infant.feeding.statSolids')}
                            </Text>
                            <Text
                                style={[
                                    infantLogStyles.statValue,
                                    globalStyles.fontBold,
                                ]}
                            >
                                {totals.solids}
                            </Text>
                        </View>
                    )}
                </View>
            </LogSectionCard>
        );
    };

    const dateTabs = strip.dates.map((date, index) => ({
        key: istDateKey(date),
        label: index === 0 ? t('infant.today') : formatChipDate(date, t),
        disabled: strip.isBeforeBirth(date),
    }));

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={dateTabs}
                activeKey={selectedKey}
                onChange={strip.selectByKey}
                trailing={<LogDatePickerChip onPress={strip.openPicker} />}
            />

            <CustomDatePicker
                show={strip.pickerVisible}
                setShow={visible => (visible ? strip.openPicker() : strip.closePicker())}
                selectedDate={selectedDate}
                onSelect={strip.pickDate}
                minimumDate={strip.minimumDate}
                maximumDate={strip.maximumDate}
            />

            {/*
             * The feed time, bounded to today.
             *
             * A mother logging at 00:30 the feed that happened at 23:45 would otherwise
             * file it against yesterday, which the closed-day rule then refuses — an error
             * about a day rather than about the time she picked. The picker simply does
             * not offer it.
             */}
            <CustomDatePicker
                show={timePickerOpen}
                setShow={setTimePickerOpen}
                selectedDate={feedAt}
                onSelect={setFeedAt}
                mode="time"
                maximumDate={new Date()}
            />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={infantLogStyles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <ActivityIndicator
                            color={colors.darkPurple}
                            style={styles.loader}
                        />
                    ) : beforeBirth ? (
                        // Both the chips and the calendar refuse these days, so this is
                        // only reachable with a date of birth in the future. Saying so
                        // beats rendering an empty log that looks like lost data.
                        <LogSectionCard title={t('infant.feeding.todayTitle')}>
                            <Text style={[styles.empty, globalStyles.fontRegular]}>
                                {t('infant.beforeBirth', { name: childName })}
                            </Text>
                        </LogSectionCard>
                    ) : (
                        <>
                            {showSolids && (
                                <LogInfoBanner
                                    icon="star-four-points-outline"
                                    text={t('infant.feeding.solidsBanner', {
                                        name: childName,
                                    })}
                                />
                            )}

                            {renderMethodCard()}
                            {renderFeedsCard()}

                            {solidsAvailable &&
                                (solidsStarted ? (
                                    <>
                                        {renderSolidsCard()}
                                        {renderWaterCard()}
                                    </>
                                ) : (
                                    !promptDismissed && renderSolidsPrompt()
                                ))}

                            {renderTodayCard()}

                            {/*
                             * Under six months this is the only mention solids get, and it
                             * is an explanation rather than a control. WHO and IAP both
                             * advise exclusive milk feeding to six completed months.
                             */}
                            {!solidsAvailable && (
                                <LogInfoBanner
                                    text={t('infant.feeding.solidsLockedNote')}
                                />
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },

    loader: {
        marginTop: 32,
    },

    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },

    optionRowSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    optionLabel: {
        fontSize: 15,
        color: colors.black,
    },

    optionHint: {
        marginTop: 2,
        fontSize: 12,
        color: colors.darkGray,
    },

    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.mediumGray,
        alignItems: 'center',
        justifyContent: 'center',
    },

    radioSelected: {
        borderColor: colors.darkPurple,
    },

    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.darkPurple,
    },

    /** The uncommitted row, separated from the committed list above it. */
    composer: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: colors.lightGray,
    },

    feedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },

    timeButton: {
        flex: 0,
        width: 86,
        justifyContent: 'center',
    },

    timeText: {
        fontSize: 14,
        color: colors.black,
    },

    amountInput: {
        flex: 0,
        width: 72,
    },

    sideGroup: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 6,
    },

    side: {
        alignItems: 'center',
        gap: 4,
    },

    sideLabel: {
        fontSize: 11,
        color: colors.darkGray,
    },

    choice: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    choiceSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    choiceLabel: {
        fontSize: 14,
        textAlign: 'center',
        color: colors.darkGray,
    },

    choiceLabelSelected: {
        color: colors.darkPurple,
    },

    subheading: {
        marginTop: 18,
        marginBottom: 10,
        fontSize: 13,
        color: colors.black,
    },

    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },

    reaction: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },

    reactionSelected: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },

    reactionLabel: {
        fontSize: 13,
        color: colors.darkGray,
    },

    reactionLabelSelected: {
        color: colors.darkPurple,
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
    },

    /** In flight. Faint rather than absent, so a slow network is visible but not alarming. */
    entryPending: {
        opacity: 0.5,
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

    waterTotalRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },

    waterTotal: {
        fontSize: 34,
        color: colors.black,
    },

    waterUnit: {
        fontSize: 14,
        color: colors.darkGray,
    },

    waterButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },

    waterButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.purple,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },

    waterButtonLabel: {
        fontSize: 14,
        color: colors.darkPurple,
    },
});

export default FeedingLog;
