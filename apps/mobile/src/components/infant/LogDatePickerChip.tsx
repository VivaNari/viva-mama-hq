import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { infantLogStyles } from '../../public/styles/infantLogStyles';

interface LogDatePickerChipProps {
    onPress: () => void;
}

/**
 * The chip at the end of a date strip that opens a calendar.
 *
 * Deliberately styled apart from the day chips — outlined rather than filled — because it
 * is not a day. A parent scanning the strip for "which day am I looking at" should not have
 * to read this one to rule it out.
 */
const LogDatePickerChip: React.FC<LogDatePickerChipProps> = ({ onPress }) => {
    const { t } = useTranslation();

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('infant.pickDate')}
            style={[infantLogStyles.chip, styles.chip]}
        >
            <MaterialDesignIcons
                name="calendar-blank-outline"
                size={16}
                color={colors.purple}
            />

            <Text
                style={[infantLogStyles.chipText, globalStyles.fontSemiBold]}
                numberOfLines={1}
            >
                {t('infant.pickDate')}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.lightPurple,
    },
});

export default LogDatePickerChip;
