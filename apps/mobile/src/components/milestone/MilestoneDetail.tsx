import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import MilestoneScene, { sceneFor } from './MilestoneScene';
import { SkinTone } from './rig/palette';
import { useReduceMotion } from './rig/useReduceMotion';
import { useSceneClock } from './rig/useSceneClock';

interface MilestoneDetailProps {
    milestoneKey: string | null;
    /** The band's other milestones, for the "most babies" list below. */
    bandMilestones: string[];
    bandLabelKey: string;
    logged: boolean;
    skinTone?: SkinTone;
    onToggle: () => void;
    onClose: () => void;
}

/**
 * One milestone, large.
 *
 * The animation lives here rather than in the grid. A card thumbnail is 150px wide and read
 * in passing; this is where a parent actually watches what the milestone looks like, and
 * where the step chips are worth having.
 *
 * Which makes this the only place on the feature that moves, so it is also the only place that
 * has to answer Reduce Motion. The answer is to withhold the clock: a scene with no clock draws
 * the still frame its author already chose as its most legible, so the screen loses its
 * movement and none of its meaning. The step chips go with it — they seek a clock that is not
 * running — but each one's moment is still the frame the scene is holding.
 */
const MilestoneDetail: React.FC<MilestoneDetailProps> = ({
    milestoneKey,
    bandMilestones,
    bandLabelKey,
    logged,
    skinTone,
    onToggle,
    onClose,
}) => {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();

    const scene = milestoneKey ? sceneFor(milestoneKey) : undefined;

    // Hooks cannot be conditional, so the clock is always created; it simply drives nothing
    // when the milestone on screen has no authored animation, or when the viewer has asked
    // the system for less of it.
    const reduceMotion = useReduceMotion();
    const clock = useSceneClock(
        scene?.duration ?? 1,
        !!scene && !!milestoneKey && !reduceMotion,
    );

    const moving = !!scene && !reduceMotion;

    const stageWidth = Math.min(width - 48, 520);

    return (
        <Modal
            visible={!!milestoneKey}
            animationType="slide"
            onRequestClose={onClose}
            transparent={false}
        >
            <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.back')}
                        hitSlop={12}
                    >
                        <MaterialDesignIcons
                            name="arrow-left"
                            size={24}
                            color={colors.black}
                        />
                    </TouchableOpacity>

                    <Text style={[styles.headerTitle, globalStyles.fontBold]}>
                        {t('infant.milestone.heading')}
                    </Text>
                </View>

                {milestoneKey && (
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.stage}>
                            <MilestoneScene
                                milestoneKey={milestoneKey}
                                width={stageWidth}
                                skinTone={skinTone}
                                clock={moving ? clock : undefined}
                                // The whole performance. This is the one place a scene is
                                // big enough for a blink, an eye creasing with a smile or a
                                // far limb moving on its own to be visible at all — a card
                                // thumbnail drops them because nobody can see them there.
                                detail="full"
                            />
                        </View>

                        <Text style={[styles.name, globalStyles.fontBold]}>
                            {t(`infant.milestone.items.${milestoneKey}`)}
                        </Text>
                        <Text style={[styles.age, globalStyles.fontRegular]}>
                            {t(bandLabelKey)}
                        </Text>

                        {/* Step chips seek the clock, so they need one that is running. */}
                        {moving && (
                            <View style={styles.steps}>
                                {scene.steps.map((step, index) => (
                                    <TouchableOpacity
                                        key={step.labelKey}
                                        activeOpacity={0.8}
                                        onPress={() => clock.seek(step.at)}
                                        accessibilityRole="button"
                                        style={styles.step}
                                    >
                                        <Text
                                            style={[styles.stepLabel, globalStyles.fontSemiBold]}
                                        >
                                            {index + 1} · {t(step.labelKey)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={onToggle}
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
                                {logged
                                    ? t('infant.milestone.logged')
                                    : t('infant.milestone.logThis')}
                            </Text>
                            {logged && (
                                <MaterialDesignIcons
                                    name="check"
                                    size={16}
                                    color={colors.success}
                                />
                            )}
                        </TouchableOpacity>

                        <View style={styles.listCard}>
                            <Text style={[styles.listTitle, globalStyles.fontSemiBold]}>
                                {t('infant.milestone.mostBabies')}
                            </Text>

                            {bandMilestones.map((key) => (
                                <View key={key} style={styles.listRow}>
                                    <View style={styles.bullet} />
                                    <Text
                                        style={[styles.listItem, globalStyles.fontRegular]}
                                    >
                                        {t(`infant.milestone.items.${key}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <Text style={[styles.source, globalStyles.fontRegular]}>
                            {t('infant.milestone.source')}
                        </Text>
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.pageBG,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },

    headerTitle: {
        fontSize: 20,
        color: colors.black,
    },

    content: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 10,
    },

    stage: {
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.white,
    },

    name: {
        marginTop: 6,
        fontSize: 20,
        color: colors.black,
    },

    age: {
        fontSize: 13,
        color: colors.gray,
    },

    steps: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },

    step: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: colors.lightPurple,
    },

    stepLabel: {
        fontSize: 12,
        color: colors.purple,
    },

    action: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        paddingVertical: 15,
        borderRadius: 26,
        backgroundColor: colors.lightPurple,
    },

    actionLogged: {
        backgroundColor: '#E8F5E9',
    },

    actionLabel: {
        fontSize: 15,
        color: colors.purple,
    },

    actionLabelLogged: {
        color: colors.success,
    },

    listCard: {
        marginTop: 8,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.white,
        gap: 10,
    },

    listTitle: {
        fontSize: 15,
        color: colors.black,
    },

    listRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },

    bullet: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 7,
        backgroundColor: colors.purple,
    },

    listItem: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: colors.black,
    },

    source: {
        marginTop: 10,
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        color: colors.gray,
    },
});

export default MilestoneDetail;
