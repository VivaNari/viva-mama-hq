import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IHealthRecordItem } from '../../types/healthRecords.types';
import { formatDay, recordLabelKey } from '../../utils/healthRecords';

interface IRecordCardProps {
    record: IHealthRecordItem;
    width: number;
    selecting: boolean;
    selected: boolean;
    onOpen: (record: IHealthRecordItem) => void;
    onSummary: (record: IHealthRecordItem) => void;
    onLongPress: (record: IHealthRecordItem) => void;
}

/**
 * A record in My records: its first page (or a PDF tile), what it is and who it is
 * for, and the eye button in the top-right corner that opens its summary.
 */
const RecordCard = ({ record, width, selecting, selected, onOpen, onSummary, onLongPress }: IRecordCardProps) => {
    const { t, i18n } = useTranslation();
    const label = record.title || t(recordLabelKey(record.category, record.scanType));
    const kindLabel = t(recordLabelKey(record.category, record.scanType));
    const who = record.subject.type === 'CHILD' ? record.subject.childName || t('healthRecords.baby') : t('healthRecords.me');
    const date = formatDay(record.recordDate, i18n.language);
    const ready = record.status === 'READY';
    const a11y = t('healthRecords.a11y.card', { label, who, date });

    return (
        <TouchableOpacity
            style={[styles.card, { width }, selected && styles.cardSelected]}
            activeOpacity={0.85}
            onPress={() => onOpen(record)}
            onLongPress={() => onLongPress(record)}
            accessibilityRole={selecting ? 'checkbox' : 'button'}
            accessibilityState={selecting ? { checked: selected } : undefined}
            accessibilityLabel={a11y}
            accessibilityHint={selecting ? undefined : t('healthRecords.a11y.cardHint')}
        >
            <View style={[styles.thumb, { height: width * 0.95 }]}>
                {record.thumbnailUrl ? (
                    <Image source={{ uri: record.thumbnailUrl }} style={styles.image} />
                ) : (
                    <View style={styles.placeholder}>
                        <Lucide
                            name={record.kind === 'PDF' ? 'file-text' : 'image'}
                            size={34}
                            color={colors.vivaDashed}
                        />
                        {record.kind === 'PDF' && record.pageCount ? (
                            <Text style={[styles.placeholderText, globalStyles.fontMedium]}>
                                {t('healthRecords.pages', { count: record.pageCount })}
                            </Text>
                        ) : null}
                    </View>
                )}

                {record.status === 'PROCESSING' ? (
                    <View style={styles.statusOverlay}>
                        <ActivityIndicator color={colors.white} />
                        <Text style={[styles.statusText, globalStyles.fontSemiBold]}>{t('healthRecords.reading')}</Text>
                    </View>
                ) : null}
                {record.status === 'FAILED' || record.status === 'REJECTED' ? (
                    <View style={[styles.statusOverlay, styles.statusBad]}>
                        <Lucide name="alert-circle" size={20} color={colors.white} />
                        <Text style={[styles.statusText, globalStyles.fontSemiBold]}>
                            {t(record.status === 'FAILED' ? 'healthRecords.failed' : 'healthRecords.notSaved')}
                        </Text>
                    </View>
                ) : null}

                {record.kind === 'IMAGE' && record.fileCount > 1 ? (
                    <View style={styles.countBadge}>
                        <Lucide name="layers" size={11} color={colors.white} />
                        <Text style={[styles.countText, globalStyles.fontSemiBold]}>{record.fileCount}</Text>
                    </View>
                ) : null}

                {selecting ? (
                    <View style={[styles.corner, selected ? styles.checkOn : styles.checkOff]}>
                        {selected ? <Lucide name="check" size={14} color={colors.white} /> : null}
                    </View>
                ) : ready ? (
                    <TouchableOpacity
                        style={[styles.corner, styles.eye]}
                        onPress={() => onSummary(record)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('healthRecords.a11y.viewSummary', { label })}
                    >
                        <Lucide name="eye" size={16} color={colors.darkPurple} />
                    </TouchableOpacity>
                ) : null}

                {record.severity === 'HIGH' || record.severity === 'MEDIUM' ? (
                    <View style={[styles.flag, record.severity === 'HIGH' ? styles.flagHigh : styles.flagMedium]}>
                        <Text style={[styles.flagText, globalStyles.fontSemiBold]}>
                            {t(record.severity === 'HIGH' ? 'healthRecords.flagHigh' : 'healthRecords.flagMedium')}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.body}>
                <Text style={[styles.title, globalStyles.fontSemiBold]} numberOfLines={2}>
                    {label}
                </Text>
                <View style={styles.badges}>
                    <Text style={[styles.badge, globalStyles.fontMedium]} numberOfLines={1}>
                        {kindLabel}
                    </Text>
                    <Text style={[styles.badge, styles.badgeWho, globalStyles.fontMedium]} numberOfLines={1}>
                        {who}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.vivaBorder,
        overflow: 'hidden',
    },
    cardSelected: { borderColor: colors.darkPurple, borderWidth: 2 },
    thumb: { backgroundColor: colors.vivaTrack },
    image: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    placeholderText: { fontSize: 12, color: colors.vivaSubtle },
    statusOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(36,31,46,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 8,
    },
    statusBad: { backgroundColor: 'rgba(192,57,43,0.55)' },
    statusText: { color: colors.white, fontSize: 12, textAlign: 'center' },
    countBadge: {
        position: 'absolute',
        left: 8,
        bottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(36,31,46,0.7)',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    countText: { color: colors.white, fontSize: 11 },
    corner: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eye: {
        backgroundColor: colors.white,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    checkOn: { backgroundColor: colors.darkPurple },
    checkOff: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: colors.vivaDashed },
    flag: { position: 'absolute', left: 8, top: 8, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    flagHigh: { backgroundColor: colors.vivaDangerText },
    flagMedium: { backgroundColor: colors.vivaWarning },
    flagText: { color: colors.white, fontSize: 10 },
    body: { padding: 10, gap: 6 },
    title: { fontSize: 13, color: colors.vivaInk, lineHeight: 18 },
    badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    badge: {
        fontSize: 10.5,
        color: colors.vivaTintText,
        backgroundColor: colors.vivaTint,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        overflow: 'hidden',
        maxWidth: '100%',
    },
    badgeWho: { color: colors.vivaSubtle, backgroundColor: colors.vivaTrack },
});

export default RecordCard;
