import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { getDiaperLogs } from '../../api/infantDiaper.api';
import { getGrowthLogs } from '../../api/infantGrowth.api';
import { getInfantWellbeing } from '../../api/infantWellbeing.api';
import { IInfantWellbeing } from '../../types/infantWellbeing.types';
import InfantWellbeingCard from './InfantWellbeingCard';
import GrowthChartCard from '../growth/GrowthChartCard';
import { buildSeries, latestResults } from '../../utils/growthSeries';
import { IGrowthLog } from '../../types/growthLog.types';
import { infantData } from '../../data/infantData';
import { FLOW_SLUGS } from '../../constants/chat';
import { FlowType } from '../../types/chat.types';
import { IChild } from '../../types/user.types';
import { IUserAllData } from '../../types/dashboard.types';
import { InfantLogRouteParams } from '../../types/infantLog.types';
import { getVisibleChildren } from '../../utils/childAge';
import { getAgeInMonths, istDateKey } from '../../utils/infantLogHelpers';
import DashboardCard from './DashboardCard';
import ChildAvatarStrip from './ChildAvatarStrip';
import FLInfantCheckInOptions from './FLInfantCheckInOptions';
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius';

interface DashboardInfantTabProps {
    userData: IUserAllData | undefined;
}

const DashboardInfantTab: React.FC<DashboardInfantTabProps> = ({ userData }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const children = useMemo(
        () => getVisibleChildren(userData?.user?.childs),
        [userData?.user?.childs],
    );

    const [selectedChildId, setSelectedChildId] = useState<string | undefined>(
        children[0]?._id,
    );

    // Keep the selection pointing at a child that still exists. Without this, finishing a
    // second onboarding leaves the selection on a stale id after a refresh replaces the
    // array, and the card below renders blank.
    useEffect(() => {
        const stillPresent = children.some((child) => child._id === selectedChildId);
        if (!stillPresent) {
            setSelectedChildId(children[0]?._id);
        }
    }, [children, selectedChildId]);

    const selectedChild: IChild | undefined =
        children.find((child) => child._id === selectedChildId) ?? children[0];

    const [growthLogs, setGrowthLogs] = useState<IGrowthLog[]>([]);

    /**
     * A failed fetch leaves the chart showing its reference curves with no child points,
     * which is the same thing a child with no logs yet sees. That degrades honestly, so it
     * is not worth a toast on a dashboard the mother did not explicitly ask to refresh.
     *
     * Depends on `userData`, not just the child id: the dashboard's pull-to-refresh replaces
     * `userData` with a fresh object without changing which child is selected, and this tab
     * has no other way to learn that a refresh happened. Without it, a growth log entered and
     * then refreshed back to would keep showing the chart from before the entry until the app
     * was restarted.
     */
    useEffect(() => {
        let cancelled = false;
        const childId = selectedChild?._id;

        if (!childId) {
            setGrowthLogs([]);
            return;
        }

        getGrowthLogs(childId)
            .then((logs) => {
                if (!cancelled) setGrowthLogs(logs);
            })
            .catch((error) => {
                console.log('[DashboardInfantTab] Failed to load growth logs', error);
                if (!cancelled) setGrowthLogs([]);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedChild?._id, userData]);

    const series = useMemo(() => buildSeries(growthLogs), [growthLogs]);
    const results = useMemo(() => latestResults(growthLogs), [growthLogs]);

    const [wellbeing, setWellbeing] = useState<IInfantWellbeing | null>(null);

    /**
     * The wellbeing summary, on focus rather than on mount.
     *
     * This card summarises all five logs, so returning from *any* of them is the moment it
     * is most likely to be wrong — a mother who ticks off an overdue vaccine and comes
     * straight back should not still be told it is overdue. `userData` is in the deps for
     * the same reason the diaper fetch has it: a pull-to-refresh fires no focus event.
     *
     * Fails silently to null, which simply hides the card. The four log screens underneath
     * are the source of truth and are all still reachable, so a summary that could not load
     * is worth less than the toast it would cost.
     */
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            const childId = selectedChild?._id;

            if (!childId) {
                setWellbeing(null);
                return;
            }

            getInfantWellbeing(childId)
                .then((summary) => {
                    if (!cancelled) setWellbeing(summary);
                })
                .catch((error) => {
                    console.log('[DashboardInfantTab] Failed to load the wellbeing summary', error);
                    if (!cancelled) setWellbeing(null);
                });

            return () => {
                cancelled = true;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selectedChild?._id, userData]),
    );

    const [diaperToday, setDiaperToday] = useState<number>(0);

    /**
     * Today's diaper count for the tile subtitle.
     *
     * Asks for one day rather than the history — the tile needs a single number, and the
     * dashboard should not pull a month of entries to render it. Fails silently for the
     * same reason the growth fetch does: the tile falls back to its static line, which is
     * also what a day with nothing logged shows.
     *
     * On focus rather than on mount. Logging a diaper and coming straight back here is the
     * single most likely way this tile is looked at, and keyed on the child alone it would
     * still be showing the count from before the visit — the one number on the dashboard
     * guaranteed to be stale exactly when a parent goes to check it.
     *
     * `userData` is also a dependency of the memoized callback so that a pull-to-refresh —
     * which happens while this screen is already focused, so a focus event never fires —
     * still reruns it: `useFocusEffect` invokes the callback immediately whenever its
     * identity changes and the screen is focused, not only on the focus event itself.
     */
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            const childId = selectedChild?._id;

            if (!childId) {
                setDiaperToday(0);
                return;
            }

            const today = istDateKey(new Date());

            getDiaperLogs(childId, today, today)
                .then((logs) => {
                    if (!cancelled) setDiaperToday(logs[0]?.totals?.total ?? 0);
                })
                .catch((error) => {
                    console.log('[DashboardInfantTab] Failed to load diaper logs', error);
                    if (!cancelled) setDiaperToday(0);
                });

            return () => {
                cancelled = true;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selectedChild?._id, userData]),
    );

    /**
     * Both the empty state's CTA and the strip's "+" land here. No childId is passed: the
     * server resolves an in-flight run or creates a fresh draft child, which is what makes
     * an interrupted add resume rather than duplicate.
     */
    const startBabyOnboarding = () => {
        navigation.navigate('ChatWithVivaAI', {
            flowSlug: FLOW_SLUGS[FlowType.BABY_ONBOARDING],
        });
    };

    if (children.length === 0) {
        return (
            <DashboardCard style={styles.emptyCard}>
                <Text style={[styles.emptyTitle, globalStyles.fontBold]}>
                    {t('infant.emptyTitle')}
                </Text>

                <Text style={[styles.emptyBody, globalStyles.fontRegular]}>
                    {t('infant.emptyBody')}
                </Text>

                <GradientButtonWithSlightRadius
                    title={t('infant.emptyCta')}
                    onPress={startBabyOnboarding}
                    fullRounded
                    fullWidth
                />

                <Text style={[styles.emptyCaption, globalStyles.fontRegular]}>
                    {t('infant.emptyCaption')}
                </Text>
            </DashboardCard>
        );
    }

    const measurements = selectedChild?.birth_measurements;
    const missing = t('infant.statMissing');

    /**
     * The most recent numbers on file.
     *
     * Prefers the latest growth log and falls back to the birth measurements, so a child
     * onboarded but never logged still shows something real. Weight is stored in kilograms
     * and displayed in grams, which is the unit an Indian clinic reports.
     */
    const latest = growthLogs.length > 0 ? growthLogs[growthLogs.length - 1] : undefined;

    const latestWeightGrams =
        typeof latest?.measurements.weight_kg === 'number'
            ? Math.round(latest.measurements.weight_kg * 1000)
            : measurements?.weight_grams;
    const latestLengthCm = latest?.measurements.length_cm ?? measurements?.length_cm;
    const latestHeadCm =
        latest?.measurements.head_circumference_cm ??
        measurements?.head_circumference_cm;

    // Units come from the locale files, as they do on the growth log — "g" and "cm" are
    // English words, and hardcoding them left the dashboard reading in English while the
    // screen behind it read in Hindi.
    const measured = (value: number | undefined, unitKey: string): string =>
        typeof value === 'number'
            ? t('infant.statValue', { value, unit: t(unitKey) })
            : missing;

    const stats = [
        {
            label: t('infant.statWeight'),
            value: measured(latestWeightGrams, 'infant.growth.unitGrams'),
        },
        {
            label: t('infant.statHeight'),
            value: measured(latestLengthCm, 'infant.growth.unitCm'),
        },
        {
            label: t('infant.statHead'),
            value: measured(latestHeadCm, 'infant.growth.unitCm'),
        },
    ];

    /**
     * What every log screen is handed when a tile is tapped.
     *
     * Route params must stay serialisable — React Navigation persists them across a state
     * restore — so the date of birth travels as an ISO string rather than a Date.
     */
    const logParams: InfantLogRouteParams = {
        childId: selectedChild?._id,
        childName: selectedChild?.name,
        childDob: selectedChild?.date_of_birth
            ? new Date(selectedChild.date_of_birth).toISOString()
            : undefined,
        vaccinationSector: selectedChild?.vaccination_sector,
        childSex: selectedChild?.sex,
    };

    /**
     * A live line for a tile whose data the dashboard has loaded, or undefined to keep the
     * tile's static one.
     *
     * Zero falls through to "Not logged" rather than rendering "0 today" — they mean the
     * same thing and the static line reads better.
     */
    const tileSubtitle = (screen: string): string | undefined =>
        screen === 'DiaperLog' && diaperToday > 0
            ? t('infant.diaper.countToday', { count: diaperToday })
            : undefined;

    // Rendered as rows rather than a FlatList: the last tile spans both columns, which a
    // numColumns grid cannot express.
    const tiles = infantData.checkinOptions;
    const gridTiles = tiles.filter((tile) => !tile.fullWidth);
    const wideTiles = tiles.filter((tile) => tile.fullWidth);
    const rows: typeof gridTiles[] = [];
    for (let i = 0; i < gridTiles.length; i += 2) {
        rows.push(gridTiles.slice(i, i + 2));
    }

    return (
        <View>
            <ChildAvatarStrip
                childList={children}
                selectedChildId={selectedChild?._id}
                onSelectChild={setSelectedChildId}
                onAddChild={startBabyOnboarding}
            />

            {selectedChild?._id && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                        navigation.navigate('EditChild', {
                            ...logParams,
                            birthMeasurements: selectedChild.birth_measurements,
                        })
                    }
                    accessibilityRole="button"
                    style={styles.editRow}
                >
                    <Text style={[styles.editLink, globalStyles.fontSemiBold]}>
                        {t('infant.editChild.entry', {
                            name: selectedChild.name ?? t('infant.childFallback'),
                        })}
                    </Text>
                </TouchableOpacity>
            )}

            {/*
              Above the chart on purpose: the answer to "is my baby OK?" should not be
              something a mother has to scroll past a graph to reach.
            */}
            {wellbeing && (
                <InfantWellbeingCard
                    wellbeing={wellbeing}
                    childName={selectedChild?.name ?? t('infant.childFallback')}
                    onOpenDomain={(screen) => navigation.navigate(screen, logParams)}
                />
            )}

            {/*
              Replaces the static growth-chart JPEG and the "Not yet scored" badge that
              stood in until the WHO tables landed. Percentiles now come from real stored
              measurements via @vivamama/growth-standards.
            */}
            <GrowthChartCard
                sex={selectedChild?.sex}
                childName={selectedChild?.name ?? t('infant.childFallback')}
                seriesByIndicator={series}
                latestByIndicator={results}
                ageMonths={getAgeInMonths(selectedChild?.date_of_birth)}
            />

            <View style={styles.statRow}>
                {stats.map((stat) => (
                    <View key={stat.label} style={styles.stat}>
                        <Text style={[styles.statLabel, globalStyles.fontRegular]}>
                            {stat.label}
                        </Text>
                        <Text style={[styles.statValue, globalStyles.fontBold]}>
                            {stat.value}
                        </Text>
                    </View>
                ))}
            </View>

            <Text style={[styles.sectionTitle, globalStyles.fontBold]}>
                {t('infant.checkinTitle')}
            </Text>
            <Text style={[styles.sectionCaption, globalStyles.fontRegular]}>
                {t('infant.checkinCaption')}
            </Text>

            <View style={styles.grid}>
                {rows.map((row, index) => (
                    <View key={index} style={styles.gridRow}>
                        {row.map((tile) => (
                            <FLInfantCheckInOptions
                                key={tile.screen}
                                item={tile}
                                navigation={navigation}
                                params={logParams}
                                subtitle={tileSubtitle(tile.screen)}
                            />
                        ))}
                    </View>
                ))}

                {wideTiles.map((tile) => (
                    <View key={tile.screen} style={styles.gridRow}>
                        <FLInfantCheckInOptions
                            item={tile}
                            navigation={navigation}
                            params={logParams}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    emptyCard: {
        backgroundColor: colors.white,
        padding: 20,
        alignItems: 'center',
    },

    emptyTitle: {
        fontSize: 20,
        color: colors.black,
        textAlign: 'center',
    },

    emptyBody: {
        marginTop: 10,
        marginBottom: 20,
        fontSize: 14,
        lineHeight: 21,
        color: colors.darkGray,
        textAlign: 'center',
    },

    emptyCaption: {
        marginTop: 12,
        fontSize: 12,
        color: colors.gray,
        textAlign: 'center',
    },

    editRow: {
        alignSelf: 'flex-end',
        paddingHorizontal: 4,
        paddingBottom: 8,
    },

    editLink: {
        fontSize: 12,
        color: colors.darkPurple,
    },

    statRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },

    stat: {
        flex: 1,
        backgroundColor: colors.lightGray,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },

    statLabel: {
        fontSize: 10,
        letterSpacing: 0.5,
        color: colors.gray,
    },

    statValue: {
        marginTop: 2,
        fontSize: 15,
        color: colors.black,
    },

    sectionTitle: {
        marginTop: 18,
        fontSize: 20,
        color: colors.black,
    },

    sectionCaption: {
        marginTop: 2,
        marginBottom: 6,
        fontSize: 12,
        color: colors.gray,
    },

    grid: {
        gap: 10,
        marginBottom: 10,
    },

    gridRow: {
        flexDirection: 'row',
        gap: 10,
    },
});

export default DashboardInfantTab;
