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
    /**
     * Whole months since birth, for the length rule below. Omitted where the age is not
     * known, which simply means no action line is ever offered.
     */
    ageMonths?: number | null;
}

const isSex = (value: unknown): value is Sex => value === 'Male' || value === 'Female';

/**
 * From which age a low length-for-age is worth raising.
 *
 * Mirrors `THRESHOLDS.lengthTriggersFromMonths` in the backend's infant-wellbeing service,
 * which decides the same thing for the dashboard's wellbeing card. Duplicated rather than
 * shared because the chart also runs on the Growth Log screen, where no wellbeing payload
 * is fetched — but the two must move together, so change both or neither.
 */
const LENGTH_TRIGGERS_FROM_MONTHS = 3;

/**
 * Whether this measurement is worth raising with a clinician.
 *
 * Deliberately not "is this baby doing well". The rules are the wellbeing card's, so the
 * chart and the card can never tell a mother two different things about one measurement:
 *
 *  - only the low side, at WHO's own -2 SD. A large baby is not a finding with an action
 *    behind it;
 *  - weight at any age, length only from three months — a newborn's length is measured
 *    with the baby still curled up, and the reading is unreliable enough that flagging it
 *    would be flagging the tape measure;
 *  - head circumference and weight-for-length never, matching the card. Head size is
 *    strongly familial and the urgent signal there is a rapid *increase*, which a low-side
 *    rule would miss while looking like coverage.
 */
const needsRaising = (
    indicator: Indicator,
    result: IndicatorResult | undefined,
    ageMonths: number | null | undefined,
): boolean => {
    if (result?.status !== 'OK' || result.z === null) return false;

    if (indicator === 'weight_for_age') {
        // fall through
    } else if (indicator === 'length_for_age') {
        if (ageMonths == null || ageMonths < LENGTH_TRIGGERS_FROM_MONTHS) return false;
    } else {
        return false;
    }

    const band = bandForZ(result.z);
    return band === 'below' || band === 'far_below';
};

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
    ageMonths,
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

    /** Whether the amber action line below will render, which the copy has to account for. */
    const raising = needsRaising(indicator, result, ageMonths);

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
            // This sentence carries its own "worth mentioning" tail, which is right when
            // nothing else says it — an extreme head circumference, or an extreme length
            // in the newborn weeks, neither of which gets an action line. When the action
            // line *is* rendering, the tail would be the same instruction twice, a word
            // apart, stacked.
            return t(
                raising
                    ? 'infant.growth.comparisonExtremeNeutral'
                    : 'infant.growth.comparisonExtreme',
                { name: childName },
            );
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
              The action, and only the action, carries a colour.

              The sentence above stays in neutral text however the measurement lands. It
              ends with "healthy babies sit anywhere across this range", and tinting *that*
              amber would have the colour contradict the words — colour wins, and a mother
              stops reading. Tinting it green would be worse: it grades a position, implying
              the ~5% of healthy babies outside the range are failing and that a higher
              percentile is a better one. Both are what `growthCopy`'s rules forbid.

              So nothing is ever green here. A line appears only when there is something to
              do, which is the one thing a colour can say honestly.
            */}
            {raising && (
                <View style={styles.action}>
                    <View style={styles.actionDot} />
                    <Text style={[styles.actionText, globalStyles.fontSemiBold]}>
                        {t('infant.growth.actionDiscuss')}
                    </Text>
                </View>
            )}

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

    /** Tinted rather than boxed: a banner here would read as an alarm. */
    action: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.yellowBadgeBG,
    },

    actionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 7,
        backgroundColor: colors.yellowBadgeText,
    },

    actionText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: colors.yellowBadgeText,
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
