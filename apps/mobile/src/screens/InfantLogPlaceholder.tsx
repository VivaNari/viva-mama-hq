import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

/**
 * Stand-in for the infant logs that have no backend yet: Growth, Diaper and Milestone.
 *
 * These three are listed in infantData.checkinOptions and rendered as tappable tiles, but
 * the screens were never built — tapping them threw a navigation error. A placeholder is
 * the honest fix: the tile stays in the grid the design calls for, and the user gets told
 * where they are instead of a crash.
 */
const InfantLogPlaceholder: React.FC = () => {
    const { t } = useTranslation();

    return (
        <View style={styles.container}>
            <MaterialDesignIcons
                name="clock-outline"
                size={40}
                color={colors.darkPurple}
            />

            <Text style={[styles.title, globalStyles.fontBold]}>
                {t('infant.comingSoonTitle')}
            </Text>

            <Text style={[styles.body, globalStyles.fontRegular]}>
                {t('infant.comingSoonBody')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        backgroundColor: colors.white,
    },

    title: {
        marginTop: 14,
        fontSize: 18,
        color: colors.black,
    },

    body: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 21,
        color: colors.darkGray,
        textAlign: 'center',
    },
});

export default InfantLogPlaceholder;
