import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import AttachmentConsentSheet from '../../components/chatAttachments/AttachmentConsentSheet';
import AttachmentSourceSheet from '../../components/chatAttachments/AttachmentSourceSheet';
import ImageViewerModal from '../../components/chatAttachments/ImageViewerModal';
import { MarkdownText } from '../../components/chatBubble/MarkdownText';
import RecordPagesGrid from '../../components/healthRecords/RecordPagesGrid';
import { LinkButton, PrimaryButton, SecondaryButton } from '../../components/logs/Buttons';
import Chip from '../../components/logs/Chip';
import { AmberNote } from '../../components/logs/Feedback';
import LogScreen from '../../components/logs/LogScreen';
import { useMyChildren } from '../../hooks/useMyChildren';
import { TRecordMeta, useRecordDraft } from '../../hooks/useRecordDraft';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';
import { RecordCategory, ScanType } from '../../types/healthRecords.types';
import { recordLabelKey, toRecordsLang } from '../../utils/healthRecords';

const CATEGORIES: RecordCategory[] = ['scan', 'lab', 'prescription', 'mch'];
const SCAN_TYPES: ScanType[] = ['dating', 'anomaly', 'growth'];
const ME = 'me';

/**
 * Add a scan, lab report, prescription or MCH card: what it is, who it is for, then
 * 1 PDF or up to 5 photos of its pages. Pages upload while she fills the rest in;
 * Save sends it to Viva, which reads it and writes the summary kept with it.
 */
const RecordsUpload: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const children = useMyChildren();
    const [category, setCategory] = useState<RecordCategory>('scan');
    const [scanType, setScanType] = useState<ScanType | null>(null);
    const [subjectKey, setSubjectKey] = useState<string>(ME);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const meta = useMemo<TRecordMeta>(
        () => ({
            category,
            scanType: category === 'scan' ? scanType : null,
            subject:
                subjectKey === ME ? { type: 'MOTHER', childId: null } : { type: 'CHILD', childId: subjectKey },
        }),
        [category, scanType, subjectKey],
    );
    const draft = useRecordDraft(meta, toRecordsLang(i18n.language));
    const { config, record, phase } = draft;

    const ready = (category !== 'scan' || scanType !== null) && draft.canSubmit;
    const itemLabel = t(recordLabelKey(category, category === 'scan' ? scanType : null));

    const pickCategory = (next: RecordCategory) => {
        setCategory(next);
        if (next !== 'scan') setScanType(null);
    };

    if (!config) {
        return (
            <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
                {draft.configError ? (
                    <View style={{ gap: 12, alignItems: 'center', marginTop: 40 }}>
                        <Text style={[logsStyles.bodyMuted, globalStyles.fontRegular]}>
                            {t('healthRecords.loadFailed')}
                        </Text>
                        <SecondaryButton label={t('common.retry')} onPress={draft.refreshConfig} />
                    </View>
                ) : (
                    <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
                )}
            </LogScreen>
        );
    }

    if (!config.enabled) {
        return (
            <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
                <AmberNote text={t('healthRecords.unavailable')} />
            </LogScreen>
        );
    }

    if (phase === 'processing' || phase === 'done') {
        return (
            <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
                <ResultState
                    phase={phase}
                    record={record}
                    itemLabel={itemLabel}
                    onAnother={draft.reset}
                    onOpenRecords={() => navigation.navigate('HealthRecords')}
                    onRetry={draft.retryRead}
                />
            </LogScreen>
        );
    }

    const uploadsLeft = config.quota.uploads.remaining;
    return (
        <LogScreen title={t('logs.records.title')} contentStyle={{ paddingTop: 18 }}>
            <Text style={[logsStyles.questionTitle, globalStyles.fontBold]}>{t('logs.records.whatAdding')}</Text>
            <View style={logsStyles.chipRow}>
                {CATEGORIES.map(key => (
                    <Chip
                        key={key}
                        variant="solid"
                        label={t(`logs.records.categories.${key}`)}
                        selected={category === key}
                        onPress={() => pickCategory(key)}
                    />
                ))}
            </View>

            {category === 'mch' ? (
                <View style={logsStyles.mchNote}>
                    <View style={[logsStyles.tileIcon, logsStyles.tileIconOnTone]}>
                        <Lucide name="clipboard-list" size={16} color={colors.darkPurple} />
                    </View>
                    <Text style={[logsStyles.mchNoteText, globalStyles.fontRegular]}>{t('logs.records.mchNote')}</Text>
                </View>
            ) : null}

            {category === 'scan' ? (
                <View style={{ gap: 10 }}>
                    <Text style={[logsStyles.fieldLabel, { fontSize: 12.5 }, globalStyles.fontSemiBold]}>
                        {t('logs.records.whichScan')}
                    </Text>
                    {SCAN_TYPES.map(key => (
                        <TouchableOpacity
                            key={key}
                            onPress={() => setScanType(key)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: scanType === key }}
                            style={[logsStyles.choiceCard, scanType === key && logsStyles.choiceCardOn]}
                        >
                            <Text style={[logsStyles.itemTitle, globalStyles.fontSemiBold]}>
                                {t(`logs.records.scanTypes.${key}`)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}

            {children.length > 0 ? (
                <View style={{ gap: 10 }}>
                    <Text style={[logsStyles.fieldLabel, { fontSize: 12.5 }, globalStyles.fontSemiBold]}>
                        {t('healthRecords.whoFor')}
                    </Text>
                    <View style={logsStyles.chipRow}>
                        <Chip
                            variant="solid"
                            label={t('healthRecords.me')}
                            selected={subjectKey === ME}
                            onPress={() => setSubjectKey(ME)}
                        />
                        {children.map(child => (
                            <Chip
                                key={child.id}
                                variant="solid"
                                label={child.name}
                                selected={subjectKey === child.id}
                                onPress={() => setSubjectKey(child.id)}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            <View style={{ gap: 10 }}>
                <Text style={[logsStyles.fieldLabel, { fontSize: 12.5 }, globalStyles.fontSemiBold]}>
                    {t('healthRecords.pagesLabel', { max: config.maxFiles })}
                </Text>
                {draft.pages.length === 0 ? (
                    <TouchableOpacity
                        onPress={draft.openAdd}
                        accessibilityRole="button"
                        style={logsStyles.dashedButton}
                    >
                        <Lucide name="camera" size={16} color={colors.darkPurple} />
                        <Text style={[logsStyles.dashedButtonText, globalStyles.fontSemiBold]}>
                            {t('logs.common.takePhoto')}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <RecordPagesGrid
                        pages={draft.pages}
                        canAdd={!draft.full}
                        onAdd={draft.openAdd}
                        onRemove={draft.remove}
                        onRetry={draft.retry}
                        onOpen={index => draft.pages[index]?.kind === 'IMAGE' && setPreviewIndex(index)}
                    />
                )}
            </View>

            <Text style={[logsStyles.footnote, globalStyles.fontRegular]}>
                {t('healthRecords.privacyLine')}
                {uploadsLeft != null ? ` ${t('healthRecords.uploadsLeft', { count: uploadsLeft })}` : ''}
            </Text>

            <PrimaryButton
                label={phase === 'submitting' ? t('common.saving') : t('healthRecords.saveAndSummarise')}
                onPress={draft.submit}
                disabled={!ready || phase === 'submitting'}
                style={{ marginTop: 4 }}
            />
            {draft.pages.length === 0 ? null : (
                <LinkButton label={t('healthRecords.myRecords')} onPress={() => navigation.navigate('HealthRecords')} />
            )}

            <AttachmentSourceSheet
                visible={draft.sheetVisible}
                onClose={draft.closeSheet}
                onSelect={draft.pickFrom}
                retentionDays={0}
                remainingToday={null}
                disabledSources={draft.disabledSources}
                title={t('healthRecords.sheetTitle')}
                subtitle={t('healthRecords.sheetSubtitle', { max: config.maxFiles })}
                privacyNote={t('healthRecords.privacyLine')}
            />
            <ImageViewerModal
                visible={previewIndex != null}
                images={draft.pages
                    .filter(p => p.kind === 'IMAGE')
                    .map(p => ({ id: p.localId, kind: 'IMAGE' as const, localUri: p.uri }))}
                initialIndex={previewIndex ?? 0}
                onClose={() => setPreviewIndex(null)}
                resolveUrl={() => Promise.reject(new Error('local only'))}
            />
            <AttachmentConsentSheet
                visible={draft.consentVisible}
                retentionDays={0}
                submitting={draft.consentSubmitting}
                onAccept={draft.acceptConsent}
                onDecline={draft.declineConsent}
                i18nPrefix="healthRecords.consent"
            />
        </LogScreen>
    );
};

const ResultState = ({
    phase,
    record,
    itemLabel,
    onAnother,
    onOpenRecords,
    onRetry,
}: {
    phase: 'processing' | 'done';
    record: ReturnType<typeof useRecordDraft>['record'];
    itemLabel: string;
    onAnother: () => void;
    onOpenRecords: () => void;
    onRetry: () => void;
}) => {
    const { t } = useTranslation();
    const status = record?.status;

    if (phase === 'processing' || status === 'PROCESSING' || !record) {
        return (
            <View style={logsStyles.doneWrap} accessibilityLiveRegion="polite">
                <ActivityIndicator size="large" color={colors.darkPurple} />
                <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>
                    {t(phase === 'processing' ? 'healthRecords.readingTitle' : 'healthRecords.stillReadingTitle')}
                </Text>
                <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>
                    {t(phase === 'processing' ? 'healthRecords.readingBody' : 'healthRecords.stillReading')}
                </Text>
                {phase === 'done' ? (
                    <PrimaryButton label={t('healthRecords.myRecords')} onPress={onOpenRecords} style={{ alignSelf: 'stretch' }} />
                ) : null}
            </View>
        );
    }

    if (status === 'READY') {
        return (
            <View style={{ gap: 14 }} accessibilityLiveRegion="polite">
                <View style={logsStyles.doneWrap}>
                    <View style={logsStyles.doneIcon}>
                        <Lucide name="check" size={28} color={colors.vivaSuccess} />
                    </View>
                    <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>
                        {t('healthRecords.savedTitle', { item: record.title || itemLabel })}
                    </Text>
                    <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>{t('healthRecords.savedBody')}</Text>
                </View>
                {record.summary ? (
                    <View style={[logsStyles.card, { padding: 14 }]}>
                        <MarkdownText
                            text={record.summary.markdown}
                            baseStyle={[{ fontSize: 14, lineHeight: 21, color: colors.vivaInk }, globalStyles.fontRegular]}
                        />
                    </View>
                ) : null}
                <PrimaryButton label={t('healthRecords.addAnother')} onPress={onAnother} />
                <SecondaryButton label={t('healthRecords.myRecords')} onPress={onOpenRecords} />
            </View>
        );
    }

    // Refused (not a health record of hers or her baby's) or failed to read.
    return (
        <View style={logsStyles.doneWrap} accessibilityLiveRegion="polite">
            <View style={[logsStyles.doneIcon, { backgroundColor: colors.vivaDangerBG }]}>
                <Lucide name="file-x" size={26} color={colors.vivaDangerText} />
            </View>
            <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>
                {t(status === 'FAILED' ? 'healthRecords.failedTitle' : 'healthRecords.rejectedTitle')}
            </Text>
            <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>
                {record.message || t(status === 'FAILED' ? 'healthRecords.failedBody' : 'healthRecords.rejectedBody')}
            </Text>
            <Text style={[logsStyles.footnote, globalStyles.fontRegular]}>{t('healthRecords.notCounted')}</Text>
            {status === 'FAILED' ? (
                <PrimaryButton label={t('healthRecords.retryRead')} onPress={onRetry} style={{ alignSelf: 'stretch' }} />
            ) : (
                <PrimaryButton label={t('healthRecords.tryAgain')} onPress={onAnother} style={{ alignSelf: 'stretch' }} />
            )}
        </View>
    );
};

export default RecordsUpload;
