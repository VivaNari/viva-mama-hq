import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { CURVE_COLORS } from './growthChart.theme';

interface GrowthChartTooltipProps {
    /** Pixel x of the guide line. */
    x: number;
    chartWidth: number;
    /** The probed position in data terms — months, or cm for weight-for-length. */
    xValue: number;
    xKind: 'ageMonths' | 'lengthCm';
    valueUnit: 'kg' | 'cm';
    values: { percentile: number; value: number }[];
}

const TOOLTIP_WIDTH = 132;

/**
 * The read-out that follows the dashed guide: what each reference curve is worth at the
 * probed age or length.
 *
 * Reports only the reference values, never a verdict on where the child sits relative to
 * them. Reading that comparison is the parent's to make, and a clinician's to interpret.
 */
const GrowthChartTooltip: React.FC<GrowthChartTooltipProps> = ({
    x,
    chartWidth,
    xValue,
    xKind,
    valueUnit,
    values,
}) => {
    const { t } = useTranslation();

    // Flip to whichever side has room, so the tooltip never hangs off the chart.
    const left = Math.min(Math.max(x - TOOLTIP_WIDTH / 2, 4), chartWidth - TOOLTIP_WIDTH - 4);

    const heading =
        xKind === 'ageMonths'
            ? t('infant.growth.tooltipAge', { months: xValue.toFixed(1) })
            : t('infant.growth.tooltipLength', { length: xValue.toFixed(1) });

    const unit = t(valueUnit === 'kg' ? 'infant.growth.unitKg' : 'infant.growth.unitCm');

    return (
        <View pointerEvents="none" style={[styles.tooltip, { left }]}>
            <Text style={[styles.heading, globalStyles.fontSemiBold]}>{heading}</Text>

            {values.map((entry) => (
                <View key={entry.percentile} style={styles.row}>
                    <View
                        style={[
                            styles.swatch,
                            { backgroundColor: CURVE_COLORS[entry.percentile] ?? colors.gray },
                        ]}
                    />
                    <Text style={[styles.label, globalStyles.fontRegular]}>
                        {t('infant.growth.percentileShort', { percentile: entry.percentile })}
                    </Text>
                    <Text style={[styles.value, globalStyles.fontSemiBold]}>
                        {`${entry.value.toFixed(valueUnit === 'kg' ? 2 : 1)} ${unit}`}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    tooltip: {
        position: 'absolute',
        top: 8,
        width: TOOLTIP_WIDTH,
        backgroundColor: colors.white,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        boxShadow: '0 2px 6px 0 rgba(0, 0, 0, 0.18)',
    },

    heading: {
        fontSize: 11,
        marginBottom: 6,
        color: colors.black,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },

    swatch: {
        width: 8,
        height: 3,
        borderRadius: 2,
    },

    label: {
        flex: 1,
        fontSize: 10,
        color: colors.gray,
    },

    value: {
        fontSize: 10,
        color: colors.darkGray,
    },
});

export default GrowthChartTooltip;
