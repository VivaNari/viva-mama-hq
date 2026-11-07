import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { Path, SvgXml } from 'react-native-svg';
import { useLanguage } from '../../context/LanguageContext';
import { colors } from '../../public/assets/colors';
import { splitGraphemes } from '../../utils/graphemes';

export const INTRO_COLORS = {
    page: '#FDFBFF',
    ink: '#1F1433',
    muted: '#5E5275',
    purple: colors.darkPurple,
    deepPurple: '#541CC6',
    panel: '#F3ECFE',
    tint: '#EDE3FC',
    track: '#E4D8FA',
    softBubble: '#F6F1FD',
    userBubble: '#E7DAFB',
    peach: '#FFEDE3',
    amber: '#F2A33A',
    lilac: '#B794F6',
    white: colors.white,
    inactiveDot: '#DCCFF7',
};

/** The design's fixed slide area. Each slide is drawn at this size and scaled to fit. */
export const ART_WIDTH = 390;
export const ART_HEIGHT = 616;

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);
export const EASE_MORPH = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_LINEAR = Easing.linear;

export const VIVA_AVATAR = require('../../public/assets/images/welcomeIntro/viva_avatar.jpg');

type TimingOptions = {
    delay?: number;
    duration: number;
    easing?: typeof EASE_OUT | typeof EASE_LINEAR;
};

/** Builds animations that land immediately when the OS asks for reduced motion. */
export const useIntroTiming = () => {
    const reduced = useReducedMotion();
    return useCallback(
        (to: number, { delay = 0, duration, easing = EASE_OUT }: TimingOptions) =>
            reduced ? to : withDelay(delay, withTiming(to, { duration, easing })),
        [reduced],
    );
};

export const hiddenFromScreenReader = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
} as const;

type RevealFrom = { x?: number; y?: number; scale?: number; rotate?: number };

interface IRevealProps {
    on: boolean;
    delay?: number;
    duration?: number;
    easing?: TimingOptions['easing'];
    from?: RevealFrom;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

/** Fades content in, optionally sliding, scaling or turning it into place. */
export const Reveal = ({ on, delay = 0, duration = 500, easing = EASE_OUT, from, style, children }: IRevealProps) => {
    const animate = useIntroTiming();
    const progress = useSharedValue(0);
    const { x = 0, y = 0, scale = 1, rotate = 0 } = from ?? {};

    useEffect(() => {
        progress.value = animate(on ? 1 : 0, { delay, duration, easing });
    }, [on, animate, delay, duration, easing, progress]);

    const animatedStyle = useAnimatedStyle(() => {
        const p = progress.value;
        return {
            // Doubled so the fade finishes early, and clamped because a pop overshoots 1.
            opacity: Math.min(1, Math.max(0, p * 2)),
            transform: [
                { translateX: x * (1 - p) },
                { translateY: y * (1 - p) },
                { scale: scale + (1 - scale) * p },
                { rotate: `${rotate * (1 - p)}deg` },
            ],
        };
    });

    return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
};

type IntroFont = 'regular' | 'semibold' | 'bold' | 'heading' | 'script';

const FONT_FAMILY: Record<IntroFont, string> = {
    regular: 'Mukta-Regular',
    semibold: 'Mukta-SemiBold',
    bold: 'Mukta-Bold',
    heading: 'Quicksand-Bold',
    script: 'Kalam-Bold',
};

/** Devanagari matras sit above and below the line and clip at the design's tight Latin spacing. */
const DEVANAGARI_MIN_LINE_HEIGHT = 1.4;

interface IIntroTextProps extends TextProps {
    font?: IntroFont;
    size: number;
    lineHeight?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
}

/**
 * Text drawn inside a fixed artboard. Quicksand has no Devanagari, so Hindi headings use
 * Mukta. System font scaling is off because the whole artboard already scales to fit the
 * screen, and larger text would overflow its fixed-size mock-ups.
 */
export const IntroText = ({
    font = 'regular',
    size,
    lineHeight = 1.3,
    color = INTRO_COLORS.ink,
    style,
    ...rest
}: IIntroTextProps) => {
    const { language } = useLanguage();
    const isDevanagari = language === 'hi';
    const family = isDevanagari && font === 'heading' ? FONT_FAMILY.bold : FONT_FAMILY[font];
    const leading = isDevanagari ? Math.max(lineHeight, DEVANAGARI_MIN_LINE_HEIGHT) : lineHeight;

    return (
        <Text
            allowFontScaling={false}
            style={[
                {
                    fontFamily: family,
                    fontSize: size,
                    lineHeight: size * leading,
                    color,
                    includeFontPadding: false,
                },
                style,
            ]}
            {...rest}
        />
    );
};

const ICON_BODIES = {
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    pill: '<path d="M10.6 19.4l8.8-8.8a4.4 4.4 0 0 0-6.2-6.2l-8.8 8.8a4.4 4.4 0 0 0 6.2 6.2z"/><path d="M8.3 8.3l7.4 7.4"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8 13.5h2.2l1.4-2.8 1.9 5 1.4-2.2H16"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9z"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
    video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
    chat: '<path d="M20.5 12a8 8 0 0 1-11.6 7.1L3.5 20.5l1.4-5.1A8 8 0 1 1 20.5 12z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7 4.5c2.1 0 3.7 1.2 5 3 1.3-1.8 2.9-3 5-3 3.4 0 5.5 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
};

export type IntroIconName = keyof typeof ICON_BODIES;

interface ILineIconProps {
    name: IntroIconName;
    size: number;
    color: string;
    weight?: number;
    filled?: boolean;
}

export const LineIcon = ({ name, size, color, weight = 2, filled = false }: ILineIconProps) => {
    const paint = filled
        ? `fill="${color}" stroke="none"`
        : `fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"`;
    return (
        <SvgXml
            width={size}
            height={size}
            xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${paint}>${ICON_BODIES[name]}</svg>`}
        />
    );
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface IDrawnStrokeProps {
    d: string;
    stroke: string;
    strokeWidth: number;
    /** The path's length, which the dash needs in order to hide and reveal it. */
    length: number;
    progress: SharedValue<number>;
}

/** A path that draws itself as `progress` runs from 0 to 1. Render inside an Svg. */
export const DrawnStroke = ({ d, stroke, strokeWidth, length, progress }: IDrawnStrokeProps) => {
    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: length * (1 - progress.value),
        // A zero-length dash with round caps still paints a dot, so hide it until it moves.
        strokeOpacity: progress.value > 0.001 ? 1 : 0,
    }));

    return (
        <AnimatedPath
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${length} ${length + 40}`}
            animatedProps={animatedProps}
        />
    );
};

/** The rounded lilac card that holds each slide's illustration. */
export const ArtPanel = ({ on, children }: { on: boolean; children: React.ReactNode }) => (
    <View style={styles.panelPosition} {...hiddenFromScreenReader}>
        <Reveal on={on} duration={700} from={{ scale: 0.92 }} style={styles.panel}>
            {children}
        </Reveal>
    </View>
);

interface ICaptionProps {
    on: boolean;
    title: string;
    body: string;
}

/** Viva's avatar with the slide's headline and supporting line. */
export const Caption = ({ on, title, body }: ICaptionProps) => (
    <Reveal on={on} delay={50} duration={600} from={{ y: 12 }} style={styles.caption}>
        <View style={styles.captionAvatarRing} {...hiddenFromScreenReader}>
            <Image source={VIVA_AVATAR} style={styles.captionAvatar} />
        </View>
        <View style={styles.captionText}>
            <IntroText
                accessibilityRole="header"
                font="heading"
                size={28}
                lineHeight={1.15}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
            >
                {title}
            </IntroText>
            <IntroText
                size={16}
                lineHeight={1.45}
                color={INTRO_COLORS.muted}
                numberOfLines={3}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
            >
                {body}
            </IntroText>
        </View>
    </Reveal>
);

export type TypedSegment = { text: string; accent?: boolean };

interface ITypedTextProps {
    start: boolean;
    segments: TypedSegment[];
    size: number;
    /** Time per letter, in milliseconds. */
    pace?: number;
}

/**
 * Types its text out letter by letter. The untyped remainder stays in place but
 * transparent, so lines never reflow as the text grows. The design's blinking caret is
 * left out: a character in the flow would shift the text with every letter.
 */
const TypedText = ({ start, segments, size, pace = 40 }: ITypedTextProps) => {
    const reduced = useReducedMotion();
    const parts = useMemo(() => segments.map(s => splitGraphemes(s.text)), [segments]);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const [typed, setTyped] = useState(0);
    const finished = useRef(false);

    useEffect(() => {
        if (!start) {
            return;
        }
        // Reduced motion shows it whole; so does a language change after it finished.
        if (reduced || finished.current) {
            finished.current = true;
            setTyped(total);
            return;
        }
        // Clamped for a language change mid-typing, when the new text may be shorter.
        setTyped(current => Math.min(current, total));
        const timer = setInterval(() => {
            setTyped(current => {
                if (current + 1 >= total) {
                    clearInterval(timer);
                    finished.current = true;
                    return total;
                }
                return current + 1;
            });
        }, pace);
        return () => clearInterval(timer);
    }, [start, reduced, total, pace]);

    let remaining = typed;
    const fullText = segments.map(s => s.text).join('');

    return (
        <IntroText
            font="script"
            size={size}
            lineHeight={1.2}
            style={styles.typed}
            accessibilityLabel={fullText}
        >
            {segments.map((segment, index) => {
                const count = Math.max(0, Math.min(parts[index].length, remaining));
                remaining -= count;
                return (
                    <React.Fragment key={index}>
                        <Text style={segment.accent ? styles.accentText : undefined}>
                            {parts[index].slice(0, count).join('')}
                        </Text>
                        <Text style={styles.untyped}>{parts[index].slice(count).join('')}</Text>
                    </React.Fragment>
                );
            })}
        </IntroText>
    );
};

interface ISpeechBubbleProps {
    typing: boolean;
    segments: TypedSegment[];
    size: number;
    style?: StyleProp<ViewStyle>;
}

/** Viva's peach speech bubble, with its tail pointing up at her. */
export const SpeechBubble = ({ typing, segments, size, style }: ISpeechBubbleProps) => (
    <View style={[styles.bubble, style]}>
        <View style={styles.bubbleTail} />
        <TypedText start={typing} segments={segments} size={size} />
    </View>
);

const styles = StyleSheet.create({
    panelPosition: {
        position: 'absolute',
        left: 16,
        top: 8,
        width: 358,
        height: 432,
    },
    panel: {
        flex: 1,
        borderRadius: 32,
        backgroundColor: INTRO_COLORS.panel,
        overflow: 'hidden',
    },
    caption: {
        position: 'absolute',
        left: 16,
        right: 16,
        top: 456,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    captionAvatarRing: {
        width: 50,
        height: 50,
        marginTop: 2,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: INTRO_COLORS.white,
        boxShadow: '0 4px 12px rgba(31, 20, 51, 0.12)',
    },
    captionAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    captionText: {
        flex: 1,
        minWidth: 0,
        gap: 8,
    },
    bubble: {
        borderRadius: 24,
        backgroundColor: INTRO_COLORS.peach,
        boxShadow: '0 10px 28px rgba(31, 20, 51, 0.10)',
    },
    bubbleTail: {
        position: 'absolute',
        top: -7,
        left: '50%',
        width: 16,
        height: 16,
        marginLeft: -8,
        borderRadius: 3,
        backgroundColor: INTRO_COLORS.peach,
        transform: [{ rotate: '45deg' }],
    },
    typed: {
        textAlign: 'center',
    },
    accentText: {
        color: INTRO_COLORS.purple,
    },
    untyped: {
        color: 'transparent',
    },
});
