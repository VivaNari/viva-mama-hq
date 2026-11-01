import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import BottomSheetModal from './BottomSheetModal';

export type TAttachmentSource = 'camera' | 'gallery' | 'pdf';

interface IAttachmentSourceSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (source: TAttachmentSource) => void;
    retentionDays: number;
    remainingToday: number | null;
    /** Photos are disabled once a PDF is picked, and the reverse. */
    disabledSources?: TAttachmentSource[];
    /** Copy for another use than chat (health records). Defaults to the chat copy. */
    title?: string;
    subtitle?: string;
    privacyNote?: string;
}

const OPTIONS: { source: TAttachmentSource; icon: string; titleKey: string; hintKey: string }[] = [
    { source: 'camera', icon: 'camera', titleKey: 'chat.attachments.takePhoto', hintKey: 'chat.attachments.takePhotoHint' },
    { source: 'gallery', icon: 'image', titleKey: 'chat.attachments.chooseFromGallery', hintKey: 'chat.attachments.chooseFromGalleryHint' },
    { source: 'pdf', icon: 'file-text', titleKey: 'chat.attachments.uploadPdf', hintKey: 'chat.attachments.uploadPdfHint' },
];

/** "Add a report": camera, gallery or PDF, with what happens to the file. */
const AttachmentSourceSheet = ({
    visible,
    onClose,
    onSelect,
    retentionDays,
    remainingToday,
    disabledSources = [],
    title,
    subtitle,
    privacyNote,
}: IAttachmentSourceSheetProps) => {
    const { t } = useTranslation();
    const heading = title ?? t('chat.attachments.sheetTitle');
    return (
        <BottomSheetModal visible={visible} onClose={onClose} accessibilityLabel={heading}>
            <Text style={[styles.title, globalStyles.fontBold]} accessibilityRole="header">
                {heading}
            </Text>
            <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                {subtitle ?? t('chat.attachments.sheetSubtitle')}
            </Text>

            {OPTIONS.map(option => {
                const disabled = disabledSources.includes(option.source);
                return (
                    <TouchableOpacity
                        key={option.source}
                        style={[styles.row, disabled && styles.rowDisabled]}
                        onPress={() => onSelect(option.source)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ disabled }}
                        accessibilityLabel={t(option.titleKey)}
                        accessibilityHint={t(option.hintKey)}
                    >
                        <View style={styles.iconWrap}>
                            <Lucide name={option.icon as any} size={22} color={colors.darkPurple} />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={[styles.rowTitle, globalStyles.fontSemiBold]}>{t(option.titleKey)}</Text>
                            <Text style={[styles.rowHint, globalStyles.fontRegular]}>{t(option.hintKey)}</Text>
                        </View>
                        <Lucide name="chevron-right" size={18} color={colors.gray} />
                    </TouchableOpacity>
                );
            })}

            <View style={styles.tip}>
                <Lucide name="lightbulb" size={16} color={colors.vivaTintText} />
                <Text style={[styles.tipText, globalStyles.fontRegular]}>{t('chat.attachments.photoTip')}</Text>
            </View>

            <View style={styles.privacy}>
                <Lucide name="shield-check" size={16} color={colors.darkGray} />
                <Text style={[styles.privacyText, globalStyles.fontRegular]}>
                    {privacyNote ?? t('chat.attachments.privacyNote', { days: retentionDays })}
                    {remainingToday != null ? ` ${t('chat.attachments.remainingToday', { count: remainingToday })}` : ''}
                </Text>
            </View>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    title: { fontSize: 18, color: colors.black },
    subtitle: { fontSize: 14, color: colors.darkGray, marginTop: 4, marginBottom: 12, lineHeight: 20 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 56,
        gap: 12,
    },
    rowDisabled: { opacity: 0.4 },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.lightPurple,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, color: colors.black },
    rowHint: { fontSize: 12, color: colors.darkGray, marginTop: 2 },
    tip: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: colors.vivaTint,
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
    },
    tipText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.vivaTintText },
    privacy: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 2 },
    privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.darkGray },
});

export default AttachmentSourceSheet;
