import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import LogInfoBanner from '../components/infant/LogInfoBanner';
import LogSectionCard from '../components/infant/LogSectionCard';
import { DIAPER_KINDS } from '../data/infantDiaperData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { IDiaperEntry, TDiaperKind } from '../types/infantLog.types';
import { formatClockTime } from '../utils/infantLogHelpers';

/**
 * Diaper Log (PRD 4.5) — pee and poop.
 *
 * The only log with no Save button, and deliberately so: a diaper is logged one-handed
 * while holding a baby, so a tap on Wet / Dirty / Both records it with the current time
 * immediately. The undo is the ✕ on the entry, not a form the parent has to come back to.
 *
 * UI only — entries live in component state and are lost on unmount.
 */
const DiaperLog: React.FC = () => {
    const { t } = useTranslation();

    const [entries, setEntries] = useState<IDiaperEntry[]>([]);

    const addEntry = (kind: TDiaperKind) =>
        setEntries((prev) => [
            {
                // Date.now() alone collides when two taps land in the same millisecond,
                // which React then renders with duplicate keys.
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                kind,
                loggedAt: Date.now(),
            },
            ...prev,
        ]);

    const removeEntry = (id: string) =>
        setEntries((prev) => prev.filter((entry) => entry.id !== id));

    const countFor = (kind: TDiaperKind) =>
        entries.filter((entry) => entry.kind === kind).length;

    const configFor = (kind: TDiaperKind) =>
        DIAPER_KINDS.find((item) => item.kind === kind) ?? DIAPER_KINDS[0];

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={infantLogStyles.content}
                showsVerticalScrollIndicator={false}
            >
                <LogSectionCard
                    title={t('infant.diaper.quickLogTitle')}
                    caption={t('infant.diaper.quickLogCaption')}
                >
                    <View style={styles.quickRow}>
                        {DIAPER_KINDS.map((kind) => (
                            <TouchableOpacity
                                key={kind.kind}
                                activeOpacity={0.8}
                                onPress={() => addEntry(kind.kind)}
                                accessibilityRole="button"
                                accessibilityLabel={t(kind.labelKey)}
                                style={[
                                    styles.quickTile,
                                    { backgroundColor: kind.background },
                                ]}
                            >
                                <MaterialDesignIcons
                                    name={kind.icon as any}
                                    size={26}
                                    color={kind.foreground}
                                />

                                <Text
                                    style={[
                                        styles.quickLabel,
                                        { color: kind.foreground },
                                        globalStyles.fontSemiBold,
                                    ]}
                                >
                                    {t(kind.labelKey)}
                                </Text>

                                <Text
                                    style={[
                                        styles.quickCount,
                                        globalStyles.fontRegular,
                                    ]}
                                >
                                    {t('infant.diaper.countToday', {
                                        count: countFor(kind.kind),
                                    })}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </LogSectionCard>

                <LogSectionCard
                    title={t('infant.diaper.todayTitle')}
                    headerRight={
                        <Text style={[styles.total, globalStyles.fontRegular]}>
                            {t('infant.diaper.total', { count: entries.length })}
                        </Text>
                    }
                >
                    {entries.length === 0 ? (
                        <Text style={[styles.empty, globalStyles.fontRegular]}>
                            {t('infant.diaper.empty')}
                        </Text>
                    ) : (
                        entries.map((entry, index) => {
                            const kind = configFor(entry.kind);

                            return (
                                <View
                                    key={entry.id}
                                    style={[
                                        styles.entry,
                                        index === entries.length - 1 && styles.entryLast,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.entryIcon,
                                            { backgroundColor: kind.background },
                                        ]}
                                    >
                                        <MaterialDesignIcons
                                            name={kind.icon as any}
                                            size={18}
                                            color={kind.foreground}
                                        />
                                    </View>

                                    <View style={styles.entryText}>
                                        <Text
                                            style={[
                                                styles.entryTitle,
                                                globalStyles.fontSemiBold,
                                            ]}
                                        >
                                            {t(kind.labelKey)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.entrySubtitle,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(kind.descriptionKey)}
                                        </Text>
                                    </View>

                                    <Text
                                        style={[
                                            styles.entryTime,
                                            globalStyles.fontSemiBold,
                                        ]}
                                    >
                                        {formatClockTime(new Date(entry.loggedAt))}
                                    </Text>

                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => removeEntry(entry.id)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('infant.diaper.remove')}
                                        // Generous slop: this sits next to nothing else and
                                        // is pressed one-handed.
                                        hitSlop={10}
                                    >
                                        <MaterialDesignIcons
                                            name="close"
                                            size={18}
                                            color={colors.gray}
                                        />
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </LogSectionCard>

                <LogInfoBanner text={t('infant.diaper.guidance')} />

                <Text
                    style={[
                        infantLogStyles.footnote,
                        styles.centered,
                        globalStyles.fontRegular,
                    ]}
                >
                    {t('infant.notPersistedYet')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    quickRow: {
        flexDirection: 'row',
        gap: 10,
    },

    quickTile: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 6,
    },

    quickLabel: {
        fontSize: 15,
    },

    quickCount: {
        fontSize: 11,
        color: colors.darkGray,
    },

    total: {
        fontSize: 12,
        color: colors.gray,
    },

    empty: {
        fontSize: 13,
        color: colors.gray,
    },

    entry: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
    },

    entryLast: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },

    entryIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    entryText: {
        flex: 1,
    },

    entryTitle: {
        fontSize: 14,
        color: colors.black,
    },

    entrySubtitle: {
        marginTop: 1,
        fontSize: 12,
        color: colors.gray,
    },

    entryTime: {
        fontSize: 13,
        color: colors.darkGray,
    },

    centered: {
        textAlign: 'center',
    },
});

export default DiaperLog;
