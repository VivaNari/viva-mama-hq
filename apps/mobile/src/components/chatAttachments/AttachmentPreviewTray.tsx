import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IPendingAttachment } from '../../types/chat.types';
import { errorCodeToI18nKey, formatBytes } from '../../utils/attachments';
import UploadProgressRing from './UploadProgressRing';

interface IAttachmentPreviewTrayProps {
    items: IPendingAttachment[];
    onRemove: (localId: string) => void;
    onRetry: (localId: string) => void;
}

const THUMB = 64;

/**
 * Files picked for the next message, above the composer. Each uploads straight away,
 * so by the time she has typed her question it is usually ready to send.
 */
const AttachmentPreviewTray = ({ items, onRemove, onRetry }: IAttachmentPreviewTrayProps) => {
    const { t } = useTranslation();
    if (items.length === 0) return null;
    const failed = items.find(a => a.state === 'failed');

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                keyboardShouldPersistTaps="handled"
            >
                {items.map((item, index) => {
                    const position = t('chat.attachments.a11y.position', { index: index + 1, total: items.length });
                    const status =
                        item.state === 'uploading'
                            ? t('chat.attachments.a11y.uploading', { percent: Math.round(item.progress * 100) })
                            : item.state === 'failed'
                              ? t('chat.attachments.a11y.failed')
                              : t('chat.attachments.a11y.ready');
                    return (
                        <View key={item.localId} style={styles.item}>
                            <TouchableOpacity
                                activeOpacity={item.state === 'failed' ? 0.7 : 1}
                                onPress={item.state === 'failed' ? () => onRetry(item.localId) : undefined}
                                accessibilityRole={item.state === 'failed' ? 'button' : 'image'}
                                accessibilityLabel={`${item.kind === 'PDF' ? t('chat.attachments.a11y.pdf') : t('chat.attachments.a11y.photo')} ${position}. ${status}`}
                                accessibilityHint={item.state === 'failed' ? t('chat.attachments.a11y.retryHint') : undefined}
                            >
                                {item.kind === 'IMAGE' ? (
                                    <Image
                                        source={{ uri: item.uri }}
                                        style={[styles.thumb, item.state === 'failed' && styles.thumbFailed]}
                                    />
                                ) : (
                                    <View style={[styles.thumb, styles.pdfChip, item.state === 'failed' && styles.thumbFailed]}>
                                        <Lucide name="file-text" size={22} color={colors.darkPurple} />
                                        <Text numberOfLines={1} style={[styles.pdfName, globalStyles.fontMedium]}>
                                            {item.name || 'PDF'}
                                        </Text>
                                        <Text style={[styles.pdfMeta, globalStyles.fontRegular]}>
                                            {formatBytes(item.sizeBytes)}
                                        </Text>
                                    </View>
                                )}
                                {item.state === 'uploading' && (
                                    <View style={styles.overlay} pointerEvents="none">
                                        <UploadProgressRing progress={item.progress} />
                                    </View>
                                )}
                                {item.state === 'failed' && (
                                    <View style={[styles.overlay, styles.failedOverlay]} pointerEvents="none">
                                        <Lucide name="rotate-cw" size={20} color={colors.white} />
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.remove}
                                onPress={() => onRemove(item.localId)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel={t('chat.attachments.a11y.remove', { position })}
                            >
                                <Lucide name="x" size={12} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </ScrollView>
            {failed && (
                <Text
                    style={[styles.error, globalStyles.fontRegular]}
                    accessibilityLiveRegion="polite"
                >
                    {t(errorCodeToI18nKey(failed.errorCode))} {t('chat.attachments.tapToRetry')}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
    },
    row: { paddingHorizontal: 12, gap: 12, paddingTop: 6 },
    item: { width: THUMB, height: THUMB },
    thumb: {
        width: THUMB,
        height: THUMB,
        borderRadius: 12,
        backgroundColor: colors.lightGray,
    },
    thumbFailed: { borderWidth: 2, borderColor: colors.error },
    pdfChip: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        backgroundColor: colors.lightPurple,
    },
    pdfName: { fontSize: 10, color: colors.black, marginTop: 2, maxWidth: THUMB - 8 },
    pdfMeta: { fontSize: 9, color: colors.darkGray },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    failedOverlay: { backgroundColor: 'rgba(0,0,0,0.35)' },
    remove: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.white,
    },
    error: { color: colors.error, fontSize: 12, paddingHorizontal: 12, paddingTop: 6 },
});

export default AttachmentPreviewTray;
