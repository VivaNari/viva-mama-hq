import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
    SharedValue,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
    DrawnStroke,
    EASE_MORPH,
    EASE_OUT,
    EASE_POP,
    hiddenFromScreenReader,
    INTRO_COLORS,
    IntroText,
    Reveal,
    SpeechBubble,
    TypedSegment,
    useIntroTiming,
} from './shared';

const VIVA_PORTRAIT = require('../../public/assets/images/welcomeIntro/viva_portrait.webp');
const LOGO_MARK = require('../../public/assets/images/welcomeIntro/logo_mark.png');

const TYPING_DELAY_MS = 750;
const LOGO_DELAY_MS = 3600;

const lerp = (from: number, to: number, t: number) => {
    'worklet';
    return from + (to - from) * t;
};

/** The arch behind Viva that closes into the logo's circle. */
const MorphingFill = ({ shown, morph }: { shown: SharedValue<number>; morph: SharedValue<number> }) => {
    const shape = useAnimatedStyle(() => {
        const m = morph.value;
        const width = lerp(276, 200, m);
        return {
            opacity: shown.value,
            left: lerp(57, 95, m),
            top: lerp(192, 235, m),
            width,
            height: lerp(310, 200, m),
            borderTopLeftRadius: width / 2,
            borderTopRightRadius: width / 2,
            borderBottomLeftRadius: lerp(0, 100, m),
            borderBottomRightRadius: lerp(0, 100, m),
            transform: [{ scale: lerp(0.92, 1, shown.value) }],
        };
    });
    // Layered rather than interpolating the colour: the same purple-to-purple fade, with
    // the darker layer simply fading in over the lighter one.
    const darkLayer = useAnimatedStyle(() => ({ opacity: morph.value }));

    return (
        <Animated.View style={[styles.fill, shape]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.fillDark, darkLayer]} />
        </Animated.View>
    );
};

/** Viva and her rings, then the arch closing into the VivaMama logo as it draws itself. */
const WelcomeSlide = ({ on }: { on: boolean }) => {
    const { t } = useTranslation();
    const animate = useIntroTiming();
    const reduced = useReducedMotion();
    const [typing, setTyping] = useState(false);

    const shown = useSharedValue(0);
    const portrait = useSharedValue(0);
    const dot = useSharedValue(0);
    const leave = useSharedValue(0);
    const morph = useSharedValue(0);
    const legs = useSharedValue(0);
    const chevron = useSharedValue(0);
    const heart = useSharedValue(0);
    const logo = useSharedValue(0);

    useEffect(() => {
        if (!on) {
            return;
        }
        shown.value = animate(1, { duration: 900 });
        portrait.value = animate(1, { delay: 200, duration: 1000 });
        dot.value = animate(1, { delay: 1000, duration: 500, easing: EASE_POP });

        const typingTimer = setTimeout(() => setTyping(true), reduced ? 0 : TYPING_DELAY_MS);
        const logoTimer = setTimeout(() => {
            leave.value = animate(1, { delay: 100, duration: 500 });
            morph.value = animate(1, { delay: 350, duration: 750, easing: EASE_MORPH });
            legs.value = animate(1, { delay: 1050, duration: 500 });
            chevron.value = animate(1, { delay: 1400, duration: 550 });
            heart.value = animate(1, { delay: 1850, duration: 550, easing: EASE_POP });
            logo.value = animate(1, { delay: 2300, duration: 350, easing: EASE_OUT });
        }, reduced ? 0 : LOGO_DELAY_MS);

        return () => {
            clearTimeout(typingTimer);
            clearTimeout(logoTimer);
        };
    }, [on, reduced, animate, shown, portrait, dot, leave, morph, legs, chevron, heart, logo]);

    const ringsStyle = useAnimatedStyle(() => ({
        opacity: shown.value * (1 - leave.value),
        transform: [{ scale: lerp(0.92, 1, shown.value) + 0.12 * leave.value }],
    }));
    const dotStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, dot.value) * (1 - leave.value),
        transform: [{ scale: lerp(0.6, 1, dot.value) }],
    }));
    const portraitStyle = useAnimatedStyle(() => ({
        opacity: portrait.value * (1 - leave.value),
        transform: [
            { translateY: lerp(26, 0, portrait.value) - 8 * leave.value },
            { scale: 1 - 0.04 * leave.value },
        ],
    }));
    const heartStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, heart.value * 3),
        transform: [{ scale: lerp(0.2, 1, heart.value) }],
    }));
    const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value }));
    const bubbleShift = useAnimatedStyle(() => ({
        transform: [{ translateY: -23 * morph.value }],
    }));

    const before = t('welcomeIntro.slide1.bubbleBefore');
    const name = t('welcomeIntro.slide1.bubbleName');
    const after = t('welcomeIntro.slide1.bubbleAfter');
    const segments = useMemo<TypedSegment[]>(
        () => [{ text: before }, { text: name, accent: true }, { text: after }],
        [before, name, after],
    );

    return (
        <>
            <Reveal on={on} delay={250} duration={800} from={{ y: 12 }} style={styles.title}>
                <IntroText accessibilityRole="header" font="heading" size={32} lineHeight={1.12} style={styles.centered}>
                    {t('welcomeIntro.slide1.greeting')}
                    {'\n'}
                    <IntroText font="heading" size={32} lineHeight={1.12} color={INTRO_COLORS.purple}>
                        {t('welcomeIntro.slide1.mama')}
                    </IntroText>
                </IntroText>
            </Reveal>

            <View style={StyleSheet.absoluteFill} pointerEvents="none" {...hiddenFromScreenReader}>
                <Animated.View style={[styles.rings, ringsStyle]}>
                    <Svg width={332} height={338} fill="none">
                        <Path
                            d="M0.75 338V166A165.25 165.25 0 0 1 331.25 166V338"
                            stroke="#DCCDF8"
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                        />
                        <Path
                            d="M14.75 338V166A151.25 151.25 0 0 1 317.25 166V338"
                            stroke="#D9C7F8"
                            strokeWidth={1.5}
                        />
                    </Svg>
                </Animated.View>

                <MorphingFill shown={shown} morph={morph} />

                <Animated.View style={[styles.dot, dotStyle]} />

                <Animated.Image source={VIVA_PORTRAIT} style={[styles.portrait, portraitStyle]} />

                <View style={styles.logoFrame}>
                    <Svg width={200} height={200} viewBox="0 0 400 400">
                        <DrawnStroke d="M199.5 250L101 125.5" stroke="#B899DD" strokeWidth={31} length={160} progress={chevron} />
                        <DrawnStroke d="M199.5 250L297 125.5" stroke="#B899DD" strokeWidth={31} length={160} progress={chevron} />
                        <DrawnStroke d="M100 287V125.5" stroke={INTRO_COLORS.white} strokeWidth={33} length={162} progress={legs} />
                        <DrawnStroke d="M298 287V125.5" stroke={INTRO_COLORS.white} strokeWidth={33} length={162} progress={legs} />
                    </Svg>
                </View>
                <Animated.View style={[styles.logoFrame, styles.heartOrigin, heartStyle]}>
                    <Svg width={200} height={200} viewBox="0 0 400 400">
                        <Path
                            d="M200.5 189C179 166 163.5 148 163 136A19.5 19.5 0 0 1 200.5 128.5A19.5 19.5 0 0 1 238 136C237.5 148 222 166 200.5 189Z"
                            fill={INTRO_COLORS.white}
                        />
                    </Svg>
                </Animated.View>
                <Animated.View style={[styles.logoFrame, logoStyle]}>
                    <Image source={LOGO_MARK} style={styles.logoImage} />
                </Animated.View>
            </View>

            <Animated.View style={[styles.bubbleRow, bubbleShift]}>
                <Reveal on={on} delay={600} duration={600} easing={EASE_POP} from={{ y: 12, scale: 0.6 }}>
                    <SpeechBubble typing={typing} segments={segments} size={22} style={styles.bubble} />
                </Reveal>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    title: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 36,
    },
    centered: {
        textAlign: 'center',
    },
    rings: {
        position: 'absolute',
        left: 29,
        top: 164,
        width: 332,
        height: 338,
        transformOrigin: ['50%', '100%', 0],
    },
    fill: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: INTRO_COLORS.tint,
        transformOrigin: ['50%', '100%', 0],
    },
    fillDark: {
        backgroundColor: INTRO_COLORS.deepPurple,
    },
    dot: {
        position: 'absolute',
        left: 316,
        top: 243,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 4,
        borderColor: INTRO_COLORS.page,
        backgroundColor: INTRO_COLORS.amber,
    },
    portrait: {
        position: 'absolute',
        left: 39,
        top: 161,
        width: 312,
        height: 341,
        transformOrigin: ['50%', '100%', 0],
    },
    logoFrame: {
        position: 'absolute',
        left: 95,
        top: 235,
        width: 200,
        height: 200,
    },
    heartOrigin: {
        transformOrigin: ['50%', '37%', 0],
    },
    logoImage: {
        width: 200,
        height: 200,
    },
    bubbleRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 478,
        alignItems: 'center',
    },
    bubble: {
        width: 332,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
});

export default WelcomeSlide;
