import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { infantData } from '../../data/infantData';
import { FLOW_SLUGS } from '../../constants/chat';
import { FlowType } from '../../types/chat.types';
import { IChild } from '../../types/user.types';
import { IUserAllData } from '../../types/dashboard.types';
import { getChildAgeLabel, getVisibleChildren } from '../../utils/childAge';
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

    const stats = [
        {
            label: t('infant.statWeight'),
            value: measurements?.weight_grams
                ? `${measurements.weight_grams} g`
                : missing,
        },
        {
            label: t('infant.statHeight'),
            value: measurements?.length_cm ? `${measurements.length_cm} cm` : missing,
        },
        {
            label: t('infant.statHead'),
            value: measurements?.head_circumference_cm
                ? `${measurements.head_circumference_cm} cm`
                : missing,
        },
    ];

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

            <DashboardCard style={styles.growthCard}>
                <View style={styles.growthHeader}>
                    <Text style={[styles.growthTitle, globalStyles.fontBold]}>
                        {t('infant.ageHeading', {
                            age: getChildAgeLabel(selectedChild?.date_of_birth, t),
                        })}
                    </Text>

                    {/*
                      Placeholder until the WHO LMS reference data and z-score maths land.
                      A real percentile cannot be computed from birth measurements alone,
                      and showing an invented band on a growth chart would be worse than
                      showing none.
                    */}
                    <Text style={[styles.percentile, globalStyles.fontSemiBold]}>
                        {t('infant.percentilePending')}
                    </Text>
                </View>

                <Text style={[styles.growthSubtitle, globalStyles.fontRegular]}>
                    {t('infant.growthSubtitle')}
                </Text>

                <Image
                    source={infantData.scoreImage}
                    style={styles.chart}
                    resizeMode="contain"
                />

                <Text style={[styles.growthDescription, globalStyles.fontRegular]}>
                    {t('infant.growthDescription')}
                </Text>

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
            </DashboardCard>

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
                            />
                        ))}
                    </View>
                ))}

                {wideTiles.map((tile) => (
                    <View key={tile.screen} style={styles.gridRow}>
                        <FLInfantCheckInOptions item={tile} navigation={navigation} />
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

    growthCard: {
        backgroundColor: colors.white,
        padding: 15,
    },

    growthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },

    growthTitle: {
        flexShrink: 1,
        fontSize: 17,
        color: colors.black,
    },

    percentile: {
        fontSize: 12,
        color: colors.darkPurple,
    },

    growthSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: colors.gray,
    },

    chart: {
        width: '100%',
        height: 300,
        marginVertical: 12,
        borderRadius: 8,
    },

    growthDescription: {
        fontSize: 13,
        lineHeight: 20,
        color: colors.darkGray,
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
