import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import { colors } from '../../public/assets/colors';
import { BillingToggleProps } from '../../types/subscription.types';

export const BillingToggle: React.FC<BillingToggleProps> = ({
    billingCycle,
    onCycleChange,
    disabled = false,
}) => {
    const handleMonthlyPress = useCallback(() => {
        if (!disabled) {
            onCycleChange('monthly');
        }
    }, [disabled, onCycleChange]);

    const handleYearlyPress = useCallback(() => {
        if (!disabled) {
            onCycleChange('yearly');
        }
    }, [disabled, onCycleChange]);

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={handleMonthlyPress}
                disabled={disabled}
                style={[
                    styles.button,
                    billingCycle === 'monthly' && styles.buttonActive,
                    disabled && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Monthly billing"
                accessibilityState={{ selected: billingCycle === 'monthly', disabled }}
            >
                <Text
                    style={[
                        globalStyles.fontBold,
                        styles.buttonText,
                        billingCycle === 'monthly' && styles.buttonTextActive,
                    ]}
                >
                    Monthly
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleYearlyPress}
                disabled={disabled}
                style={[
                    styles.button,
                    billingCycle === 'yearly' && styles.buttonActive,
                    disabled && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Yearly billing"
                accessibilityState={{ selected: billingCycle === 'yearly', disabled }}
            >
                <Text
                    style={[
                        globalStyles.fontBold,
                        styles.buttonText,
                        billingCycle === 'yearly' && styles.buttonTextActive,
                    ]}
                >
                    Yearly
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.lightGray,
        borderRadius: 8,
        padding: 4,
    },
    button: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonActive: {
        backgroundColor: colors.lightPurple,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderColor: colors.purple,
        borderWidth: 0.5,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 14,
        color: colors.black,
        letterSpacing: 0.5,
    },
    buttonTextActive: {
        color: colors.primary,
        letterSpacing: 0.5,
    },
});