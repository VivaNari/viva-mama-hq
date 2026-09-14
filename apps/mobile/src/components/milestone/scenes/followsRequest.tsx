import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { CaregiverHand, SoundArcs } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { FREE_UNIT, freeSittingSkeleton } from './sittingFree';

/**
 * "Responds to simple requests like 'no', 'come here'" (10-12 months).
 *
 * The card's first comprehension milestone. Everything before it is response to *sound* — a
 * noise at four months, a name at seven. This one is response to **meaning**: the words carry
 * an instruction, and the baby does what it says.
 *
 * That cannot be drawn by having them look up. Looking up is item 17 and it is already spoken
 * for. What separates comprehension from attention is that **something is then done about
 * it**, so the shape of this scene is:
 *
 *   *asked* → **pause** → *complied*
 *
 * The pause carries the whole thing. Without it, a baby who happens to move toward somebody
 * at the same moment they are called is indistinguishable from a baby who understood — and
 * the whole point of the card is telling those two apart. Half a second of visible hesitation
 * is the difference between coincidence and comprehension.
 *
 * The adult beckons rather than reaching. A reaching hand is an offer to be lifted, which is
 * item 19; a beckoning hand is a request that has to be answered by the baby's own movement,
 * which is this.
 */

export const FOLLOWS_REQUEST_DURATION = 8.6;

export const FOLLOWS_REQUEST_CUES = {
    /** Sitting, occupied with nothing in particular. */
    settled: 0,
    /** "Come here" — words and a gesture. */
    asked: 1.6,
    /** A beat. Nothing yet. */
    thinks: 2.6,
    /** And they come. */
    comes: 3.3,
} as const;

/** Mid-move: leaning toward the beckoning hand, the request just behind them. */
export const FOLLOWS_REQUEST_STILL = 4.4;

const C = FOLLOWS_REQUEST_CUES;

const HAND_AT = vec(604, 264);
const SOUND_AT = vec(650, 168);

/** How far the asking has got: the gesture and the words together, 0 to 1. */
function asked(t: number): number {
    'worklet';

    const inn = animate(t, { start: C.asked, end: C.asked + 0.5, ease: 'easeOutCubic' });
    const out = animate(t, {
        start: FOLLOWS_REQUEST_DURATION - 1.4,
        end: FOLLOWS_REQUEST_DURATION - 0.4,
        ease: 'easeInOutSine',
    });

    return clamp(inn - out, 0, 1);
}

/**
 * How far they have come, 0 where they were to 1 arrived.
 *
 * Starts at `comes`, which is 0.7s after the request and 1.7s after the gesture began. That
 * gap is deliberate and load-bearing; see the note above.
 */
function complying(t: number): number {
    'worklet';

    const go = animate(t, { start: C.comes, end: C.comes + 1.5, ease: 'easeInOutCubic' });
    const back = animate(t, {
        start: FOLLOWS_REQUEST_DURATION - 1.8,
        end: FOLLOWS_REQUEST_DURATION - 0.2,
        ease: 'easeInOutSine',
    });

    return clamp(go - back, 0, 1);
}

const FollowsRequestScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = freeSittingSkeleton();
    const frozenAt = still ? FOLLOWS_REQUEST_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <ContactShadow left={208} top={394} width={252} height={34} />

            {/*
              * The whole baby travels toward the hand. Moving the body rather than only
              * leaning is what makes it compliance — a lean is interest, going is obedience.
              */}
            <Joint
                pivot={skeleton.hipCentre}
                shift={(t) => {
                    'worklet';
                    const go = complying(t);
                    // Forward and a little down the frame, and bobbing as they shuffle.
                    return vec(118 * go, 10 * go + Math.sin(t * 7) * 2.5 * go);
                }}
                turn={(t) => {
                    'worklet';
                    return 9 * complying(t);
                }}
                {...part}
            >
                <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
                <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.012 * Math.sin(t * 2.4);
                    }}
                    {...part}
                />

                <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    hand="open"
                    root={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // The near arm comes forward to take the weight as they
                                  // shuffle across.
                                  return -30 * complying(t);
                              }
                            : undefined
                    }
                    {...part}
                />

                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        return 5 * asked(t) + 4 * complying(t);
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={FREE_UNIT}
                        skin={skin}
                        turnTo={(t) => {
                            'worklet';
                            // Round to the person the moment they are asked — that part is
                            // attention, and it is not yet the milestone.
                            return 0.72 * asked(t);
                        }}
                        gaze={(t) => {
                            'worklet';
                            return vec(0.9 * asked(t), 0.1);
                        }}
                        mouthAt={
                            rich
                                ? (t) => {
                                      'worklet';
                                      return blendMouth(MOUTH.rest, MOUTH.smile, complying(t));
                                  }
                                : undefined
                        }
                        mouth={MOUTH.rest}
                        {...part}
                    />
                </Joint>
            </Joint>

            {/*
              * The request. A beckon, not a reach — a reaching hand offers a lift, which is
              * the card before this one; a beckoning hand asks for something to be done.
              */}
            <Joint
                pivot={HAND_AT}
                turn={(t) => {
                    'worklet';
                    // The curl repeats while the request stands, and stops once it is
                    // answered. A gesture that carried on after the baby arrived would look
                    // like it had not worked.
                    return Math.sin(t * 5.5) * 9 * asked(t) * (1 - complying(t));
                }}
                {...part}
            >
                <CaregiverHand
                    at={HAND_AT}
                    unit={FREE_UNIT}
                    skin={skin}
                    gesture="beckon"
                    angle={-28}
                    from={vec(760, 372)}
                />
            </Joint>

            <SoundArcs
                at={SOUND_AT}
                towards={180}
                size={34}
                pulse={(t) => {
                    'worklet';
                    if (asked(t) === 0) return 0;
                    return clamp((t - C.asked) / 1.1, 0, 1);
                }}
                {...part}
            />
        </Nursery>
    );
};

export default FollowsRequestScene;
