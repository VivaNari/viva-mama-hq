import Lucide from '@react-native-vector-icons/lucide';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

import { getHealthRecord } from '../../api/healthRecords.api';
import { AnalyticsEvent, track } from '../../analytics';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IHealthRecord, IHealthRecordItem } from '../../types/healthRecords.types';
import { formatDay, recordLabelKey } from '../../utils/healthRecords';
import BottomSheetModal from '../chatAttachments/BottomSheetModal';
import { MarkdownText } from '../chatBubble/MarkdownText';

interface IRecordSummarySheetProps {
    /** The record whose summary to show; null hides the sheet. */
    record: IHealthRecordItem | null;
    onClose: () => void;
    onViewFile: (record: IHealthRecord) => void;
    onDelete: (record: IHealthRecordItem) => void;
    onRetry?: (record: IHealthRecordItem) => void;
}

/** What Viva wrote about one record, and what she can do with it. */
const RecordSummarySheet = ({ record, onClose, onViewFile, onDelete, onRetry }: IRecordSummarySheetProps) => {
    const { t, i18n } = useTranslation();
    const { height } = useWindowDimensions();
    const [full, setFull] = useState<IHealthRecord | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFull(null);
        setFailed(false);
        if (!record) return;
        let cancelled = false;
        getHealthRecord(record.id)
            .then(r => {
                if (cancelled) return;
                setFull(r);
                if (r.summary) track(AnalyticsEvent.RECORD_SUMMARY_VIEWED, { category: r.category });
            })
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, [record]);

    if (!record) return null;
    const label = record.title || t(recordLabelKey(record.category, record.scanType));
    const who = record.subject.type === 'CHILD' ? record.subject.childName || t('healthRecords.baby') : t('healthRecords.me');

    return (
        <BottomSheetModal visible={!!record} onClose={onClose} accessibilityLabel={label}>
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Text style={[styles.title, globalStyles.fontBold]} accessibilityRole="header" numberOfLines={2}>
                        {label}
                    </Text>
                    <Text style={[styles.meta, globalStyles.fontRegular]}>
                        {formatDay(record.recordDate, i18n.language)} · {who}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.close}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                >
                    <Lucide name="x" size={20} color={colors.vivaSubtle} />
                </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={styles.body}>
                {!full && !failed ? <ActivityIndicator color={colors.darkPurple} style={styles.loading} /> : null}
                {failed ? (
                    <Text style={[styles.message, globalStyles.fontRegular]}>{t('healthRecords.loadFailed')}</Text>
                ) : null}
                {full?.summary ? (
                    <MarkdownText
                        text={full.summary.markdown}
                        baseStyle={[styles.summaryText, globalStyles.fontRegular]}
                    />
                ) : null}
                {full && !full.summary ? (
                    <Text style={[styles.message, globalStyles.fontRegular]}>
                        {full.message ||
                            t(full.status === 'PROCESSING' ? 'healthRecords.stillReading' : 'healthRecords.failedBody')}
                    </Text>
                ) : null}
            </ScrollView>

            <View style={styles.actions}>
                {full && full.files.length > 0 ? (
                    <Action icon="file-search" label={t('healthRecords.viewFile')} onPress={() => onViewFile(full)} />
                ) : null}
                {record.status === 'FAILED' && onRetry ? (
                    <Action icon="rotate-cw" label={t('healthRecords.retryRead')} onPress={() => onRetry(record)} />
                ) : null}
                <Action
                    icon="trash-2"
                    label={t('healthRecords.delete')}
                    destructive
                    onPress={() => onDelete(record)}
                    a11y={t('healthRecords.a11y.delete', { label, date: formatDay(record.recordDate, i18n.language) })}
                />
            </View>
        </BottomSheetModal>
    );
};

const Action = ({
    icon,
    label,
    onPress,
    destructive = false,
    a11y,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
    a11y?: string;
}) => (
    <TouchableOpacity
        style={styles.action}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y ?? label}
    >
        <Lucide name={icon as any} size={18} color={destructive ? colors.vivaDangerText : colors.darkPurple} />
        <Text
            style={[
                styles.actionText,
                globalStyles.fontSemiBold,
                destructive && { color: colors.vivaDangerText },
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    headerText: { flex: 1 },
    title: { fontSize: 17, color: colors.vivaInk },
    meta: { fontSize: 12.5, color: colors.vivaSubtle, marginTop: 2 },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
    body: { paddingBottom: 12 },
    loading: { marginVertical: 24 },
    summaryText: { fontSize: 14, lineHeight: 21, color: colors.vivaInk },
    message: { fontSize: 14, lineHeight: 21, color: colors.vivaSubtle },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        borderTopColor: colors.vivaDivider,
        paddingTop: 8,
        gap: 4,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    actionText: { fontSize: 13.5, color: colors.darkPurple },
});

export default RecordSummarySheet;
