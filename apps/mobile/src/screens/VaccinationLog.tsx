import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Lucide from '@react-native-vector-icons/lucide';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import Toast from 'react-native-toast-message';

import { AnalyticsEvent, track } from '../analytics';
import {
    getVaccinationLogs,
    recordVaccineDose,
    removeVaccineDose,
} from '../api/infantVaccination.api';
import { useBottomSheet } from '../components/bottomSheet/AppBottomSheet';
import VaccineInfo from '../components/bottomSheet/VaccineInfo';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogSectionCard from '../components/infant/LogSectionCard';
import { VACCINATION_SCHEDULE } from '../data/infantVaccinationData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import {
    IVaccinationVisit,
    IVaccineDose,
    InfantLogRouteParams,
    TVaccinationSector,
} from '../types/infantLog.types';
import { IVaccinationLog } from '../types/vaccinationLog.types';
import {
    currentAgeIndex,
    formatFullDate,
    reachedAgeIndices,
    vaccinationDueWindow,
} from '../utils/infantLogHelpers';

/**
 * Vaccination Log (PRD 4.4) — the India MCP card's age-wise immunisation schedule.
 *
 * The government schedule is generated into `infantVaccinationData.ts` from the workbook in
 * content/mcp-card, so it can be checked against the card row by row. The private
 * paediatrician schedule beside it is hand-transcribed and is **not** clinically reviewed;
 * both live in the generator, which says so where it defines them.
 *
 * Ships through two years. The card runs to sixteen, and the visits beyond twenty-four
 * months are excluded at the generator — recorded there as a decision rather than deleted,
 * so that a missing visit cannot be mistaken for an oversight.
 *
 * ## The schedule is fixed, and the pill is a label
 *
 * Which schedule a child is on is chosen once, at baby onboarding, and never again. This
 * screen reads it; it does not offer to change it. A dose is a clinical event that happened
 * on a particular schedule, and letting the schedule be re-picked afterwards would mean a
 * record whose meaning depends on a setting — three of Pentavalent are not three of
 * DTwP + Hib + Hepatitis B, and a screen that can swap between them invites exactly that
 * confusion. The API refuses a dose that is not on this child's schedule, so the rule holds
 * whatever a client sends.
 *
 * A child with no stored sector falls to the government schedule. That is the card every
 * Indian family is handed, and the server applies the same fallback — the two must not
 * disagree about which doses exist.
 *
 * The nine doses both schedules give still share one key, so a key names the dose rather
 * than the schedule. Nothing user-facing depends on that any more, but it is what lets the
 * API check a key against a sector with a plain membership test.
 */

/** Which dose of a vaccine this is, where the card numbers them. */
const doseLabel = (dose: IVaccineDose, t: ReturnType<typeof useTranslation>['t']) => {
    switch (dose.doseKind) {
        case 'birth':
            return t('infant.vaccination.dose.birth');
        case 'number':
            return t('infant.vaccination.dose.number', { number: dose.doseNumber });
        case 'booster':
            return dose.doseNumber
                ? t('infant.vaccination.dose.boosterNumber', { number: dose.doseNumber })
                : t('infant.vaccination.dose.booster');
        // "Single dose" gets no chip. There is nothing to distinguish it from.
        default:
            return null;
    }
};

const VaccinationLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    // Mounted app-wide in App.tsx, so the sheet needs no plumbing of its own here.
    const { open: openSheet } = useBottomSheet();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const childName = params.childName?.trim() || t('infant.childFallback');

    // Read once from the child, never set. See the note above on why this is not a control.
    const sector: TVaccinationSector = params.vaccinationSector ?? 'public';

    const visits = VACCINATION_SCHEDULE[sector];
    /**
     * The due windows are already in weeks or months; normalised to months here so one
     * helper serves both this screen and the milestone bands, and both the initial tab and
     * the visibility filter below agree on what "reached" means for the same visit. A visit
     * given in weeks is under three months old, so integer division is precise enough to
     * order them.
     */
    const visitAgeRanges = useMemo(
        () =>
            visits.map((visit) => ({
                from:
                    visit.due.unit === 'week'
                        ? Math.floor((visit.due.from * 7) / 30)
                        : visit.due.from,
            })),
        [visits],
    );

    /** Opens on the visit the child has reached, not on the birth visit. */
    const [activeVisitKey, setActiveVisitKey] = useState<string>(
        () => visits[currentAgeIndex(visitAgeRanges, params.childDob)]!.key,
    );
    const [logs, setLogs] = useState<IVaccinationLog[]>([]);
    const [loading, setLoading] = useState(false);

    const activeVisit = useMemo(
        () => visits.find((visit) => visit.key === activeVisitKey) ?? visits[0],
        [visits, activeVisitKey],
    );

    /**
     * Only visits the child has reached are offered as tabs — a visit due in four months is
     * not a tab a parent can usefully open today. Visits already passed stay visible: a
     * parent logging a late dose, or one given early, still needs to reach them.
     */
    const visibleVisits = useMemo(() => {
        const reached = reachedAgeIndices(visitAgeRanges, params.childDob);
        return visits.filter((_, index) => reached.has(index));
    }, [visits, visitAgeRanges, params.childDob]);

    const loadLogs = useCallback(async () => {
        if (!params.childId) return;

        setLoading(true);
        try {
            setLogs(await getVaccinationLogs(params.childId));
        } catch (error) {
            console.log('[VaccinationLog] Failed to load vaccinations', error);
            Toast.show({ type: 'error', text1: t('infant.vaccination.loadFailed') });
        } finally {
            setLoading(false);
        }
    }, [params.childId, t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    /**
     * Given doses by key, so a row can show both its tick and the date it carries.
     *
     * The whole card rather than this visit's share of it: the chips count what is done per
     * visit, and the sector switch has to keep the ticks the two schedules share.
     */
    const given = useMemo(() => {
        const byKey = new Map<string, IVaccinationLog>();
        for (const entry of logs) byKey.set(entry.vaccineKey, entry);
        return byKey;
    }, [logs]);

    const countGiven = useCallback(
        (visit: IVaccinationVisit) =>
            visit.doses.filter((dose) => given.has(dose.key)).length,
        [given],
    );

    const logsRef = useRef(logs);
    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    /**
     * Optimistic, like the milestone and diaper logs.
     *
     * A parent works down a clinic card ticking six rows in a row; a spinner between each
     * tap and its switch would make that feel broken. A failed write takes its tick back and
     * says so.
     */
    const toggleDose = useCallback(
        async (vaccineKey: string) => {
            if (!params.childId) {
                Toast.show({ type: 'error', text1: t('infant.vaccination.noChild') });
                return;
            }

            // The vaccine and its status are a child's medical record, so only the fact that
            // the schedule was touched is reported — never which vaccine, never the child.
            track(AnalyticsEvent.VACCINATION_LOG_UPDATED);

            const previous = logsRef.current;
            const wasGiven = previous.some((entry) => entry.vaccineKey === vaccineKey);

            setLogs((current) =>
                wasGiven
                    ? current.filter((entry) => entry.vaccineKey !== vaccineKey)
                    : [
                          ...current,
                          {
                              _id: `pending-${vaccineKey}`,
                              childId: params.childId as string,
                              vaccineKey,
                              givenOn: '',
                              createdAt: '',
                              updatedAt: '',
                          },
                      ],
            );

            try {
                if (wasGiven) {
                    await removeVaccineDose({ childId: params.childId, vaccineKey });
                } else {
                    const saved = await recordVaccineDose({
                        childId: params.childId,
                        vaccineKey,
                    });
                    setLogs((current) =>
                        current.map((entry) =>
                            entry.vaccineKey === vaccineKey ? saved : entry,
                        ),
                    );
                }
            } catch (error) {
                console.log('[VaccinationLog] Failed to save vaccination', error);
                setLogs(previous);
                Toast.show({ type: 'error', text1: t('infant.vaccination.saveFailed') });
            }
        },
        [params.childId, t],
    );

    /**
     * When this visit falls due, from the child's date of birth.
     *
     * Stated plainly and without colour, a badge or a count of days late — the same rule the
     * growth percentiles and the milestone warning signs follow. A parent who is behind knows
     * it, and a red banner on a screen they opened to catch up would be the app telling them
     * off. Nothing shows at all when the date of birth did not come through, because a wrong
     * due date here is worse than none.
     */
    const dueLabel = useMemo(() => {
        const window = vaccinationDueWindow(params.childDob, activeVisit.due);
        if (!window) return null;

        if (activeVisit.due.unit === 'week' && activeVisit.due.to === 0) {
            return t('infant.vaccination.dueAtBirth');
        }

        const from = formatFullDate(window.from, t);
        return activeVisit.due.from === activeVisit.due.to
            ? t('infant.vaccination.dueAround', { date: from })
            : t('infant.vaccination.dueBetween', {
                  from,
                  to: formatFullDate(window.to, t),
              });
    }, [params.childDob, activeVisit, t]);

    const visitTitle = activeVisit.detailKey
        ? t('infant.vaccination.visitTitle', {
              visit: t(activeVisit.labelKey),
              detail: t(activeVisit.detailKey),
          })
        : t(activeVisit.labelKey);

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <View style={styles.sectorRow}>
                <View style={styles.sectorPill}>
                    <Text style={[styles.sectorLabel, globalStyles.fontSemiBold]}>
                        {sector === 'public'
                            ? t('infant.vaccination.sectorPublic')
                            : t('infant.vaccination.sectorPrivate')}
                    </Text>
                </View>

                <Text style={[styles.sectorHint, globalStyles.fontRegular]}>
                    {t('infant.vaccination.sectorHint')}
                </Text>
            </View>

            <LogChipTabs
                tabs={visibleVisits.map((visit) => ({
                    key: visit.key,
                    label: t('infant.vaccination.visitChip', {
                        visit: t(visit.labelKey),
                        given: countGiven(visit),
                        total: visit.doses.length,
                    }),
                }))}
                activeKey={activeVisit.key}
                onChange={setActiveVisitKey}
            />

            <ScrollView
                contentContainerStyle={infantLogStyles.content}
                showsVerticalScrollIndicator={false}
            >
                <LogSectionCard
                    title={visitTitle}
                    caption={t('infant.vaccination.question', { name: childName })}
                    headerRight={
                        <Text style={[styles.progress, globalStyles.fontRegular]}>
                            {t('infant.vaccination.progress', {
                                given: countGiven(activeVisit),
                                total: activeVisit.doses.length,
                            })}
                        </Text>
                    }
                    footnote={t('infant.vaccination.footnote')}
                >
                    {!!dueLabel && (
                        <View style={styles.dueRow}>
                            <MaterialDesignIcons
                                name="calendar-blank-outline"
                                size={14}
                                color={colors.gray}
                            />
                            <Text style={[styles.dueLabel, globalStyles.fontRegular]}>
                                {dueLabel}
                            </Text>
                        </View>
                    )}

                    {loading ? (
                        <ActivityIndicator color={colors.darkPurple} style={styles.loader} />
                    ) : (
                        activeVisit.doses.map((dose, index) => {
                            const entry = given.get(dose.key);
                            const dosage = doseLabel(dose, t);

                            return (
                                <View
                                    key={dose.key}
                                    style={[
                                        styles.vaccineRow,
                                        index === activeVisit.doses.length - 1 &&
                                            styles.vaccineRowLast,
                                    ]}
                                >
                                    <View style={styles.vaccineText}>
                                        <View style={styles.nameRow}>
                                            <Text
                                                style={[
                                                    styles.vaccineName,
                                                    globalStyles.fontSemiBold,
                                                ]}
                                            >
                                                {dose.name}
                                            </Text>

                                            {/*
                                              What the injection in front of her is for.
                                              Beside the name rather than behind the row,
                                              because the question is about the vaccine and
                                              the row's own tap target is the Switch — one
                                              that records a dose she may not have given yet.
                                            */}
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() =>
                                                    openSheet(<VaccineInfo dose={dose} />)
                                                }
                                                accessibilityRole="button"
                                                accessibilityLabel={t(
                                                    'infant.vaccination.infoAbout',
                                                    { vaccine: dose.name },
                                                )}
                                                hitSlop={10}
                                            >
                                                <Lucide
                                                    name="info"
                                                    size={15}
                                                    color={colors.darkPurple}
                                                />
                                            </TouchableOpacity>

                                            {!!dosage && (
                                                <View style={styles.doseChip}>
                                                    <Text
                                                        style={[
                                                            styles.doseChipText,
                                                            globalStyles.fontSemiBold,
                                                        ]}
                                                    >
                                                        {dosage}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <Text
                                            style={[
                                                styles.vaccineHint,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(
                                                `infant.vaccination.protects.${dose.key}`,
                                            )}
                                        </Text>

                                        {!!dose.note && (
                                            <Text
                                                style={[
                                                    styles.vaccineNote,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {t(`infant.vaccination.notes.${dose.key}`)}
                                            </Text>
                                        )}

                                        {!!dose.supplement && (
                                            <Text
                                                style={[
                                                    styles.vaccineNote,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {t('infant.vaccination.supplement')}
                                            </Text>
                                        )}

                                        {/*
                                          The date the server stored, once it has. A pending
                                          row carries none, and showing "given" with no date
                                          beside it for the moment the write is in flight is
                                          better than a placeholder that flickers.
                                        */}
                                        {!!entry?.givenOn && (
                                            <Text
                                                style={[
                                                    styles.givenOn,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {t('infant.vaccination.givenOn', {
                                                    date: formatFullDate(
                                                        new Date(entry.givenOn),
                                                        t,
                                                    ),
                                                })}
                                            </Text>
                                        )}
                                    </View>

                                    <Switch
                                        value={!!entry}
                                        onValueChange={() => toggleDose(dose.key)}
                                        trackColor={{
                                            false: colors.offWhite,
                                            true: colors.lightPurple,
                                        }}
                                        thumbColor={entry ? colors.darkPurple : colors.white}
                                        ios_backgroundColor={colors.offWhite}
                                        accessibilityLabel={
                                            dosage ? `${dose.name} ${dosage}` : dose.name
                                        }
                                    />
                                </View>
                            );
                        })
                    )}
                </LogSectionCard>

                <Text
                    style={[
                        infantLogStyles.footnote,
                        styles.centered,
                        globalStyles.fontRegular,
                    ]}
                >
                    {t('infant.vaccination.source')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    sectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 14,
    },

    sectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.lightPurple,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },

    sectorLabel: {
        fontSize: 13,
        color: colors.darkPurple,
    },

    sectorHint: {
        flexShrink: 1,
        fontSize: 12,
        color: colors.gray,
    },

    progress: {
        fontSize: 13,
        color: colors.gray,
    },

    dueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },

    dueLabel: {
        flexShrink: 1,
        fontSize: 12,
        color: colors.gray,
    },

    loader: {
        marginVertical: 30,
    },

    vaccineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
    },

    vaccineRowLast: {
        borderBottomWidth: 0,
    },

    vaccineText: {
        flex: 1,
    },

    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },

    vaccineName: {
        fontSize: 15,
        color: colors.black,
    },

    doseChip: {
        backgroundColor: colors.lightPurple,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },

    doseChipText: {
        fontSize: 11,
        color: colors.darkPurple,
    },

    vaccineHint: {
        marginTop: 3,
        fontSize: 12,
        color: colors.gray,
    },

    vaccineNote: {
        marginTop: 2,
        fontSize: 11,
        color: colors.gray,
    },

    givenOn: {
        marginTop: 4,
        fontSize: 11,
        color: colors.success,
    },

    centered: {
        textAlign: 'center',
    },
});

export default VaccinationLog;
