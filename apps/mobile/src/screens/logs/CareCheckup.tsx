import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ANC_CHECKS, CareKind, PNC_CHECKS } from '@vivamama/care-schedules';

import { addMotherLog, getCareSchedule, setCareScheduleItem } from '../../api/motherLogs.api';
import { PrimaryButton } from '../../components/logs/Buttons';
import { DoneState } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import SegmentedToggle from '../../components/logs/SegmentedToggle';
import CareModelPrompt from '../../components/logs/CareModelPrompt';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { i18nKey } from '../../types/motherLog.types';
import { careRoute, scheduleFor } from '../../utils/careSchedule';
import { showLogError } from '../../utils/motherLogHelpers';

const CHECKS: Record<CareKind, readonly string[]> = { anc: ANC_CHECKS, pnc: PNC_CHECKS };

export type CareCheckupTab = 'log' | 'schedule';

interface CareCheckupProps {
    kind: CareKind;
    initialTab?: CareCheckupTab;
}

const toggled = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
};

/**
 * Log a visit, or tick off the recommended schedule. One screen for the ANC checkup while
 * she is pregnant and the PNC checkup after the birth. Her care route picks the schedule;
 * structure and timing come from @vivamama/care-schedules and the words from
 * `logs.<kind>.schedule.<route>`.
 */
const CareCheckup: React.FC<CareCheckupProps> = ({ kind, initialTab = 'log' }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const {
        careModel,
        pregnancyWeek,
        postpartumWeek,
        deliveryType,
        deliveryOutcome,
        hasGdm,
        loading: careLoading,
    } = useCareContext();
    const [tab, setTab] = useState<CareCheckupTab>(initialTab);
    const [checks, setChecks] = useState<Set<string>>(new Set());
    const [done, setDone] = useState(false);
    const [saving, setSaving] = useState(false);
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
    const [scheduleLoading, setScheduleLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            getCareSchedule(kind)
                .then(ids => setDoneIds(new Set(ids)))
                .catch(error => showLogError(t, 'load', error, 'CareCheckup.loadSchedule'))
                .finally(() => setScheduleLoading(false));
        }, [kind, t]),
    );

    const saveVisit = async () => {
        setSaving(true);
        try {
            await addMotherLog(`${kind}_visit`, { checks: CHECKS[kind].filter(key => checks.has(key)) });
            setDone(true);
        } catch (error) {
            showLogError(t, 'save', error, 'CareCheckup.saveVisit');
        } finally {
            setSaving(false);
        }
    };

    // Tick at once, then take the server's list; roll back if it refuses.
    const toggleItem = async (id: string) => {
        const before = doneIds;
        const nextDone = !doneIds.has(id);
        setDoneIds(prev => toggled(prev, id));
        try {
            setDoneIds(new Set(await setCareScheduleItem(kind, id, nextDone)));
        } catch (error) {
            setDoneIds(before);
            showLogError(t, 'save', error, 'CareCheckup.toggleItem');
        }
    };

    const route = careRoute(careModel);
    const schedule = useMemo(
        () => scheduleFor(kind, route, { deliveryType, deliveryOutcome, hasGdm }),
        [kind, route, deliveryType, deliveryOutcome, hasGdm],
    );
    const allIds = schedule.groups.flatMap(group => group.items.map(item => item.id));
    const doneCount = allIds.filter(id => doneIds.has(id)).length;
    const week = kind === 'anc' ? pregnancyWeek : postpartumWeek;
    const copy = `logs.${kind}`;

    const fixedTop = (
        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
            <View style={[logsStyles.tintNote, { paddingHorizontal: 16 }]}>
                <Text style={[logsStyles.tintNoteText, { fontSize: 13 }, globalStyles.fontSemiBold]}>
                    {week ? t(`${copy}.weekToday`, { week }) : t(`${copy}.visitToday`)}
                </Text>
            </View>
            <SegmentedToggle
                variant="tab"
                value={tab}
                onChange={setTab}
                options={[
                    { key: 'log', label: t(`${copy}.logVisit`) },
                    { key: 'schedule', label: t(`${copy}.recommendedSchedule`) },
                ]}
            />
        </View>
    );

    return (
        <LogScreen title={t(`${copy}.title`)} fixedTop={fixedTop} contentStyle={{ gap: 16 }}>
            {tab === 'log' && done ? (
                <DoneState
                    title={t(`${copy}.logged`)}
                    subtitle={t(`${copy}.checksRecorded`, { count: checks.size })}
                    actionLabel={t('logs.common.logMore')}
                    onAction={() => navigation.navigate('LogPicker')}
                />
            ) : null}

            {tab === 'log' && !done ? (
                <>
                    <Text style={[logsStyles.questionTitle, globalStyles.fontBold]}>{t(`${copy}.whichChecks`)}</Text>
                    <View style={[logsStyles.tileGrid, { rowGap: 10 }]}>
                        {CHECKS[kind].map(key => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setChecks(prev => toggled(prev, key))}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: checks.has(key) }}
                                style={[
                                    logsStyles.choiceCard,
                                    { width: '48.5%', paddingVertical: 13, paddingHorizontal: 14 },
                                    checks.has(key) && logsStyles.choiceCardOn,
                                ]}
                            >
                                <Text style={[logsStyles.itemTitle, { fontSize: 13 }, globalStyles.fontSemiBold]}>
                                    {t(`${copy}.checks.${i18nKey(key)}`)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[logsStyles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
                        <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t(`${copy}.nextVisitHint`)}</Text>
                    </View>
                    <PrimaryButton
                        label={t('logs.common.saveLog')}
                        onPress={saveVisit}
                        disabled={checks.size === 0 || saving}
                    />
                </>
            ) : null}

            {tab === 'schedule' && scheduleLoading && careModel ? (
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
            ) : null}

            {tab === 'schedule' && !careLoading && !careModel ? <CareModelPrompt /> : null}

            {tab === 'schedule' && !scheduleLoading && careModel ? (
                <>
                    <View style={[logsStyles.listRow]}>
                        <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t(`${copy}.checkedOff`)}</Text>
                        <Text style={[{ fontSize: 13, color: colors.darkPurple }, globalStyles.fontBold]}>
                            {t(`${copy}.progress`, { count: doneCount, total: allIds.length })}
                        </Text>
                    </View>

                    {schedule.groups.map(({ id: group, items }) => (
                        <View key={group} style={{ gap: 8 }}>
                            <Text style={[logsStyles.capsLabel, globalStyles.fontBold]}>
                                {t(`${copy}.schedule.${route}.groups.${group}`)}
                            </Text>
                            {items.map(({ id }) => {
                                const isDone = doneIds.has(id);
                                return (
                                    <View
                                        key={id}
                                        style={[
                                            logsStyles.itemCard,
                                            { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
                                            isDone && logsStyles.itemCardDone,
                                        ]}
                                    >
                                        <View style={[logsStyles.itemBody, { gap: 1 }]}>
                                            <Text style={[logsStyles.itemTitle, { fontSize: 12.5 }, globalStyles.fontBold]}>
                                                {t(`${copy}.schedule.${route}.${id}.label`)}
                                            </Text>
                                            <Text style={[logsStyles.itemSub, { fontSize: 10.5 }, globalStyles.fontRegular]}>
                                                {t(`${copy}.schedule.${route}.${id}.timing`)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => toggleItem(id)}
                                            accessibilityRole="button"
                                            style={[
                                                logsStyles.smallActionButton,
                                                { paddingVertical: 7, paddingHorizontal: 11 },
                                                isDone && logsStyles.smallActionButtonDone,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    logsStyles.smallActionText,
                                                    { fontSize: 10.5 },
                                                    isDone && logsStyles.smallActionTextDone,
                                                    globalStyles.fontBold,
                                                ]}
                                            >
                                                {isDone ? t(`${copy}.done`) : t(`${copy}.markDone`)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    ))}

                    {/* Repeats every month, so there is nothing to tick off. */}
                    {schedule.recurring.map(({ id }) => (
                        <View
                            key={id}
                            style={[logsStyles.itemCard, { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }]}
                        >
                            <View style={[logsStyles.itemBody, { gap: 1 }]}>
                                <Text style={[logsStyles.itemTitle, { fontSize: 12.5 }, globalStyles.fontBold]}>
                                    {t(`${copy}.schedule.${route}.${id}.label`)}
                                </Text>
                                <Text style={[logsStyles.itemSub, { fontSize: 10.5 }, globalStyles.fontRegular]}>
                                    {t(`${copy}.schedule.${route}.${id}.timing`)}
                                </Text>
                            </View>
                        </View>
                    ))}

                    <Text style={[logsStyles.footnote, globalStyles.fontRegular]}>
                        {t(`${copy}.schedule.${route}.footnote`)}
                    </Text>
                </>
            ) : null}
        </LogScreen>
    );
};

export default CareCheckup;
