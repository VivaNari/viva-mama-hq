import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

/**
 * The three chip treatments in the design:
 * - `outline`: purple outline, fills purple when picked (medicine, reminder options).
 * - `solid`: grey outline, fills purple when picked (meal time, record type).
 * - `soft`: grey outline, turns lilac with a purple edge when picked (food items).
 */
export type ChipVariant = 'outline' | 'solid' | 'soft';

interface ChipProps {
    label: string;
    selected: boolean;
    onPress: () => void;
    variant?: ChipVariant;
    small?: boolean;
}

const PALETTE: Record<ChipVariant, { on: [string, string, string]; off: [string, string, string] }> = {
    // [background, border, text]
    outline: {
        on: [colors.darkPurple, colors.darkPurple, colors.white],
        off: [colors.white, colors.darkPurple, colors.darkPurple],
    },
    solid: {
        on: [colors.darkPurple, colors.darkPurple, colors.white],
        off: [colors.white, colors.vivaBorder, colors.vivaInk],
    },
    soft: {
        on: [colors.vivaSelectedBG, colors.darkPurple, colors.darkPurple],
        off: [colors.white, colors.vivaBorder, colors.vivaInk],
    },
};

const Chip: React.FC<ChipProps> = ({ label, selected, onPress, variant = 'outline', small = false }) => {
    const [bg, border, text] = PALETTE[variant][selected ? 'on' : 'off'];

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
                logsStyles.chip,
                small && logsStyles.chipSmall,
                { backgroundColor: bg, borderColor: border },
            ]}
        >
            <Text
                style={[
                    logsStyles.chipText,
                    small && logsStyles.chipTextSmall,
                    { color: text },
                    globalStyles.fontSemiBold,
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
};

export default Chip;
