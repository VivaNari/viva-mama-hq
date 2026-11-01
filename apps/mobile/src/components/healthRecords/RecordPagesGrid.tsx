import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TRecordPage } from '../../hooks/useRecordDraft';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { formatBytes } from '../../utils/attachments';
import { recordErrorKey } from '../../utils/healthRecords';
import UploadProgressRing from '../chatAttachments/UploadProgressRing';

interface IRecordPagesGridProps {
    pages: TRecordPage[];
    canAdd: boolean;
    onAdd: () => void;
    onRemove: (localId: string) => void;
    onRetry: (localId: string) => void;
    onOpen: (index: number) => void;
}

const TILE = 96;

/** The pages of the record she is adding: photos as tiles, or one PDF card. */
const RecordPagesGrid = ({ pages, canAdd, onAdd, onRemove, onRetry, onOpen }: IRecordPagesGridProps) => {
    const { t } = useTranslation();
    const total = pages.length;
    const failed = pages.find(p => p.state === 'failed');

    return (
        <View>
            <View style={styles.grid}>
                {pages.map((page, index) => {
                    const label = t('healthRecords.a11y.page', { index: index + 1, total });
                    return (
                        <View key={page.localId} style={page.kind === 'PDF' ? styles.pdfTile : styles.tile}>
                            <TouchableOpacity
                                style={StyleSheet.absoluteFill}
                                onPress={() => (page.state === 'failed' ? onRetry(page.localId) : onOpen(index))}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    page.state === 'failed' ? t('healthRecords.a11y.retryPage', { label }) : label
                                }
                            >
                                {page.kind === 'PDF' ? (
                                    <View style={styles.pdfBody}>
                                        <Lucide name="file-text" size={26} color={colors.darkPurple} />
                                        <View style={styles.pdfText}>
                                            <Text
                                                style={[styles.pdfName, globalStyles.fontSemiBold]}
                                                numberOfLines={1}
                                            >
                                                {page.name || 'PDF'}
                                            </Text>
                                            <Text style={[styles.pdfMeta, globalStyles.fontRegular]}>
                                                {formatBytes(page.sizeBytes)}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Image source={{ uri: page.uri }} style={styles.image} />
                                )}
                                {page.state === 'uploading' ? (
                                    <View style={styles.overlay}>
                                        <UploadProgressRing progress={page.progress} size={34} />
                                    </View>
                                ) : null}
                                {page.state === 'failed' ? (
                                    <View style={[styles.overlay, styles.failed]}>
                                        <Lucide name="rotate-cw" size={20} color={colors.white} />
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.remove}
                                onPress={() => onRemove(page.localId)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={t('healthRecords.a11y.removePage', { label })}
                            >
                                <Lucide name="x" size={12} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    );
                })}
                {canAdd && total > 0 ? (
                    <TouchableOpacity
                        style={[styles.tile, styles.addTile]}
                        onPress={onAdd}
                        accessibilityRole="button"
                        accessibilityLabel={t('healthRecords.addPage')}
                    >
                        <Lucide name="plus" size={22} color={colors.darkPurple} />
                        <Text style={[styles.addText, globalStyles.fontSemiBold]}>{t('healthRecords.addPage')}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            {failed ? (
                <Text style={[styles.error, globalStyles.fontRegular]} accessibilityLiveRegion="polite">
                    {t(recordErrorKey(failed.errorCode))} {t('healthRecords.tapToRetry')}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
        width: TILE,
        height: TILE,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.vivaTrack,
    },
    pdfTile: {
        width: '100%',
        height: 64,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.lightPurple,
        borderWidth: 1,
        borderColor: colors.vivaMchBorder,
    },
    pdfBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
    pdfText: { flex: 1, paddingRight: 24 },
    pdfName: { fontSize: 14, color: colors.vivaInk },
    pdfMeta: { fontSize: 12, color: colors.vivaSubtle, marginTop: 2 },
    image: { width: '100%', height: '100%' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(36,31,46,0.35)',
    },
    failed: { backgroundColor: 'rgba(192,57,43,0.55)' },
    remove: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(36,31,46,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addTile: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.vivaDashed,
        backgroundColor: colors.white,
        gap: 4,
    },
    addText: { fontSize: 11, color: colors.darkPurple },
    error: { marginTop: 8, fontSize: 12, color: colors.vivaDangerText },
});

export default RecordPagesGrid;
