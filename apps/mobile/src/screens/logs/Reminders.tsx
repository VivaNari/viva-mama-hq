import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { PrimaryButton, SecondaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import LogScreen from '../../components/logs/LogScreen';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { CareModelEnum } from '../../types/user.types';

type Step = 'list' | 'category' | 'when' | 'dates' | 'confirm';
type Category = 'medicine' | 'meals' | 'exercise' | 'tests' | 'other';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
type Frequency = 'daily' | 'alternateDays' | 'weekly' | 'custom';

const CATEGORIES: { key: Category; icon: string }[] = [
    { key: 'medicine', icon: 'pill' },
    { key: 'meals', icon: 'utensils' },
    { key: 'exercise', icon: 'activity' },
    { key: 'tests', icon: 'heart-pulse' },
    { key: 'other', icon: 'plus' },
];
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const FREQUENCIES: Frequency[] = ['daily', 'alternateDays', 'weekly', 'custom'];
const OTHER_OPTIONS = ['doctorAppointment', 'journaling', 'restBreak', 'drinkWater'] as const;

interface Draft {
    category: Category;
    otherDetail: string;
    time: TimeOfDay;
    frequency: Frequency;
    ongoing: boolean;
    endWeeks: number;
}

/** A pre-set reminder (i18n key) or one she created (draft values). */
type Reminder = { id: string; presetKey: string } | { id: string; draft: Draft };

// Pre-set lists from the design, seeded by route. To be generated from her schedule
// once the reminders engine exists.
const PRESETS: Record<CareModelEnum, string[]> = {
    [CareModelEnum.PUBLIC]: ['ironCalcium', 'ancVisit', 'pmsma', 'thr'],
    [CareModelEnum.PRIVATE]: ['ironCalciumRx', 'doctorAppointment', 'growthScan', 'babyVaccines'],
};

const Reminders: React.FC = () => {
    const { t } = useTranslation();
    const { careModel, loading } = useCareContext();

    const newDraft = (): Draft => ({
        category: 'medicine',
        otherDetail: t('logs.reminders.otherOptions.doctorAppointment'),
        time: 'morning',
        frequency: 'daily',
        ongoing: true,
        endWeeks: 4,
    });

    const [step, setStep] = useState<Step>('list');
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [draft, setDraft] = useState<Draft>(newDraft);

    // Seed the route's pre-set list once her care route is known.
    useEffect(() => {
        if (!loading) setReminders(PRESETS[careModel].map(key => ({ id: key, presetKey: key })));
    }, [loading, careModel]);

    const update = (patch: Partial<Draft>) => setDraft(prev => ({ ...prev, ...patch }));

    const detailOf = (d: Draft) =>
        d.category === 'other' ? d.otherDetail : t(`logs.reminders.details.${d.category}`);
    const durationOf = (d: Draft) =>
        d.ongoing ? t('logs.reminders.ongoing') : t('logs.reminders.endsInWeeks', { count: d.endWeeks });
    const scheduleOf = (d: Draft) =>
        [t(`logs.reminders.times.${d.time}`), t(`logs.reminders.frequencies.${d.frequency}`), durationOf(d)].join(
            ' · ',
        );

    const routeLabel = careModel === CareModelEnum.PRIVATE ? t('logs.reminders.private') : t('logs.reminders.public');

    const confirm = () => {
        setReminders(prev => [...prev, { id: `${Date.now()}`, draft }]);
        setDraft(newDraft());
        setStep('list');
    };

    const stepHeader = (n: number, titleKey: string) => (
        <>
            <Text style={[logsStyles.capsLabel, globalStyles.fontBold]}>{t('logs.reminders.stepOf', { step: n, total: 4 })}</Text>
            <Text style={[logsStyles.stepTitle, globalStyles.fontBold]}>{t(titleKey)}</Text>
        </>
    );

    const nav = (back: () => void, next: () => void, backKey = 'logs.common.back', nextKey = 'logs.reminders.next') => (
        <View style={[logsStyles.buttonPair, { marginTop: 2 }]}>
            <SecondaryButton label={t(backKey)} onPress={back} style={{ flex: 1 }} />
            <PrimaryButton rounded label={t(nextKey)} onPress={next} style={{ flex: 1.4 }} />
        </View>
    );

    const subtitle =
        step === 'list'
            ? t('logs.reminders.activeCount', { count: reminders.length })
            : t('logs.reminders.newReminder');

    return (
        <LogScreen title={t('logs.reminders.title')} subtitle={subtitle} contentStyle={{ paddingTop: 18, gap: 16 }}>
            {step === 'list' ? (
                <>
                    <Text style={[logsStyles.mutedLabel, { fontSize: 11, lineHeight: 16 }, globalStyles.fontRegular]}>
                        {t(`logs.reminders.routeHint.${careModel}`)}
                    </Text>
                    <View style={{ gap: 10 }}>
                        {reminders.map(reminder => (
                            <View key={reminder.id} style={logsStyles.itemCard}>
                                <View style={logsStyles.iconBadge}>
                                    <Lucide name="bell" size={16} color={colors.darkPurple} />
                                </View>
                                <View style={logsStyles.itemBody}>
                                    <Text style={[logsStyles.itemTitle, { fontSize: 13 }, globalStyles.fontBold]}>
                                        {'presetKey' in reminder
                                            ? t(`logs.reminders.presets.${reminder.presetKey}.detail`)
                                            : detailOf(reminder.draft)}
                                    </Text>
                                    <Text style={[logsStyles.itemSub, { fontSize: 11 }, globalStyles.fontRegular]}>
                                        {'presetKey' in reminder
                                            ? t(`logs.reminders.presets.${reminder.presetKey}.schedule`)
                                            : scheduleOf(reminder.draft)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setReminders(prev => prev.filter(r => r.id !== reminder.id))}
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
                                    label={t(`logs.reminders.times.${key}`)}
                                    selected={draft.time === key}
                                    onPress={() => update({ time: key })}
                                />
                            ))}
                        </View>
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
                    {nav(() => setStep('category'), () => setStep('dates'))}
                </>
            ) : null}

            {step === 'dates' ? (
                <>
                    {stepHeader(3, 'logs.reminders.startEnd')}
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
                    {nav(() => setStep('when'), () => setStep('confirm'))}
                </>
            ) : null}

            {step === 'confirm' ? (
                <>
                    {stepHeader(4, 'logs.reminders.confirmTitle')}
                    <View style={[logsStyles.itemCard, { flexDirection: 'column', alignItems: 'stretch', padding: 16, gap: 10 }]}>
                        {[
                            ['reminder', detailOf(draft)],
                            ['care', routeLabel],
                            ['time', t(`logs.reminders.times.${draft.time}`)],
                            ['frequency', t(`logs.reminders.frequencies.${draft.frequency}`)],
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
                    {nav(() => setStep('dates'), confirm, 'logs.common.back', 'logs.reminders.doneSet')}
                </>
            ) : null}
        </LogScreen>
    );
};

export default Reminders;
