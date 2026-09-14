import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import MilestoneScene from './MilestoneScene';
import { SkinTone } from './rig/palette';

interface MilestoneCardProps {
    milestoneKey: string;
    width: number;
    logged: boolean;
    skinTone?: SkinTone;
    /**
     * Both take the key rather than closing over it, so the screen can hand the same two
     * functions to every card. A handler built per card inside the map would be a new
     * function on every render, which is enough on its own to defeat the memo below.
     */
    onOpen: (milestoneKey: string) => void;
    onToggle: (milestoneKey: string) => void;
}

/**
 * One milestone in the grid: a still illustration, its name, and the log toggle.
 *
 * ## Why this is memoised, and why the thumbnail no longer moves
 *
 * Logging a milestone replaces the screen's `logs`, which re-renders the grid. Without the
 * memo that re-rendered all six cards, and a card is not a cheap thing to re-render — each one
 * rebuilds a whole illustration, a few hundred elements of rounded rectangles. Five of those
 * six had nothing change about them. The memo holds because every prop here is a primitive or
 * one of the two stable handlers above.
 *
 * The thumbnail is deliberately still. A scene given no clock freezes at the frame its author
 * picked as the most legible one, so the card keeps the pose that explains the milestone and
 * loses only the motion — and the motion was never really readable at this size anyway. It
 * lives in the detail view, which is where a parent actually watches it.
 */
const MilestoneCard: React.FC<MilestoneCardProps> = ({
    milestoneKey,
    width,
    logged,
    skinTone,
    onOpen,
    onToggle,
}) => {
    const { t } = useTranslation();

    return (
        <View style={[styles.card, { width }]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onOpen(milestoneKey)}
                accessibilityRole="button"
                accessibilityLabel={t(`infant.milestone.items.${milestoneKey}`)}
                style={styles.thumb}
            >
                <MilestoneScene
                    milestoneKey={milestoneKey}
                    width={width}
                    skinTone={skinTone}
                />

                {logged && (
                    <View style={styles.badge}>
                        <MaterialDesignIcons name="check" size={14} color={colors.white} />
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.body}>
                <Text style={[styles.title, globalStyles.fontSemiBold]} numberOfLines={3}>
                    {t(`infant.milestone.items.${milestoneKey}`)}
                </Text>

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onToggle(milestoneKey)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: logged }}
                    style={[styles.action, logged && styles.actionLogged]}
                >
                    <Text
                        style={[
                            styles.actionLabel,
                            logged && styles.actionLabelLogged,
                            globalStyles.fontSemiBold,
                        ]}
                    >
                        {logged ? t('infant.milestone.logged') : t('infant.milestone.logThis')}
                    </Text>

                    {logged && (
                        <MaterialDesignIcons name="check" size={14} color={colors.success} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.white,
        borderRadius: 14,
        overflow: 'hidden',
    },

    thumb: {
        position: 'relative',
    },

    badge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success,
    },

    body: {
        padding: 10,
        gap: 8,
    },

    title: {
        fontSize: 13,
        lineHeight: 17,
        color: colors.black,
    },

    action: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.lightPurple,
    },

    actionLogged: {
        // The soft green the screen already used for a logged action.
        backgroundColor: '#E8F5E9',
    },

    actionLabel: {
        fontSize: 12,
        color: colors.purple,
    },

    actionLabelLogged: {
        color: colors.success,
    },
});

export default React.memo(MilestoneCard);
