import Lucide from '@react-native-vector-icons/lucide';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyConsultations } from '../api/getMyConsultations';
import ConsultationHistoryCard from '../components/consultation/ConsultationHistoryCard';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import {
    EConsultationStage,
    IUserConsultationHistory,
    IUserConsultationHistoryResponse,
} from '../types/consultation.types';

/** Left to right, in the order a patient thinks about them. */
const TAB_ORDER: EConsultationStage[] = [
    EConsultationStage.UPCOMING,
    EConsultationStage.ONGOING,
    EConsultationStage.PAST,
];

const TAB_LABEL_KEYS: Record<EConsultationStage, string> = {
    [EConsultationStage.UPCOMING]: 'consultationHistory.tabs.upcoming',
    [EConsultationStage.ONGOING]: 'consultationHistory.tabs.ongoing',
    [EConsultationStage.PAST]: 'consultationHistory.tabs.past',
};

const EMPTY_KEYS: Record<EConsultationStage, string> = {
    [EConsultationStage.UPCOMING]: 'consultationHistory.empty.upcoming',
    [EConsultationStage.ONGOING]: 'consultationHistory.empty.ongoing',
    [EConsultationStage.PAST]: 'consultationHistory.empty.past',
};

const MyConsultations = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const [consultations, setConsultations] = useState<IUserConsultationHistory[]>([]);
    const [activeTab, setActiveTab] = useState<EConsultationStage>(EConsultationStage.UPCOMING);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async (isRefresh = false, isSilent = false) => {
        if (isSilent) {
            // No UI indicator for silent auto-refresh
        } else if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        if (!isSilent) {
            setFailed(false);
        }

        try {
            const response = (await getMyConsultations()) as IUserConsultationHistoryResponse;
            if (response?.success) {
                setConsultations(response.data ?? []);
            } else {
                if (!isSilent) {
                    setFailed(true);
                }
            }
        } catch (error) {
            console.error('Error loading consultations:', error);
            if (!isSilent) {
                setFailed(true);
            }
        } finally {
            if (!isSilent) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    // Refetched on focus: a booking made moments ago on another screen, or a call the
    // team has since closed off, would otherwise show a stale stage.
    // Also polls in the background every 20 seconds while the screen is focused.
    useFocusEffect(
        useCallback(() => {
            load();

            const interval = setInterval(() => {
                load(false, true);
            }, 10000);

            return () => {
                clearInterval(interval);
            };
        }, [load]),
    );

    const grouped = useMemo(() => {
        const buckets: Record<EConsultationStage, IUserConsultationHistory[]> = {
            [EConsultationStage.UPCOMING]: [],
            [EConsultationStage.ONGOING]: [],
            [EConsultationStage.PAST]: [],
        };

        consultations.forEach(item => {
            (buckets[item.stage] ?? buckets[EConsultationStage.PAST]).push(item);
        });

        // The server sends newest-first, which is right for what has already happened.
        // Upcoming reads the other way round — the next call is the one that matters.
        buckets[EConsultationStage.UPCOMING].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        );

        return buckets;
    }, [consultations]);

    const visible = grouped[activeTab];

    const openRating = useCallback(
        (consultationId: string) => {
            navigation.navigate('ConsultationRating', { consultationId });
        },
        [navigation],
    );

    const renderEmpty = () => {
        if (loading) {
            return (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.purple} />
                </View>
            );
        }

        if (failed) {
            return (
                <View style={styles.centered}>
                    <Lucide name="triangle-alert" size={28} color={colors.warning} />
                    <Text style={[styles.emptyText, globalStyles.fontRegular]}>
                        {t('consultationHistory.loadError')}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => load()}
                        style={styles.retryButton}
                    >
                        <Text style={[styles.retryText, globalStyles.fontSemiBold]}>
                            {t('common.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.centered}>
                <Lucide name="calendar-x" size={28} color={colors.gray} />
                <Text style={[styles.emptyText, globalStyles.fontRegular]}>
                    {t(EMPTY_KEYS[activeTab])}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
            <View style={styles.tabBar}>
                {TAB_ORDER.map(stage => {
                    const active = stage === activeTab;
                    const count = grouped[stage].length;

                    return (
                        <TouchableOpacity
                            key={stage}
                            activeOpacity={0.8}
                            onPress={() => setActiveTab(stage)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            style={[styles.tab, active && styles.tabActive]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    globalStyles.fontSemiBold,
                                    active && styles.tabTextActive,
                                ]}
                                numberOfLines={1}
                            >
                                {t(TAB_LABEL_KEYS[stage])}
                                {count > 0 ? ` (${count})` : ''}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FlatList
                data={visible}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                    <ConsultationHistoryCard item={item} onRate={openRating} />
                )}
                contentContainerStyle={[
                    styles.listContent,
                    visible.length === 0 && styles.listContentEmpty,
                ]}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load(true)}
                        colors={[colors.darkPurple]}
                        tintColor={colors.darkPurple}
                    />
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.white,
    },
    tabBar: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 9,
        paddingHorizontal: 6,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.white,
    },
    tabActive: {
        borderColor: colors.darkPurple,
        backgroundColor: colors.lightPurple,
    },
    tabText: {
        fontSize: 13,
        color: colors.darkGray,
    },
    tabTextActive: {
        color: colors.darkPurple,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 32,
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        color: colors.darkGray,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 9,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.darkPurple,
    },
    retryText: {
        fontSize: 14,
        color: colors.darkPurple,
    },
});

export default MyConsultations;
