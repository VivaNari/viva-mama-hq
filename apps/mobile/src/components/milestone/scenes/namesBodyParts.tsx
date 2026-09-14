import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { HighlightRing, SpeechBubble } from '../rig/annotations';
import { HEAD, frontSkeleton } from '../rig/anatomy';
import { clamp, interpolate } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Correctly points out and names one or more body parts" (24 months).
 *
 * Three words in that line are each doing work, and the drawing owes all three.
 *
 * **Correctly** — the part being touched has to be identifiable, which is why a ring pulses
 * on it. A finger somewhere near a head could be anything.
 *
 * **Points out** — the finger goes to the actual part, in turn, and lands on it.
 *
 * **Names** — a word comes with each one. Pointing without naming is a twelve-month skill and
 * has its own card; this needs both together, so the bubble pops as the finger lands.
 *
 * **One or more** is why there are three: nose, ear, head. One could be a coincidence, and
 * the card explicitly allows for more.
 *
 * ## One ring, not three
 *
 * The highlight moves between the three parts rather than three rings taking turns — and it
 * moves *while its own opacity is zero*, in the gap between pulses, so the jump is never
 * seen. One animated node instead of three, for a picture that is identical.
 */

export const BODY_PARTS_DURATION = 9.6;

export const BODY_PARTS_CUES = {
    /** Standing, about to be asked. */
    ready: 0,
    /** Nose. */
    nose: 1.6,
    /** Ear. */
    ear: 4.0,
    /** Head. */
    head: 6.4,
} as const;

/** Finger on the ear, ring lit, word out — the clearest of the three. */
export const BODY_PARTS_STILL = 4.6;

const C = BODY_PARTS_CUES;

const UNIT = 108;
const BUBBLE_AT = vec(540, 118);

/**
 * Which part is being pointed at: 0 nose, 1 ear, 2 head.
 *
 * A stepped value that moves during the gaps, so nothing is mid-transition while anything is
 * visible.
 */
function target(t: number): number {
    'worklet';

    return interpolate(
        t,
        [C.nose, C.ear - 0.5, C.ear, C.head - 0.5, C.head],
        [0, 0, 1, 1, 2],
        'easeInOutSine',
    );
}

/** How lit the current part is, 0 to 1, pulsing once per part. */
function lit(t: number): number {
    'worklet';

    const each = (at: number) =>
        clamp(interpolate(t, [at - 0.15, at + 0.25, at + 1.5, at + 1.8], [0, 1, 1, 0], 'easeOutCubic'), 0, 1);

    return Math.max(each(C.nose), Math.max(each(C.ear), each(C.head)));
}

const NamesBodyPartsScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = frontSkeleton({
        headAt: vec(306, 152),
        unit: UNIT,
        age: 'child',
        armSpread: 20,
        legSpread: 12,
    });
    const frozenAt = still ? BODY_PARTS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const head = skeleton.headCentre;

    /** The three parts, in the order they are named. */
    const NOSE = vec(head.x, head.y + HEAD.noseLine * UNIT);
    const EAR = vec(head.x + HEAD.earSpread * UNIT, head.y + HEAD.earLine * UNIT);
    const CROWN = vec(head.x, head.y + (HEAD.crown + 0.12) * UNIT);

    /** Shoulder and elbow angles that put the fingertip on each part in turn. */
    const shoulder = (t: number) => {
        'worklet';
        return interpolate(target(t), [0, 1, 2], [-118, -104, -132]);
    };
    const elbow = (t: number) => {
        'worklet';
        return interpolate(target(t), [0, 1, 2], [-58, -36, -30]);
    };

    return (
        <Nursery>
            <ContactShadow left={214} top={432} width={188} height={26} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.011 * Math.sin(t * 2.5) + 0.012 * lit(t);
                }}
                {...part}
            />

            <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />

            {/* the pointing arm, travelling between the three parts */}
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="point"
                root={shoulder}
                joint={elbow}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              // A small tilt away from the hand as it arrives, which is what
                              // people do when touching their own face.
                              return -3 * lit(t);
                          }
                        : undefined
                }
                {...part}
            >
                <Head
                    at={head}
                    unit={UNIT}
                    skin={skin}
                    gaze={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // Out at whoever asked, not down at their own hand — this
                                  // is being shown to somebody. They do glance toward the
                                  // part as it is named, which is what makes each one a
                                  // separate answer rather than a recital.
                                  return vec(0.35 + 0.25 * lit(t), -0.1 - 0.2 * lit(t));
                              }
                            : undefined
                    }
                    mouthAt={(t) => {
                        'worklet';
                        return blendMouth(MOUTH.smile, MOUTH.ah, lit(t) * 0.7);
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * One ring for all three parts. It moves between them while invisible, in the
              * gap between pulses, so the jump is never seen — three rings taking turns
              * would cost three nodes and draw exactly the same picture.
              */}
            <HighlightRing
                at={NOSE}
                size={UNIT * 0.4}
                pulse={lit}
                moveTo={(t) => {
                    'worklet';
                    const which = target(t);
                    // Stepped, not blended: the ring is never drawn between two parts,
                    // because `target` only changes while `lit` has it invisible.
                    if (which < 0.5) return NOSE;
                    if (which < 1.5) return EAR;
                    return CROWN;
                }}
                {...part}
            />

            <SpeechBubble
                at={BUBBLE_AT}
                width={172}
                words={1}
                tail="left"
                pop={lit}
                {...part}
            />
        </Nursery>
    );
};

export default NamesBodyPartsScene;
