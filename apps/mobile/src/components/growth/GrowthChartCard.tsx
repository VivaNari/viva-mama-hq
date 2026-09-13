import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
    Indicator,
    IndicatorResult,
    Sex,
    bandForZ,
    isPercentileQuotable,
} from '@vivamama/growth-standards';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { infantLogStyles } from '../../public/styles/infantLogStyles';
import LogChipTabs from '../infant/LogChipTabs';
import LogInfoBanner from '../infant/LogInfoBanner';
import GrowthChart from './GrowthChart';
import GrowthChartLegend from './GrowthChartLegend';
import { ChildPoint } from './chartGeometry';
import {
    INDICATOR_ORDER,
    bandLabelKey,
    indicatorComparisonKey,
    indicatorExplainerKey,
    indicatorTabKey,
    indicatorTitleKey,
    ordinalSuffix,
    statusMessageKey,
} from './growthCopy';

export interface GrowthChartCardProps {
    sex: Sex | string | null | undefined;
    childName: string;
    /** The child's plotted series per indicator, oldest first. */
    seriesByIndicator: Record<Indicator, ChildPoint[]>;
    /** The most recent scored result per indicator, for the headline and copy. */
    latestByIndicator: Record<Indicator, IndicatorResult>;
}

const isSex = (value: unknown): value is Sex => value === 'Male' || value === 'Female';

/**
 * The growth card: one chart at a time, switched by a tab strip.
 *
 * One card rather than four stacked charts, for two reasons — it keeps the dashboard
 * scannable, and building five SVG paths four times over on first paint is a real cost on
 * a low-end Android.
 *
 * Used in two places: the dashboard, reading the latest saved log, and the Growth Log
 * screen, reading what the mother is typing right now. Both get their numbers from
 * @vivamama/growth-standards, so a live preview and a saved row can never disagree.
 */
const GrowthChartCard: React.FC<GrowthChartCardProps> = ({
    sex,
    childName,
    seriesByIndicator,
    latestByIndicator,
}) => {
    const { t } = useTranslation();

    const [indicator, setIndicator] = useState<Indicator>('weight_for_age');

    const result = latestByIndicator[indicator];
    const points = seriesByIndicator[indicator] ?? [];

    const tabs = useMemo(
        () =>
            INDICATOR_ORDER.map((key) => ({
                key,
                label: t(indicatorTabKey(key)),
            })),
        [t],
    );

    /**
     * The headline.
     *
     * Out in the tails the digits are false precision, so past the 0.1st / 99.9th the band
     * label replaces the number — "0.003rd percentile" is not something a parent can use.
     */
    const headline = (): string => {
        if (result?.status !== 'OK') return t('infant.growth.notScored');

        if (!isPercentileQuotable(result.percentile)) {
            return t(bandLabelKey(bandForZ(result.z)));
        }

        const rounded = Math.round(result.percentile);
        return t('infant.growth.percentileValue', {
            value: rounded,
            suffix: ordinalSuffix(rounded),
        });
    };

    /** The sentence under the chart — what the number means, in counting terms. */
    const explanation = (): string => {
        if (!isSex(sex)) {
            return t('infant.growth.status.NOT_APPLICABLE', { name: childName });
        }

        if (result?.status !== 'OK') {
            return t(statusMessageKey(indicator, result?.status ?? 'MISSING_INPUT'), {
                name: childName,
                value: result?.value ?? '',
                key: result?.key?.toFixed(1) ?? '',
            });
        }

        if (!isPercentileQuotable(result.percentile)) {
            return t('infant.growth.comparisonExtreme', { name: childName });
        }

        return t(indicatorComparisonKey(indicator), {
            name: childName,
            percentile: Math.round(result.percentile),
        });
    };

    return (
        <View style={infantLogStyles.card}>
            <View style={styles.header}>
                <Text style={[styles.title, globalStyles.fontBold]}>
                    {t(indicatorTitleKey(indicator))}
                </Text>
                <Text style={[styles.headline, globalStyles.fontSemiBold]}>
                    {headline()}
                </Text>
            </View>

            <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                {t(indicatorExplainerKey(indicator))}
            </Text>

            <View style={styles.tabs}>
                <LogChipTabs
                    tabs={tabs}
                    activeKey={indicator}
                    onChange={(key) => setIndicator(key as Indicator)}
                />
            </View>

            {isSex(sex) ? (
                <>
                    <GrowthChart indicator={indicator} sex={sex} childPoints={points} />
                    <Text style={[styles.axisCaption, globalStyles.fontRegular]}>
                        {t(
                            indicator === 'weight_for_length'
                                ? 'infant.growth.axisLength'
                                : 'infant.growth.axisAge',
                        )}
                    </Text>
                    <GrowthChartLegend />
                </>
            ) : (
                // The explanation below already says why there is no chart, so this stands
                // in for the plot area without repeating it.
                <Text style={[styles.unavailable, globalStyles.fontRegular]}>
                    {t('infant.growth.notScored')}
                </Text>
            )}

            <Text style={[styles.explanation, globalStyles.fontRegular]}>
                {explanation()}
            </Text>

            {/*
              Non-dismissible on every chart, by design. These numbers look clinical and a
              parent will read them as a judgement unless told otherwise.
            */}
            <LogInfoBanner
                icon="shield-outline"
                text={t('infant.growth.disclaimer')}
                style={styles.disclaimer}
            />

            <Text style={[infantLogStyles.footnote, globalStyles.fontRegular]}>
                {t('infant.growth.attribution')}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
    },

    title: {
        flexShrink: 1,
        fontSize: 16,
        color: colors.black,
    },

    headline: {
        fontSize: 13,
        color: colors.darkPurple,
    },

    subtitle: {
        marginTop: 3,
        fontSize: 12,
        lineHeight: 18,
        color: colors.gray,
    },

    tabs: {
        // LogChipTabs pads itself for a full-bleed strip; pull that back inside the card.
        marginHorizontal: -16,
    },

    axisCaption: {
        marginTop: 2,
        fontSize: 10,
        textAlign: 'center',
        color: colors.gray,
    },

    explanation: {
        marginTop: 12,
        fontSize: 13,
        lineHeight: 20,
        color: colors.darkGray,
    },

    unavailable: {
        marginVertical: 20,
        fontSize: 13,
        textAlign: 'center',
        color: colors.gray,
    },

    disclaimer: {
        marginTop: 12,
        marginBottom: 0,
    },
});

export default GrowthChartCard;
