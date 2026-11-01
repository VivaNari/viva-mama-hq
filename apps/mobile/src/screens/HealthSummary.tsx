import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

import { deleteHealthSummary, getHealthSummary, getHealthSummaryHistory } from '../api/healthRecords.api';
import { PrimaryButton, SecondaryButton } from '../components/logs/Buttons';
import { AmberNote } from '../components/logs/Feedback';
import LogScreen from '../components/logs/LogScreen';
import { invalidateHealthSummaryCache, useHealthSummary } from '../hooks/useHealthSummary';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { logsStyles } from '../public/styles/logsStyles';
import { IHealthSummary, IHealthSummaryContent } from '../types/healthRecords.types';
import { formatDay, toRecordsLang } from '../utils/healthRecords';

/**
 * Her overall health summary: what her records show, the values to discuss with her
 * doctor, recent readings, and the records it was built from. Shared as plain text.
 */
const HealthSummary: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const lang = toRecordsLang(i18n.language);
    const { latest, loading, generating, generate, share, copy, load } = useHealthSummary();
    const [viewing, setViewing] = useState<IHealthSummary | null>(null);
    const [history, setHistory] = useState<IHealthSummary[]>([]);
    const started = useRef(false);

    const loadHistory = useCallback(() => {
        getHealthSummaryHistory()
            .then(page => setHistory(page.summaries))
            .catch(() => undefined);
    }, []);

    useEffect(loadHistory, [loadHistory]);

    // Opened from "Generate health summary", or a summary is already being built: start
    // (or resume waiting on) it once. Resuming does not spend another summary.
    useEffect(() => {
        if (started.current || loading || !latest) return;
        const resume = latest.pending?.status === 'PENDING';
        if ((route.params?.generate && latest.readyRecords > 0) || resume) {
            started.current = true;
            generate(lang).then(ok => ok && loadHistory());
        }
    }, [latest, loading, route.params, generate, lang, loadHistory]);

    const shown = viewing ?? latest?.summary ?? null;
    const isLatest = !viewing || viewing.id === latest?.summary?.id;

    const regenerate = () => {
        setViewing(null);
        generate(lang).then(ok => ok && loadHistory());
    };

    const openPast = async (id: string) => {
        try {
            setViewing(await getHealthSummary(id));
        } catch {
            Toast.show({ type: 'error', text1: t('healthSummary.loadFailed'), position: 'bottom' });
        }
    };

    const confirmDelete = (summary: IHealthSummary) =>
        Alert.alert(t('healthSummary.deleteTitle'), t('healthSummary.deleteBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('healthRecords.delete'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteHealthSummary(summary.id);
                        invalidateHealthSummaryCache();
                        if (viewing?.id === summary.id) setViewing(null);
                        await load();
                        loadHistory();
                    } catch {
                        Toast.show({ type: 'error', text1: t('healthSummary.deleteFailed'), position: 'bottom' });
                    }
                },
            },
        ]);

    if (loading && !latest) {
        return (
            <LogScreen title={t('healthSummary.title')}>
                <ActivityIndicator color={colors.darkPurple} style={{ marginTop: 40 }} />
            </LogScreen>
        );
    }

    if (generating) {
        return (
            <LogScreen title={t('healthSummary.title')}>
                <View style={logsStyles.doneWrap} accessibilityLiveRegion="polite">
                    <ActivityIndicator size="large" color={colors.darkPurple} />
                    <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>{t('healthSummary.generatingTitle')}</Text>
                    <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>
                        {t('healthSummary.generatingBody', { count: latest?.readyRecords ?? 0 })}
                    </Text>
                </View>
            </LogScreen>
        );
    }

    if (!shown) {
        const none = (latest?.readyRecords ?? 0) === 0;
        return (
            <LogScreen title={t('healthSummary.title')}>
                <View style={logsStyles.doneWrap}>
                    <View style={[logsStyles.doneIcon, { backgroundColor: colors.vivaTint }]}>
                        <Lucide name="sparkles" size={26} color={colors.darkPurple} />
                    </View>
                    <Text style={[logsStyles.doneTitle, globalStyles.fontBold]}>
                        {t(none ? 'healthSummary.noRecordsTitle' : 'healthSummary.noSummaryTitle')}
                    </Text>
                    <Text style={[logsStyles.doneSub, globalStyles.fontRegular]}>
                        {t(none ? 'healthSummary.noRecordsBody' : 'healthSummary.noSummaryBody', {
                            count: latest?.readyRecords ?? 0,
                        })}
                    </Text>
                    {latest?.pending?.status === 'FAILED' ? (
                        <AmberNote text={t('healthSummary.failed')} />
                    ) : null}
                    <PrimaryButton
                        label={t(none ? 'healthRecords.addFirst' : 'healthRecords.generateSummary')}
                        onPress={() => (none ? navigation.navigate('RecordsUpload') : regenerate())}
                        style={{ alignSelf: 'stretch' }}
                    />
                </View>
            </LogScreen>
        );
    }

    const content = shown.content as IHealthSummaryContent;
    const stale = isLatest ? latest?.stale : null;
    return (
        <LogScreen title={t('healthSummary.title')} contentStyle={{ paddingTop: 12 }}>
            <Text style={[styles.meta, globalStyles.fontRegular]}>
                {t('healthSummary.generatedOn', {
                    date: formatDay(shown.createdAt.slice(0, 10), i18n.language),
                    count: shown.recordCount,
                })}
            </Text>

            {stale ? (
                <TouchableOpacity
                    style={styles.stale}
                    onPress={regenerate}
                    accessibilityRole="button"
                    accessibilityLabel={t('healthSummary.update')}
                >
                    <Lucide name="refresh-cw" size={16} color={colors.vivaAmberText} />
                    <Text style={[styles.staleText, globalStyles.fontRegular]}>
                        {stale.removedRecords
                            ? t('healthSummary.staleRemoved')
                            : t('healthSummary.staleNew', { count: stale.newRecords })}{' '}
                        <Text style={globalStyles.fontBold}>{t('healthSummary.update')}</Text>
                    </Text>
                </TouchableOpacity>
            ) : null}
            {!isLatest ? <AmberNote text={t('healthSummary.pastSnapshot')} /> : null}

            <SummaryBody content={content} />

            <View style={styles.actions}>
                <PrimaryButton
                    label={t('healthSummary.share')}
                    icon={<Lucide name="share-2" size={16} color={colors.white} />}
                    onPress={() => share(shown)}
                    style={{ flex: 1 }}
                />
                <SecondaryButton label={t('healthSummary.copy')} onPress={() => copy(shown)} style={{ flex: 1 }} />
            </View>
            {isLatest ? (
                <SecondaryButton label={t('healthSummary.regenerate')} onPress={regenerate} />
            ) : (
                <SecondaryButton label={t('healthSummary.backToLatest')} onPress={() => setViewing(null)} />
            )}

            {history.length > 1 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={[logsStyles.capsLabel, globalStyles.fontBold]}>{t('healthSummary.earlier')}</Text>
                    {history.map(item => (
                        <View key={item.id} style={styles.historyRow}>
                            <TouchableOpacity
                                style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                                onPress={() => openPast(item.id)}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.historyTitle, globalStyles.fontSemiBold]}>
                                    {formatDay(item.createdAt.slice(0, 10), i18n.language)}
                                    {item.id === shown.id ? ` · ${t('healthSummary.showing')}` : ''}
                                </Text>
                                <Text style={[styles.historySub, globalStyles.fontRegular]}>
                                    {t('healthSummary.recordCount', { count: item.recordCount })}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.historyDelete}
                                onPress={() => confirmDelete(item)}
                                accessibilityRole="button"
                                accessibilityLabel={t('healthSummary.deleteA11y', {
                                    date: formatDay(item.createdAt.slice(0, 10), i18n.language),
                                })}
                            >
                                <Lucide name="trash-2" size={16} color={colors.vivaDangerText} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.deleteOne}
                    onPress={() => confirmDelete(shown)}
                    accessibilityRole="button"
                >
                    <Text style={[styles.deleteOneText, globalStyles.fontSemiBold]}>{t('healthSummary.delete')}</Text>
                </TouchableOpacity>
            )}
        </LogScreen>
    );
};

/** The summary itself, in the same sections as the shared text. */
export const SummaryBody = ({ content }: { content: IHealthSummaryContent }) => {
    const { t, i18n } = useTranslation();
    const facts = content.facts;
    const about = [
        facts.stage_line,
        facts.conditions.length ? t('healthSummary.conditions', { items: facts.conditions.join(', ') }) : '',
        facts.medicines.length ? t('healthSummary.medicines', { items: facts.medicines.join('; ') }) : '',
    ].filter(Boolean);

    return (
        <View style={{ gap: 12 }}>
            {facts.name ? <Text style={[styles.name, globalStyles.fontBold]}>{facts.name}</Text> : null}
            {about.length ? (
                <Section title={t('healthSummary.aboutMe')} icon="user-round">
                    {about.map(line => (
                        <Text key={line} style={[styles.text, globalStyles.fontRegular]}>
                            {line}
                        </Text>
                    ))}
                </Section>
            ) : null}
            {facts.children.length ? (
                <Section title={t('healthSummary.babies')} icon="baby">
                    {facts.children.map(c => (
                        <Text key={c.name} style={[styles.text, globalStyles.fontRegular]}>
                            {c.name}
                            {[c.sex, c.age_text].filter(Boolean).length ? ` (${[c.sex, c.age_text].filter(Boolean).join(', ')})` : ''}
                        </Text>
                    ))}
                </Section>
            ) : null}
            {content.overview ? (
                <Section title={t('healthSummary.overview')} icon="sparkles">
                    <Text style={[styles.text, globalStyles.fontRegular]}>{content.overview}</Text>
                </Section>
            ) : null}
            {content.mother_points.length || content.baby_points.length ? (
                <Section title={t('healthSummary.keyPoints')} icon="list-checks">
                    <Bullets items={content.mother_points} />
                    {content.baby_points.map(b => (
                        <View key={b.child_name} style={{ marginTop: 6 }}>
                            <Text style={[styles.text, globalStyles.fontSemiBold]}>{b.child_name}</Text>
                            <Bullets items={b.points} />
                        </View>
                    ))}
                </Section>
            ) : null}
            {content.trends.length ? (
                <Section title={t('healthSummary.trends')} icon="trending-up">
                    <Bullets items={content.trends} />
                </Section>
            ) : null}
            {content.values_to_discuss.length ? (
                <Section title={t('healthSummary.valuesToDiscuss')} icon="stethoscope">
                    {content.values_to_discuss.map((v, i) => (
                        <View key={`${v.record_id}-${i}`} style={[styles.value, v.urgent && styles.valueUrgent]}>
                            <Text style={[styles.text, globalStyles.fontSemiBold]}>
                                {v.name}: {v.value}
                                {v.reference_range ? ` (${t('healthSummary.range')} ${v.reference_range})` : ''}
                            </Text>
                            <Text style={[styles.valueMeta, globalStyles.fontRegular]}>
                                {t(`healthSummary.status.${v.status}`, { defaultValue: v.status })}
                                {v.urgent ? ` · ${t('healthSummary.urgent')}` : ''} · {v.record_title},{' '}
                                {formatDay(v.record_date, i18n.language)}
                            </Text>
                        </View>
                    ))}
                </Section>
            ) : null}
            {content.vitals.length ? (
                <Section title={t('healthSummary.recentReadings')} icon="activity">
                    <Bullets items={content.vitals} />
                </Section>
            ) : null}
            <Section title={t('healthSummary.recordsIncluded')} icon="folder-heart">
                <Bullets
                    items={content.records.map(r => `${formatDay(r.date, i18n.language)} · ${r.title} (${r.subject})`)}
                />
            </Section>
            {content.questions_for_doctor.length ? (
                <Section title={t('healthSummary.questions')} icon="message-circle-question">
                    <Bullets items={content.questions_for_doctor} />
                </Section>
            ) : null}
            <Text style={[logsStyles.disclaimer, globalStyles.fontRegular]}>{content.disclaimer}</Text>
        </View>
    );
};

const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <View style={[logsStyles.card, styles.section]}>
        <View style={styles.sectionHeader}>
            <Lucide name={icon as any} size={16} color={colors.darkPurple} />
            <Text style={[styles.sectionTitle, globalStyles.fontBold]} accessibilityRole="header">
                {title}
            </Text>
        </View>
        {children}
    </View>
);

const Bullets = ({ items }: { items: string[] }) => (
    <View style={{ gap: 4 }}>
        {items.map((item, i) => (
            <View key={`${i}-${item}`} style={styles.bullet}>
                <Text style={[styles.text, styles.dot]}>•</Text>
                <Text style={[styles.text, globalStyles.fontRegular, { flex: 1 }]}>{item}</Text>
            </View>
        ))}
    </View>
);

const styles = StyleSheet.create({
    meta: { fontSize: 12.5, color: colors.vivaSubtle },
    name: { fontSize: 18, color: colors.vivaInk },
    section: { padding: 14, gap: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 14, color: colors.vivaInk },
    text: { fontSize: 14, lineHeight: 21, color: colors.vivaInk },
    bullet: { flexDirection: 'row', gap: 6 },
    dot: { color: colors.darkPurple },
    value: { borderLeftWidth: 3, borderLeftColor: colors.vivaWarning, paddingLeft: 10, paddingVertical: 2 },
    valueUrgent: { borderLeftColor: colors.vivaDangerText },
    valueMeta: { fontSize: 12, color: colors.vivaSubtle, lineHeight: 17 },
    stale: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        backgroundColor: colors.vivaAmberBG,
        borderColor: colors.vivaAmberBorder,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        minHeight: 44,
    },
    staleText: { flex: 1, fontSize: 13, color: colors.vivaAmberText, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.vivaBorder,
        paddingLeft: 14,
    },
    historyTitle: { fontSize: 13.5, color: colors.vivaInk },
    historySub: { fontSize: 12, color: colors.vivaSubtle },
    historyDelete: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    deleteOne: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    deleteOneText: { fontSize: 13, color: colors.vivaDangerText },
});

export default HealthSummary;
