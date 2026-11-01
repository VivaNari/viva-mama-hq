import React, { useCallback, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { createReminder, deleteReminder, getReminders } from '../../api/reminders.api';
import CustomDatePicker from '../../components/CustomDatePicker';
import { PrimaryButton, SecondaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import LogScreen from '../../components/logs/LogScreen';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import {
    MotherReminder,
    REMINDER_QUICK_TIMES,
    ReminderCategory as Category,
    ReminderFrequency as Frequency,
    ReminderTime as TimeOfDay,
} from '../../types/reminder.types';
import { CareModelEnum } from '../../types/user.types';
import { fromISODateKey, toISODateKey } from '../../utils/dateKey';
import { showLogError } from '../../utils/motherLogHelpers';
import { ensureNotificationPermission } from '../../utils/notificationPermission';
import {
    WEEKDAYS,
    formatReminderDay,
    formatReminderTime,
    reminderFrequencyLabel,
    reminderTimeAsDate,
    toReminderTime,
} from '../../utils/reminderFormat';

type Step = 'list' | 'category' | 'when' | 'dates' | 'confirm';

const CATEGORIES: { key: Category; icon: string }[] = [
    { key: 'medicine', icon: 'pill' },
    { key: 'meals', icon: 'utensils' },
    { key: 'exercise', icon: 'activity' },
    { key: 'tests', icon: 'heart-pulse' },
    { key: 'other', icon: 'plus' },
];
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const FREQUENCIES: Frequency[] = ['daily', 'alternateDays', 'weekly', 'custom', 'once'];
const OTHER_OPTIONS = ['doctorAppointment', 'journaling', 'restBreak', 'drinkWater'] as const;

interface Draft {
    category: Category;
    otherDetail: string;
    /** "HH:MM", 24-hour. */
    time: string;
    frequency: Frequency;
    /** For "custom" only. */
    weekdays: number[];
    /** For "once" only: "YYYY-MM-DD". */
    date: string;
    ongoing: boolean;
    endWeeks: number;
}

/**
 * Her reminders, set here or through Viva in chat. Each is saved on the server, which
 * sends it as a push notification at the time she chose on the days its frequency
 * covers. The list holds only what she set; nothing is pre-filled.
 */
const Reminders: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { careModel } = useCareContext();

    const newDraft = (): Draft => ({
        category: 'medicine',
        otherDetail: t('logs.reminders.otherOptions.doctorAppointment'),
        time: REMINDER_QUICK_TIMES.morning,
        frequency: 'daily',
        weekdays: [],
        date: toISODateKey(new Date()),
        ongoing: true,
        endWeeks: 4,
    });

    const [step, setStep] = useState<Step>('list');
    const [reminders, setReminders] = useState<MotherReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<Draft>(newDraft);
    const [picker, setPicker] = useState<'time' | 'date' | null>(null);

    useFocusEffect(
        useCallback(() => {
            getReminders()
                .then(setReminders)
                .catch(error => showLogError(t, 'load', error, 'Reminders.load'))
                .finally(() => setLoading(false));
        }, [t]),
    );

    const update = (patch: Partial<Draft>) => setDraft(prev => ({ ...prev, ...patch }));

    const toggleWeekday = (day: number) =>
        update({
            weekdays: draft.weekdays.includes(day)
                ? draft.weekdays.filter(d => d !== day)
                : [...draft.weekdays, day],
        });

    const quickLabel = (key: TimeOfDay) =>
        `${t(`logs.reminders.times.${key}`)} · ${formatReminderTime(REMINDER_QUICK_TIMES[key])}`;
    const frequencyLabel = (frequency: Frequency, weekdays: number[], startDate?: string) =>
        reminderFrequencyLabel(t, i18n.language, frequency, weekdays, startDate);

    const detailOf = (d: Draft) =>
        d.category === 'other' ? d.otherDetail : t(`logs.reminders.details.${d.category}`);
    const durationOf = (d: Draft) => {
        if (d.frequency === 'once') return formatReminderDay(d.date, i18n.language);
        return d.ongoing ? t('logs.reminders.ongoing') : t('logs.reminders.endsInWeeks', { count: d.endWeeks });
    };

    const savedDetail = (r: MotherReminder) =>
        r.category === 'other' ? (r.detail ?? '') : t(`logs.reminders.details.${r.category}`);
    const savedSchedule = (r: MotherReminder) => {
        const time = formatReminderTime(r.time);
        if (r.frequency === 'once') {
            const parts = [formatReminderDay(r.startDate, i18n.language), time];
            if (r.lastSentDate === r.startDate) parts.push(t('logs.reminders.sent'));
            return parts.join(' · ');
        }
        return [
            time,
            frequencyLabel(r.frequency, r.weekdays, r.startDate),
            r.endDate
                ? t('logs.reminders.endsOn', {
                      date: fromISODateKey(r.endDate).toLocaleDateString(i18n.language, {
                          day: 'numeric',
                          month: 'short',
                      }),
                  })
                : t('logs.reminders.ongoingShort'),
        ].join(' · ');
    };

    const routeLabel = careModel === CareModelEnum.PRIVATE ? t('logs.reminders.private') : t('logs.reminders.public');
    // A one-time reminder for a moment already gone would never send.
    const oncePast =
        draft.frequency === 'once' &&
        draft.date === toISODateKey(new Date()) &&
        draft.time <= toReminderTime(new Date());
    const canSave = !saving && !oncePast && (draft.category !== 'other' || draft.otherDetail.trim().length > 0);

    const confirm = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const saved = await createReminder({
                category: draft.category,
                ...(draft.category === 'other' ? { detail: draft.otherDetail.trim() } : {}),
                time: draft.time,
                frequency: draft.frequency,
                ...(draft.frequency === 'custom' ? { weekdays: draft.weekdays } : {}),
                ...(draft.frequency === 'once'
                    ? { date: draft.date }
                    : { endWeeks: draft.ongoing ? null : draft.endWeeks }),
            });
            setReminders(prev => [...prev, saved]);
            setDraft(newDraft());
            setStep('list');
            // A reminder is only useful if it can notify; asks once, or points to settings.
            ensureNotificationPermission().catch(() => undefined);
        } catch (error: any) {
            const code = error?.response?.data?.data?.code;
            if (code === 'in_past' || code === 'limit') {
                Toast.show({
                    type: 'error',
                    text1: t('common.error'),
                    text2: t(code === 'in_past' ? 'logs.reminders.inPast' : 'logs.reminders.limit'),
                    position: 'bottom',
                });
            } else {
                showLogError(t, 'save', error, 'Reminders.create');
            }
        } finally {
            setSaving(false);
        }
    };

    // Remove at once; put it back if the server refuses.
    const cancelReminder = async (reminder: MotherReminder) => {
        const before = reminders;
        setReminders(prev => prev.filter(r => r._id !== reminder._id));
        try {
            await deleteReminder(reminder._id);
        } catch (error) {
            setReminders(before);
            showLogError(t, 'delete', error, 'Reminders.delete');
        }
    };

    const stepHeader = (n: number, titleKey: string) => (
        <>
            <Text style={[logsStyles.capsLabel, globalStyles.fontBold]}>{t('logs.reminders.stepOf', { step: n, total: 4 })}</Text>
            <Text style={[logsStyles.stepTitle, globalStyles.fontBold]}>{t(titleKey)}</Text>
        </>
    );

    const nav = (
        back: () => void,
        next: () => void,
        backKey = 'logs.common.back',
        nextKey = 'logs.reminders.next',
        disabled = false,
    ) => (
        <View style={[logsStyles.buttonPair, { marginTop: 2 }]}>
            <SecondaryButton label={t(backKey)} onPress={back} style={{ flex: 1 }} />
            <PrimaryButton rounded label={t(nextKey)} onPress={next} disabled={disabled} style={{ flex: 1.4 }} />
        </View>
    );

    const subtitle =
        step === 'list'
            ? loading
                ? undefined
                : t('logs.reminders.activeCount', { count: reminders.length })
            : t('logs.reminders.newReminder');

    return (
        <LogScreen title={t('logs.reminders.title')} subtitle={subtitle} contentStyle={{ paddingTop: 18, gap: 16 }}>
            {step === 'list' ? (
                <>
                    <Text style={[logsStyles.mutedLabel, { fontSize: 11, lineHeight: 16 }, globalStyles.fontRegular]}>
                        {t('logs.reminders.notifyHint')}
                    </Text>
                    <View style={{ gap: 10 }}>
                        {reminders.map(reminder => (
                            <View key={reminder._id} style={logsStyles.itemCard}>
                                <View style={logsStyles.iconBadge}>
                                    <Lucide name="bell" size={16} color={colors.darkPurple} />
                                </View>
                                <View style={logsStyles.itemBody}>
                                    <Text style={[logsStyles.itemTitle, { fontSize: 13 }, globalStyles.fontBold]}>
                                        {savedDetail(reminder)}
                                    </Text>
                                    <Text style={[logsStyles.itemSub, { fontSize: 11 }, globalStyles.fontRegular]}>
                                        {savedSchedule(reminder)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => cancelReminder(reminder)}
                                    accessibilityRole="button"
                                    style={logsStyles.cancelPill}
                                >
                                    <Text style={[logsStyles.cancelPillText, globalStyles.fontBold]}>
                                        {t('logs.common.cancel')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        {!loading && reminders.length === 0 ? (
                            <Text style={[logsStyles.emptyText, globalStyles.fontRegular]}>{t('logs.reminders.empty')}</Text>
                        ) : null}

                        <PrimaryButton
                            rounded
                            label={t('logs.reminders.newReminder')}
                            onPress={() => setStep('category')}
                            icon={<Lucide name="plus" size={16} color={colors.white} />}
                            style={{ marginTop: 4, borderRadius: 14, paddingVertical: 14 }}
                        />
                    </View>
                </>
            ) : null}

            {step === 'category' ? (
                <>
                    {stepHeader(1, 'logs.reminders.whatReminded')}
                    <View style={[logsStyles.tileGrid, { rowGap: 10 }]}>
                        {CATEGORIES.map(({ key, icon }) => {
                            const on = draft.category === key;
                            const wide = key === 'other';
                            return (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => update({ category: key })}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    style={[
                                        logsStyles.categoryTile,
                                        wide && logsStyles.categoryTileWide,
                                        on && logsStyles.categoryTileOn,
                                    ]}
                                >
                                    <Lucide name={icon as any} size={18} color={on ? colors.white : colors.darkPurple} />
                                    <Text
                                        style={[
                                            { fontSize: 13, color: on ? colors.white : colors.darkPurple },
                                            globalStyles.fontBold,
                                        ]}
                                    >
                                        {t(`logs.reminders.categories.${key}`)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {draft.category === 'other' ? (
                        <View style={{ gap: 8 }}>
                            <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.remindAbout')}</Text>
                            <TextInput
                                value={draft.otherDetail}
                                onChangeText={text => update({ otherDetail: text })}
                                placeholder={t('logs.reminders.typeOwn')}
                                placeholderTextColor={colors.vivaFaint}
                                style={[logsStyles.textInput, globalStyles.fontRegular]}
                            />
                            <Text style={[logsStyles.quickPickLabel, globalStyles.fontSemiBold]}>
                                {t('logs.common.orQuickPick')}
                            </Text>
                            <View style={logsStyles.chipRow}>
                                {OTHER_OPTIONS.map(key => {
                                    const label = t(`logs.reminders.otherOptions.${key}`);
                                    return (
                                        <Chip
                                            key={key}
                                            small
                                            label={label}
                                            selected={draft.otherDetail === label}
                                            onPress={() => update({ otherDetail: label })}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}

                    {nav(() => setStep('list'), () => setStep('when'), 'logs.common.cancel')}
                </>
            ) : null}

            {step === 'when' ? (
                <>
                    {stepHeader(2, 'logs.reminders.whenRemind')}
                    <View style={{ gap: 8 }}>
                        <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.timeOfDay')}</Text>
                        <View style={logsStyles.chipRow}>
                            {TIMES.map(key => (
                                <Chip
                                    key={key}
                                    label={quickLabel(key)}
                                    selected={draft.time === REMINDER_QUICK_TIMES[key]}
                                    onPress={() => update({ time: REMINDER_QUICK_TIMES[key] })}
                                />
                            ))}
                        </View>
                        <TouchableOpacity
                            onPress={() => setPicker('time')}
                            accessibilityRole="button"
                            accessibilityLabel={t('logs.reminders.changeTime')}
                            style={[logsStyles.startDateBox, logsStyles.spaceBetween]}
                        >
                            <Text style={[{ fontSize: 13.5, color: colors.darkPurple }, globalStyles.fontBold]}>
                                {formatReminderTime(draft.time)}
                            </Text>
                            <Text style={[{ fontSize: 12, color: colors.darkPurple }, globalStyles.fontSemiBold]}>
                                {t('logs.reminders.changeTime')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ gap: 8 }}>
                        <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.frequency')}</Text>
                        <View style={logsStyles.chipRow}>
                            {FREQUENCIES.map(key => (
                                <Chip
                                    key={key}
                                    label={t(`logs.reminders.frequencies.${key}`)}
                                    selected={draft.frequency === key}
                                    onPress={() => update({ frequency: key })}
                                />
                            ))}
                        </View>
                    </View>
                    {draft.frequency === 'custom' ? (
                        <View style={{ gap: 8 }}>
                            <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.pickDays')}</Text>
                            <View style={logsStyles.chipRow}>
                                {WEEKDAYS.map(day => (
                                    <Chip
                                        key={day}
                                        small
                                        label={t(`logs.reminders.weekdays.${day}`)}
                                        selected={draft.weekdays.includes(day)}
                                        onPress={() => toggleWeekday(day)}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : null}
                    {nav(
                        () => setStep('category'),
                        () => setStep('dates'),
                        undefined,
                        undefined,
                        draft.frequency === 'custom' && draft.weekdays.length === 0,
                    )}
                </>
            ) : null}

            {step === 'dates' ? (
                <>
                    {stepHeader(3, draft.frequency === 'once' ? 'logs.reminders.whichDay' : 'logs.reminders.startEnd')}
                    {draft.frequency === 'once' ? (
                        <TouchableOpacity
                            onPress={() => setPicker('date')}
                            accessibilityRole="button"
                            accessibilityLabel={t('logs.reminders.changeDate')}
                            style={[logsStyles.startDateBox, logsStyles.spaceBetween]}
                        >
                            <Text style={[{ fontSize: 13.5, color: colors.darkPurple }, globalStyles.fontBold]}>
                                {formatReminderDay(draft.date, i18n.language)}
                            </Text>
                            <Text style={[{ fontSize: 12, color: colors.darkPurple }, globalStyles.fontSemiBold]}>
                                {t('logs.reminders.changeDate')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <View style={{ gap: 8 }}>
                                <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.startDate')}</Text>
                                <View style={logsStyles.startDateBox}>
                                    <Text style={[{ fontSize: 13.5, color: colors.darkPurple }, globalStyles.fontBold]}>
                                        {t('logs.reminders.today')}
                                    </Text>
                                </View>
                            </View>
                            <View style={{ gap: 8 }}>
                                <Text style={[logsStyles.fieldLabel, globalStyles.fontBold]}>{t('logs.reminders.endDate')}</Text>
                                <View style={logsStyles.buttonPair}>
                                    {[true, false].map(ongoing => {
                                        const on = draft.ongoing === ongoing;
                                        return (
                                            <TouchableOpacity
                                                key={String(ongoing)}
                                                onPress={() => update({ ongoing })}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: on }}
                                                style={[logsStyles.endOption, on && logsStyles.categoryTileOn]}
                                            >
                                                <Text
                                                    style={[
                                                        { fontSize: 12.5, textAlign: 'center', color: on ? colors.white : colors.darkPurple },
                                                        globalStyles.fontBold,
                                                    ]}
                                                >
                                                    {ongoing ? t('logs.reminders.ongoing') : t('logs.reminders.setEndDate')}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {!draft.ongoing ? (
                                    <View style={logsStyles.weeksBox}>
                                        <TouchableOpacity
                                            onPress={() => update({ endWeeks: Math.max(1, draft.endWeeks - 1) })}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('logs.reminders.fewerWeeks')}
                                            style={[logsStyles.weeksButton, { backgroundColor: colors.white }]}
                                        >
                                            <Text style={[{ fontSize: 18, color: colors.darkPurple }, globalStyles.fontBold]}>−</Text>
                                        </TouchableOpacity>
                                        <Text style={[{ fontSize: 14.5, minWidth: 130, textAlign: 'center', color: colors.vivaInk }, globalStyles.fontBold]}>
                                            {t('logs.reminders.endsInWeeks', { count: draft.endWeeks })}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => update({ endWeeks: draft.endWeeks + 1 })}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('logs.reminders.moreWeeks')}
                                            style={[logsStyles.weeksButton, { backgroundColor: colors.darkPurple }]}
                                        >
                                            <Text style={[{ fontSize: 18, color: colors.white }, globalStyles.fontBold]}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                            </View>
                        </>
                    )}
                    {oncePast ? (
                        <Text style={[logsStyles.mutedLabel, { fontSize: 12, color: colors.vivaDangerText }, globalStyles.fontSemiBold]}>
                            {t('logs.reminders.inPast')}
                        </Text>
                    ) : null}
                    {nav(() => setStep('when'), () => setStep('confirm'), undefined, undefined, oncePast)}
                </>
            ) : null}

            {step === 'confirm' ? (
                <>
                    {stepHeader(4, 'logs.reminders.confirmTitle')}
                    <View style={[logsStyles.itemCard, { flexDirection: 'column', alignItems: 'stretch', padding: 16, gap: 10 }]}>
                        {[
                            ['reminder', detailOf(draft)],
                            ['care', routeLabel],
                            ['time', formatReminderTime(draft.time)],
                            ['frequency', frequencyLabel(draft.frequency, draft.weekdays)],
                            ['duration', durationOf(draft)],
                        ].map(([key, value]) => (
                            <View key={key} style={logsStyles.spaceBetween}>
                                <Text style={[logsStyles.mutedLabel, { fontSize: 12.5 }, globalStyles.fontRegular]}>
                                    {t(`logs.reminders.confirmRows.${key}`)}
                                </Text>
                                <Text style={[{ fontSize: 12.5, color: colors.vivaInk, flexShrink: 1, textAlign: 'right' }, globalStyles.fontBold]}>
                                    {value}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {nav(() => setStep('dates'), confirm, 'logs.common.back', 'logs.reminders.doneSet', !canSave)}
                </>
            ) : null}

            <CustomDatePicker
                show={picker !== null}
                setShow={show => {
                    if (!show) setPicker(null);
                }}
                mode={picker === 'date' ? 'date' : 'time'}
                minimumDate={picker === 'date'}
                selectedDate={picker === 'date' ? fromISODateKey(draft.date) : reminderTimeAsDate(draft.time)}
                onSelect={value =>
                    update(picker === 'date' ? { date: toISODateKey(value) } : { time: toReminderTime(value) })
                }
            />
        </LogScreen>
    );
};

export default Reminders;
