import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { getHealthRecord, retryHealthRecord } from '../api/healthRecords.api';
import RecordCard from '../components/healthRecords/RecordCard';
import RecordSummarySheet from '../components/healthRecords/RecordSummarySheet';
import { useRecordViewer } from '../components/healthRecords/useRecordViewer';
import Chip from '../components/logs/Chip';
import { PrimaryButton } from '../components/logs/Buttons';
import { TRecordFilter, useHealthRecordsList } from '../hooks/useHealthRecordsList';
import { useMyChildren } from '../hooks/useMyChildren';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { logsStyles } from '../public/styles/logsStyles';
import { IHealthRecordItem, RecordCategory } from '../types/healthRecords.types';
import { serverErrorCode } from '../utils/attachments';
import { formatDay, recordErrorKey, toMonthSections } from '../utils/healthRecords';

const GUTTER = 16;
const GAP = 12;
const CATEGORIES: RecordCategory[] = ['scan', 'lab', 'prescription', 'mch'];

type TFilterKey = 'all' | 'me' | `child:${string}` | `cat:${RecordCategory}`;

const toFilter = (key: TFilterKey): TRecordFilter => {
    if (key === 'me') return { subject: 'MOTHER' };
    if (key.startsWith('child:')) return { subject: 'CHILD', childId: key.slice(6) };
    if (key.startsWith('cat:')) return { category: key.slice(4) as RecordCategory };
    return {};
};

/**
 * My records: every record she has kept, grouped by month and day of the report,
 * newest first. The eye on a card opens what Viva wrote about it; a long press starts
 * selecting several to delete.
 */
const HealthRecords: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const { width } = useWindowDimensions();
    const children = useMyChildren();
    const [filterKey, setFilterKey] = useState<TFilterKey>('all');
    const filter = useMemo(() => toFilter(filterKey), [filterKey]);
    const list = useHealthRecordsList(filter);
    const viewer = useRecordViewer();

    const [sheetRecord, setSheetRecord] = useState<IHealthRecordItem | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const selecting = selected.size > 0;

    const cardWidth = (width - GUTTER * 2 - GAP) / 2;
    const sections = useMemo(() => toMonthSections(list.groups, i18n.language), [list.groups, i18n.language]);
    const allRecords = useMemo(() => list.groups.flatMap(g => g.records), [list.groups]);

    const toggle = useCallback((record: IHealthRecordItem) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(record.id)) next.delete(record.id);
            else next.add(record.id);
            return next;
        });
    }, []);

    const confirmDelete = useCallback(
        (records: IHealthRecordItem[]) => {
            const many = records.length > 1;
            Alert.alert(
                many ? t('healthRecords.deleteManyTitle', { count: records.length }) : t('healthRecords.deleteTitle'),
                t('healthRecords.deleteBody'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('healthRecords.delete'),
                        style: 'destructive',
                        onPress: async () => {
                            setSheetRecord(null);
                            setSelected(new Set());
                            if (await list.remove(records)) {
                                Toast.show({
                                    type: 'success',
                                    text1: t('healthRecords.deleted', { count: records.length }),
                                    position: 'bottom',
                                });
                            }
                        },
                    },
                ],
            );
        },
        [list, t],
    );

    const openCard = useCallback(
        (record: IHealthRecordItem) => {
            if (selecting) return toggle(record);
            // A record that was not saved has no file to open: show why instead.
            if (record.status !== 'READY' || record.fileCount === 0) return setSheetRecord(record);
            // The list item carries no file ids; fetch them, then open the pages.
            getHealthRecord(record.id)
                .then(full => viewer.open(full))
                .catch(() =>
                    Toast.show({ type: 'error', text1: t('healthRecords.couldNotOpen'), position: 'bottom' }),
                );
        },
        [selecting, toggle, viewer, t],
    );

    const retryRead = useCallback(
        async (record: IHealthRecordItem) => {
            setSheetRecord(null);
            try {
                await retryHealthRecord(record.id);
                list.replace();
            } catch (error: any) {
                if (error?.response?.status !== 402) {
                    Toast.show({ type: 'error', text1: t(recordErrorKey(serverErrorCode(error))), position: 'bottom' });
                }
            }
        },
        [list, t],
    );

    const filters: { key: TFilterKey; label: string }[] = [
        { key: 'all', label: t('healthRecords.filterAll') },
        ...(children.length
            ? [
                  { key: 'me' as TFilterKey, label: t('healthRecords.me') },
                  ...children.map(c => ({ key: `child:${c.id}` as TFilterKey, label: c.name })),
              ]
            : []),
        ...CATEGORIES.map(c => ({ key: `cat:${c}` as TFilterKey, label: t(`logs.records.categories.${c}`) })),
    ];

    return (
        <SafeAreaView style={logsStyles.screen} edges={['top', 'bottom', 'left', 'right']}>
            <View style={logsStyles.header}>
                <TouchableOpacity
                    style={logsStyles.backButton}
                    onPress={() => (selecting ? setSelected(new Set()) : navigation.goBack())}
                    accessibilityRole="button"
                    accessibilityLabel={selecting ? t('common.cancel') : t('logs.common.back')}
                >
                    <Lucide name={selecting ? 'x' : 'chevron-left'} size={18} color={colors.vivaInk} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[logsStyles.headerTitle, globalStyles.fontBold]}>
                        {selecting ? t('healthRecords.selected', { count: selected.size }) : t('healthRecords.title')}
                    </Text>
                    {!selecting ? (
                        <Text style={[logsStyles.headerSubtitle, globalStyles.fontRegular]}>
                            {t('healthRecords.subtitle')}
                        </Text>
                    ) : null}
                </View>
                {selecting ? (
                    <TouchableOpacity
                        style={styles.headerAction}
                        onPress={() => confirmDelete(allRecords.filter(r => selected.has(r.id)))}
                        accessibilityRole="button"
                        accessibilityLabel={t('healthRecords.deleteSelected', { count: selected.size })}
                    >
                        <Lucide name="trash-2" size={18} color={colors.vivaDangerText} />
                    </TouchableOpacity>
                ) : allRecords.length > 0 ? (
                    <TouchableOpacity
                        style={styles.headerAction}
                        onPress={() => allRecords[0] && toggle(allRecords[0])}
                        accessibilityRole="button"
                        accessibilityLabel={t('healthRecords.select')}
                    >
                        <Text style={[styles.selectText, globalStyles.fontSemiBold]}>{t('healthRecords.select')}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <SectionList
                sections={sections}
                keyExtractor={group => group.date}
                stickySectionHeadersEnabled
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
                onEndReached={list.loadMore}
                onEndReachedThreshold={0.4}
                ListHeaderComponent={
                    <View style={[logsStyles.chipRow, styles.filters]}>
                        {filters.map(f => (
                            <Chip
                                key={f.key}
                                variant="outline"
                                small
                                label={f.label}
                                selected={filterKey === f.key}
                                onPress={() => setFilterKey(f.key)}
                            />
                        ))}
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <Text style={[styles.month, globalStyles.fontBold]} accessibilityRole="header">
                        {section.title}
                    </Text>
                )}
                renderItem={({ item: group }) => (
                    <View style={styles.day}>
                        <Text style={[styles.dayLabel, globalStyles.fontSemiBold]}>
                            {formatDay(group.date, i18n.language)}
                        </Text>
                        <View style={styles.grid}>
                            {group.records.map(record => (
                                <RecordCard
                                    key={record.id}
                                    record={record}
                                    width={cardWidth}
                                    selecting={selecting}
                                    selected={selected.has(record.id)}
                                    onOpen={openCard}
                                    onSummary={setSheetRecord}
                                    onLongPress={toggle}
                                />
                            ))}
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    list.loading ? (
                        <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
                    ) : list.error ? (
                        <Empty
                            icon="cloud-off"
                            title={t('healthRecords.loadFailed')}
                            action={t('common.retry')}
                            onAction={list.refresh}
                        />
                    ) : (
                        <Empty
                            icon="folder-heart"
                            title={t(filterKey === 'all' ? 'healthRecords.emptyTitle' : 'healthRecords.emptyFiltered')}
                            body={filterKey === 'all' ? t('healthRecords.emptyBody') : undefined}
                            action={t('healthRecords.addFirst')}
                            onAction={() => navigation.navigate('RecordsUpload')}
                        />
                    )
                }
                ListFooterComponent={
                    list.loadingMore ? <ActivityIndicator color={colors.darkPurple} style={{ margin: 16 }} /> : null
                }
            />

            {!selecting ? (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => navigation.navigate('RecordsUpload')}
                        accessibilityRole="button"
                        accessibilityLabel={t('healthRecords.addRecord')}
                    >
                        <Lucide name="plus" size={22} color={colors.darkPurple} />
                    </TouchableOpacity>
                    <PrimaryButton
                        label={t('healthRecords.generateSummary')}
                        icon={<Lucide name="sparkles" size={16} color={colors.white} />}
                        disabled={list.readyRecords === 0}
                        onPress={() => navigation.navigate('HealthSummary', { generate: true })}
                        style={{ flex: 1 }}
                    />
                </View>
            ) : null}

            <RecordSummarySheet
                record={sheetRecord}
                onClose={() => setSheetRecord(null)}
                onViewFile={full => {
                    setSheetRecord(null);
                    setTimeout(() => viewer.open(full), 300);
                }}
                onDelete={record => confirmDelete([record])}
                onRetry={retryRead}
            />
            {viewer.element}
        </SafeAreaView>
    );
};

const Empty = ({
    icon,
    title,
    body,
    action,
    onAction,
}: {
    icon: string;
    title: string;
    body?: string;
    action: string;
    onAction: () => void;
}) => (
    <View style={styles.empty}>
        <View style={styles.emptyIcon}>
            <Lucide name={icon as any} size={28} color={colors.darkPurple} />
        </View>
        <Text style={[styles.emptyTitle, globalStyles.fontBold]}>{title}</Text>
        {body ? <Text style={[styles.emptyBody, globalStyles.fontRegular]}>{body}</Text> : null}
        <PrimaryButton label={action} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
);

const styles = StyleSheet.create({
    listContent: { paddingHorizontal: GUTTER, paddingBottom: 110 },
    filters: { marginTop: 4, marginBottom: 8 },
    month: {
        fontSize: 15,
        color: colors.vivaInk,
        backgroundColor: colors.vivaBG,
        paddingTop: 14,
        paddingBottom: 6,
    },
    day: { marginBottom: 14 },
    dayLabel: { fontSize: 12.5, color: colors.vivaSubtle, marginBottom: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    headerAction: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    selectText: { fontSize: 14, color: colors.darkPurple },
    footer: {
        position: 'absolute',
        left: GUTTER,
        right: GUTTER,
        bottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    fab: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.vivaBorder,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    empty: { alignItems: 'center', gap: 8, marginTop: 48, paddingHorizontal: 12 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.vivaTint,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, color: colors.vivaInk, textAlign: 'center' },
    emptyBody: { fontSize: 13.5, color: colors.vivaSubtle, textAlign: 'center', lineHeight: 20 },
});

export default HealthRecords;
