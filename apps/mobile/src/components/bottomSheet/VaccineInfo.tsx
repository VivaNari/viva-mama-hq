import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { IVaccineDose } from '../../types/infantLog.types';

/**
 * What one vaccine is for, opened from the info button on a dose row.
 *
 * Keyed on `dose.vaccine` rather than `dose.key`: PCV's three doses are one vaccine and
 * share one description. The dose number belongs on the row that was tapped, not in here.
 *
 * The disclaimer is not decoration. This is health copy a parent may act on, and the
 * schedule itself is the clinic's to set — the app records what was given, it does not
 * advise. The same line appears under the Viva Score's own info sheet.
 */
const VaccineInfo = ({ dose }: { dose: IVaccineDose }) => {
    const { t } = useTranslation();

    return (
        <View>
            <Text style={[styles.name, globalStyles.fontBold]}>{dose.name}</Text>

            <Text style={[styles.protects, globalStyles.fontSemiBold]}>
                {t(`infant.vaccination.protects.${dose.key}`)}
            </Text>

            <Text style={[styles.description, globalStyles.fontRegular]}>
                {t(`infant.vaccination.descriptions.${dose.vaccine}`)}
            </Text>

            {!!dose.supplement && (
                <Text style={[styles.supplement, globalStyles.fontRegular]}>
                    {t('infant.vaccination.supplement')}
                </Text>
            )}

            <Text style={[styles.disclaimer, globalStyles.fontRegular]}>
                {t('infant.vaccination.infoDisclaimer')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    name: {
        fontSize: 20,
        color: colors.black,
    },

    protects: {
        marginTop: 4,
        fontSize: 14,
        color: colors.darkPurple,
    },

    description: {
        marginTop: 14,
        fontSize: 15,
        lineHeight: 23,
        color: colors.darkGray,
    },

    supplement: {
        marginTop: 12,
        fontSize: 13,
        color: colors.gray,
    },

    disclaimer: {
        marginTop: 20,
        fontSize: 11,
        lineHeight: 16,
        color: colors.gray,
    },
});

export default VaccineInfo;
