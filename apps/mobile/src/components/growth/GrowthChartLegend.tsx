import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { REFERENCE_PERCENTILES } from '@vivamama/growth-standards';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { CURVE_COLORS, chartTheme } from './growthChart.theme';

/**
 * Key for the five reference curves, plus the child's own line.
 *
 * Without it the chart is five anonymous grey lines — the legend is what turns it from a
 * decoration into something readable.
 */
const GrowthChartLegend: React.FC = () => {
    const { t } = useTranslation();

    return (
        <View style={styles.legend}>
            {REFERENCE_PERCENTILES.map((percentile) => (
                <View key={percentile} style={styles.item}>
                    <View
                        style={[
                            styles.swatch,
                            { backgroundColor: CURVE_COLORS[percentile] ?? colors.gray },
                        ]}
                    />
                    <Text style={[styles.label, globalStyles.fontRegular]}>
                        {t('infant.growth.percentileShort', { percentile })}
                    </Text>
                </View>
            ))}

            <View style={styles.item}>
                <View style={[styles.swatch, { backgroundColor: chartTheme.childLine }]} />
                <Text style={[styles.label, globalStyles.fontSemiBold]}>
                    {t('infant.growth.legendChild')}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginTop: 10,
    },

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },

    swatch: {
        width: 14,
        height: 3,
        borderRadius: 2,
    },

    label: {
        fontSize: 11,
        color: colors.darkGray,
    },
});

export default GrowthChartLegend;
