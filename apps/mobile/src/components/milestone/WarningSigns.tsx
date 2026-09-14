import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';

interface WarningSignsProps {
    /** Warning-sign keys for the band on screen. */
    signs: string[];
}

/**
 * The MCP card's warning signs for an age band.
 *
 * Closed by default, and deliberately so. This is a screen a parent opens to celebrate
 * something their child has just done; opening it with six things that might be wrong
 * changes what the screen is for. Collapsed keeps the information one tap away — which is
 * where the card itself keeps it, in a separate column — without leading with it.
 *
 * No colour-coding, no count badge, no icon that reads as an alarm, and nothing here
 * triggers a notification. The same rule the growth percentiles follow: the app reports,
 * it does not diagnose.
 */
const WarningSigns: React.FC<WarningSignsProps> = ({ signs }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <View style={styles.card}>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpen((previous) => !previous)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={styles.header}
            >
                <View style={styles.headerText}>
                    <Text style={[styles.title, globalStyles.fontSemiBold]}>
                        {t('infant.milestone.warningsTitle')}
                    </Text>
                    {!open && (
                        <Text style={[styles.hint, globalStyles.fontRegular]}>
                            {t('infant.milestone.warningsHint')}
                        </Text>
                    )}
                </View>

                <MaterialDesignIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={colors.gray}
                />
            </TouchableOpacity>

            {open && (
                <View style={styles.body}>
                    <Text style={[styles.intro, globalStyles.fontRegular]}>
                        {t('infant.milestone.warningsBody')}
                    </Text>

                    {signs.map((key) => (
                        <View key={key} style={styles.row}>
                            <View style={styles.bullet} />
                            <Text style={[styles.sign, globalStyles.fontRegular]}>
                                {t(`infant.milestone.warnings.${key}`)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    headerText: {
        flex: 1,
    },

    title: {
        fontSize: 15,
        color: colors.black,
    },

    hint: {
        marginTop: 2,
        fontSize: 12,
        color: colors.gray,
    },

    body: {
        marginTop: 12,
        gap: 10,
    },

    intro: {
        fontSize: 13,
        lineHeight: 19,
        color: colors.darkGray,
    },

    row: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },

    bullet: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 7,
        backgroundColor: colors.gray,
    },

    sign: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: colors.black,
    },
});

export default WarningSigns;
