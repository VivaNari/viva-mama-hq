import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useLanguage } from '../../context/LanguageContext';
import {
    EASE_POP,
    INTRO_COLORS,
    IntroIconName,
    IntroText,
    LineIcon,
    Reveal,
    SpeechBubble,
    TypedSegment,
    VIVA_AVATAR,
} from './shared';

const TYPING_DELAY_MS = 1150;

const PROMISES: { key: string; icon: IntroIconName; delay: number }[] = [
    { key: 'private', icon: 'lock', delay: 250 },
    { key: 'personalised', icon: 'person', delay: 370 },
    { key: 'nonJudgemental', icon: 'heart', delay: 490 },
];

/** Slide 7: Viva's promise, and the way into the app. */
const PromiseSlide = ({ on }: { on: boolean }) => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const reduced = useReducedMotion();
    const [typing, setTyping] = useState(false);

    useEffect(() => {
        if (!on) {
            return;
        }
        const timer = setTimeout(() => setTyping(true), reduced ? 0 : TYPING_DELAY_MS);
        return () => clearTimeout(timer);
    }, [on, reduced]);

    const bubble = t('welcomeIntro.slide7.bubble');
    const segments = useMemo<TypedSegment[]>(() => [{ text: bubble }], [bubble]);

    return (
        <>
            <Reveal on={on} duration={700} from={{ scale: 0.92 }} style={styles.panel}>
                <Reveal on={on} delay={150} duration={400}>
                    <IntroText accessibilityRole="header" font="heading" size={12} lineHeight={1.33} color={INTRO_COLORS.purple} style={[styles.heading, language !== 'hi' && styles.headingTracking]}>
                        {t('welcomeIntro.slide7.heading').toUpperCase()}
                    </IntroText>
                </Reveal>
                <View style={styles.list}>
                    {PROMISES.map(item => (
                        <Reveal key={item.key} on={on} delay={item.delay} duration={550} from={{ y: 12 }} style={styles.item}>
                            <View style={styles.itemIcon}>
                                <LineIcon name={item.icon} size={22} color={INTRO_COLORS.purple} weight={1.9} />
                            </View>
                            <IntroText font="heading" size={16} lineHeight={1.2} style={styles.itemText}>
                                {t(`welcomeIntro.slide7.${item.key}`)}
                            </IntroText>
                        </Reveal>
                    ))}
                </View>
            </Reveal>

            <Reveal on={on} delay={600} duration={550} easing={EASE_POP} from={{ scale: 0.6 }} style={styles.vivaRing}>
                <View style={styles.vivaFrame}>
                    <Image
                        source={VIVA_AVATAR}
                        style={styles.vivaPhoto}
                        accessible
                        accessibilityLabel={t('welcomeIntro.vivaImageLabel')}
                    />
                </View>
            </Reveal>

            <View style={styles.bubbleRow}>
                <Reveal on={on} delay={1050} duration={600} easing={EASE_POP} from={{ y: 12, scale: 0.6 }}>
                    <SpeechBubble typing={typing} segments={segments} size={24} style={styles.bubble} />
                </Reveal>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    panel: {
        position: 'absolute',
        left: 16,
        top: 8,
        width: 358,
        paddingTop: 16,
        paddingHorizontal: 14,
        paddingBottom: 14,
        borderRadius: 32,
        backgroundColor: INTRO_COLORS.panel,
    },
    heading: {
        marginBottom: 10,
        paddingLeft: 6,
    },
    // Latin only: letter spacing pulls Devanagari conjuncts apart.
    headingTracking: {
        letterSpacing: 0.96,
    },
    list: {
        gap: 8,
    },
    item: {
        minHeight: 64,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: INTRO_COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 6px 18px rgba(31, 20, 51, 0.06)',
    },
    itemIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: INTRO_COLORS.panel,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        flex: 1,
        minWidth: 0,
    },
    vivaRing: {
        position: 'absolute',
        left: 122,
        top: 297,
        width: 146,
        height: 146,
        borderRadius: 73,
        backgroundColor: INTRO_COLORS.purple,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 14px 30px rgba(84, 28, 198, 0.24)',
    },
    vivaFrame: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: INTRO_COLORS.white,
        overflow: 'hidden',
    },
    vivaPhoto: {
        width: 132,
        height: 132,
    },
    bubbleRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 464,
        alignItems: 'center',
    },
    bubble: {
        maxWidth: 310,
        paddingTop: 12,
        paddingHorizontal: 26,
        paddingBottom: 14,
    },
});

export default PromiseSlide;
