import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

// Button diameter, value size and gap for the three stepper sizes in the design.
const SIZES = {
    lg: { button: 44, glyph: 20, value: 42, gap: 18 },
    md: { button: 42, glyph: 19, value: 36, gap: 18 },
    sm: { button: 34, glyph: 16, value: 24, gap: 10 },
} as const;

interface StepperProps {
    value: string | number;
    unit?: string;
    onIncrease: () => void;
    onDecrease: () => void;
    size?: keyof typeof SIZES;
    /** Vertical stacks + / value / − with a label on top, as in the BP reading. */
    vertical?: boolean;
    label?: string;
    /** Overrides the value size (the BP numbers are 28 in a small stepper). */
    valueSize?: number;
}

/** The round −/+ control around a number that every log screen uses. */
const Stepper: React.FC<StepperProps> = ({
    value,
    unit,
    onIncrease,
    onDecrease,
    size = 'md',
    vertical = false,
    label,
    valueSize,
}) => {
    const { t } = useTranslation();
    const s = SIZES[size];

    const button = (glyph: '+' | '−', onPress: () => void) => (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={glyph === '+' ? t('logs.common.increase') : t('logs.common.decrease')}
            style={[logsStyles.stepperButton, { width: s.button, height: s.button }]}
        >
            <Text style={[{ fontSize: s.glyph, color: colors.darkPurple }, globalStyles.fontBold]}>
                {glyph}
            </Text>
        </TouchableOpacity>
    );

    const valueBlock = (
        <View style={[logsStyles.stepperValueBlock, size === 'sm' && { minWidth: 54 }]}>
            <Text style={[logsStyles.stepperValue, { fontSize: valueSize ?? s.value }, globalStyles.fontBold]}>
                {value}
            </Text>
            {unit ? (
                <Text style={[logsStyles.stepperUnit, globalStyles.fontRegular]}>{unit}</Text>
            ) : null}
        </View>
    );

    if (vertical) {
        return (
            <View style={logsStyles.stepperColumn}>
                {label ? (
                    <Text style={[logsStyles.mutedLabel, globalStyles.fontSemiBold]}>{label}</Text>
                ) : null}
                {button('+', onIncrease)}
                {valueBlock}
                {button('−', onDecrease)}
            </View>
        );
    }

    return (
        <View style={logsStyles.stepperColumn}>
            {label ? (
                <Text style={[logsStyles.mutedLabel, globalStyles.fontBold]}>{label}</Text>
            ) : null}
            <View style={[logsStyles.stepperRow, { gap: s.gap }]}>
                {button('−', onDecrease)}
                {valueBlock}
                {button('+', onIncrease)}
            </View>
        </View>
    );
};

export default Stepper;
