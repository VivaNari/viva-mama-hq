import Lucide from '@react-native-vector-icons/lucide';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { dismissEmergencyAlert } from '../../api/recentCheckIn.api';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IEmergencyAlert } from '../../types/dashboard.types';

/**
 * Red-flag answers from the latest weekly check-in (heavy bleeding, fever,
 * wound discharge, persistent low mood), surfaced at the top of the dashboard.
 *
 * `indicator` and `answerLabel` are already localized by the server, so they
 * are printed verbatim; only the surrounding copy comes from i18n.
 */
const EmergencyAlertCard = ({ alert }: { alert: IEmergencyAlert }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [dismissed, setDismissed] = useState(false);
    const [dismissing, setDismissing] = useState(false);

    if (dismissed) {
        return null;
    }

    const handleDismiss = async () => {
        if (dismissing) {
            return;
        }
        // Hide immediately — the card is about a symptom she has already read,
        // and making her wait on the network to close it is the wrong trade.
        // Restore it if the server never recorded the dismissal.
        setDismissed(true);
        setDismissing(true);
        try {
            await dismissEmergencyAlert(alert.recommendationHistoryId);
        } catch (error) {
            setDismissed(false);
            Toast.show({
                type: 'error',
                text1: t('common.error'),
                text2: t('common.somethingWrong'),
                position: 'bottom',
            });
        } finally {
            setDismissing(false);
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Lucide name="triangle-alert" size={20} color={colors.redBadgeText} />
                <Text style={[styles.title, globalStyles.fontBold]}>
                    {t('dashboard.emergencyAlert.title')}
                </Text>
            </View>

            <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                {t('dashboard.emergencyAlert.subtitle')}
            </Text>

            <View style={styles.concerns}>
                {alert.concerns.map(concern => (
                    <View key={concern.nodeId} style={styles.concernRow}>
                        <View style={styles.bullet} />
                        <Text style={[styles.concernText, globalStyles.fontRegular]}>
                            <Text style={globalStyles.fontSemiBold}>{concern.indicator}</Text>
                            {` — ${concern.answerLabel}`}
                        </Text>
                    </View>
                ))}
            </View>

            <Text style={[styles.disclaimer, globalStyles.fontRegular]}>
                {t('dashboard.emergencyAlert.disclaimer')}
            </Text>

            <TouchableOpacity
                activeOpacity={0.8}
                style={styles.connectButton}
                onPress={() => navigation.navigate('Experts')}
            >
                <Lucide name="stethoscope" size={18} color={colors.white} />
                <Text style={[styles.connectButtonText, globalStyles.fontSemiBold]}>
                    {t('dashboard.emergencyAlert.connectExpert')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.7}
                style={styles.dismissButton}
                onPress={handleDismiss}
                disabled={dismissing}
            >
                <Text style={[styles.dismissText, globalStyles.fontMedium]}>
                    {t('dashboard.emergencyAlert.dismiss')}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.redBadgeBG,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: colors.redBadgeText,
        padding: 14,
        marginBottom: 12,
        boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.25)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        color: colors.redBadgeText,
        flexShrink: 1,
    },
    subtitle: {
        fontSize: 13,
        color: colors.text,
        marginTop: 8,
    },
    concerns: {
        marginTop: 10,
        gap: 6,
    },
    concernRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.redBadgeText,
        marginTop: 6,
    },
    concernText: {
        fontSize: 13,
        color: colors.text,
        flexShrink: 1,
        lineHeight: 19,
    },
    disclaimer: {
        fontSize: 11,
        color: colors.darkGray,
        marginTop: 12,
    },
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.darkPurple,
        borderRadius: 25,
        paddingVertical: 12,
        marginTop: 14,
    },
    connectButtonText: {
        fontSize: 15,
        color: colors.white,
    },
    dismissButton: {
        alignItems: 'center',
        paddingVertical: 10,
        marginTop: 2,
    },
    dismissText: {
        fontSize: 14,
        color: colors.darkGray,
    },
});

export default EmergencyAlertCard;
