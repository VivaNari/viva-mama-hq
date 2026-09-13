import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogSectionCard from '../components/infant/LogSectionCard';
import { GROWTH_BOUNDS, GROWTH_FIELDS } from '../data/infantGrowthData';
import { infantData } from '../data/infantData';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { IGrowthMeasurementField, InfantLogRouteParams } from '../types/infantLog.types';
import { isSameDay, recentDates } from '../utils/infantLogHelpers';

/** Today plus the two days before it, matching the design's three date chips. */
const VISIBLE_DAYS = 3;

type MeasurementValues = Record<IGrowthMeasurementField['key'], string>;

const EMPTY_VALUES: MeasurementValues = {
    head_circumference_cm: '',
    length_cm: '',
    weight_grams: '',
};

/**
 * Growth Log — head circumference, length and weight, plotted against WHO standards
 * (PRD 4.1). Tracked to two years.
 *
 * UI only: nothing is persisted, and the WHO chart is the same static image the dashboard
 * card uses. The percentile tiles are deliberately unscored — see the comment on them.
 */
const GrowthLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const dates = useMemo(() => recentDates(VISIBLE_DAYS), []);
    const [selectedDate, setSelectedDate] = useState<Date>(dates[0]);
    const [values, setValues] = useState<MeasurementValues>(EMPTY_VALUES);

    const childName = params.childName?.trim() || t('infant.childFallback');

    const dateTabs = dates.map((date, index) => ({
        key: date.toISOString(),
        label: index === 0
            ? t('infant.growth.today')
            : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        // Only today is editable. Past days stay visible so a parent can see the series
        // forming, but the 24-hour edit window the check-in caption promises is real.
        disabled: index !== 0,
    }));

    const setValue = (key: IGrowthMeasurementField['key'], next: string) =>
        setValues((prev) => ({ ...prev, [key]: next }));

    /**
     * Out-of-range is surfaced per field rather than blocking Save, because the range is a
     * typo-catcher and not a clinical judgement — a parent whose baby genuinely sits
     * outside it must still be able to record the number.
     */
    const outOfRange = (key: IGrowthMeasurementField['key']): boolean => {
        const raw = values[key].trim();
        if (!raw) return false;

        const parsed = Number(raw);
        if (Number.isNaN(parsed)) return true;

        const bounds = GROWTH_BOUNDS[key];
        return parsed < bounds.min || parsed > bounds.max;
    };

    const lastRecorded = (key: IGrowthMeasurementField['key']): string | null => {
        const last = params.lastMeasurements?.[key];
        if (last === undefined || last === null) return null;

        const unit = t(
            key === 'weight_grams' ? 'infant.growth.unitGrams' : 'infant.growth.unitCm',
        );
        return t('infant.growth.lastValue', { value: last, unit });
    };

    const hasAnyValue = Object.values(values).some((value) => value.trim().length > 0);
    const isToday = isSameDay(selectedDate, new Date());

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={dateTabs}
                activeKey={selectedDate.toISOString()}
                onChange={(key) => setSelectedDate(new Date(key))}
            />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={infantLogStyles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <LogSectionCard title={t('infant.growth.measurements')}>
                        {GROWTH_FIELDS.map((field) => {
                            const last = lastRecorded(field.key);
                            const invalid = outOfRange(field.key);

                            return (
                                <View key={field.key} style={styles.field}>
                                    <View style={styles.fieldHeader}>
                                        <Text
                                            style={[
                                                styles.fieldLabel,
                                                globalStyles.fontSemiBold,
                                            ]}
                                        >
                                            {t(field.labelKey)}
                                        </Text>

                                        {!!last && (
                                            <Text
                                                style={[
                                                    styles.fieldLast,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {last}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={infantLogStyles.row}>
                                        <TextInput
                                            value={values[field.key]}
                                            onChangeText={(text) =>
                                                setValue(field.key, text)
                                            }
                                            placeholder={field.placeholder}
                                            placeholderTextColor={colors.gray}
                                            keyboardType="decimal-pad"
                                            style={[
                                                infantLogStyles.input,
                                                invalid && styles.inputInvalid,
                                                globalStyles.fontRegular,
                                            ]}
                                            accessibilityLabel={t(field.labelKey)}
                                        />

                                        <Text
                                            style={[
                                                styles.unit,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(field.unitKey)}
                                        </Text>
                                    </View>

                                    {invalid && (
                                        <Text
                                            style={[
                                                styles.rangeHint,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t('infant.growth.rangeHint', {
                                                min: GROWTH_BOUNDS[field.key].min,
                                                max: GROWTH_BOUNDS[field.key].max,
                                            })}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </LogSectionCard>

                    <LogSectionCard
                        title={t('infant.growth.whoTitle')}
                        footnote={t('infant.growth.disclaimer')}
                    >
                        <Image
                            source={infantData.scoreImage}
                            style={styles.chart}
                            resizeMode="contain"
                            accessibilityLabel={t('infant.growth.chartAlt', {
                                name: childName,
                            })}
                        />

                        {/*
                          The design shows scored bands here ("Weight 25th–50th"). They stay
                          unscored until the WHO LMS reference tables and the z-score maths
                          land: a percentile is a number a mother will act on, and an
                          invented one is worse than an honest blank. The tiles keep their
                          place in the layout so the wiring is a value swap.
                        */}
                        <View style={styles.percentileRow}>
                            {GROWTH_FIELDS.map((field) => (
                                <View key={field.key} style={styles.percentile}>
                                    <Text
                                        style={[
                                            styles.percentileLabel,
                                            globalStyles.fontRegular,
                                        ]}
                                    >
                                        {t(field.labelKey)}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.percentileValue,
                                            globalStyles.fontSemiBold,
                                        ]}
                                    >
                                        {t('infant.growth.percentilePending')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </LogSectionCard>

                    <GradientButtonWithSlightRadius
                        title={t('infant.saveLog')}
                        onPress={() => undefined}
                        disabled={!hasAnyValue || !isToday}
                        fullRounded
                        fullWidth
                    />

                    <Text style={[infantLogStyles.footnote, styles.savedHint, globalStyles.fontRegular]}>
                        {t('infant.notPersistedYet')}
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },

    field: {
        marginBottom: 16,
    },

    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
    },

    fieldLabel: {
        fontSize: 14,
        color: colors.black,
    },

    fieldLast: {
        fontSize: 12,
        color: colors.gray,
    },

    inputInvalid: {
        borderWidth: 1,
        borderColor: colors.error,
    },

    unit: {
        width: 52,
        fontSize: 13,
        color: colors.darkGray,
    },

    rangeHint: {
        marginTop: 6,
        fontSize: 12,
        color: colors.error,
    },

    chart: {
        width: '100%',
        height: 300,
        borderRadius: 8,
    },

    percentileRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
    },

    percentile: {
        flex: 1,
        backgroundColor: colors.lightGray,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
    },

    percentileLabel: {
        fontSize: 11,
        color: colors.gray,
    },

    percentileValue: {
        marginTop: 3,
        fontSize: 12,
        textAlign: 'center',
        color: colors.darkGray,
    },

    savedHint: {
        textAlign: 'center',
    },
});

export default GrowthLog;
