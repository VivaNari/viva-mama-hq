import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { AnalyticsEvent, track } from '../analytics';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogSectionCard from '../components/infant/LogSectionCard';
import { VACCINATION_SCHEDULE } from '../data/infantVacineData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import {
    InfantLogRouteParams,
    TVaccinationSector,
    TVaccinationSelection,
} from '../types/infantLog.types';

/**
 * Vaccination Log (PRD 4.4).
 *
 * Which schedule is shown comes from the sector the mother chose during baby onboarding
 * and which is stored on the child. The pill at the top is a control, not a label: the
 * design marks it "editable", and a family does move between a government centre and a
 * private paediatrician — switching here swaps the whole visit list.
 *
 * UI only. Toggles are held per visit in component state and are lost on unmount; dates
 * and certificates are a later change, as the footnote says.
 */
const VaccinationLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const childName = params.childName?.trim() || t('infant.childFallback');

    const [sector, setSector] = useState<TVaccinationSector>(
        params.vaccinationSector ?? 'public',
    );

    const visits = VACCINATION_SCHEDULE[sector];
    const [activeVisitKey, setActiveVisitKey] = useState<string>(visits[0].key);

    /**
     * Given vaccines, keyed by sector so a switch does not carry one schedule's ticks onto
     * the other — "DTwP/DTaP-1" and "Pentavalent-1" are different records.
     */
    const [given, setGiven] = useState<Record<string, TVaccinationSelection>>({});

    const activeVisit = useMemo(
        () => visits.find((visit) => visit.key === activeVisitKey) ?? visits[0],
        [visits, activeVisitKey],
    );

    const selectionKey = `${sector}:${activeVisit.key}`;
    const visitSelection = given[selectionKey] ?? {};

    const toggleVaccine = (name: string, isGiven: boolean) => {
        // The vaccine and its status are a child's medical record, so only the fact that
        // the schedule was touched is reported — never which vaccine, never the child.
        track(AnalyticsEvent.VACCINATION_LOG_UPDATED);

        setGiven((prev) => ({
            ...prev,
            [selectionKey]: { ...(prev[selectionKey] ?? {}), [name]: isGiven },
        }));
    };

    const switchSector = () => {
        const next: TVaccinationSector = sector === 'public' ? 'private' : 'public';
        setSector(next);
        // Visit keys differ between schedules ('12m' exists only in the private one), so
        // land on the first visit rather than a key the new list may not contain.
        setActiveVisitKey(VACCINATION_SCHEDULE[next][0].key);
    };

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <View style={styles.sectorRow}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={switchSector}
                    accessibilityRole="button"
                    accessibilityLabel={t('infant.vaccination.switchSector')}
                    style={styles.sectorPill}
                >
                    <Text style={[styles.sectorLabel, globalStyles.fontSemiBold]}>
                        {sector === 'public'
                            ? t('infant.vaccination.sectorPublic')
                            : t('infant.vaccination.sectorPrivate')}
                    </Text>

                    <MaterialDesignIcons
                        name="swap-horizontal"
                        size={14}
                        color={colors.darkPurple}
                    />
                </TouchableOpacity>

                <Text style={[styles.sectorHint, globalStyles.fontRegular]}>
                    {t('infant.vaccination.sectorHint')}
                </Text>
            </View>

            <LogChipTabs
                tabs={visits.map((visit) => ({
                    key: visit.key,
                    label: t(visit.labelKey),
                }))}
                activeKey={activeVisit.key}
                onChange={setActiveVisitKey}
            />

            <ScrollView
                contentContainerStyle={infantLogStyles.content}
                showsVerticalScrollIndicator={false}
            >
                <LogSectionCard
                    title={t(activeVisit.labelKey)}
                    caption={t('infant.vaccination.question', { name: childName })}
                    footnote={t('infant.vaccination.footnote')}
                >
                    {activeVisit.vaccines.map((vaccine, index) => (
                        <View
                            key={vaccine.name}
                            style={[
                                styles.vaccineRow,
                                index === activeVisit.vaccines.length - 1 &&
                                    styles.vaccineRowLast,
                            ]}
                        >
                            <View style={styles.vaccineText}>
                                <Text
                                    style={[
                                        styles.vaccineName,
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {vaccine.name}
                                </Text>

                                {!!vaccine.descriptionKey && (
                                    <Text
                                        style={[
                                            styles.vaccineHint,
                                            globalStyles.fontRegular,
                                        ]}
                                    >
                                        {t(vaccine.descriptionKey)}
                                    </Text>
                                )}
                            </View>

                            <Switch
                                value={!!visitSelection[vaccine.name]}
                                onValueChange={(next) =>
                                    toggleVaccine(vaccine.name, next)
                                }
                                trackColor={{
                                    false: colors.offWhite,
                                    true: colors.lightPurple,
                                }}
                                thumbColor={
                                    visitSelection[vaccine.name]
                                        ? colors.darkPurple
                                        : colors.white
                                }
                                ios_backgroundColor={colors.offWhite}
                                accessibilityLabel={vaccine.name}
                            />
                        </View>
                    ))}
                </LogSectionCard>

                <GradientButtonWithSlightRadius
                    title={t('infant.saveLog')}
                    onPress={() => undefined}
                    fullRounded
                    fullWidth
                />

                <Text
                    style={[
                        infantLogStyles.footnote,
                        styles.centered,
                        globalStyles.fontRegular,
                    ]}
                >
                    {t('infant.notPersistedYet')}
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

    vaccineName: {
        fontSize: 15,
        color: colors.black,
    },

    vaccineHint: {
        marginTop: 2,
        fontSize: 12,
        color: colors.gray,
    },

    centered: {
        textAlign: 'center',
    },
});

export default VaccinationLog;
