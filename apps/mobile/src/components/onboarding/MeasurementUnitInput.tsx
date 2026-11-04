import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import {
    HEIGHT_CM_BOUNDS,
    HeightUnit,
    WeightUnit,
    toHeightCm,
    toWeightKg,
    weightBoundsIn,
} from '../../utils/measurementUnits';

interface Props {
    kind: 'weight' | 'height';
    disabled: boolean;
    /** `display` is the chat bubble's text; `value` is what the server stores (kg or cm). */
    onSubmit: (display: string, value: string) => void;
}

type Unit = WeightUnit | HeightUnit;

/**
 * Weight or height in the unit she knows it in. The server only ever receives kg or cm,
 * so nothing downstream has to care which one she chose.
 */
const MeasurementUnitInput: React.FC<Props> = ({ kind, disabled, onSubmit }) => {
    const { t } = useTranslation();
    const units: Unit[] = kind === 'weight' ? ['kg', 'lb'] : ['cm', 'ft'];
    const [unit, setUnit] = useState<Unit>(units[0]);
    const [primary, setPrimary] = useState('');
    const [inches, setInches] = useState('');

    const isFeet = unit === 'ft';

    const value = useMemo(
        () =>
            kind === 'weight'
                ? toWeightKg(primary, unit as WeightUnit)
                : toHeightCm(primary, inches, unit as HeightUnit),
        [kind, primary, inches, unit],
    );

    const error = useMemo(() => {
        if (!primary.trim() || value !== null) return null;
        if (isFeet) return t('chat.heightFeetOutOfRange');
        const bounds = kind === 'weight' ? weightBoundsIn(unit as WeightUnit) : HEIGHT_CM_BOUNDS;
        return t('chat.measurementOutOfRange', { min: bounds.min, max: bounds.max, unit });
    }, [primary, value, isFeet, kind, unit, t]);

    const submit = () => {
        if (value === null || disabled) return;
        const display = isFeet
            ? `${primary.trim()} ft ${inches.trim() || 0} in`
            : `${primary.trim()} ${unit}`;
        onSubmit(display, String(value));
    };

    const changeUnit = (next: Unit) => {
        setUnit(next);
        setPrimary('');
        setInches('');
    };

    return (
        <View style={styles.wrapper}>
            {error ? <Text style={[styles.error, globalStyles.fontRegular]}>{error}</Text> : null}

            <View style={styles.row}>
                <View style={styles.units}>
                    {units.map(option => (
                        <TouchableOpacity
                            key={option}
                            onPress={() => changeUnit(option)}
                            style={[styles.unit, unit === option && styles.unitActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: unit === option }}
                        >
                            <Text
                                style={[
                                    styles.unitText,
                                    unit === option && styles.unitTextActive,
                                    globalStyles.fontSemiBold,
                                ]}
                            >
                                {option}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TextInput
                    style={[styles.input, globalStyles.fontSemiBold]}
                    value={primary}
                    onChangeText={setPrimary}
                    keyboardType="decimal-pad"
                    placeholder={isFeet ? 'ft' : unit}
                    placeholderTextColor={colors.gray}
                    accessibilityLabel={t(kind === 'weight' ? 'chat.weightA11y' : 'chat.heightA11y')}
                />
                {isFeet ? (
                    <TextInput
                        style={[styles.input, globalStyles.fontSemiBold]}
                        value={inches}
                        onChangeText={setInches}
                        keyboardType="decimal-pad"
                        placeholder="in"
                        placeholderTextColor={colors.gray}
                        accessibilityLabel={t('chat.inchesA11y')}
                    />
                ) : null}

                <TouchableOpacity
                    style={[styles.send, (value === null || disabled) && styles.sendDisabled]}
                    onPress={submit}
                    disabled={value === null || disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.send')}
                >
                    <MaterialDesignIcons name="send-outline" size={20} color={colors.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { paddingHorizontal: 12, paddingTop: 8 },
    error: { color: colors.error, fontSize: 12, marginBottom: 6, paddingHorizontal: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    units: {
        flexDirection: 'row',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    unit: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.white },
    unitActive: { backgroundColor: colors.darkPurple },
    unitText: { fontSize: 13, color: colors.darkPurple },
    unitTextActive: { color: colors.white },
    input: {
        flex: 1,
        minWidth: 0,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 15,
        color: colors.text,
        backgroundColor: colors.white,
    },
    send: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.darkPurple,
    },
    sendDisabled: { opacity: 0.45 },
});

export default MeasurementUnitInput;
