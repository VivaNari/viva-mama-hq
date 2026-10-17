import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

/**
 * The small coloured badge the dashboard uses to state a status in one word.
 *
 * Extracted here for the infant wellbeing card. The mother's Viva Score card and
 * `IndividualRecoveryCard` still inline their own copies with a red/yellow/green ternary —
 * deliberately left alone rather than migrated, since changing how the recovery score reads
 * is a different change from adding an infant card.
 */
export type TPillTone = 'positive' | 'caution' | 'neutral';

const TONES: Record<TPillTone, { background: string; foreground: string }> = {
    positive: { background: colors.greenBadgeBG, foreground: colors.greenBadgeText },
    caution: { background: colors.yellowBadgeBG, foreground: colors.yellowBadgeText },
    neutral: { background: colors.lightGray, foreground: colors.darkGray },
};

const StatusPill = ({ label, tone }: { label: string; tone: TPillTone }) => {
    const { background, foreground } = TONES[tone];

    return (
        <View style={[styles.pill, { backgroundColor: background }]}>
            <View style={[styles.dot, { backgroundColor: foreground }]} />
            <Text style={[styles.label, { color: foreground }, globalStyles.fontSemiBold]}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
    },

    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },

    label: {
        fontSize: 12,
    },
});

export default StatusPill;
