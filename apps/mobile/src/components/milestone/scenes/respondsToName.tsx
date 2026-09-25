import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { CaregiverFace, SoundArcs } from '../rig/annotations';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Responds to name being called" (7-9 months).
 *
 * The last of the three head turns, and the one that is not really about the head at all.
 *
 *  - Turning to a sound (item 8) is a reflex — a noise arrives and the head goes to it.
 *  - Following a toy (item 15) is tracking — smooth, continuous, nothing to decide.
 *  - **This one requires letting go of something.** The baby is busy. A sound arrives, is
 *    ignored for a moment, and *then* they disengage from what they were doing and turn to
 *    find the person who said their name.
 *
 * Three things carry that and none of them is the turn itself:
 *
 * 1. **They start facing away**, absorbed in a toy. Turning *from* something is what makes the
 *    turn cost anything.
 * 2. **The first call is ignored.** The arcs arrive, and nothing happens. It takes a second
 *    one. That is not a baby being slow — it is the difference between hearing a noise and
 *    recognising a word, which is the entire milestone.
 * 3. **A person is there at the end of it.** A name has a speaker. Sound arcs alone would make
 *    this item 8 again, so the face arrives with the second call and the gaze lands on it.
 *
 * The turn is also slower than item 8's snap, and a smile arrives with it. Recognising your
 * own name is a pleasure, not a startle.
 */

export const RESPONDS_TO_NAME_DURATION = 9.4;

export const RESPONDS_TO_NAME_CUES = {
    /** Turned away, playing. */
    busy: 0,
    /** Called once. Nothing. */
    firstCall: 1.8,
    /** Called again. */
    secondCall: 3.4,
    /** Looks round, and finds her. */
    turns: 3.9,
} as const;

/** Round over the shoulder, eyes on the caller, smile arriving. */
export const RESPONDS_TO_NAME_STILL = 5.2;

const C = RESPONDS_TO_NAME_CUES;

/** The caller, at the left edge. */
const CALLER_AT = vec(112, 186);
const SOUND_AT = vec(96, 246);

/** The toy the baby is busy with, off to the right. */
const TOY_AT = vec(498, 330);

/** How far round they have turned, 0 away to 1 facing the caller. */
function turned(t: number): number {
    'worklet';

    // Slower than a startle — 0.62s against item 8's 0.34 — and no overshoot, because this
    // is a decision rather than a reflex.
    const round = animate(t, { start: C.turns, end: C.turns + 0.62, ease: 'easeInOutCubic' });
    const back = animate(t, {
        start: RESPONDS_TO_NAME_DURATION - 1.6,
        end: RESPONDS_TO_NAME_DURATION - 0.2,
        ease: 'easeInOutSine',
    });

    return clamp(round - back, 0, 1);
}

/** The two calls. The first one goes unanswered. */
function calling(t: number): number {
    'worklet';

    const first = animate(t, { start: C.firstCall, end: C.firstCall + 1.0, ease: 'linear' });
    const second = animate(t, { start: C.secondCall, end: C.secondCall + 1.0, ease: 'linear' });

    return first < 1 ? first : second;
}

const RespondsToNameScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? RESPONDS_TO_NAME_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <Cushion skeleton={skeleton} />

            {/* the toy they are busy with — the thing that has to be given up */}
            <View style={ball(TOY_AT, 54, SCENE.toyPink)} />
            <View style={ball(vec(TOY_AT.x - 7, TOY_AT.y - 9), 22, SCENE.toyLilac)} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

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
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={
                    rich
                        ? (t) => {
                              'worklet';
                              // The hand that was on the toy lets go and comes back as they
                              // turn. Disengaging is the milestone; the hand should show it
                              // as well as the head.
                              return -22 * (1 - turned(t));
                          }
                        : undefined
                }
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    const round = turned(t);
                    // Starts tilted toward the toy, ends tilted toward the caller.
                    return 9 - 17 * round;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={SITTING_UNIT}
                    skin={skin}
                    turnTo={(t) => {
                        'worklet';
                        // From facing the toy on the right, round to the caller on the left.
                        return 0.72 - 1.62 * turned(t);
                    }}
                    gaze={(t) => {
                        'worklet';
                        const round = turned(t);
                        return vec(0.85 - 1.75 * round, 0.4 - 0.55 * round);
                    }}
                    mouthAt={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // Pleased to be called. This is the beat that separates it
                                  // from a startle.
                                  return blendMouth(MOUTH.rest, MOUTH.smile, turned(t));
                              }
                            : undefined
                    }
                    mouth={MOUTH.rest}
                    {...part}
                />
            </Joint>

            {/*
              * The caller, arriving with the second call. A name needs somebody to say it —
              * without a person this card is "turns towards a sound" all over again.
              */}
            <Joint
                pivot={CALLER_AT}
                shift={(t) => {
                    'worklet';
                    const here = animate(t, {
                        start: C.secondCall - 0.3,
                        end: C.secondCall + 0.6,
                        ease: 'easeOutCubic',
                    });
                    return vec(-190 * (1 - here), 0);
                }}
                {...part}
            >
                <CaregiverFace
                    at={CALLER_AT}
                    unit={SITTING_UNIT * 0.86}
                    skin={skin}
                    facing={0.5}
                    mouth={MOUTH.smile}
                />
            </Joint>

            <SoundArcs at={SOUND_AT} towards={0} size={42} pulse={calling} {...part} />
        </Nursery>
    );
};

export default RespondsToNameScene;
