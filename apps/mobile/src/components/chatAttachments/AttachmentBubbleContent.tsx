import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IMessageAttachment, IUserMessage } from '../../types/chat.types';
import { formatBytes } from '../../utils/attachments';

interface IAttachmentBubbleContentProps {
    attachments: IMessageAttachment[];
    status?: IUserMessage['status'];
    onOpenImage: (attachments: IMessageAttachment[], index: number) => void;
    onOpenPdf: (attachment: IMessageAttachment) => void;
}

const WIDTH = 220;

/**
 * The files on one of her sent messages, shown above her text bubble (not inside it):
 * a photo, a grid of photos, or a PDF card, right-aligned on the chat background.
 */
const AttachmentBubbleContent = ({ attachments, status, onOpenImage, onOpenPdf }: IAttachmentBubbleContentProps) => {
    const { t } = useTranslation();
    const [broken, setBroken] = useState<Record<string, boolean>>({});
    const images = attachments.filter(a => a.kind === 'IMAGE');
    const pdf = attachments.find(a => a.kind === 'PDF');

    const overlay =
        status === 'sending' ? (
            <View style={styles.statusOverlay} pointerEvents="none">
                <ActivityIndicator color={colors.white} />
            </View>
        ) : null;

    if (pdf) {
        return (
            <TouchableOpacity
                style={styles.pdfCard}
                onPress={() => onOpenPdf(pdf)}
                accessibilityRole="button"
                accessibilityLabel={t('chat.attachments.a11y.openPdf', { name: pdf.name || 'PDF' })}
            >
                <View style={styles.pdfIcon}>
                    <Lucide name="file-text" size={22} color={colors.darkPurple} />
                </View>
                <View style={styles.pdfText}>
                    <Text numberOfLines={1} style={[styles.pdfName, globalStyles.fontSemiBold]}>
                        {pdf.name || t('chat.attachments.pdfDocument')}
                    </Text>
                    <Text style={[styles.pdfMeta, globalStyles.fontRegular]}>
                        {[
                            pdf.pageCount ? t('chat.attachments.pages', { count: pdf.pageCount }) : null,
                            formatBytes(pdf.sizeBytes),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                </View>
                {status === 'sending' && <ActivityIndicator color={colors.darkPurple} />}
            </TouchableOpacity>
        );
    }

    const single = images.length === 1;
    const tile = single ? WIDTH : (WIDTH - 4 * (images.length - 1)) / images.length;
    const ratio = single && images[0].width && images[0].height ? images[0].height / images[0].width : 0.75;
    const height = single ? Math.min(WIDTH * Math.min(Math.max(ratio, 0.5), 1.33), 293) : tile;

    return (
        <View style={styles.grid}>
            {images.map((image, index) => (
                <TouchableOpacity
                    key={image.id}
                    onPress={() => onOpenImage(images, index)}
                    activeOpacity={0.85}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('chat.attachments.a11y.sharedPhoto', {
                        index: index + 1,
                        total: images.length,
                    })}
                >
                    {broken[image.id] || !image.localUri ? (
                        <View style={[styles.placeholder, { width: tile, height }]}>
                            <Lucide name="image" size={24} color={colors.gray} />
                            <Text style={[styles.placeholderText, globalStyles.fontRegular]}>
                                {t('chat.attachments.tapToView')}
                            </Text>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: image.localUri }}
                            style={{ width: tile, height, borderRadius: 12 }}
                            resizeMode="cover"
                            onError={() => setBroken(prev => ({ ...prev, [image.id]: true }))}
                        />
                    )}
                </TouchableOpacity>
            ))}
            {overlay}
        </View>
    );
};

const styles = StyleSheet.create({
    grid: { flexDirection: 'row', gap: 4, marginBottom: 6, alignSelf: 'flex-end' },
    statusOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        borderRadius: 12,
        backgroundColor: colors.lightGray,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    placeholderText: { color: colors.darkGray, fontSize: 12 },
    pdfCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: WIDTH,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.lightPurple,
        borderWidth: 1,
        borderColor: colors.vivaBorder,
        marginBottom: 6,
        alignSelf: 'flex-end',
    },
    pdfIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pdfText: { flex: 1 },
    pdfName: { color: colors.black, fontSize: 14 },
    pdfMeta: { color: colors.darkGray, fontSize: 12, marginTop: 2 },
});

export default AttachmentBubbleContent;
