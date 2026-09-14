import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { achieveMilestone, forgetMilestone, getMilestoneLogs } from '../api/infantMilestone.api';
import LogChipTabs from '../components/infant/LogChipTabs';
import MilestoneCard from '../components/milestone/MilestoneCard';
import MilestoneDetail from '../components/milestone/MilestoneDetail';
import WarningSigns from '../components/milestone/WarningSigns';
import { MILESTONE_BANDS } from '../data/infantMilestoneData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { InfantLogRouteParams } from '../types/infantLog.types';
import { IMilestoneLog } from '../types/milestoneLog.types';

/**
 * Milestone Log (PRD 4.2) — the India MCP card's age-wise development milestones.
 *
 * Content is the card's own, generated into `infantMilestoneData.ts` from the workbook in
 * content/mcp-card. The illustrations are drawn from the rig in components/milestone; every
 * milestone that ships has an authored scene.
 *
 * A milestone can always be un-logged. A parent who taps the wrong card at 3am needs a way
 * back, and this screen offers no other undo.
 *
 * ## The grid does not animate
 *
 * The scenes here are drawn still, each frozen at the frame its author chose as the clearest.
 * The performances play in `MilestoneDetail`, which is the only place they are big enough to
 * read.
 *
 * That is a cost decision as much as a design one. Changing band swaps every card at once, and
 * the illustrations are built from a few hundred plain Views each — several hundred native
 * views created in one commit before the tab can paint. Six looping scenes on top of that
 * bought motion nobody could follow in a 150px box. The clock, and with it the Reduce Motion
 * check that used to live here, moved to the detail view.
 */

const MilestoneLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;
    const { width } = useWindowDimensions();

    const [activeBandKey, setActiveBandKey] = useState(MILESTONE_BANDS[0].key);
    const [logs, setLogs] = useState<IMilestoneLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [openKey, setOpenKey] = useState<string | null>(null);

    const band =
        MILESTONE_BANDS.find((candidate) => candidate.key === activeBandKey) ??
        MILESTONE_BANDS[0];

    const loadLogs = useCallback(async () => {
        if (!params.childId) return;

        setLoading(true);
        try {
            setLogs(await getMilestoneLogs(params.childId));
        } catch (error) {
            console.log('[MilestoneLog] Failed to load milestones', error);
            Toast.show({ type: 'error', text1: t('infant.milestone.loadFailed') });
        } finally {
            setLoading(false);
        }
    }, [params.childId, t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const loggedKeys = useMemo(
        () => new Set(logs.map((entry) => entry.milestoneKey)),
        [logs],
    );

    const loggedCount = band.milestones.filter((key) => loggedKeys.has(key)).length;

    /**
     * The current logs, readable from a handler that must not be rebuilt when they change.
     *
     * `toggle` is handed to six memoised cards, so it has to keep its identity across a log
     * being added or removed — otherwise every card re-renders on every tap and the memo is
     * decoration. A ref updated after commit gives the handler the same value the closure it
     * replaces would have captured.
     */
    const logsRef = useRef(logs);
    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    /**
     * Optimistic, like the diaper log's quick entries.
     *
     * Tapping a milestone is a small celebration; a spinner between the tap and the tick
     * takes the moment out of it. A failed write takes its tick back and says so.
     */
    const toggle = useCallback(async (milestoneKey: string) => {
        if (!params.childId) {
            Toast.show({ type: 'error', text1: t('infant.milestone.noChild') });
            return;
        }

        const previous = logsRef.current;
        const wasLogged = previous.some((entry) => entry.milestoneKey === milestoneKey);

        setLogs((current) =>
            wasLogged
                ? current.filter((entry) => entry.milestoneKey !== milestoneKey)
                : [
                      ...current,
                      {
                          _id: `pending-${milestoneKey}`,
                          childId: params.childId as string,
                          milestoneKey,
                          achievedOn: '',
                          createdAt: '',
                          updatedAt: '',
                      },
                  ],
        );

        try {
            if (wasLogged) {
                await forgetMilestone({ childId: params.childId, milestoneKey });
            } else {
                const saved = await achieveMilestone({ childId: params.childId, milestoneKey });
                setLogs((current) =>
                    current.map((entry) =>
                        entry.milestoneKey === milestoneKey ? saved : entry,
                    ),
                );
            }
        } catch (error) {
            console.log('[MilestoneLog] Failed to save milestone', error);
            setLogs(previous);
            Toast.show({ type: 'error', text1: t('infant.milestone.saveFailed') });
        }
    }, [params.childId, t]);

    const open = useCallback((milestoneKey: string) => setOpenKey(milestoneKey), []);
    const closeDetail = useCallback(() => setOpenKey(null), []);
    const toggleOpen = useCallback(() => {
        if (openKey) toggle(openKey);
    }, [openKey, toggle]);

    // Two per row, matching the design's grid: half the content width less the gutter.
    const cardWidth = (width - 16 * 2 - 12) / 2;

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={MILESTONE_BANDS.map((candidate) => ({
                    key: candidate.key,
                    label: t(candidate.labelKey),
                }))}
                activeKey={band.key}
                onChange={setActiveBandKey}
            />

            <ScrollView
                contentContainerStyle={infantLogStyles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={[styles.heading, globalStyles.fontBold]}>
                        {t('infant.milestone.heading')}
                    </Text>
                    <Text style={[styles.progress, globalStyles.fontRegular]}>
                        {t('infant.milestone.progress', {
                            logged: loggedCount,
                            total: band.milestones.length,
                        })}
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator color={colors.darkPurple} style={styles.loader} />
                ) : (
                    <View style={styles.grid}>
                        {band.milestones.map((key) => (
                            <MilestoneCard
                                key={key}
                                milestoneKey={key}
                                width={cardWidth}
                                logged={loggedKeys.has(key)}
                                onOpen={open}
                                onToggle={toggle}
                            />
                        ))}
                    </View>
                )}

                <WarningSigns signs={band.warnings} />

                <Text
                    style={[
                        infantLogStyles.footnote,
                        styles.centered,
                        globalStyles.fontRegular,
                    ]}
                >
                    {t('infant.milestone.source')}
                </Text>
            </ScrollView>

            <MilestoneDetail
                milestoneKey={openKey}
                bandMilestones={band.milestones}
                bandLabelKey={band.labelKey}
                logged={openKey ? loggedKeys.has(openKey) : false}
                onToggle={toggleOpen}
                onClose={closeDetail}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 12,
    },

    heading: {
        fontSize: 20,
        color: colors.black,
    },

    progress: {
        fontSize: 13,
        color: colors.gray,
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
    },

    loader: {
        marginVertical: 40,
    },

    centered: {
        textAlign: 'center',
    },
});

export default MilestoneLog;
