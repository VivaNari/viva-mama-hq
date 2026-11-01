import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import BottomSheetModal from './BottomSheetModal';

interface IAttachmentConsentSheetProps {
    visible: boolean;
    retentionDays: number;
    submitting: boolean;
    onAccept: () => void;
    onDecline: () => void;
}

const POINTS = [
    { icon: 'file-heart', key: 'chat.attachments.consent.purpose' },
    { icon: 'lock', key: 'chat.attachments.consent.storage' },
    { icon: 'trash-2', key: 'chat.attachments.consent.deletion' },
    { icon: 'stethoscope', key: 'chat.attachments.consent.notDiagnosis' },
];

/**
 * Asked once (per version of this text) before her first upload. Health documents are
 * sensitive personal data, so Viva reads them only with her explicit agreement.
 */
const AttachmentConsentSheet = ({
    visible,
    retentionDays,
    submitting,
    onAccept,
    onDecline,
}: IAttachmentConsentSheetProps) => {
    const { t } = useTranslation();
    return (
        <BottomSheetModal visible={visible} onClose={onDecline} accessibilityLabel={t('chat.attachments.consent.title')}>
            <Text style={[styles.title, globalStyles.fontBold]} accessibilityRole="header">
                {t('chat.attachments.consent.title')}
            </Text>
            {POINTS.map(point => (
                <View key={point.key} style={styles.point}>
                    <Lucide name={point.icon as any} size={20} color={colors.darkPurple} />
                    <Text style={[styles.pointText, globalStyles.fontRegular]}>
                        {t(point.key, { days: retentionDays })}
                    </Text>
                </View>
            ))}
            <TouchableOpacity
                style={[styles.primary, submitting && styles.primaryDisabled]}
                onPress={onAccept}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={t('chat.attachments.consent.accept')}
            >
                {submitting ? (
                    <ActivityIndicator color={colors.white} />
                ) : (
                    <Text style={[styles.primaryText, globalStyles.fontSemiBold]}>
                        {t('chat.attachments.consent.accept')}
                    </Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.secondary}
                onPress={onDecline}
                accessibilityRole="button"
                accessibilityLabel={t('chat.attachments.consent.decline')}
            >
                <Text style={[styles.secondaryText, globalStyles.fontMedium]}>
                    {t('chat.attachments.consent.decline')}
                </Text>
            </TouchableOpacity>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    title: { fontSize: 18, color: colors.black, marginBottom: 12 },
    point: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
    pointText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.darkGray },
    primary: {
        marginTop: 8,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.darkPurple,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryDisabled: { opacity: 0.7 },
    primaryText: { color: colors.white, fontSize: 16 },
    secondary: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    secondaryText: { color: colors.darkGray, fontSize: 14 },
});

export default AttachmentConsentSheet;
