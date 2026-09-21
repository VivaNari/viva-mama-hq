import React from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import { ordinalSuffix } from '../growth/growthCopy';
import {
    IInfantWellbeing,
    IWellbeingTile,
    TWellbeingDomain,
} from '../../types/infantWellbeing.types';
import StatusPill from '../StatusPill';

/**
 * "Is my baby doing OK?" — the one question the infant tab could not answer.
 *
 * Four domains reduced to a value and a dot, plus one overall status. What the dot means is
 * the whole design: it reports whether there is something to **do**, never a verdict on the
 * child. A baby on the 3rd percentile is a healthy small baby and its Growth dot is green;
 * a baby whose vaccines are three weeks overdue gets an amber dot and a line telling the
 * mother to book a visit.
 *
 * That split is what keeps this card on the right side of the policy the rest of the infant
 * code follows — `growthCopy.ts` forbids colour-coding a percentile as good or bad, and
 * `WarningSigns.tsx` forbids anything that reads as an alarm. There is no red state here at
 * all: an app that cannot examine a baby should not raise an alarm about one.
 */

// `as const` so the names stay literals — the icon font's prop is a union of its glyphs,
// and a widened `string` would not satisfy it.
const ICONS = {
    growth: 'trending-up',
    feeding: 'milk',
    vaccines: 'syringe',
    milestones: 'footprints',
} as const satisfies Record<TWellbeingDomain, string>;

/** Tap targets, so a tile that says something is due can be acted on. */
const SCREENS: Record<TWellbeingDomain, string> = {
    growth: 'GrowthLog',
    feeding: 'FeedingLog',
    vaccines: 'VaccinationLog',
    milestones: 'MilestoneLog',
};

/**
 * Params the server sends as keys rather than as words.
 *
 * `visit` and `band` identify a row on the MCP card ("6w", "2-3m"); their labels already
 * exist in the locale files, and the server has no business rendering "6 weeks" in a
 * language it was never told. Resolved here so "Due 6w" reads as "Due 6 weeks".
 */
const KEYED_PARAMS: Record<string, string> = {
    visit: 'infant.vaccination.visits',
    band: 'infant.milestone.bands',
    measure: 'infant.wellbeing.measure',
};

const resolveParams = (
    params: Record<string, string | number> | undefined,
    t: TFunction,
): Record<string, string | number> | undefined => {
    if (!params) return params;

    const resolved: Record<string, string | number> = { ...params };

    for (const [name, namespace] of Object.entries(KEYED_PARAMS)) {
        const value = params[name];
        if (typeof value === 'string') resolved[name] = t(`${namespace}.${value}`);
    }

    // "31th". The suffix is arithmetic rather than translation — 1st/2nd/3rd/11th/21st
    // cannot be expressed as an interpolation — so it is computed with the same helper the
    // growth chart below this card already uses, and locales that do not take an ordinal
    // suffix simply ignore it.
    if (typeof params.percentile === 'number') {
        resolved.suffix = ordinalSuffix(params.percentile);
    }

    return resolved;
};

const Tile = ({
    tile,
    onPress,
}: {
    tile: IWellbeingTile;
    onPress: (domain: TWellbeingDomain) => void;
}) => {
    const { t } = useTranslation();
    const attention = tile.status === 'attention';
    const value = t(tile.valueKey, resolveParams(tile.valueParams, t));

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress(tile.domain)}
            accessibilityRole="button"
            accessibilityLabel={`${t(`infant.wellbeing.domain.${tile.domain}`)}: ${value}`}
            style={[styles.tile, attention && styles.tileAttention]}
        >
            <View style={styles.tileHead}>
                <Lucide
                    name={ICONS[tile.domain]}
                    size={14}
                    color={attention ? colors.yellowBadgeText : colors.darkPurple}
                />
                <View
                    style={[
                        styles.dot,
                        {
                            backgroundColor: attention
                                ? colors.yellowBadgeText
                                : colors.greenBadgeText,
                        },
                    ]}
                />
            </View>

            <Text style={[styles.tileValue, globalStyles.fontBold]} numberOfLines={1}>
                {value}
            </Text>

            <Text style={[styles.tileLabel, globalStyles.fontRegular]} numberOfLines={1}>
                {t(`infant.wellbeing.domain.${tile.domain}`)}
            </Text>
        </TouchableOpacity>
    );
};

const InfantWellbeingCard = ({
    wellbeing,
    childName,
    onOpenDomain,
}: {
    wellbeing: IInfantWellbeing;
    childName: string;
    onOpenDomain: (screen: string) => void;
}) => {
    const { t } = useTranslation();

    const attention = wellbeing.status === 'attention';
    // Every action currently showing, so a mother reads what to do without opening a tile.
    const actions = wellbeing.tiles.filter(tile => tile.actionKey);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={[styles.title, globalStyles.fontBold]}>
                    {t('infant.wellbeing.title')}
                </Text>

                {!wellbeing.firstRun && (
                    <StatusPill
                        label={t(
                            attention
                                ? 'infant.wellbeing.statusAttention'
                                : 'infant.wellbeing.statusOnTrack',
                        )}
                        tone={attention ? 'caution' : 'positive'}
                    />
                )}
            </View>

            <Text style={[styles.summary, globalStyles.fontRegular]}>
                {t(wellbeing.summaryKey, { name: childName, ...wellbeing.summaryParams })}
            </Text>

            {wellbeing.tiles.length > 0 && (
                <View style={styles.tiles}>
                    {wellbeing.tiles.map(tile => (
                        <Tile
                            key={tile.domain}
                            tile={tile}
                            onPress={domain => onOpenDomain(SCREENS[domain])}
                        />
                    ))}
                </View>
            )}

            {actions.length > 0 && (
                <View style={styles.actions}>
                    {actions.map(tile => (
                        <View key={tile.domain} style={styles.action}>
                            <View style={styles.actionDot} />
                            <Text
                                style={[styles.actionText, globalStyles.fontRegular]}
                                // The action is the point of the card; never truncate it.
                            >
                                {t(tile.actionKey!, {
                                    name: childName,
                                    ...resolveParams(tile.actionParams, t),
                                })}
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 16,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },

    title: {
        flex: 1,
        fontSize: 17,
        color: colors.black,
    },

    summary: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 19,
        color: colors.darkGray,
    },

    tiles: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 14,
    },

    tile: {
        // Two per row on a narrow phone, four on a wide one, without a media query.
        flexGrow: 1,
        flexBasis: 72,
        borderRadius: 12,
        backgroundColor: colors.logFieldBG,
        paddingVertical: 10,
        paddingHorizontal: 10,
    },

    tileAttention: {
        backgroundColor: colors.yellowBadgeBG,
    },

    tileHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },

    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },

    tileValue: {
        fontSize: 14,
        color: colors.black,
    },

    tileLabel: {
        marginTop: 1,
        fontSize: 11,
        color: colors.darkGray,
    },

    actions: {
        marginTop: 14,
        gap: 8,
    },

    action: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },

    actionDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 7,
        backgroundColor: colors.yellowBadgeText,
    },

    actionText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: colors.darkGray,
    },
});

export default InfantWellbeingCard;
