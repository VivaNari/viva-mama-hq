import React from 'react';
import { View } from 'react-native';

import { HEAD, type HeadProportions } from './anatomy';
import { SCENE, type SkinPalette } from './palette';
import { Part, STAGE_HEIGHT, STAGE_WIDTH } from './parts';
import { ball, oval, vec, type Vec } from './skeleton';
import type { SceneClock } from './useSceneClock';

/**
 * A baby's head, able to turn, look, blink and change its mouth.
 *
 * Three of these milestones are head turns — towards a sound at 4-6 months, following a
 * moving toy at 7-9, towards their own name at 10-12 — and several more are pure face. A
 * head that could only be drawn face-on or in profile, as the previous one was, cannot tell
 * those apart: the difference between them is *how* the turn happens, which needs the turn
 * to be a continuous value rather than a choice between two pictures.
 *
 * So `facing` runs from -1 (full left profile) through 0 (face on) to +1 (full right). The
 * features slide and compress across the skull as it turns, the far eye narrows away and
 * the profile's nose and ear fade in — the ordinary way a flat drawing turns, and enough at
 * this size.
 *
 * ## What each moving prop costs
 *
 * One animated node each, and only if supplied:
 *
 *  - `turnTo` — the whole face plate, sliding and squashing.
 *  - `gaze` and `blink` — both ride the eye group, so together they are one node.
 *  - `mouth` — one node.
 *
 * A head that only needs to nod costs nothing here; the nod belongs to the neck joint above
 * it. That is what keeps the per-thumbnail motion budget something you can count off the
 * markup.
 */

/**
 * How the mouth is shaped at a moment.
 *
 * `curve` is what separates a smile from an open mouth at the same size: at 1 the top edge
 * is flat and only the bottom is round, which is a smile; at 0 it is a full oval, which is
 * a sound coming out.
 */
export interface MouthShape {
    /** Width in head-height multiples. */
    w: number;
    /** Height in head-height multiples. */
    h: number;
    /** 0 = open oval, 1 = flat-topped curve. */
    curve: number;
}

export const MOUTH = {
    rest: { w: 0.17, h: 0.05, curve: 1 },
    smile: { w: 0.26, h: 0.1, curve: 1 },
    bigSmile: { w: 0.32, h: 0.15, curve: 1 },
    /** Laughing, squealing — wide and open. */
    laugh: { w: 0.3, h: 0.22, curve: 0.15 },
    /** The three babble vowels, which are three distinct mouth shapes and nothing else. */
    ah: { w: 0.22, h: 0.22, curve: 0 },
    ee: { w: 0.28, h: 0.09, curve: 0.4 },
    oo: { w: 0.15, h: 0.16, curve: 0 },
} as const satisfies Record<string, MouthShape>;

/**
 * A mouth partway between two shapes. A worklet.
 *
 * Expressions arrive, they do not cut. A social smile that appeared on one frame would read
 * as a glitch rather than as a response — and "in response" is the entire content of
 * milestone 2, so the mouth has to be interpolable rather than a set of discrete poses.
 */
export function blendMouth(from: MouthShape, to: MouthShape, amount: number): MouthShape {
    'worklet';

    const a = amount < 0 ? 0 : amount > 1 ? 1 : amount;

    return {
        w: from.w + (to.w - from.w) * a,
        h: from.h + (to.h - from.h) * a,
        curve: from.curve + (to.curve - from.curve) * a,
    };
}

export interface HeadProps {
    /** Centre of the skull, in stage coordinates. */
    at: Vec;
    /**
     * Whose head this is. Defaults to a baby's.
     *
     * The only difference between a baby and a grown-up here is the landmark table — eyes
     * below the midline under a tall cranium, or on it under a shorter one. Passing
     * `ADULT_HEAD` is what makes a caregiver read as another person rather than a sibling.
     */
    shape?: HeadProportions;
    /** Head height in stage pixels — everything inside scales from it. */
    unit: number;
    skin: SkinPalette;

    /** -1 full left profile, 0 face on, +1 full right profile. */
    facing?: number;
    /** `facing` over time. A worklet. */
    turnTo?: (t: number) => number;

    /** Where the eyes are pointed, as -1..1 in each axis. A worklet, or fixed. */
    gaze?: (t: number) => Vec;
    /** 0 open, 1 shut. A worklet. */
    blink?: (t: number) => number;

    mouth?: MouthShape;
    /** Mouth shape over time. A worklet. Replaces `mouth`. */
    mouthAt?: (t: number) => MouthShape;

    /** Hair is off for a close-up that wants the whole face, on otherwise. */
    hair?: boolean;

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

export const Head: React.FC<HeadProps> = ({
    at,
    shape = HEAD,
    unit,
    skin,
    facing = 0,
    turnTo,
    gaze,
    blink,
    mouth = MOUTH.rest,
    mouthAt,
    hair = true,
    clock,
    frozenAt,
}) => {
    const u = (multiple: number) => multiple * unit;
    const part = { clock, frozenAt };

    const eyeY = at.y + u(shape.eyeLine);
    const eyeDx = u(shape.eyeSpacing) / 2;
    const eyeSize = u(shape.eyeSize);

    const leftEye = vec(at.x - eyeDx, eyeY);
    const rightEye = vec(at.x + eyeDx, eyeY);

    // How far the features travel across the skull at a full profile. Less than it looks
    // like it should be: past about a fifth of the head's width the face slides off the
    // silhouette and the drawing stops being a head.
    const travel = u(shape.skullWidth * 0.2);

    const mouthStyle = (lips: MouthShape) => {
        'worklet';
        const width = lips.w * unit;
        const height = lips.h * unit;
        const top = lips.curve;

        return {
            width,
            height,
            borderTopLeftRadius: (height / 2) * (1 - top),
            borderTopRightRadius: (height / 2) * (1 - top),
            borderBottomLeftRadius: height / 2,
            borderBottomRightRadius: height / 2,
            // Kept centred on the mouth line as it grows, so a smile widening does not
            // walk down the chin.
            transform: [{ translateX: -width / 2 }, { translateY: -height / 2 }],
        };
    };

    return (
        <>
            {/*
              * The profile's own features — the nose in silhouette and the far ear — fade in
              * as the head turns away. Drawn behind the skull so the nose reads as breaking
              * the outline rather than sitting on top of the cheek.
              */}
            <Part
                {...part}
                style={{ ...stage, opacity: Math.abs(facing) }}
                animate={
                    turnTo
                        ? (t) => {
                              'worklet';
                              return { opacity: Math.abs(turnTo(t)) };
                          }
                        : undefined
                }
            >
                <View
                    style={ball(
                        vec(at.x + (facing >= 0 ? 1 : -1) * u(shape.skullWidth * 0.47), at.y + u(shape.noseLine)),
                        u(0.13),
                        skin.skin,
                    )}
                />
            </Part>

            {/* skull — an ellipse, taller than it is wide, widest across the cheeks */}
            <View
                style={oval(at, u(shape.skullWidth), u(shape.skullHeight), skin.skin, 0, {
                    // A soft form shadow down the far side. Without it the head is a flat
                    // disc, which was most of why the old one read as a ball rather than a
                    // head.
                    boxShadow: `inset ${-0.07 * unit}px ${-0.09 * unit}px ${0.16 * unit}px rgba(0,0,0,0.1)`,
                })}
            />

            {/* cheeks, which are what make the widest point of the head sit low */}
            <View
                style={oval(
                    vec(at.x - u(shape.cheekSpread), at.y + u(shape.cheekLine)),
                    u(0.3),
                    u(0.24),
                    skin.skin,
                )}
            />
            <View
                style={oval(
                    vec(at.x + u(shape.cheekSpread), at.y + u(shape.cheekLine)),
                    u(0.3),
                    u(0.24),
                    skin.skin,
                )}
            />

            {/* ears, sitting on the eye line as they actually do */}
            <View
                style={oval(
                    vec(at.x - u(shape.earSpread), at.y + u(shape.earLine)),
                    u(0.14),
                    u(0.19),
                    skin.shade,
                )}
            />
            <View
                style={oval(
                    vec(at.x + u(shape.earSpread), at.y + u(shape.earLine)),
                    u(0.14),
                    u(0.19),
                    skin.shade,
                )}
            />

            {hair && (
                <View
                    style={oval(
                        vec(at.x, at.y + u(shape.crown + 0.24)),
                        u(shape.skullWidth * 1.0),
                        u(0.62),
                        skin.hair,
                        0,
                        {
                            // Only the top corners are round, so the hairline sits across
                            // the forehead instead of curving back up off it.
                            borderBottomLeftRadius: u(0.16),
                            borderBottomRightRadius: u(0.16),
                        },
                    )}
                />
            )}

            {/*
              * The face plate. Everything that reads as "the face" moves together when the
              * head turns: it slides toward the direction of the turn and compresses
              * horizontally, which is how a flat drawing suggests a third dimension.
              */}
            <Part
                {...part}
                style={{
                    ...stage,
                    transformOrigin: [at.x, at.y, 0],
                    transform: [
                        { translateX: facing * travel },
                        { scaleX: 1 - 0.22 * Math.abs(facing) },
                    ],
                }}
                animate={
                    turnTo
                        ? (t) => {
                              'worklet';
                              const f = turnTo(t);
                              return {
                                  transform: [
                                      { translateX: f * travel },
                                      { scaleX: 1 - 0.22 * Math.abs(f) },
                                  ],
                              };
                          }
                        : undefined
                }
            >
                {/* brows — small, high, and the difference between calm and startled */}
                <View
                    style={oval(
                        vec(leftEye.x, at.y + u(shape.browLine)),
                        u(0.15),
                        u(0.035),
                        skin.hair,
                        -6,
                    )}
                />
                <View
                    style={oval(
                        vec(rightEye.x, at.y + u(shape.browLine)),
                        u(0.15),
                        u(0.035),
                        skin.hair,
                        6,
                    )}
                />

                {/* nose — barely there, which is correct for this age */}
                <View
                    style={oval(
                        vec(at.x, at.y + u(shape.noseLine)),
                        u(0.1),
                        u(0.07),
                        skin.shade,
                    )}
                />

                {/*
                  * Eyes. Gaze and blink both ride this one group: gaze slides the pair
                  * within their sockets, blink squashes them shut. Two behaviours, one
                  * animated node.
                  */}
                <Part
                    {...part}
                    style={{ ...stage, transformOrigin: [at.x, eyeY, 0] }}
                    animate={
                        gaze || blink
                            ? (t) => {
                                  'worklet';
                                  const look = gaze ? gaze(t) : { x: 0, y: 0 };
                                  const shut = blink ? blink(t) : 0;

                                  return {
                                      transform: [
                                          { translateX: look.x * eyeSize * 0.34 },
                                          { translateY: look.y * eyeSize * 0.28 },
                                          { scaleY: Math.max(0.04, 1 - shut) },
                                      ],
                                  };
                              }
                            : undefined
                    }
                >
                    <View style={oval(leftEye, eyeSize * 0.86, eyeSize, SCENE.eye)} />
                    <View style={oval(rightEye, eyeSize * 0.86, eyeSize, SCENE.eye)} />

                    {/* catchlights — a small thing that does most of the work of looking alive */}
                    <View
                        style={ball(
                            vec(leftEye.x + eyeSize * 0.2, leftEye.y - eyeSize * 0.22),
                            eyeSize * 0.28,
                            'rgba(255,255,255,0.92)',
                        )}
                    />
                    <View
                        style={ball(
                            vec(rightEye.x + eyeSize * 0.2, rightEye.y - eyeSize * 0.22),
                            eyeSize * 0.28,
                            'rgba(255,255,255,0.92)',
                        )}
                    />
                </Part>

                {/* the flush across the cheeks, above the cheek forms themselves */}
                <View
                    style={oval(
                        vec(at.x - u(shape.cheekSpread), at.y + u(shape.cheekLine)),
                        u(0.2),
                        u(0.12),
                        SCENE.cheek,
                    )}
                />
                <View
                    style={oval(
                        vec(at.x + u(shape.cheekSpread), at.y + u(shape.cheekLine)),
                        u(0.2),
                        u(0.12),
                        SCENE.cheek,
                    )}
                />

                <Part
                    {...part}
                    style={{
                        position: 'absolute',
                        left: at.x,
                        top: at.y + u(shape.mouthLine),
                        backgroundColor: SCENE.mouth,
                        ...mouthStyle(mouth),
                    }}
                    animate={
                        mouthAt
                            ? (t) => {
                                  'worklet';
                                  return mouthStyle(mouthAt(t));
                              }
                            : undefined
                    }
                />
            </Part>
        </>
    );
};

export default Head;
