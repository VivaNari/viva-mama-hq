import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {
    Indicator,
    gramsToKg,
    isPercentileQuotable,
    kgToGrams,
} from '@vivamama/growth-standards';

import { getGrowthLogs, upsertGrowthLog } from '../api/infantGrowth.api';
import CustomDatePicker from '../components/CustomDatePicker';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import { ordinalSuffix } from '../components/growth/growthCopy';
import LogChipTabs from '../components/infant/LogChipTabs';
import LogDatePickerChip from '../components/infant/LogDatePickerChip';
import LogSectionCard from '../components/infant/LogSectionCard';
import { GROWTH_BOUNDS, GROWTH_FIELDS } from '../data/infantGrowthData';
import { useLogDateStrip } from '../hooks/useLogDateStrip';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { IGrowthLog } from '../types/growthLog.types';
import { IGrowthMeasurementField, InfantLogRouteParams } from '../types/infantLog.types';
import { latestResults, previewResults } from '../utils/growthSeries';
import {
    formatChipDate,
    istDateKey,
    mergeByDay,
} from '../utils/infantLogHelpers';

type MeasurementValues = Record<IGrowthMeasurementField['key'], string>;

const EMPTY_VALUES: MeasurementValues = {
    head_circumference_cm: '',
    length_cm: '',
    weight_grams: '',
};

/** Which indicator each input field's live percentile comes from. */
const FIELD_INDICATOR: Record<IGrowthMeasurementField['key'], Indicator> = {
    head_circumference_cm: 'head_circumference_for_age',
    length_cm: 'length_for_age',
    weight_grams: 'weight_for_age',
};

/**
 * Short labels for the percentile tiles — the same three the dashboard uses.
 *
 * Not the field labels: "Head circumference" and "Height / length" wrap inside a tile a
 * third of the card wide, and the second breaks at the slash, leaving three tiles of
 * different heights. The full names are already above, on the inputs these summarise.
 */
const FIELD_TILE_LABEL: Record<IGrowthMeasurementField['key'], string> = {
    head_circumference_cm: 'infant.statHead',
    length_cm: 'infant.statHeight',
    weight_grams: 'infant.statWeight',
};

/**
 * Growth Log — head circumference, length and weight, scored against the WHO Child Growth
 * Standards (PRD 4.1). Tracked to two years.
 *
 * Percentiles update as the mother types, computed on the device by
 * @vivamama/growth-standards — the same module the server uses to score the row it
 * persists, so the preview and the saved value cannot disagree.
 */
const GrowthLog: React.FC = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams;

    const strip = useLogDateStrip(params.childDob);
    const { selectedDate, isToday } = strip;

    const [values, setValues] = useState<MeasurementValues>(EMPTY_VALUES);
    const [logs, setLogs] = useState<IGrowthLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const beforeBirth = strip.isBeforeBirth(selectedDate);

    const loadLogs = useCallback(async () => {
        if (!params.childId) return;

        setLoading(true);
        try {
            // Bounded to the days the strip can actually reach. Unbounded, this pulled a
            // child's entire history on every open and then rendered a week of it — the
            // dashboard chart is what needs the full series, and it fetches its own.
            const week = await getGrowthLogs(
                params.childId,
                strip.windowFrom,
                strip.windowTo,
            );
            setLogs(prev => mergeByDay(prev, week, row => row.measuredOn));
        } catch (error) {
            console.log('[GrowthLog] Failed to load growth logs', error);
            Toast.show({ type: 'error', text1: t('infant.growth.loadFailed') });
        } finally {
            setLoading(false);
        }
    }, [params.childId, strip.windowFrom, strip.windowTo, t]);

    /**
     * A day picked from the calendar, fetched on its own.
     *
     * A separate single-day request rather than widening the range above: reaching back to
     * a measurement taken three months ago should cost one day's data, not three months.
     */
    useEffect(() => {
        const dayKey = strip.extraDayKey;
        if (!dayKey || !params.childId) return;

        let cancelled = false;

        getGrowthLogs(params.childId, dayKey, dayKey)
            .then(rows => {
                if (!cancelled) {
                    setLogs(prev => mergeByDay(prev, rows, row => row.measuredOn));
                }
            })
            .catch(error => {
                console.log('[GrowthLog] Failed to load the picked day', error);
                Toast.show({ type: 'error', text1: t('infant.growth.loadFailed') });
            });

        return () => {
            cancelled = true;
        };
    }, [strip.extraDayKey, params.childId, t]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const setValue = (key: IGrowthMeasurementField['key'], next: string) =>
        setValues(prev => ({ ...prev, [key]: next }));

    /** The stored entry for the day on screen, if there is one. */
    const entryForSelectedDate = useMemo(
        () => logs.find(entry => entry.measuredOn === istDateKey(selectedDate)),
        [logs, selectedDate],
    );

    /**
     * Show what is already recorded for the selected day.
     *
     * Without this the screen only ever showed an empty form: saving cleared the inputs and
     * nothing read them back, so the measurements a mother had just entered disappeared,
     * and reopening the screen looked like nothing had been logged at all.
     *
     * Runs on mount, when the day changes, and after a save refreshes `logs`.
     */
    useEffect(() => {
        if (!entryForSelectedDate) {
            setValues(EMPTY_VALUES);
            return;
        }

        const stored = entryForSelectedDate.measurements;

        setValues({
            head_circumference_cm: stored.head_circumference_cm?.toString() ?? '',
            length_cm: stored.length_cm?.toString() ?? '',
            // Stored in kilograms, entered in the grams a clinic reports.
            weight_grams:
                typeof stored.weight_kg === 'number'
                    ? String(Math.round(kgToGrams(stored.weight_kg)))
                    : '',
        });
    }, [entryForSelectedDate]);

    const numeric = (key: IGrowthMeasurementField['key']): number | null => {
        const raw = values[key].trim();
        if (!raw) return null;

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    };

    /**
     * Out-of-range is surfaced per field rather than blocking Save, because the range is a
     * typo-catcher and not a clinical judgement — a parent whose baby genuinely sits
     * outside it must still be able to record the number.
     */
    const outOfRange = (key: IGrowthMeasurementField['key']): boolean => {
        const raw = values[key].trim();
        if (!raw) return false;

        const parsed = numeric(key);
        if (parsed === null) return true;

        const bounds = GROWTH_BOUNDS[key];
        return parsed < bounds.min || parsed > bounds.max;
    };

    /** The measurements currently typed, in the units the standards package expects. */
    const typedMeasurement = useMemo(() => {
        const grams = numeric('weight_grams');

        return {
            // The field is in grams because that is what a clinic reports; WHO works in
            // kilograms. The conversion happens once, here, through the package.
            weight_kg: grams === null ? null : gramsToKg(grams),
            length_cm: numeric('length_cm'),
            head_circumference_cm: numeric('head_circumference_cm'),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values]);

    const hasAnyValue = Object.values(values).some(value => value.trim().length > 0);

    /**
     * Scores for the day on screen: live while typing, otherwise whatever was stored for
     * that day.
     *
     * It used to fall back to `latestResults(logs)` — the newest row in the whole history —
     * so opening a day with nothing logged showed percentiles from some earlier day above
     * three empty inputs. The tiles and the fields told different stories.
     */
    const results = useMemo(() => {
        if (hasAnyValue) {
            return previewResults({
                sex: params.childSex,
                dateOfBirth: params.childDob,
                measuredOn: selectedDate,
                measurement: typedMeasurement,
            });
        }

        return latestResults(entryForSelectedDate ? [entryForSelectedDate] : []);
    }, [
        hasAnyValue,
        params.childSex,
        params.childDob,
        selectedDate,
        typedMeasurement,
        entryForSelectedDate,
    ]);

    const percentileLabel = (key: IGrowthMeasurementField['key']): string => {
        const result = results[FIELD_INDICATOR[key]];
        if (result.status !== 'OK') return t('infant.statMissing');

        if (!isPercentileQuotable(result.percentile)) {
            return t('infant.growth.percentileOffScale');
        }

        const rounded = Math.round(result.percentile);
        return t('infant.growth.percentileValue', {
            value: rounded,
            suffix: ordinalSuffix(rounded),
        });
    };

    const save = async () => {
        if (!params.childId) {
            Toast.show({ type: 'error', text1: t('infant.growth.noChild') });
            return;
        }

        setSaving(true);
        try {
            await upsertGrowthLog({
                childId: params.childId,
                measuredOn: istDateKey(selectedDate),
                weight_kg: typedMeasurement.weight_kg,
                length_cm: typedMeasurement.length_cm,
                head_circumference_cm: typedMeasurement.head_circumference_cm,
            });

            // Deliberately not clearing the form: reloading re-hydrates it from the row
            // that was just written, so the mother sees her entry persisted rather than a
            // blank screen that looks like the save was lost.
            await loadLogs();
            Toast.show({ type: 'success', text1: t('infant.growth.saved') });
        } catch (error) {
            console.log('[GrowthLog] Failed to save growth log', error);
            Toast.show({ type: 'error', text1: t('infant.growth.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    // Every day is selectable. Past ones were `disabled`, which made them inert decoration
    // — a parent could see that the 12th existed but never what was recorded on it. They
    // open read-only instead, which is what "editable for 24 hours" actually means.
    //
    // Days before the child was born are the one exception: there is nothing behind them
    // and never can be, and the server rejects a measurement dated before birth anyway.
    const dateTabs = strip.dates.map((date, index) => ({
        // Keyed on the IST day, not the instant. A chip is a day, and keying on
        // toISOString() meant a date chosen from the calendar — which arrives at
        // midnight — matched no chip, leaving the strip with nothing highlighted.
        key: istDateKey(date),
        label: index === 0 ? t('infant.today') : formatChipDate(date, t),
        disabled: strip.isBeforeBirth(date),
    }));

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <LogChipTabs
                tabs={dateTabs}
                activeKey={istDateKey(selectedDate)}
                onChange={strip.selectByKey}
                trailing={<LogDatePickerChip onPress={strip.openPicker} />}
            />

            <CustomDatePicker
                show={strip.pickerVisible}
                setShow={visible => (visible ? strip.openPicker() : strip.closePicker())}
                selectedDate={selectedDate}
                onSelect={strip.pickDate}
                // The calendar refuses anything before the child existed or after today,
                // so an impossible day cannot be chosen in the first place.
                minimumDate={strip.minimumDate}
                maximumDate={strip.maximumDate}
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
                    {loading ? (
                        <ActivityIndicator
                            color={colors.darkPurple}
                            style={styles.loader}
                        />
                    ) : beforeBirth ? (
                        // Both the chips and the calendar refuse these days, so this is
                        // only reachable with a date of birth in the future. Saying so
                        // beats rendering an empty form that invites a measurement the
                        // server will reject.
                        <LogSectionCard title={t('infant.growth.measurements')}>
                            <Text style={[styles.caption, globalStyles.fontRegular]}>
                                {t('infant.beforeBirth', {
                                    name: params.childName ?? t('infant.childFallback'),
                                })}
                            </Text>
                        </LogSectionCard>
                    ) : (
                        <LogSectionCard
                            title={t('infant.growth.measurements')}
                            caption={
                                isToday ? undefined : t('infant.growth.readOnlyDay')
                            }
                        >
                            {GROWTH_FIELDS.map(field => {
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
                                        </View>

                                        <View style={infantLogStyles.row}>
                                            <TextInput
                                                value={values[field.key]}
                                                onChangeText={text =>
                                                    setValue(field.key, text)
                                                }
                                                // An em dash reads as "not recorded"; the
                                                // sample number would read as a value.
                                                placeholder={
                                                    isToday ? field.placeholder : '—'
                                                }
                                                placeholderTextColor={colors.gray}
                                                keyboardType="decimal-pad"
                                                editable={isToday}
                                                style={[
                                                    infantLogStyles.input,
                                                    !isToday && styles.inputReadOnly,
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

                            {/* Live percentiles — these update as she types. */}
                            <View style={styles.percentileRow}>
                                {GROWTH_FIELDS.map(field => (
                                    <View key={field.key} style={styles.percentile}>
                                        <Text
                                            style={[
                                                styles.percentileLabel,
                                                globalStyles.fontRegular,
                                            ]}
                                        >
                                            {t(FIELD_TILE_LABEL[field.key])}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.percentileValue,
                                                globalStyles.fontSemiBold,
                                            ]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                        >
                                            {percentileLabel(field.key)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </LogSectionCard>
                    )}

                    {isToday && !loading && !beforeBirth && (
                        <GradientButtonWithSlightRadius
                            title={saving ? t('common.saving') : t('infant.saveLog')}
                            onPress={save}
                            disabled={!hasAnyValue || saving}
                            fullRounded
                            fullWidth
                        />
                    )}
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

    inputInvalid: {
        borderWidth: 1,
        borderColor: colors.error,
    },

    /**
     * A past day is shown, not edited.
     *
     * Keeps a visible ground and a hairline border. This was `backgroundColor: white`,
     * which on a white card made an empty disabled field indistinguishable from blank
     * space — the fields looked missing rather than read-only.
     */
    inputReadOnly: {
        backgroundColor: colors.lightGray,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.darkGray,
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

    percentileRow: {
        flexDirection: 'row',
        // stretch, not center: the three tiles share a height even if one value wraps.
        alignItems: 'stretch',
        gap: 8,
        marginTop: 4,
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
        fontSize: 10,
        letterSpacing: 0.5,
        textAlign: 'center',
        color: colors.gray,
    },

    percentileValue: {
        marginTop: 3,
        fontSize: 12,
        textAlign: 'center',
        color: colors.darkPurple,
    },

    loader: {
        marginVertical: 40,
    },

    caption: {
        fontSize: 13,
        color: colors.gray,
    },
});

export default GrowthLog;
