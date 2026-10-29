import React from 'react';
import { StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { globalStyles } from '../../public/styles';
import { logsStyles } from '../../public/styles/logsStyles';

interface ButtonProps {
    label: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
}

interface PrimaryButtonProps extends ButtonProps {
    /** Greys the button out the way the design does when nothing is selected yet. */
    disabled?: boolean;
    /** 12pt corners instead of a full pill, for the paired step buttons. */
    rounded?: boolean;
    icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
    label,
    onPress,
    disabled = false,
    rounded = false,
    icon,
    style,
}) => (
    <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
            logsStyles.primaryButton,
            rounded && logsStyles.primaryButtonRounded,
            disabled && logsStyles.primaryButtonDisabled,
            style,
        ]}
    >
        {icon}
        <Text style={[logsStyles.primaryButtonText, rounded && { fontSize: 13 }, globalStyles.fontBold]}>
            {label}
        </Text>
    </TouchableOpacity>
);

/** The white Cancel / Back button paired with a primary one. */
export const SecondaryButton: React.FC<ButtonProps> = ({ label, onPress, style }) => (
    <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        style={[logsStyles.secondaryButton, style]}
    >
        <Text style={[logsStyles.secondaryButtonText, globalStyles.fontBold]}>{label}</Text>
    </TouchableOpacity>
);

/** Underlined grey text action ("Remove last tap"). */
export const LinkButton: React.FC<ButtonProps> = ({ label, onPress, style }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" style={[logsStyles.linkButton, style]}>
        <Text style={[logsStyles.linkButtonText, globalStyles.fontSemiBold]}>{label}</Text>
    </TouchableOpacity>
);
