import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IInfantCheckinOptions } from '../../types/infantData.types';

const FLInfantCheckInOptions = ({
    item,
    navigation,
}: {
    item: IInfantCheckinOptions;
    navigation: { navigate: any };
}) => {
    const { t } = useTranslation();

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate(item.screen)}
            style={styles.tile}
            accessibilityRole="button"
            accessibilityLabel={t(item.titleKey)}
        >
            <MaterialDesignIcons
                name={item.icon as any}
                size={24}
                color={colors.white}
                style={styles.icon}
            />

            <Text style={[styles.title, globalStyles.fontBold]}>{t(item.titleKey)}</Text>

            <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                {t(item.subtitleKey)}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    tile: {
        backgroundColor: colors.infantTile,
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },

    icon: {
        marginBottom: 8,
    },

    title: {
        fontSize: 15,
        textAlign: 'center',
        color: colors.white,
    },

    subtitle: {
        marginTop: 4,
        fontSize: 11,
        textAlign: 'center',
        // Softened rather than a separate token: it is the same ink as the title, one
        // step back in the hierarchy.
        color: 'rgba(255, 255, 255, 0.75)',
    },
});

export default FLInfantCheckInOptions;
