import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { deleteChild, updateChild } from '../api/child.api';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import LogInfoBanner from '../components/infant/LogInfoBanner';
import LogSectionCard from '../components/infant/LogSectionCard';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { infantLogStyles } from '../public/styles/infantLogStyles';
import { InfantLogRouteParams } from '../types/infantLog.types';
import { formatFullDate } from '../utils/infantLogHelpers';

/**
 * Edit a child, or remove them.
 *
 * ## Why so little is editable
 *
 * Only the name and the birth measurements. The date of birth, the sex and the vaccination
 * sector are set once, when the baby is added, and are frozen after — the API refuses them
 * and the payload type does not carry them.
 *
 * That is not caution for its own sake. Those three are the basis of everything derived
 * about a child: growth percentiles are scored against the date of birth and the sex, the
 * immunisation schedule comes from the sector, the six-month solids gate and the floor on
 * every date strip come from the date of birth. Editing one would not correct a value, it
 * would silently invalidate months of history — and a stale percentile still looks like a
 * perfectly plausible number, so nothing would ever surface the error.
 *
 * They are shown here rather than hidden, with a line saying why. A field a mother cannot
 * find is one she assumes is missing; a field she can see and cannot change is one she
 * knows the shape of.
 *
 * Birth measurements *are* editable. They have a derived copy too — the day-0 point on the
 * growth chart is a real stored row — but unlike the frozen three, that copy is simply
 * rewritten when they change.
 *
 * ## The delete
 *
 * Removing a child removes every log kept about them. With the three fields above frozen,
 * this is also the only way to correct one of them, so it is the path a mother reaches for
 * after a mistyped birthday — which makes it more important, not less, that the
 * confirmation says plainly what it is about to destroy rather than asking "are you sure?".
 */

/** The bounds the onboarding chat and the API both enforce. Repeated so the error is local. */
const MEASUREMENT_BOUNDS = {
    weight_grams: { min: 500, max: 8000 },
    length_cm: { min: 30, max: 100 },
    head_circumference_cm: { min: 20, max: 60 },
} as const;

type MeasurementKey = keyof typeof MEASUREMENT_BOUNDS;

const MEASUREMENT_FIELDS: {
    key: MeasurementKey;
    labelKey: string;
    unitKey: string;
}[] = [
    {
        key: 'weight_grams',
        labelKey: 'infant.editChild.birthWeight',
        unitKey: 'infant.growth.unitGrams',
    },
    {
        key: 'length_cm',
        labelKey: 'infant.editChild.birthLength',
        unitKey: 'infant.growth.unitCm',
    },
    {
        key: 'head_circumference_cm',
        labelKey: 'infant.editChild.birthHead',
        unitKey: 'infant.growth.unitCm',
    },
];

const EditChild: React.FC = () => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute();
    const params = (route.params ?? {}) as InfantLogRouteParams & {
        birthMeasurements?: Partial<Record<MeasurementKey, number>>;
    };

    const childName = params.childName?.trim() || t('infant.childFallback');

    const [name, setName] = useState(params.childName ?? '');
    const [measurements, setMeasurements] = useState<Record<MeasurementKey, string>>(() => ({
        weight_grams: params.birthMeasurements?.weight_grams?.toString() ?? '',
        length_cm: params.birthMeasurements?.length_cm?.toString() ?? '',
        head_circumference_cm:
            params.birthMeasurements?.head_circumference_cm?.toString() ?? '',
    }));

    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    /**
     * Range-checked before sending.
     *
     * The API drops an out-of-range measurement without complaining, so catching it here is
     * what turns a silently lost edit into a fixable one — the same reasoning the onboarding
     * chat's own validator carries.
     */
    const measurementError = (key: MeasurementKey): string | null => {
        const raw = measurements[key].trim();
        if (!raw) return null;

        const value = Number(raw);
        const { min, max } = MEASUREMENT_BOUNDS[key];

        if (!Number.isFinite(value)) return t('infant.editChild.notANumber');
        if (value < min || value > max) {
            return t('infant.editChild.outOfRange', { min, max });
        }

        return null;
    };

    const firstError = MEASUREMENT_FIELDS.map((field) => measurementError(field.key)).find(
        (error): error is string => error !== null,
    );

    const save = async () => {
        if (!params.childId) return;

        const trimmed = name.trim();
        if (!trimmed) {
            Toast.show({ type: 'error', text1: t('infant.editChild.nameRequired') });
            return;
        }
        if (firstError) {
            Toast.show({ type: 'error', text1: firstError });
            return;
        }

        // Only what the mother actually filled in. An empty box means "not recorded",
        // which is different from zero and must not be sent as one.
        const birth: Record<string, number> = {};
        for (const field of MEASUREMENT_FIELDS) {
            const raw = measurements[field.key].trim();
            if (raw) birth[field.key] = Number(raw);
        }

        setSaving(true);
        try {
            await updateChild(params.childId, {
                name: trimmed,
                ...(Object.keys(birth).length > 0 ? { birth_measurements: birth } : {}),
            });

            Toast.show({ type: 'success', text1: t('infant.editChild.saved') });
            navigation.goBack();
        } catch (error) {
            console.log('[EditChild] Failed to save the child', error);
            Toast.show({ type: 'error', text1: t('infant.editChild.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    /**
     * Two taps, and the first one names what goes.
     *
     * Deliberately not a generic "are you sure?". This deletes five collections' worth of
     * a baby's history, and the mother most likely to reach it is one correcting a typo
     * she cannot otherwise fix — the one person who does not expect to lose anything.
     */
    const confirmRemove = () => {
        Alert.alert(
            t('infant.editChild.removeTitle', { name: childName }),
            t('infant.editChild.removeBody', { name: childName }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('infant.editChild.removeConfirm'),
                    style: 'destructive',
                    onPress: remove,
                },
            ],
        );
    };

    const remove = async () => {
        if (!params.childId) return;

        setRemoving(true);
        try {
            await deleteChild(params.childId);
            Toast.show({ type: 'success', text1: t('infant.editChild.removed') });
            navigation.goBack();
        } catch (error) {
            console.log('[EditChild] Failed to remove the child', error);
            Toast.show({ type: 'error', text1: t('infant.editChild.removeFailed') });
        } finally {
            setRemoving(false);
        }
    };

    const sexLabel = params.childSex
        ? t(`infant.editChild.sex.${params.childSex}`)
        : t('infant.statMissing');

    const dobLabel = params.childDob
        ? formatFullDate(new Date(params.childDob), t)
        : t('infant.statMissing');

    const sectorLabel =
        params.vaccinationSector === 'private'
            ? t('infant.vaccination.sectorPrivate')
            : t('infant.vaccination.sectorPublic');

    return (
        <SafeAreaView style={infantLogStyles.screen} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={infantLogStyles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <LogSectionCard title={t('infant.editChild.nameTitle')}>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={t('infant.editChild.namePlaceholder')}
                            placeholderTextColor={colors.gray}
                            maxLength={60}
                            style={[infantLogStyles.input, globalStyles.fontRegular]}
                            accessibilityLabel={t('infant.editChild.nameTitle')}
                        />
                    </LogSectionCard>

                    <LogSectionCard
                        title={t('infant.editChild.birthTitle')}
                        caption={t('infant.editChild.birthCaption')}
                    >
                        {MEASUREMENT_FIELDS.map((field) => {
                            const error = measurementError(field.key);

                            return (
                                <View key={field.key} style={styles.measurementRow}>
                                    <Text
                                        style={[
                                            styles.measurementLabel,
                                            globalStyles.fontRegular,
                                        ]}
                                    >
                                        {t(field.labelKey)}
                                    </Text>

                                    <View style={styles.measurementInputWrap}>
                                        <TextInput
                                            value={measurements[field.key]}
                                            onChangeText={(value) =>
                                                setMeasurements((prev) => ({
                                                    ...prev,
                                                    [field.key]: value,
                                                }))
                                            }
                                            placeholder={t(field.unitKey)}
                                            placeholderTextColor={colors.gray}
                                            keyboardType="decimal-pad"
                                            style={[
                                                infantLogStyles.input,
                                                styles.measurementInput,
                                                !!error && styles.inputInvalid,
                                                globalStyles.fontRegular,
                                            ]}
                                            accessibilityLabel={t(field.labelKey)}
                                        />
                                        {!!error && (
                                            <Text
                                                style={[
                                                    styles.errorText,
                                                    globalStyles.fontRegular,
                                                ]}
                                            >
                                                {error}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </LogSectionCard>

                    {/*
                     * Shown, not hidden. A field a mother cannot find reads as missing; one
                     * she can see and cannot change reads as decided.
                     */}
                    <LogSectionCard
                        title={t('infant.editChild.fixedTitle')}
                        caption={t('infant.editChild.fixedCaption')}
                    >
                        {[
                            { label: t('infant.editChild.dob'), value: dobLabel },
                            { label: t('infant.editChild.sexLabel'), value: sexLabel },
                            {
                                label: t('infant.editChild.sector'),
                                value: sectorLabel,
                            },
                        ].map((row) => (
                            <View key={row.label} style={styles.fixedRow}>
                                <Text
                                    style={[styles.fixedLabel, globalStyles.fontRegular]}
                                >
                                    {row.label}
                                </Text>
                                <Text
                                    style={[styles.fixedValue, globalStyles.fontSemiBold]}
                                >
                                    {row.value}
                                </Text>
                            </View>
                        ))}
                    </LogSectionCard>

                    <GradientButtonWithSlightRadius
                        title={t('infant.editChild.save')}
                        onPress={save}
                        disabled={saving}
                        fullRounded
                        fullWidth
                    />

                    <LogInfoBanner text={t('infant.editChild.removeExplainer')} />

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={confirmRemove}
                        disabled={removing}
                        accessibilityRole="button"
                        style={styles.removeButton}
                    >
                        {removing ? (
                            <ActivityIndicator color={colors.error} />
                        ) : (
                            <Text style={[styles.removeLabel, globalStyles.fontSemiBold]}>
                                {t('infant.editChild.remove', { name: childName })}
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },

    measurementRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },

    measurementLabel: {
        flex: 1,
        paddingTop: 14,
        fontSize: 14,
        color: colors.black,
    },

    measurementInputWrap: {
        width: 120,
    },

    measurementInput: {
        flex: 0,
    },

    inputInvalid: {
        borderColor: colors.error,
    },

    errorText: {
        marginTop: 4,
        fontSize: 11,
        color: colors.error,
    },

    fixedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.lightGray,
    },

    fixedLabel: {
        fontSize: 13,
        color: colors.darkGray,
    },

    fixedValue: {
        flexShrink: 1,
        fontSize: 13,
        textAlign: 'right',
        color: colors.black,
    },

    removeButton: {
        marginTop: 4,
        paddingVertical: 14,
        alignItems: 'center',
    },

    removeLabel: {
        fontSize: 14,
        color: colors.error,
    },
});

export default EditChild;
