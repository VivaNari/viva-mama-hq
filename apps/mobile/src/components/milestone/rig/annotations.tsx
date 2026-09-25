import React from 'react';
import { View } from 'react-native';

import { ADULT_HEAD } from './anatomy';
import Head, { MOUTH, type MouthShape } from './Head';
import { clamp } from './motion';
import { SCENE, type SkinPalette } from './palette';
import { Part, STAGE_HEIGHT, STAGE_WIDTH } from './parts';
import { ball, bone, oval, rotateAbout, vec, type Vec } from './skeleton';
import type { SceneClock } from './useSceneClock';

/**
 * The marks that are not anatomy.
 *
 * Roughly half of these milestones have no distinctive posture at all. "Responds to their
 * name", "uses one or two words", "looks for a toy that was hidden", "identifies colours" —
 * a baby doing any of those looks like a baby sitting down. What separates them is not how
 * the body is arranged but what is arriving at it or leaving it, so the drawing needs a
 * second vocabulary: sound coming from somewhere, words going out, somebody else present,
 * attention landing on a particular thing.
 *
 * Two rules hold throughout.
 *
 * **No text, ever.** The app ships English and Hindi, and a scene with letters baked into it
 * is a scene that is wrong in one of them. Speech is drawn as word-shaped blobs, which also
 * happens to be the only way to make "one or two words" and "three words joined together"
 * visibly different things.
 *
 * **Everything is countable.** A bubble with two blobs in it means two words. That is the
 * entire content of milestone 21, and it has to survive being shrunk to a thumbnail.
 */

interface Timing {
    clock?: SceneClock;
    frozenAt?: number;
}

const stage = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
} as const;

/* ------------------------------------------------------------------ sound */

export interface SoundArcsProps extends Timing {
    /** Where the sound comes from. */
    at: Vec;
    /** Which way it travels, in degrees clockwise from stage right. */
    towards?: number;
    /** Radius of the innermost arc. */
    size: number;
    color?: string;
    /**
     * The wavefront's progress, 0 to 1. A worklet.
     *
     * Usually `(t) => (t % period) / period`, so it leaves, fades and leaves again. One
     * animated node drives all three arcs together, which is enough: they are concentric,
     * so scaling the group reads as a single front moving outward.
     */
    pulse?: (t: number) => number;
}

export const SoundArcs: React.FC<SoundArcsProps> = ({
    at,
    towards = 0,
    size,
    color = SCENE.accent,
    pulse,
    clock,
    frozenAt,
}) => {
    // A View with a 50% radius and three transparent borders draws one quarter of a ring,
    // which is the arc. Rotating it aims the sound.
    const arc = (radius: number, width: number, opacity: number) => ({
        position: 'absolute' as const,
        left: at.x - radius,
        top: at.y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%' as const,
        borderWidth: width,
        borderColor: 'transparent',
        borderRightColor: color,
        opacity,
        transform: [{ rotate: `${towards}deg` }],
    });

    return (
        <Part
            clock={clock}
            frozenAt={frozenAt}
            style={{ ...stage, transformOrigin: [at.x, at.y, 0] }}
            animate={
                pulse
                    ? (t) => {
                          'worklet';
                          const p = clamp(pulse(t), 0, 1);
                          return {
                              opacity: Math.sin(p * Math.PI),
                              transform: [{ scale: 0.55 + p * 0.75 }],
                          };
                      }
                    : undefined
            }
        >
            <View style={arc(size, size * 0.17, 0.95)} />
            <View style={arc(size * 1.55, size * 0.15, 0.6)} />
            <View style={arc(size * 2.1, size * 0.13, 0.34)} />
        </Part>
    );
};

/* ------------------------------------------------------------------ speech */

export interface SpeechBubbleProps extends Timing {
    /** The bubble's centre. */
    at: Vec;
    /** Width of the bubble. Height and the blobs inside follow from it. */
    width: number;
    /** How many words it can hold. */
    words: number;
    color?: string;
    blobColor?: string;
    /** Which side the tail points to. */
    tail?: 'left' | 'right';

    /** Scale from nothing to full, 0..1. A worklet. One node. */
    pop?: (t: number) => number;
    /**
     * How many words have been said so far — fractional, so they fade in one at a time.
     * A worklet. One node per word.
     *
     * This is the whole of milestone 21: one blob, then two.
     */
    spoken?: (t: number) => number;
    /**
     * How far the words have merged into a single run, 0 to 1. A worklet.
     *
     * And this is the whole of milestone 33. Three separate words sliding together into one
     * continuous bar is the only way to draw "joins words into a sentence" without writing
     * a sentence.
     */
    join?: (t: number) => number;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
    at,
    width,
    words,
    color = SCENE.windowFill,
    blobColor = SCENE.accent,
    tail = 'left',
    pop,
    spoken,
    join,
    clock,
    frozenAt,
}) => {
    const timing = { clock, frozenAt };

    const height = width * 0.44;
    const padding = width * 0.1;
    const span = width - padding * 2;

    const gap = span * 0.08;
    const wordWidth = (span - gap * (words - 1)) / words;
    /** Merged, the words fill the same span with no gaps between them. */
    const joinedWidth = span / words;

    const left = at.x - width / 2 + padding;
    const barHeight = height * 0.22;
    const barTop = at.y - barHeight / 2;

    return (
        <Part
            {...timing}
            style={{ ...stage, transformOrigin: [at.x, at.y, 0] }}
            animate={
                pop
                    ? (t) => {
                          'worklet';
                          const p = clamp(pop(t), 0, 1);
                          return { opacity: p, transform: [{ scale: 0.7 + 0.3 * p }] };
                      }
                    : undefined
            }
        >
            <View
                style={{
                    position: 'absolute',
                    left: at.x - width / 2,
                    top: at.y - height / 2,
                    width,
                    height,
                    borderRadius: height / 2,
                    backgroundColor: color,
                }}
            />

            {/* the tail, as a small ball rather than a triangle, which React Native has no way to draw */}
            <View
                style={ball(
                    vec(
                        at.x + (tail === 'left' ? -1 : 1) * width * 0.38,
                        at.y + height * 0.52,
                    ),
                    height * 0.26,
                    color,
                )}
            />

            {Array.from({ length: words }, (_, index) => {
                const restLeft = left + index * (wordWidth + gap);
                const joinedLeft = left + index * joinedWidth;

                return (
                    <Part
                        key={index}
                        {...timing}
                        style={{
                            position: 'absolute',
                            left: restLeft,
                            top: barTop,
                            width: wordWidth,
                            height: barHeight,
                            borderRadius: barHeight / 2,
                            backgroundColor: blobColor,
                            opacity: spoken ? 0 : 1,
                        }}
                        animate={
                            spoken || join
                                ? (t) => {
                                      'worklet';
                                      const said = spoken
                                          ? clamp(spoken(t) - index, 0, 1)
                                          : 1;
                                      const merged = join ? clamp(join(t), 0, 1) : 0;

                                      return {
                                          opacity: said,
                                          left:
                                              restLeft + (joinedLeft - restLeft) * merged,
                                          width:
                                              wordWidth +
                                              (joinedWidth - wordWidth) * merged,
                                          // Square the inner edges as they meet, so three
                                          // blobs become one bar rather than a row of
                                          // touching lozenges.
                                          borderRadius: (barHeight / 2) * (1 - merged * 0.85),
                                      };
                                  }
                                : undefined
                        }
                    />
                );
            })}
        </Part>
    );
};

/* --------------------------------------------------------------- attention */

export interface SparklesProps extends Timing {
    at: Vec;
    size: number;
    color?: string;
    /** 0 to 1 and back. A worklet. One node for the whole cluster. */
    pop?: (t: number) => number;
}

/**
 * Delight, or recognition landing.
 *
 * Two crossed ovals per star — React Native cannot draw a concave shape, and a four-pointed
 * twinkle made of a tall thin oval and a wide thin oval is indistinguishable from one at
 * this size.
 */
export const Sparkles: React.FC<SparklesProps> = ({
    at,
    size,
    color = SCENE.accent,
    pop,
    clock,
    frozenAt,
}) => {
    const star = (centre: Vec, scale: number, opacity: number) => (
        <>
            <View style={oval(centre, size * 0.22 * scale, size * scale, color, 0, { opacity })} />
            <View style={oval(centre, size * scale, size * 0.22 * scale, color, 0, { opacity })} />
        </>
    );

    return (
        <Part
            clock={clock}
            frozenAt={frozenAt}
            style={{ ...stage, transformOrigin: [at.x, at.y, 0] }}
            animate={
                pop
                    ? (t) => {
                          'worklet';
                          const p = clamp(pop(t), 0, 1);
                          return {
                              opacity: Math.sin(p * Math.PI),
                              transform: [{ scale: 0.5 + p * 0.7 }, { rotate: `${p * 24}deg` }],
                          };
                      }
                    : undefined
            }
        >
            {star(at, 1, 0.95)}
            {star(vec(at.x + size * 0.85, at.y - size * 0.6), 0.55, 0.8)}
            {star(vec(at.x - size * 0.7, at.y - size * 0.75), 0.4, 0.65)}
        </Part>
    );
};

export interface HighlightRingProps extends Timing {
    at: Vec;
    size: number;
    color?: string;
    /** 0 to 1. A worklet. */
    pulse?: (t: number) => number;
    /**
     * Where the ring is, over time. A worklet.
     *
     * So one ring can serve several targets in turn. Move it during the gaps — while `pulse`
     * has it at zero — and the jump is never seen, which is a whole node cheaper than a ring
     * per target for an identical picture.
     */
    moveTo?: (t: number) => Vec;
}

/** Attention landing on one particular thing — a named body part, a touched block. */
export const HighlightRing: React.FC<HighlightRingProps> = ({
    at,
    size,
    color = SCENE.accent,
    pulse,
    moveTo,
    clock,
    frozenAt,
}) => (
    <Part
        clock={clock}
        frozenAt={frozenAt}
        style={{
            position: 'absolute',
            left: at.x - size / 2,
            top: at.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            borderWidth: size * 0.08,
            borderColor: color,
        }}
        animate={
            pulse || moveTo
                ? (t) => {
                      'worklet';
                      const p = pulse ? clamp(pulse(t), 0, 1) : 1;
                      const where = moveTo ? moveTo(t) : at;

                      return {
                          left: where.x - size / 2,
                          top: where.y - size / 2,
                          // Fades in and out again rather than holding, so there is always a
                          // moment at zero for `moveTo` to jump in.
                          opacity: Math.sin(p * Math.PI),
                          transform: [{ scale: 0.7 + p * 0.5 }],
                      };
                  }
                : undefined
        }
    />
);

/* --------------------------------------------------------------- caregiver */

export type CaregiverGesture =
    /** Palm open, offered. */
    | 'open'
    /** Fingers curled in — "come here". */
    | 'beckon'
    /** Cupped and angled down, coming to lift someone. */
    | 'reach'
    | 'point';

export interface CaregiverHandProps {
    /** The wrist. */
    at: Vec;
    /** The baby's head height, so the hand scales with the scene. */
    unit: number;
    skin: SkinPalette;
    gesture?: CaregiverGesture;
    /** Degrees clockwise from fingers-down. */
    angle?: number;
    /**
     * Where the forearm runs off to, usually a point outside the frame.
     *
     * A hand with no arm reads as a prop rather than as a person, and several of these
     * milestones are specifically about there being another person.
     */
    from?: Vec;
}

/**
 * A grown-up's hand entering the frame.
 *
 * Deliberately not the baby's hand at a larger scale: an adult's fingers are long relative
 * to the palm and a baby's are shorter than it. Getting that wrong makes the caregiver read
 * as a second, enormous baby.
 */
export const CaregiverHand: React.FC<CaregiverHandProps> = ({
    at,
    unit,
    skin,
    gesture = 'open',
    angle = 0,
    from,
}) => {
    const u = (multiple: number) => multiple * unit;
    const p = (x: number, y: number): Vec => rotateAbout(vec(at.x + u(x), at.y + u(y)), at, angle);

    const finger = (key: string, a: [number, number], b: [number, number], w = 0.06) => (
        <View key={key} style={bone(p(a[0], a[1]), p(b[0], b[1]), u(w), skin.skin)} />
    );

    const xs = [-0.09, -0.03, 0.03, 0.09];
    const fingers: React.ReactNode[] = [];

    switch (gesture) {
        case 'beckon':
            // Curled back toward the palm. The hook shape is the gesture.
            xs.forEach((x, i) => fingers.push(finger(`f${i}`, [x, 0.17], [x * 0.55, 0.09])));
            fingers.push(finger('thumb', [-0.15, 0.09], [-0.2, 0.18], 0.07));
            break;
        case 'reach':
            xs.forEach((x, i) =>
                fingers.push(finger(`f${i}`, [x, 0.17], [x * 1.25, 0.33 - Math.abs(x) * 0.5])),
            );
            fingers.push(finger('thumb', [-0.15, 0.08], [-0.24, 0.19], 0.07));
            break;
        case 'point':
            fingers.push(finger('index', [0.0, 0.16], [0.02, 0.42], 0.065));
            xs.slice(0, 3).forEach((x, i) =>
                fingers.push(finger(`t${i}`, [x * 0.7, 0.17], [x * 0.45, 0.25], 0.055)),
            );
            fingers.push(finger('thumb', [-0.14, 0.08], [-0.19, 0.17], 0.07));
            break;
        case 'open':
        default:
            xs.forEach((x, i) =>
                fingers.push(finger(`f${i}`, [x, 0.17], [x * 1.3, 0.39 - Math.abs(x) * 0.35])),
            );
            fingers.push(finger('thumb', [-0.15, 0.07], [-0.27, 0.16], 0.07));
            break;
    }

    return (
        <>
            {from && <View style={bone(from, at, u(0.3), skin.skin)} />}
            {fingers}
            <View style={oval(p(0, 0.1), u(0.26), u(0.3), skin.skin, angle)} />
        </>
    );
};

export interface CaregiverFaceProps extends Timing {
    /** Centre of the head. */
    at: Vec;
    /** The baby's head height; the adult's is drawn larger from it. */
    unit: number;
    skin: SkinPalette;
    facing?: number;
    turnTo?: (t: number) => number;
    gaze?: (t: number) => Vec;
    mouth?: MouthShape;
    mouthAt?: (t: number) => MouthShape;
}

/**
 * The mother's face, leaning into frame.
 *
 * Milestones 1 and 2 are both a response *to her* — recognising the face, and smiling back
 * at it — so she has to be in the picture and has to be unmistakably not another baby. The
 * adult landmark table plus a head about a third larger does that.
 */
export const CaregiverFace: React.FC<CaregiverFaceProps> = ({
    at,
    unit,
    skin,
    mouth = MOUTH.smile,
    ...rest
}) => <Head at={at} unit={unit * 1.34} skin={skin} shape={ADULT_HEAD} mouth={mouth} {...rest} />;
