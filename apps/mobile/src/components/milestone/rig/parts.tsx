import React, { ReactNode, createContext, useContext } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { SceneClock } from './useSceneClock';

/**
 * The primitives every milestone illustration is drawn from.
 *
 * The whole art style is rounded rectangles, circles and transforms — no images, no SVG
 * paths, no Lottie. That is what lets one scene serve a 150px card thumbnail and a
 * full-width detail view from the same code, render offline, and be scrubbed to any moment.
 */

/** Scenes are authored against a fixed 720x480 stage, as the design artifact was. */
export const STAGE_WIDTH = 720;
export const STAGE_HEIGHT = 480;

interface SceneFrameProps {
    /** Rendered width; the stage scales to it and the height follows the 3:2 stage. */
    width: number;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Scales the authoring stage down to whatever box the caller has.
 *
 * Every coordinate inside a scene is an absolute pixel on the 720x480 stage, exactly as
 * authored. Rescaling each one per call site would make the scenes unreadable and the
 * arithmetic impossible to check against the original; one transform on the parent keeps
 * them literal.
 */
export const SceneFrame: React.FC<SceneFrameProps> = ({ width, children, style }) => {
    const scale = width / STAGE_WIDTH;

    return (
        <View
            style={[
                { width, height: STAGE_HEIGHT * scale, overflow: 'hidden' },
                style,
            ]}
        >
            <View
                style={{
                    width: STAGE_WIDTH,
                    height: STAGE_HEIGHT,
                    transform: [{ scale }],
                    // Without this the stage scales about its centre and drifts out of the
                    // frame; the coordinates are all measured from the top left.
                    transformOrigin: 'top left',
                }}
            >
                {children}
            </View>
        </View>
    );
};

/**
 * A per-scene offset into the shared clock, in seconds.
 *
 * One clock drives every card on screen, which is what keeps six moving thumbnails to a
 * single timing loop. Left alone that also means six babies performing in perfect unison,
 * which looks like a fault rather than a grid. A phase per card fixes it for free: the same
 * clock, read at a different moment.
 *
 * Context rather than a prop so that scenes never have to thread it through every shape they
 * draw. A scene is written as a function of its own time from zero, and stays that way.
 */
export const ScenePhase = createContext(0);

/** A worklet mapping the clock's seconds to a style. */
export type PartAnimator = (t: number) => ViewStyle;

interface PartProps {
    style?: StyleProp<ViewStyle>;
    /** Omit to render the pose frozen at `frozenAt` instead of animating it. */
    clock?: SceneClock;
    animate?: PartAnimator;
    /**
     * The moment to hold when there is no clock, in scene seconds.
     *
     * This is what lets one scene definition serve three call sites: an animated card, an
     * animated detail view, and a still thumbnail frozen at its most legible frame. An
     * animator is an ordinary function as well as a worklet, so freezing means calling it
     * once on the JS thread rather than writing the pose out a second time by hand.
     */
    frozenAt?: number;
    children?: ReactNode;
}

/**
 * One drawn element, optionally driven by the scene clock.
 *
 * Each Part owns its own `useAnimatedStyle`, so a scene reads as a list of shapes with the
 * motion for each sitting next to the shape it moves.
 */
export const Part: React.FC<PartProps> = ({
    style,
    clock,
    animate,
    frozenAt,
    children,
}) => {
    const time = clock?.time;
    const phase = useContext(ScenePhase);
    const duration = clock?.duration ?? 0;

    const animated = useAnimatedStyle(() => {
        if (!animate || !time) return {};

        // Wrapped, because a scene's tweens hold their end value past `duration`; an
        // unwrapped offset would park the last card at the end of the performance forever.
        const shifted = time.value + phase;
        return animate(duration > 0 ? shifted % duration : shifted);
    }, [animate, time, phase, duration]);

    const frozen =
        !time && animate && frozenAt !== undefined ? animate(frozenAt) : undefined;

    return (
        <Animated.View style={[style, frozen, animated]}>{children}</Animated.View>
    );
};

/**
 * A rounded capsule — the artifact's `cap()` helper.
 *
 * Limbs are capsules: a rect whose corner radius is half its height reads as a rounded
 * limb at any length.
 */
export const capsule = (
    left: number,
    top: number,
    width: number,
    height: number,
    background: string,
    rotate = 0,
    extra?: ViewStyle,
): ViewStyle => ({
    position: 'absolute',
    left,
    top,
    width,
    height,
    borderRadius: height / 2,
    backgroundColor: background,
    transform: [{ rotate: `${rotate}deg` }],
    ...extra,
});

/** A circle — heads, hands, eyes, sparkles. */
export const dot = (
    left: number,
    top: number,
    size: number,
    background: string,
    extra?: ViewStyle,
): ViewStyle => ({
    position: 'absolute',
    left,
    top,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: background,
    ...extra,
});

/**
 * A soft asymmetric blob — torsos and cheeks.
 *
 * The artifact writes these as CSS's four-value percentage `border-radius`, which React
 * Native has no equivalent for: its corners are circular, not elliptical, and it takes one
 * radius or four numbers rather than the percentage shorthand. So a blob is approximated
 * with four explicit corner radii. It reads slightly rounder than the original.
 */
export const blob = (
    left: number,
    top: number,
    width: number,
    height: number,
    background: string,
    radii: [number, number, number, number],
    extra?: ViewStyle,
): ViewStyle => ({
    position: 'absolute',
    left,
    top,
    width,
    height,
    borderTopLeftRadius: radii[0],
    borderTopRightRadius: radii[1],
    borderBottomRightRadius: radii[2],
    borderBottomLeftRadius: radii[3],
    backgroundColor: background,
    ...extra,
});

/**
 * The repeating diagonal stripe of the play mat, as a single background.
 *
 * This used to be a stack of rotated bars, because `repeating-linear-gradient` is the CSS the
 * artifact used and React Native implements `linear-gradient` only. But the repeating form is
 * not actually needed: RN 0.81's parser accepts the CSS two-position colour stop
 * (`colour 4% 7%`), which it expands into the same colour at both positions — a hard stop. A
 * run of those is a stripe pattern in one View.
 *
 * It matters because the bars were not cheap. At the mat's own size the stack came to **60
 * Views per scene**, six scenes to a band, and every one of them static decoration that had to
 * be created and laid out before a tab could paint. The pattern below is the same picture for
 * one node.
 *
 * The geometry is carried over rather than re-chosen, so the mat still reads as it did:
 *
 *  - The bars were `band` wide and rotated 45 degrees, and rotation does not change how wide a
 *    bar is across its own axis — so the stripe stays `band`.
 *  - They were set `band * 2` apart along x, which at 45 degrees is a perpendicular spacing of
 *    `band * 2 * cos45`, i.e. `band * sqrt(2)`.
 *
 * What is *not* carried over is the pattern's phase. The old stack happened to start at
 * `x = -height`, which put the first bar's edge wherever that fell; here it starts at the
 * corner. At the size this is drawn the shift is a fraction of a pixel of a texture, and
 * pinning it would mean an offset nobody could ever check.
 */
export const diagonalStripes = (
    width: number,
    height: number,
    colors: [string, string],
    band: number,
): string => {
    /**
     * How far a 45-degree gradient line runs across the box. This is CSS's own definition,
     * `|W*sin0| + |H*cos0|`, and it is what every percentage below is a percentage *of* —
     * positions are measured along the gradient line, not across the box.
     */
    const line = (width + height) * Math.SQRT1_2;

    if (line <= 0 || band <= 0) return `linear-gradient(135deg, ${colors[0]}, ${colors[0]})`;

    const period = (band * Math.SQRT2 * 100) / line;
    const stripe = (band * 100) / line;

    // Counted rather than accumulated: adding `period` repeatedly would drift the last few
    // stripes by whatever the float error had grown to, and stops that fall out of order are
    // not a wrong colour but an undefined gradient.
    const count = Math.ceil(100 / period);
    const stops: string[] = [];

    for (let i = 0; i < count; i++) {
        const at = i * period;
        const edge = Math.min(at + stripe, 100);
        const end = Math.min(at + period, 100);

        stops.push(`${colors[0]} ${at.toFixed(3)}% ${edge.toFixed(3)}%`);
        if (edge < end) stops.push(`${colors[1]} ${edge.toFixed(3)}% ${end.toFixed(3)}%`);
    }

    // 135deg is the gradient line pointing at the bottom-right corner, which puts the bands of
    // constant colour perpendicular to it, running bottom-left to top-right. That is the same
    // lean the rotated bars had.
    return `linear-gradient(135deg, ${stops.join(', ')})`;
};

/**
 * A striped mat.
 *
 * One View. Note there is no `overflow: 'hidden'` any more: it was there to clip 60 rotated
 * children against the caller's rounded corners, which on Android means an offscreen layer per
 * mat. A background is clipped by the border radius without one.
 */
export const Stripes: React.FC<{
    width: number;
    height: number;
    colors: [string, string];
    /** Stripe width in pixels, measured across the stripe. */
    band?: number;
    style?: StyleProp<ViewStyle>;
}> = ({ width, height, colors, band = 12, style }) => (
    <View
        style={[
            {
                width,
                height,
                backgroundColor: colors[1],
                experimental_backgroundImage: diagonalStripes(width, height, colors, band),
            },
            style,
        ]}
    />
);
