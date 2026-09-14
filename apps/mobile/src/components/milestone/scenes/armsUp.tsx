import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { CaregiverHand } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { FREE_UNIT, freeSittingSkeleton } from './sittingFree';

/**
 * "Raises arms to be picked up" (10-12 months).
 *
 * Quietly one of the more interesting milestones on the card. Every other reach in this
 * catalogue is for an **object** — a toy at the edge of reach, a pebble, a cup. This one is
 * not a reach at all. It is a *request*, made with the body, to a person: the first gesture
 * most babies produce that means something rather than gets something.
 *
 * Which settles how it has to be drawn, and how it must not be. Item 9's reach is one arm,
 * angled at a thing, with the eyes on the thing. This is:
 *
 *  - **Both arms**, straight up, symmetrical. Asymmetry would make it look like grabbing.
 *  - **Aimed at nothing** — the hands stop in open air below the adult's, not on them.
 *    Closing the distance would turn a request into a grab and lose the whole point, which is
 *    that the baby is asking and waiting for an answer.
 *  - **Eyes on the face, not the hands.** You look at the person you are asking.
 *  - A small **bounce** on the spot, which is what a baby who wants up actually does.
 *
 * The adult comes down to meet them at the end, because a request that goes unanswered is a
 * sadder card than the MCP card intends.
 */

export const ARMS_UP_DURATION = 7.4;

export const ARMS_UP_CUES = {
    /** Sitting, and somebody is standing over them. */
    sees: 0,
    /** Arms up. */
    asks: 1.5,
    /** And an answer. */
    lifted: 4.0,
} as const;

/** Both arms up, hands open, eyes up, hands not yet met. */
export const ARMS_UP_STILL = 3.0;

const C = ARMS_UP_CUES;

/** Where the adult's hands wait, and how far down they come. */
const HAND_L = vec(224, 96);
const HAND_R = vec(392, 96);

/** How far the arms are raised, 0 down to 1 straight up. */
function asking(t: number): number {
    'worklet';

    const up = animate(t, { start: C.asks, end: C.asks + 0.7, ease: 'easeOutBack' });
    const down = animate(t, {
        start: ARMS_UP_DURATION - 1.4,
        end: ARMS_UP_DURATION - 0.2,
        ease: 'easeInOutSine',
    });

    return clamp(up - down, 0, 1);
}

/** How far the adult has reached down in answer, 0 to 1. */
function answering(t: number): number {
    'worklet';

    const down = animate(t, { start: C.lifted, end: C.lifted + 0.9, ease: 'easeInOutSine' });
    const away = animate(t, {
        start: ARMS_UP_DURATION - 1.2,
        end: ARMS_UP_DURATION - 0.1,
        ease: 'easeInOutSine',
    });

    return clamp(down - away, 0, 1);
}

const ArmsUpScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = freeSittingSkeleton();
    const frozenAt = still ? ARMS_UP_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** The hopeful bounce, which only happens while they are asking. */
    const bounce = (t: number) => {
        'worklet';
        return Math.sin(t * 7.4) * asking(t);
    };

    return (
        <Nursery>
            <ContactShadow left={208} top={394} width={252} height={34} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.012 * Math.sin(t * 2.4) + 0.016 * bounce(t);
                }}
                {...part}
            />

            {/*
              * Both arms, the same angle, straight up. The symmetry is what makes it a
              * request rather than a grab — one arm angled at something is item 9.
              */}
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="left"
                far
                hand="open"
                root={(t) => {
                    'worklet';
                    return 138 * asking(t) + bounce(t) * 3;
                }}
                {...part}
            />
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={(t) => {
                    'worklet';
                    return -138 * asking(t) - bounce(t) * 3;
                }}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              return -6 * asking(t) + bounce(t) * 1.5;
                          }
                        : undefined
                }
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={FREE_UNIT}
                    skin={skin}
                    gaze={(t) => {
                        'worklet';
                        // Up, at the face. Not at the hands — you look at the person you
                        // are asking, and that is the difference between asking and taking.
                        return vec(0.15, -0.9 * asking(t));
                    }}
                    mouthAt={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return blendMouth(MOUTH.rest, MOUTH.smile, asking(t) * 0.8);
                              }
                            : undefined
                    }
                    mouth={MOUTH.smile}
                    {...part}
                />
            </Joint>

            {/*
              * The adult's hands, waiting above and then coming down. Two hands with
              * forearms running off the top of the frame — a pair of hands with no arms
              * would read as props rather than as somebody standing there.
              */}
            <Joint
                pivot={HAND_L}
                shift={(t) => {
                    'worklet';
                    return vec(0, 86 * answering(t));
                }}
                {...part}
            >
                <CaregiverHand
                    at={HAND_L}
                    unit={FREE_UNIT}
                    skin={skin}
                    gesture="reach"
                    angle={-14}
                    from={vec(HAND_L.x - 40, -70)}
                />
            </Joint>
            <Joint
                pivot={HAND_R}
                shift={(t) => {
                    'worklet';
                    return vec(0, 86 * answering(t));
                }}
                {...part}
            >
                <CaregiverHand
                    at={HAND_R}
                    unit={FREE_UNIT}
                    skin={skin}
                    gesture="reach"
                    angle={14}
                    from={vec(HAND_R.x + 40, -70)}
                />
            </Joint>
        </Nursery>
    );
};

export default ArmsUpScene;
