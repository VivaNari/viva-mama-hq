import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import LogChipTabs from '../components/infant/LogChipTabs';
import LogInfoBanner from '../components/infant/LogInfoBanner';
import { MILESTONE_BANDS } from '../data/infantMilestoneData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';

/**
 * Milestone Log (PRD 4.2) — "child is able to crawl / walk".
 *
 * A milestone is logged, never un-due: the card flips to "Logged" and stays available to
 * untick, because a parent who taps the wrong card at 3am needs a way back and there is no
 * other undo on this screen.
 *
 * The illustrations the design is built around have not been supplied. Each card renders a
 * labelled placeholder naming the image it wants, which is what the banner at the foot
 * explains — a blank tile would just look broken.
 *
 * UI only — nothing is persisted.
 */
const MilestoneLog: React.FC = () => {
    const { t } = useTranslation();

    const [activeBandKey, setActiveBandKey] = useState<string>(MILESTONE_BANDS[0].key);
    const [logged, setLogged] = useState<Record<string, boolean>>({});

    const activeBand =
        MILESTONE_BANDS.find((band) => band.key === activeBandKey) ?? MILESTONE_BANDS[0];

    const loggedCount = activeBand.milestones.filter(
        (milestone) => logged[milestone.key],
    ).length;

    const toggle = (key: string) =>
        setLogged((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={MILESTONE_BANDS.map((band) => ({
                    key: band.key,
                    label: t(band.labelKey),
                }))}
                activeKey={activeBand.key}
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
                            total: activeBand.milestones.length,
                        })}
                    </Text>
                </View>

                <View style={styles.grid}>
                    {activeBand.milestones.map((milestone) => {
                        const isLogged = !!logged[milestone.key];

                        return (
                            <View key={milestone.key} style={styles.card}>
                                <View style={styles.photo}>
                                    <Text
                                        style={[
                                            styles.photoHint,
                                            globalStyles.fontRegular,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {t(milestone.photoHintKey)}
                                    </Text>

                                    {isLogged && (
                                        <View style={styles.badge}>
                                            <MaterialDesignIcons
                                                name="check"
                                                size={14}
                                                color={colors.white}
                                            />
                                        </View>
                                    )}
                                </View>

                                <View style={styles.cardBody}>
                                    <Text
                                        style={[
                                            styles.cardTitle,
                                            globalStyles.fontSemiBold,
                                        ]}
                                    >
                                        {t(milestone.nameKey)}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.cardAge,
                                            globalStyles.fontRegular,
                                        ]}
                                    >
                                        {t(milestone.ageKey)}
                                    </Text>

                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => toggle(milestone.key)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isLogged }}
                                        style={[
                                            styles.action,
                                            isLogged && styles.actionLogged,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.actionLabel,
                                                isLogged && styles.actionLabelLogged,
                                                globalStyles.fontSemiBold,
                                            ]}
                                        >
                                            {isLogged
                                                ? t('infant.milestone.logged')
                                                : t('infant.milestone.logThis')}
                                        </Text>

                                        {isLogged && (
                                            <MaterialDesignIcons
                                                name="check"
                                                size={14}
                                                color={colors.success}
                                            />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <LogInfoBanner
                    icon="image-outline"
                    text={t('infant.milestone.illustrationsPending')}
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

    card: {
        // Two per row: half the remaining width once the 12px gutter is removed.
        width: '48%',
        flexGrow: 1,
        backgroundColor: colors.white,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.12)',
    },

    photo: {
        height: 110,
        backgroundColor: colors.lightPurple,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },

    photoHint: {
        fontSize: 11,
        textAlign: 'center',
        color: colors.purple,
    },

    badge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },

    cardBody: {
        padding: 12,
    },

    cardTitle: {
        fontSize: 14,
        color: colors.black,
    },

    cardAge: {
        marginTop: 2,
        fontSize: 12,
        color: colors.gray,
    },

    action: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.purple,
        borderRadius: 20,
        paddingVertical: 9,
    },

    actionLogged: {
        borderColor: colors.success,
        backgroundColor: colors.greenBadgeBG,
    },

    actionLabel: {
        fontSize: 13,
        color: colors.darkPurple,
    },

    actionLabelLogged: {
        color: colors.success,
    },

    centered: {
        textAlign: 'center',
    },
});

export default MilestoneLog;
