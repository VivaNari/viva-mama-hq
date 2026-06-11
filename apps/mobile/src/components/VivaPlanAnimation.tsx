import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import { globalStyles } from '../public/styles';

export const Loader = () => {
    const bubble1Angle = useSharedValue(0);
    const bubble1Radius = useSharedValue(200);
    const bubble1Scale = useSharedValue(0);

    const bubble2Angle = useSharedValue(90);
    const bubble2Radius = useSharedValue(200);
    const bubble2Scale = useSharedValue(0);

    const bubble3Angle = useSharedValue(180);
    const bubble3Radius = useSharedValue(200);
    const bubble3Scale = useSharedValue(0);

    const bubble4Angle = useSharedValue(270);
    const bubble4Radius = useSharedValue(200);
    const bubble4Scale = useSharedValue(0);

    const centerScale = useSharedValue(0);
    const centerOpacity = useSharedValue(0);

    useEffect(() => {
        const spinDuration = 3000;
        const convergeDuration = 2000;

        // All bubbles spin and converge simultaneously
        const animateBubble = (angle: any, radius: any, scale: any, startAngle: any) => {
            // Continuous rotation
            angle.value = withRepeat(
                withTiming(startAngle + 360, {
                    duration: spinDuration,
                    easing: Easing.linear,
                }),
                -1
            );

            // Pulsing radius - moves in and out from center
            radius.value = withRepeat(
                withSequence(
                    withTiming(80, {
                        duration: convergeDuration,
                        easing: Easing.bezier(0.45, 0, 0.55, 1),
                    }),
                    withTiming(200, {
                        duration: convergeDuration,
                        easing: Easing.bezier(0.45, 0, 0.55, 1),
                    })
                ),
                -1
            );

            // Scale animation
            scale.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) }),
                    withTiming(0.85, { duration: 1200 }),
                    withTiming(1, { duration: 800 })
                ),
                -1
            );
        };

        animateBubble(bubble1Angle, bubble1Radius, bubble1Scale, 0);
        animateBubble(bubble2Angle, bubble2Radius, bubble2Scale, 90);
        animateBubble(bubble3Angle, bubble3Radius, bubble3Scale, 180);
        animateBubble(bubble4Angle, bubble4Radius, bubble4Scale, 270);

        // Center content animation
        centerScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        centerOpacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500 }),
                withTiming(0.9, { duration: 1500 })
            ),
            -1,
            true
        );
    }, []);

    const getBubbleStyle = (angle: any, radius: any, scale: any) => {
        return useAnimatedStyle(() => {
            const angleRad = (angle.value * Math.PI) / 180;
            const x = Math.cos(angleRad) * radius.value;
            const y = Math.sin(angleRad) * radius.value;

            return {
                transform: [
                    { translateX: x },
                    { translateY: y },
                    { scale: scale.value }
                ],
                opacity: scale.value * 0.85,
            };
        });
    };

    const centerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: centerScale.value }],
        opacity: centerOpacity.value,
    }));

    return (
        <View style={styles.container}>
            <View style={styles.orbitContainer}>
                <Animated.View
                    style={[
                        styles.spinBubble,
                        styles.purpleBubble,
                        getBubbleStyle(bubble1Angle, bubble1Radius, bubble1Scale)
                    ]}
                />
                <Animated.View
                    style={[
                        styles.spinBubble,
                        styles.blueBubble,
                        getBubbleStyle(bubble2Angle, bubble2Radius, bubble2Scale)
                    ]}
                />
                <Animated.View
                    style={[
                        styles.spinBubble,
                        styles.pinkBubble,
                        getBubbleStyle(bubble3Angle, bubble3Radius, bubble3Scale)
                    ]}
                />
                <Animated.View
                    style={[
                        styles.spinBubble,
                        styles.cyanBubble,
                        getBubbleStyle(bubble4Angle, bubble4Radius, bubble4Scale)
                    ]}
                />
            </View>

            <Animated.View style={[styles.centerContent, centerStyle]}>
                <Text style={[styles.title, globalStyles.fontMedium]}>Viva AI</Text>
                <Text style={[styles.subtitle, globalStyles.fontRegular]}>is curating a plan for you...</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F7FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bubble: {
        position: 'absolute',
        borderRadius: 50,
        opacity: 0.7,
    },
    purpleBubble: {
        width: 70,
        height: 70,
        backgroundColor: '#A855F7',
    },
    blueBubble: {
        width: 50,
        height: 50,
        backgroundColor: '#3B82F6',
    },
    pinkBubble: {
        width: 65,
        height: 65,
        backgroundColor: '#EC4899',
    },
    cyanBubble: {
        width: 50,
        height: 50,
        backgroundColor: '#06B6D4',
    },
    centerContent: {
        alignItems: 'center',
        zIndex: 10,
    },
    title: {
        fontSize: 30,
        color: '#1F2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    orbitContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    spinBubble: {
        position: 'absolute',
        borderRadius: 35,
        width: 60,
        height: 60,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    pulseContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    pulseBubble: {
        position: 'absolute',
        borderRadius: 40,
        width: 60,
        height: 60,
        opacity: 0.6,
    },
    enhancedBubble: {
        position: 'absolute',
        borderRadius: 50,
        width: 70,
        height: 70,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    orangeBubble: {
        backgroundColor: '#F97316',
    },
    tealBubble: {
        backgroundColor: '#14B8A6',
    },
});

export default function VivaAILoader() {

    return (
        <View style={{ flex: 1 }}>
            <Loader />
        </View>
    );
}