import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CareRoute } from '@vivamama/care-schedules';

import { recordError } from '../../analytics';
import { getCareSchedule } from '../../api/motherLogs.api';
import { createReminder, getReminders } from '../../api/reminders.api';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { REMINDER_QUICK_TIMES } from '../../types/reminder.types';
import { CareScheduleContext, scheduleFor } from '../../utils/careSchedule';
import { ComingUpRow, comingUp, reminderDate, schedulePlace } from '../../utils/comingUp';
import { JourneyPosition } from '../../utils/journeyPosition';
import { showLogError } from '../../utils/motherLogHelpers';
import { useCardWidth } from './CardRail';

type Placed = Extract<JourneyPosition, { kind: 'pregnant' | 'postpartum' }>;

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
/** The longest detail a reminder accepts. */
const REMINDER_DETAIL_MAX = 80;

const headline = (position: Placed, t: TFunction): string => {
    if (position.kind === 'postpartum') return t('journey.comingUp.postnatal');
    if (position.inLabour) return t('journey.comingUp.afterBirth');
    if (position.daysToDue < 0) return t('journey.comingUp.pastDue');
    if (position.daysToDue < DAYS_PER_WEEK) return t('journey.comingUp.dueSoon');
    return t('journey.comingUp.weeksToDue', { count: Math.round(position.daysToDue / DAYS_PER_WEEK) });
};

interface ComingUpCardProps {
    position: Placed;
    route: CareRoute;
    context: CareScheduleContext;
}

/** Card 2: her next steps, read from the ANC or PNC recommended schedule. */
const ComingUpCard: React.FC<ComingUpCardProps> = ({ position, route, context }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const width = useCardWidth();
    const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
    const [remindedDetails, setRemindedDetails] = useState<ReadonlySet<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const place = schedulePlace(position);
    const kind = place?.kind ?? 'anc';

    // On focus, so an item ticked in the schedule has moved on when she comes back.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            getCareSchedule(kind)
                .then(ids => {
                    if (!cancelled) setDoneIds(new Set(ids));
                })
                .catch(error => recordError(error, 'ComingUpCard.loadSchedule'));
            getReminders()
                .then(reminders => {
                    if (cancelled) return;
                    const oneTime = reminders.filter(reminder => reminder.frequency === 'once');
                    setRemindedDetails(new Set(oneTime.map(reminder => reminder.detail ?? '')));
                })
                .catch(error => recordError(error, 'ComingUpCard.loadReminders'));
            return () => {
                cancelled = true;
            };
        }, [kind]),
    );

    const schedule = useMemo(() => scheduleFor(kind, route, context), [kind, route, context]);
    const { rows, more } = useMemo(
        () => comingUp(schedule, place?.at ?? 0, doneIds),
        [schedule, place?.at, doneIds],
    );

    const labelOf = (row: ComingUpRow) => t(`logs.${kind}.schedule.${route}.${row.id}.label`);
    const timingOf = (row: ComingUpRow) => t(`logs.${kind}.schedule.${route}.${row.id}.timing`);

    const whenLabel = (row: ComingUpRow): { big: string; small?: string } => {
        if (row.dayOfMonth) {
            return { big: t('journey.comingUp.dayOfMonth', { day: row.dayOfMonth }), small: t('journey.comingUp.ofMonth') };
        }
        if (row.startsIn === 0) return { big: t('journey.comingUp.now') };
        const days = kind === 'anc' ? row.startsIn * DAYS_PER_WEEK : row.startsIn;
        if (days < DAYS_PER_WEEK * 2) return { big: t('journey.comingUp.inDays', { count: days }) };
        if (days < DAYS_PER_MONTH * 2) {
            return { big: t('journey.comingUp.inWeeks', { count: Math.round(days / DAYS_PER_WEEK) }) };
        }
        return { big: t('journey.comingUp.inMonths', { count: Math.round(days / DAYS_PER_MONTH) }) };
    };

    const next = rows[0];
    const reminderDetail = next ? labelOf(next).slice(0, REMINDER_DETAIL_MAX) : '';
    const reminded = !!next && remindedDetails.has(reminderDetail);

    const remind = async () => {
        if (!next || reminded || saving) return;
        setSaving(true);
        try {
            await createReminder({
                category: 'other',
                detail: reminderDetail,
                time: REMINDER_QUICK_TIMES.morning,
                frequency: 'once',
                date: reminderDate(next, kind),
            });
            setRemindedDetails(previous => new Set([...previous, reminderDetail]));
        } catch (error) {
            showLogError(t, 'save', error, 'ComingUpCard.remind');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[styles.card, { width, backgroundColor: colors.journeyTealBG }]}>
            <View style={styles.cardPad}>
                <Text style={[styles.cardLabel, { color: colors.journeyTealText }, globalStyles.fontSemiBold]}>
                    {t('journey.comingUp.title')}
                </Text>
                <Text style={[styles.cardHeading, globalStyles.fontBold]}>
                    {rows.length > 0 ? headline(position, t) : t('journey.comingUp.allDoneTitle')}
                </Text>

                {rows.length === 0 ? (
                    <Text style={[styles.cardBody, globalStyles.fontRegular]}>{t('journey.comingUp.allDoneBody')}</Text>
                ) : null}

                {rows.map(row => {
                    const when = whenLabel(row);
                    return (
                        <View key={row.id} style={styles.dateRow}>
                            <View style={styles.dateWhen}>
                                <Text style={[styles.dateWhenBig, globalStyles.fontBold]}>{when.big}</Text>
                                {when.small ? (
                                    <Text style={[styles.dateWhenSmall, globalStyles.fontRegular]}>{when.small}</Text>
                                ) : null}
                            </View>
                            <View style={styles.dateBody}>
                                <Text style={[styles.dateLabel, globalStyles.fontSemiBold]}>{labelOf(row)}</Text>
                                <Text style={[styles.dateTiming, globalStyles.fontRegular]}>{timingOf(row)}</Text>
                            </View>
                        </View>
                    );
                })}

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() =>
                        navigation.navigate(kind === 'anc' ? 'AncCheckup' : 'PncCheckup', { tab: 'schedule' })
                    }
                    accessibilityRole="link"
                >
                    <Text style={[styles.linkText, globalStyles.fontSemiBold]}>
                        {more > 0
                            ? t('journey.comingUp.fullScheduleMore', { count: more })
                            : t('journey.comingUp.fullSchedule')}
                    </Text>
                </TouchableOpacity>

                {next ? (
                    <TouchableOpacity
                        style={[styles.bigButton, { marginTop: 'auto', backgroundColor: colors.journeyTeal }]}
                        onPress={remind}
                        disabled={reminded || saving}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: reminded || saving }}
                    >
                        <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>
                            {t(reminded ? 'journey.comingUp.reminderSet' : 'journey.comingUp.remindMe')}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
};

export default ComingUpCard;
