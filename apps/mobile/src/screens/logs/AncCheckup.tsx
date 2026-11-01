import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { addMotherLog, getAncSchedule, setAncScheduleItem } from '../../api/motherLogs.api';
import { PrimaryButton } from '../../components/logs/Buttons';
import { DoneState } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import SegmentedToggle from '../../components/logs/SegmentedToggle';
import { useCareContext } from '../../hooks/useCareContext';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { AncCheck, i18nKey } from '../../types/motherLog.types';
import { CareModelEnum } from '../../types/user.types';
import { showLogError } from '../../utils/motherLogHelpers';

const CHECKS: AncCheck[] = ['bp', 'weight', 'abdominal', 'hb', 'urine', 'fetal_heartbeat'];
type Check = AncCheck;

// Visit groups and their item ids. Labels and timings live in i18n under
// `logs.anc.schedule.<route>.<id>`; group titles under `logs.anc.schedule.<route>.groups`.
const SCHEDULES: Record<CareModelEnum, { group: string; items: string[] }[]> = {
    [CareModelEnum.PUBLIC]: [
        { group: 'g1', items: ['g1a', 'g1b', 'g1c'] },
        { group: 'g2', items: ['g2a', 'g2b', 'g2c', 'g2d'] },
        { group: 'g3', items: ['g3a', 'g3b'] },
        { group: 'g4', items: ['g4a', 'g4b'] },
    ],
    [CareModelEnum.PRIVATE]: [
        { group: 'p1', items: ['p1a', 'p1b', 'p1c'] },
        { group: 'p2', items: ['p2a', 'p2b', 'p2c', 'p2d'] },
        { group: 'p3', items: ['p3a', 'p3b', 'p3c', 'p3d'] },
    ],
};

/**
 * Log an ANC visit, or tick off the recommended schedule. The design lets you switch
 * between the government and private schedules; here her care route picks one.
 */
const AncCheckup: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { careModel, pregnancyWeek } = useCareContext();
    const [tab, setTab] = useState<'log' | 'schedule'>('log');
    const [checks, setChecks] = useState<Set<Check>>(new Set());
    const [done, setDone] = useState(false);
    const [saving, setSaving] = useState(false);
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
    const [scheduleLoading, setScheduleLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            getAncSchedule()
                .then(ids => setDoneIds(new Set(ids)))
                .catch(error => showLogError(t, 'load', error, 'AncCheckup.loadSchedule'))
                .finally(() => setScheduleLoading(false));
        }, [t]),
    );

    const saveVisit = async () => {
        setSaving(true);
        try {
            await addMotherLog('anc_visit', { checks: CHECKS.filter(key => checks.has(key)) });
            setDone(true);
        } catch (error) {
            showLogError(t, 'save', error, 'AncCheckup.saveVisit');
        } finally {
            setSaving(false);
        }
    };

    // Tick at once, then take the server's list; roll back if it refuses.
    const toggleItem = async (id: string) => {
        const before = doneIds;
        const nextDone = !doneIds.has(id);
        setDoneIds(prev => toggle(prev, id));
        try {
            setDoneIds(new Set(await setAncScheduleItem(id, nextDone)));
        } catch (error) {
            setDoneIds(before);
            showLogError(t, 'save', error, 'AncCheckup.toggleItem');
        }
    };

    const route = careModel === CareModelEnum.PRIVATE ? 'private' : 'public';
    const schedule = SCHEDULES[careModel];
    const allIds = schedule.flatMap(g => g.items);
    const doneCount = allIds.filter(id => doneIds.has(id)).length;

    const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
    };

    const fixedTop = (
        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
            <View style={[logsStyles.tintNote, { paddingHorizontal: 16 }]}>
                <Text style={[logsStyles.tintNoteText, { fontSize: 13 }, globalStyles.fontSemiBold]}>
                    {pregnancyWeek
                        ? t('logs.anc.weekToday', { week: pregnancyWeek })
                        : t('logs.anc.visitToday')}
                </Text>
            </View>
            <SegmentedToggle
                variant="tab"
                value={tab}
                onChange={setTab}
                options={[
                    { key: 'log', label: t('logs.anc.logVisit') },
                    { key: 'schedule', label: t('logs.anc.recommendedSchedule') },
                ]}
            />
        </View>
    );

    return (
        <LogScreen title={t('logs.anc.title')} fixedTop={fixedTop} contentStyle={{ gap: 16 }}>
            {tab === 'log' && done ? (
                <DoneState
                    title={t('logs.anc.logged')}
                    subtitle={t('logs.anc.checksRecorded', { count: checks.size })}
                    actionLabel={t('logs.common.logMore')}
                    onAction={() => navigation.navigate('LogPicker')}
                />
            ) : null}

            {tab === 'log' && !done ? (
                <>
                    <Text style={[logsStyles.questionTitle, globalStyles.fontBold]}>{t('logs.anc.whichChecks')}</Text>
                    <View style={[logsStyles.tileGrid, { rowGap: 10 }]}>
                        {CHECKS.map(key => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setChecks(prev => toggle(prev, key))}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: checks.has(key) }}
                                style={[
                                    logsStyles.choiceCard,
                                    { width: '48.5%', paddingVertical: 13, paddingHorizontal: 14 },
                                    checks.has(key) && logsStyles.choiceCardOn,
                                ]}
                            >
                                <Text style={[logsStyles.itemTitle, { fontSize: 13 }, globalStyles.fontSemiBold]}>
                                    {t(`logs.anc.checks.${i18nKey(key)}`)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[logsStyles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
                        <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t('logs.anc.nextVisitHint')}</Text>
                    </View>
                    <PrimaryButton
                        label={t('logs.common.saveLog')}
                        onPress={saveVisit}
                        disabled={checks.size === 0 || saving}
                    />
                </>
            ) : null}

            {tab === 'schedule' && scheduleLoading ? (
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
            ) : null}

            {tab === 'schedule' && !scheduleLoading ? (
                <>
                    <View style={[logsStyles.listRow]}>
                        <Text style={[logsStyles.mutedLabel, globalStyles.fontRegular]}>{t('logs.anc.checkedOff')}</Text>
                        <Text style={[{ fontSize: 13, color: colors.darkPurple }, globalStyles.fontBold]}>
                            {t('logs.anc.progress', { count: doneCount, total: allIds.length })}
                        </Text>
                    </View>

                    {schedule.map(({ group, items }) => (
                        <View key={group} style={{ gap: 8 }}>
                            <Text style={[logsStyles.capsLabel, globalStyles.fontBold]}>
                                {t(`logs.anc.schedule.${route}.groups.${group}`)}
                            </Text>
                            {items.map(id => {
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
                                                {t(`logs.anc.schedule.${route}.${id}.label`)}
                                            </Text>
                                            <Text style={[logsStyles.itemSub, { fontSize: 10.5 }, globalStyles.fontRegular]}>
                                                {t(`logs.anc.schedule.${route}.${id}.timing`)}
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
                                                {isDone ? t('logs.anc.done') : t('logs.anc.markDone')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    ))}

                    <Text style={[logsStyles.footnote, globalStyles.fontRegular]}>
                        {t(`logs.anc.schedule.${route}.footnote`)}
                    </Text>
                </>
            ) : null}
        </LogScreen>
    );
};

export default AncCheckup;
