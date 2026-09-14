import React from 'react';

import { Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth, type MouthShape } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { clamp, interpolate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { closeUpSkeleton, CLOSE_UNIT } from './closeUp';

/**
 * "Begins to babble (ah, ee, oo) other than when crying" (4-6 months).
 *
 * The card names three vowels, and they are named because they are three *mouth shapes*: open
 * and round, wide and flat, small and pursed. That is the whole milestone — not that a noise
 * is being made, which a newborn manages, but that the mouth is being shaped deliberately to
 * change it.
 *
 * So this is the opposite scene to the laugh beside it. There the mouth does one thing and
 * the body does the work; here **the body is nearly still and the mouth is the performance**.
 * The head holds level, the shoulders barely move, and the three shapes are each held long
 * enough to be seen as distinct before the next one arrives.
 *
 * The little bubble beside the mouth echoes whatever shape is being made. It is not a speech
 * bubble with words in it — that vocabulary belongs to the milestones about actual words at
 * ten months and three years — it is the vowel itself, drawn, so the thumbnail can say
 * "shaping sounds" rather than merely "mouth open".
 *
 * No letters, here or anywhere: the app ships in English and Hindi, and "ah, ee, oo" written
 * out is wrong in one of them.
 */

export const BABBLES_DURATION = 7.2;

export const BABBLES_CUES = {
    /** Mouth at rest, about to try something. */
    quiet: 0,
    /** "ah" — open and round. */
    ah: 1.2,
    /** "ee" — wide and flat. */
    ee: 3.0,
    /** "oo" — small and pursed. */
    oo: 4.8,
} as const;

/** Mid-"ah": the most open and most obviously deliberate of the three. */
export const BABBLES_STILL = 1.9;

const C = BABBLES_CUES;

/** How far into the babbling run, 0 before it starts and 1 while it is going. */
function voicing(t: number): number {
    'worklet';

    return clamp(
        interpolate(
            t,
            [C.quiet, C.ah - 0.3, C.oo + 1.1, BABBLES_DURATION - 0.5],
            [0, 1, 1, 0],
            'easeInOutSine',
        ),
        0,
        1,
    );
}

/**
 * The mouth, moving through the three vowels.
 *
 * Each shape is *held* — the vowel sits still for most of a second before sliding to the next
 * one. Cross-fading continuously would make one continuous morph, and three shapes nobody can
 * separate is the same as no shapes at all.
 */
function vowel(t: number): MouthShape {
    'worklet';

    const stage = interpolate(
        t,
        [C.ah - 0.25, C.ah, C.ee - 0.25, C.ee, C.oo - 0.25, C.oo, C.oo + 0.9],
        [0, 1, 1, 2, 2, 3, 3],
        'easeInOutSine',
    );

    const voice = voicing(t);

    if (stage <= 1) return blendMouth(MOUTH.rest, MOUTH.ah, stage * voice);
    if (stage <= 2) return blendMouth(MOUTH.ah, MOUTH.ee, stage - 1);
    return blendMouth(MOUTH.ee, MOUTH.oo, clamp(stage - 2, 0, 1));
}

const BabblesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = closeUpSkeleton();
    const frozenAt = still ? BABBLES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const echoAt = vec(
        skeleton.headCentre.x + CLOSE_UNIT * 0.66,
        skeleton.headCentre.y + CLOSE_UNIT * 0.12,
    );

    return (
        <Nursery mat={false}>
            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // Barely anything. Every bit of movement given to the body here is
                    // movement taken away from the mouth, which is the only thing that
                    // separates this card from the one beside it.
                    return 1 + 0.011 * Math.sin(t * 2.5);
                }}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              // A small nod on each new vowel — babies push a little to get
                              // a sound out — and nothing else.
                              return Math.sin(t * 1.1) * 1.8 * voicing(t);
                          }
                        : undefined
                }
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={CLOSE_UNIT}
                    skin={skin}
                    mouthAt={vowel}
                    gaze={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // Looking out at whoever she is doing this at. Babbling at
                                  // 4-6 months is social, which is the other half of "other
                                  // than when crying".
                                  return vec(Math.sin(t * 0.55) * 0.3, 0.1);
                              }
                            : undefined
                    }
                    {...part}
                />
            </Joint>

            {/*
              * The vowel, echoed beside her mouth as a shape.
              *
              * Drawn from the same `vowel()` the mouth uses, so it cannot fall out of step
              * with what is being made — which it would if it had its own timeline.
              */}
            <Part
                {...part}
                style={oval(echoAt, CLOSE_UNIT * 0.2, CLOSE_UNIT * 0.2, SCENE.accent, 0, {
                    opacity: 0,
                })}
                animate={(t) => {
                    'worklet';
                    const shape = vowel(t);
                    const voice = voicing(t);

                    const width = shape.w * CLOSE_UNIT * 1.5;
                    const height = Math.max(shape.h * CLOSE_UNIT * 1.5, 4);

                    return {
                        left: echoAt.x - width / 2,
                        top: echoAt.y - height / 2,
                        width,
                        height,
                        opacity: 0.42 * voice,
                    };
                }}
            />
        </Nursery>
    );
};

export default BabblesScene;
