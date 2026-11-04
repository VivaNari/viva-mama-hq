import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { colors } from '../../public/assets/colors';

const BAR_DELAYS_MS = [0, 180, 360, 90, 270];
const STEP_MS = 320;
const MIN_SCALE = 0.3;

const Bar: React.FC<{ delay: number }> = ({ delay }) => {
    const scale = useSharedValue(MIN_SCALE);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: STEP_MS }),
                    withTiming(MIN_SCALE, { duration: STEP_MS }),
                ),
                -1,
            ),
        );
        return () => cancelAnimation(scale);
    }, [delay, scale]);

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

    return <Animated.View style={[styles.bar, animatedStyle]} />;
};

/**
 * Moving bars beside the stop icon while a reply is being heard. Decorative: the button
 * around it already tells a screen reader what it does.
 */
export const SpeakingWave: React.FC = () => (
    <View
        testID="speaking-wave"
        style={styles.wave}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
    >
        {BAR_DELAYS_MS.map((delay) => (
            <Bar key={delay} delay={delay} />
        ))}
    </View>
);

const styles = StyleSheet.create({
    wave: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 20,
        gap: 2,
        marginLeft: 6,
    },
    bar: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: colors.darkPurple,
    },
});
