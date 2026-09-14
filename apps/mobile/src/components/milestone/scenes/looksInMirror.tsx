import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Likes to look at self in a mirror" (4-6 months).
 *
 * Without a reflection in it this card is a baby sitting near an oval, which is not a
 * milestone. **The reflection is the milestone**, so it is a real second face that moves with
 * the first one.
 *
 * It moves *mirrored*, which is the part worth getting right. When she leans toward the glass
 * her reflection leans back toward her; when her head tilts one way its head tilts the other.
 * That is done by negating the animators rather than by flipping a transform — one sign per
 * value, no wrapper, and it keeps the reflection honest at every frame rather than only at
 * the ones anybody checked.
 *
 * The reflection is drawn inside a clipped oval, so it is genuinely bounded by the mirror.
 * Its coordinates are local to that box, which is why the face inside sits at the box's
 * centre rather than anywhere near the baby's own stage position.
 *
 * At four to six months a baby does not know the reflection is *them* — that comes much
 * later, and the card is careful to say only that they like looking. So there is no moment of
 * recognition here and no sparkle. She is interested, she pats the glass, and that is all the
 * card claims.
 */

export const MIRROR_DURATION = 8.0;

export const MIRROR_CUES = {
    /** Propped up, and there is something over there. */
    notices: 0,
    /** Leaning in for a better look. */
    leans: 1.4,
    /** A hand on the glass. */
    pats: 3.2,
} as const;

/** Leaning in, hand on the glass, the reflection leaning back at her. */
export const MIRROR_STILL = 3.9;

const C = MIRROR_CUES;

/** The mirror, standing on the mat to her right. */
const MIRROR_AT = vec(552, 232);
const MIRROR_W = 182;
const MIRROR_H = 236;

/** How far she has leaned toward it, 0 to 1. */
function leaning(t: number): number {
    'worklet';

    const over = animate(t, { start: C.leans, end: C.leans + 1.3, ease: 'easeInOutSine' });
    const back = animate(t, {
        start: MIRROR_DURATION - 1.9,
        end: MIRROR_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    return clamp(over - back, 0, 1);
}

/** The two pats on the glass, 0 to 1 and back, twice. */
function patting(t: number): number {
    'worklet';

    const first = animate(t, { start: C.pats, end: C.pats + 0.28, ease: 'easeOutQuad' })
        * (1 - animate(t, { start: C.pats + 0.28, end: C.pats + 0.62, ease: 'easeInOutSine' }));
    const second = animate(t, { start: C.pats + 0.8, end: C.pats + 1.06, ease: 'easeOutQuad' })
        * (1 - animate(t, { start: C.pats + 1.06, end: C.pats + 1.5, ease: 'easeInOutSine' }));

    return clamp(first + second, 0, 1);
}

const LooksInMirrorScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? MIRROR_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** Inside the clipped mirror, coordinates start again from its top left. */
    const reflectionAt = vec(MIRROR_W / 2, MIRROR_H * 0.46);
    const reflectionUnit = SITTING_UNIT * 0.74;

    /** The head's tilt, which the reflection takes the negative of. */
    const tilt = (t: number) => {
        'worklet';
        return 7 * leaning(t) + Math.sin(t * 1.4) * 1.6;
    };

    return (
        <Nursery>
            {/* the mirror's stand and frame, behind the glass */}
            <View style={oval(vec(MIRROR_AT.x, MIRROR_AT.y + MIRROR_H * 0.54), 96, 26, SCENE.furniture)} />
            <View
                style={oval(MIRROR_AT, MIRROR_W + 26, MIRROR_H + 26, SCENE.toyLilac)}
            />

            {/*
              * The glass. `overflow: hidden` is what makes the reflection a reflection rather
              * than a second baby floating beside the first.
              */}
            <View
                style={{
                    position: 'absolute',
                    left: MIRROR_AT.x - MIRROR_W / 2,
                    top: MIRROR_AT.y - MIRROR_H / 2,
                    width: MIRROR_W,
                    height: MIRROR_H,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: SCENE.windowFill,
                }}
            >
                <Joint
                    pivot={vec(reflectionAt.x, reflectionAt.y + reflectionUnit * 0.6)}
                    turn={(t) => {
                        'worklet';
                        // Mirrored. The one negation that makes it a reflection.
                        return -tilt(t);
                    }}
                    {...part}
                >
                    <Head
                        at={reflectionAt}
                        unit={reflectionUnit}
                        skin={skin}
                        mouth={MOUTH.smile}
                        gaze={
                            rich
                                ? (t) => {
                                      'worklet';
                                      // Also mirrored: she looks right at the glass, the
                                      // reflection looks left, back out at her.
                                      return vec(-0.5 * leaning(t), 0.1);
                                  }
                                : undefined
                        }
                        {...part}
                    />
                </Joint>
            </View>

            <Cushion skeleton={skeleton} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            {/* everything above the hips leans toward the glass */}
            <Joint
                pivot={skeleton.hipCentre}
                turn={(t) => {
                    'worklet';
                    return 11 * leaning(t);
                }}
                {...part}
            >
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.013 * Math.sin(t * 2.4);
                    }}
                    {...part}
                />

                <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />

                {/* the hand that goes to the glass */}
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    hand="open"
                    root={(t) => {
                        'worklet';
                        // Out toward the mirror, then two taps on top of that.
                        return -38 * leaning(t) - 9 * patting(t);
                    }}
                    joint={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return -14 * leaning(t) - 6 * patting(t);
                              }
                            : undefined
                    }
                    {...part}
                />

                <Joint pivot={skeleton.neckBase} turn={tilt} {...part}>
                    <Head
                        at={skeleton.headCentre}
                        unit={SITTING_UNIT}
                        skin={skin}
                        mouthAt={
                            rich
                                ? (t) => {
                                      'worklet';
                                      return blendMouth(MOUTH.rest, MOUTH.smile, leaning(t));
                                  }
                                : undefined
                        }
                        mouth={MOUTH.smile}
                        gaze={(t) => {
                            'worklet';
                            // On the glass, and staying there. Looking anywhere else would
                            // leave the mirror as scenery.
                            return vec(0.5 + 0.4 * leaning(t), 0.05);
                        }}
                        {...part}
                    />
                </Joint>
            </Joint>
        </Nursery>
    );
};

export default LooksInMirrorScene;
