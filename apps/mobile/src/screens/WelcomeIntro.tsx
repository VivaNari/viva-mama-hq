import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AccessibilityInfo,
    BackHandler,
    LayoutChangeEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, track } from '../analytics';
import {
    AskSlide,
    CareTeamSlide,
    JourneySlide,
    RemindersSlide,
    ReportsSlide,
} from '../components/welcomeIntro/FeatureSlides';
import PromiseSlide from '../components/welcomeIntro/PromiseSlide';
import {
    ART_HEIGHT,
    ART_WIDTH,
    EASE_OUT,
    INTRO_COLORS,
    LineIcon,
    Reveal,
    useIntroTiming,
} from '../components/welcomeIntro/shared';
import WelcomeSlide from '../components/welcomeIntro/WelcomeSlide';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { fitArtScale, resolveSwipe } from '../utils/welcomeIntro';

const SLIDES = [WelcomeSlide, JourneySlide, AskSlide, ReportsSlide, RemindersSlide, CareTeamSlide, PromiseSlide];
const LAST_SLIDE = SLIDES.length - 1;

const FIRST_REVEAL_DELAY_MS = 150;
const REVEAL_DELAY_MS = 240;
const PAGE_TURN_MS = 550;

const HEADER_HEIGHT = 52;
const FOOTER_TOP = 20;
const BUTTON_SIZE = 64;
const FOOTER_MIN_BOTTOM = 16;

/** Shown on every launch of a new install until "Let's begin" is tapped. */
const WelcomeIntro = ({ navigation }: { navigation: { replace: (route: string) => void } }) => {
    const { t } = useTranslation();
    const { markWelcomeIntroSeen } = useAuth();
    const { language, setLanguage } = useLanguage();
    const insets = useSafeAreaInsets();
    const { width, height: windowHeight } = useWindowDimensions();
    const animate = useIntroTiming();

    const footerHeight = FOOTER_TOP + BUTTON_SIZE + Math.max(insets.bottom, FOOTER_MIN_BOTTOM);
    // An estimate for the first frame; onLayout then replaces it with the real height.
    const [pageHeight, setPageHeight] = useState(windowHeight - insets.top - HEADER_HEIGHT - footerHeight);

    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
    const indexRef = useRef(0);
    const leaving = useRef(false);
    const viewed = useRef(new Set<number>());

    const scale = fitArtScale(width, pageHeight);
    const isLast = index === LAST_SLIDE;

    const translateX = useSharedValue(0);
    const activeSlide = useSharedValue(0);
    const buttonWidth = useSharedValue(BUTTON_SIZE);

    const goTo = useCallback(
        (target: number) => {
            const next = Math.max(0, Math.min(LAST_SLIDE, target));
            indexRef.current = next;
            activeSlide.value = next;
            setIndex(next);
            translateX.value = animate(-next * width, { duration: PAGE_TURN_MS, easing: EASE_OUT });
        },
        [activeSlide, animate, translateX, width],
    );

    // Each slide plays its animation once, and is logged once, the first time it's reached.
    useEffect(() => {
        if (!viewed.current.has(index)) {
            viewed.current.add(index);
            track(AnalyticsEvent.WELCOME_INTRO_SLIDE_VIEWED, { slide_number: index + 1 });
        }
        if (index > 0) {
            AccessibilityInfo.announceForAccessibility(
                t('welcomeIntro.slideOf', { current: index + 1, total: SLIDES.length }),
            );
        }
        const timer = setTimeout(
            () => setRevealed(current => (current.has(index) ? current : new Set(current).add(index))),
            index === 0 ? FIRST_REVEAL_DELAY_MS : REVEAL_DELAY_MS,
        );
        return () => clearTimeout(timer);
    }, [index, t]);

    // Keep the current slide in place if the window resizes (rotation, foldables).
    useEffect(() => {
        translateX.value = -indexRef.current * width;
    }, [translateX, width]);

    useEffect(() => {
        buttonWidth.value = animate(isLast ? width - 32 : BUTTON_SIZE, { duration: 500, easing: EASE_OUT });
    }, [animate, buttonWidth, isLast, width]);

    // Android's back button steps through the slides, and exits the app from the first.
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (indexRef.current === 0) {
                return false;
            }
            goTo(indexRef.current - 1);
            return true;
        });
        return () => subscription.remove();
    }, [goTo]);

    const settleSwipe = useCallback(
        (translation: number, velocity: number) => {
            goTo(resolveSwipe(translation, velocity, indexRef.current, LAST_SLIDE));
        },
        [goTo],
    );

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-12, 12])
                .failOffsetY([-16, 16])
                .onUpdate(event => {
                    const slide = activeSlide.value;
                    const pastEdge =
                        (slide === 0 && event.translationX > 0) ||
                        (slide === LAST_SLIDE && event.translationX < 0);
                    const drag = pastEdge ? event.translationX / 3 : event.translationX;
                    translateX.value = -slide * width + drag;
                })
                .onEnd(event => {
                    runOnJS(settleSwipe)(event.translationX, event.velocityX);
                }),
        [activeSlide, settleSwipe, translateX, width],
    );

    const trackStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));
    const buttonStyle = useAnimatedStyle(() => ({ width: buttonWidth.value }));

    const handleSkip = () => {
        track(AnalyticsEvent.WELCOME_INTRO_SKIPPED, { slide_number: index + 1 });
        goTo(LAST_SLIDE);
    };

    const handleBegin = async () => {
        if (leaving.current) {
            return;
        }
        leaving.current = true;
        track(AnalyticsEvent.WELCOME_INTRO_COMPLETED);
        await markWelcomeIntroSeen();
        navigation.replace('Landing');
    };

    const currentLanguage = SUPPORTED_LANGUAGES.findIndex(item => item.code === language);
    const otherLanguage = SUPPORTED_LANGUAGES[(currentLanguage + 1) % SUPPORTED_LANGUAGES.length];

    const onCarouselLayout = (event: LayoutChangeEvent) => {
        setPageHeight(event.nativeEvent.layout.height);
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                {index === 0 ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('welcomeIntro.changeLanguage', { language: otherLanguage.label })}
                        onPress={() => setLanguage(otherLanguage.code)}
                        style={styles.languageButton}
                    >
                        <Text maxFontSizeMultiplier={1.3} style={styles.languageText}>{otherLanguage.nativeLabel}</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('welcomeIntro.back')}
                        onPress={() => goTo(index - 1)}
                        style={styles.backButton}
                    >
                        <LineIcon name="chevronLeft" size={24} color={INTRO_COLORS.ink} />
                    </Pressable>
                )}
                {!isLast && (
                    <Pressable accessibilityRole="button" onPress={handleSkip} style={styles.skipButton}>
                        <Text maxFontSizeMultiplier={1.3} style={styles.skipText}>{t('welcomeIntro.skip')}</Text>
                    </Pressable>
                )}
            </View>

            <GestureDetector gesture={pan}>
                <View style={styles.carousel} onLayout={onCarouselLayout}>
                    <Animated.View style={[styles.track, { width: width * SLIDES.length }, trackStyle]}>
                        {SLIDES.map((Slide, slideIndex) => {
                            const isActive = slideIndex === index;
                            return (
                                <View
                                    key={slideIndex}
                                    style={[styles.page, { width }]}
                                    accessibilityElementsHidden={!isActive}
                                    importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
                                >
                                    <View style={{ width: ART_WIDTH * scale, height: ART_HEIGHT * scale }}>
                                        <View
                                            style={[
                                                styles.art,
                                                {
                                                    left: (ART_WIDTH * (scale - 1)) / 2,
                                                    top: (ART_HEIGHT * (scale - 1)) / 2,
                                                    transform: [{ scale }],
                                                },
                                            ]}
                                        >
                                            <Slide on={revealed.has(slideIndex)} />
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </Animated.View>
                </View>
            </GestureDetector>

            <View style={[styles.footer, { height: footerHeight }]}>
                {!isLast && (
                    <View style={styles.dots}>
                        {SLIDES.map((_, slideIndex) => (
                            <Pressable
                                key={slideIndex}
                                accessibilityRole="button"
                                accessibilityLabel={t('welcomeIntro.goToSlide', { number: slideIndex + 1 })}
                                accessibilityState={{ selected: slideIndex === index }}
                                onPress={() => goTo(slideIndex)}
                                style={styles.dotButton}
                            >
                                <View style={[styles.dot, slideIndex === index && styles.dotActive]} />
                            </Pressable>
                        ))}
                    </View>
                )}

                <Animated.View style={[styles.primaryButton, buttonStyle]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isLast ? t('welcomeIntro.begin') : t('welcomeIntro.next')}
                        onPress={isLast ? handleBegin : () => goTo(index + 1)}
                        style={styles.primaryPressable}
                    >
                        {isLast && (
                            <Reveal on delay={200} duration={300}>
                                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.primaryText}>
                                    {t('welcomeIntro.begin')}
                                </Text>
                            </Reveal>
                        )}
                        <LineIcon name="arrowRight" size={24} color={INTRO_COLORS.white} weight={2.2} />
                    </Pressable>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: INTRO_COLORS.page,
    },
    header: {
        height: HEADER_HEIGHT,
        paddingLeft: 8,
        paddingRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    languageButton: {
        height: 44,
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    languageText: {
        fontFamily: 'Mukta-SemiBold',
        fontSize: 16,
        color: INTRO_COLORS.purple,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButton: {
        height: 44,
        paddingHorizontal: 14,
        justifyContent: 'center',
        marginLeft: 'auto',
    },
    skipText: {
        fontFamily: 'Mukta-SemiBold',
        fontSize: 16,
        color: INTRO_COLORS.purple,
    },
    carousel: {
        flex: 1,
        overflow: 'hidden',
    },
    track: {
        flex: 1,
        flexDirection: 'row',
    },
    page: {
        alignItems: 'center',
    },
    art: {
        position: 'absolute',
        width: ART_WIDTH,
        height: ART_HEIGHT,
    },
    footer: {
        position: 'relative',
    },
    dots: {
        position: 'absolute',
        left: 10,
        top: FOOTER_TOP,
        height: BUTTON_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dotButton: {
        minWidth: 22,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: INTRO_COLORS.inactiveDot,
    },
    dotActive: {
        width: 22,
        backgroundColor: INTRO_COLORS.purple,
    },
    primaryButton: {
        position: 'absolute',
        right: 16,
        top: FOOTER_TOP,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: INTRO_COLORS.purple,
        overflow: 'hidden',
        boxShadow: '0 10px 24px rgba(104, 20, 219, 0.32)',
    },
    primaryPressable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    primaryText: {
        fontFamily: 'Mukta-SemiBold',
        fontSize: 18,
        color: INTRO_COLORS.white,
    },
});

export default WelcomeIntro;
