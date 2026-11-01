import Lucide from '@react-native-vector-icons/lucide';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getHealthRecordsConfig } from '../../api/healthRecords.api';
import { AnalyticsEvent, track } from '../../analytics';
import { useHealthSummary } from '../../hooks/useHealthSummary';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { formatDay } from '../../utils/healthRecords';
import GradientButtonWithSlightRadius from '../GradientButtonWithSlightRadius';

/**
 * Her health summary on the Dashboard: an invitation to add records, a prompt to
 * generate the summary once she has some, or the latest one with Share and View.
 * Shown from the device cache first, refreshed whenever the Dashboard is focused.
 */
const HealthSummaryCard = () => {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const { latest, loading, load, share } = useHealthSummary();
    const [enabled, setEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        getHealthRecordsConfig()
            .then(c => setEnabled(c.enabled))
            .catch(() => setEnabled(false));
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    if (!enabled) return null;

    const summary = latest?.summary ?? null;
    const readyRecords = latest?.readyRecords ?? 0;
    const content = summary?.content ?? null;
    const flagged = content?.values_to_discuss.length ?? 0;
    const go = (screen: string, params?: object) => {
        track(AnalyticsEvent.DASHBOARD_CARD_TAPPED, { card_id: 'health_summary' });
        navigation.navigate(screen, params);
    };

    return (
        <View style={styles.card} accessibilityRole="summary">
            <View style={styles.header}>
                <View style={styles.icon}>
                    <Lucide name="file-heart" size={20} color={colors.darkPurple} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, globalStyles.fontBold]} accessibilityRole="header">
                        {t('healthSummary.cardTitle')}
                    </Text>
                    {summary ? (
                        <Text style={[styles.meta, globalStyles.fontRegular]}>
                            {t('healthSummary.generatedOn', {
                                date: formatDay(summary.createdAt.slice(0, 10), i18n.language),
                                count: summary.recordCount,
                            })}
                        </Text>
                    ) : null}
                </View>
                {latest?.stale ? (
                    <View style={styles.staleBadge}>
                        <Text style={[styles.staleText, globalStyles.fontSemiBold]}>{t('healthSummary.outOfDate')}</Text>
                    </View>
                ) : null}
            </View>

            {loading && !latest ? <ActivityIndicator color={colors.darkPurple} style={{ marginVertical: 16 }} /> : null}

            {!loading || latest ? (
                summary && content ? (
                    <>
                        {content.overview ? (
                            <Text style={[styles.body, globalStyles.fontRegular]} numberOfLines={3}>
                                {content.overview}
                            </Text>
                        ) : null}
                        {flagged ? (
                            <View style={styles.flag}>
                                <Lucide name="stethoscope" size={14} color={colors.vivaAmberText} />
                                <Text style={[styles.flagText, globalStyles.fontSemiBold]}>
                                    {t('healthSummary.valuesCount', { count: flagged })}
                                </Text>
                            </View>
                        ) : null}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.secondary}
                                onPress={() => share(summary)}
                                accessibilityRole="button"
                                accessibilityLabel={t('healthSummary.share')}
                            >
                                <Lucide name="share-2" size={16} color={colors.darkPurple} />
                                <Text style={[styles.secondaryText, globalStyles.fontSemiBold]}>
                                    {t('healthSummary.share')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.secondary}
                                onPress={() => go('HealthSummary', latest?.stale ? { generate: true } : undefined)}
                                accessibilityRole="button"
                            >
                                <Lucide
                                    name={latest?.stale ? 'refresh-cw' : 'eye'}
                                    size={16}
                                    color={colors.darkPurple}
                                />
                                <Text style={[styles.secondaryText, globalStyles.fontSemiBold]}>
                                    {t(latest?.stale ? 'healthSummary.update' : 'healthSummary.view')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <Text style={[styles.body, globalStyles.fontRegular]}>
                            {t(readyRecords ? 'healthSummary.cardReady' : 'healthSummary.cardEmpty', {
                                count: readyRecords,
                            })}
                        </Text>
                        <GradientButtonWithSlightRadius
                            title={t(readyRecords ? 'healthRecords.generateSummary' : 'healthRecords.addRecord')}
                            onPress={() =>
                                readyRecords ? go('HealthSummary', { generate: true }) : go('RecordsUpload')
                            }
                        />
                    </>
                )
            ) : null}

            {readyRecords ? (
                <TouchableOpacity
                    onPress={() => go('HealthRecords')}
                    style={styles.link}
                    accessibilityRole="link"
                >
                    <Text style={[styles.linkText, globalStyles.fontSemiBold]}>
                        {t('healthSummary.myRecordsLink', { count: readyRecords })}
                    </Text>
                    <Lucide name="chevron-right" size={16} color={colors.darkPurple} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginTop: 15,
        backgroundColor: colors.white,
        padding: 14,
        borderRadius: 10,
        boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
        gap: 10,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.vivaTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontSize: 18, color: colors.black },
    meta: { fontSize: 12, color: colors.darkGray, marginTop: 2 },
    staleBadge: { backgroundColor: colors.vivaAmberBG, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    staleText: { fontSize: 11, color: colors.vivaAmberText },
    body: { fontSize: 14, lineHeight: 21, color: colors.darkGray },
    flag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: colors.vivaAmberBG,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    flagText: { fontSize: 12, color: colors.vivaAmberText },
    actions: { flexDirection: 'row', gap: 10 },
    secondary: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.darkPurple,
    },
    secondaryText: { fontSize: 14, color: colors.darkPurple },
    link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, gap: 2 },
    linkText: { fontSize: 13.5, color: colors.darkPurple },
});

export default HealthSummaryCard;
