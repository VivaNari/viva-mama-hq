import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { SKIN } from '../rig/palette';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Keeps head steady when held upright, and can sit with support" (4-6 months).
 *
 * The milestone is not that the head is up — a two-month-old on their tummy already lifts it,
 * and that is the card before this one. It is that the head stays *level while the body
 * moves*. A propped baby sways; head control is what stops the head swaying with it.
 *
 * So this scene is built the opposite way round from every other one here. Everywhere else a
 * joint moves and what hangs below follows. Here the torso deliberately rocks, and the neck
 * **counter-rotates by very nearly the same amount in the opposite direction**, so the head
 * ends up almost stationary in the frame while everything under it travels. That near-
 * cancellation is the entire content of the drawing.
 *
 * It is left deliberately imperfect. The counter-turn is about 88% of the sway with a slow
 * drift on top, so the head corrects late and slightly overshoots — because a four-month-old
 * holds their head steady, not bolted. A perfect cancellation reads as the head being pinned
 * to the background, which looks like a rendering fault rather than a skill.
 */

export const HEAD_STEADY_DURATION = 7.8;

export const HEAD_STEADY_CUES = {
    /** Propped upright, settled. */
    propped: 0,
    /** The body starts to rock. */
    sway: 1.4,
    /** And the head stays where it is. */
    steady: 3.6,
} as const;

/** Mid-sway: the body well off vertical, the head still level. */
export const HEAD_STEADY_STILL = 4.4;

const C = HEAD_STEADY_CUES;

/**
 * How far the torso has rocked, in degrees.
 *
 * Two frequencies, because a single sine is a metronome and a propped baby is not. Ramps in
 * rather than starting at full amplitude, so the still opening frame reads as settled.
 */
function sway(t: number): number {
    'worklet';

    const started = t < C.sway ? 0 : Math.min(1, (t - C.sway) / 1.2);
    return (Math.sin(t * 1.15) * 7.5 + Math.sin(t * 1.9 + 0.8) * 3.2) * started;
}

const HeadSteadyScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? HEAD_STEADY_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    return (
        <Nursery>
            <Cushion skeleton={skeleton} />

            {/* legs, outside the sway — they are folded on the floor and stay there */}
            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            {/*
              * Everything above the hips rocks as one. The pivot is the hips rather than the
              * waist because a supported baby tips from where they are propped.
              */}
            <Joint pivot={skeleton.hipCentre} turn={sway} {...part}>
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.013 * Math.sin(t * 2.4);
                    }}
                    {...part}
                />

                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    hand="open"
                    root={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // The arms lag behind the sway, which is what weight does.
                                  return sway(t - 0.18) * 0.45;
                              }
                            : undefined
                    }
                    {...part}
                />
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    hand="open"
                    root={(t) => {
                        'worklet';
                        return sway(t - 0.18) * 0.45;
                    }}
                    {...part}
                />

                {/*
                  * The counter-turn. Everything above is moving; this takes almost all of it
                  * back out again, and the head arrives at level.
                  */}
                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        // 0.88 rather than 1.0, and delayed a tenth of a second: the
                        // correction is real work being done slightly late, not a rigid
                        // lock. The small residual sine is the tremor of holding it.
                        return -sway(t - 0.1) * 0.88 + Math.sin(t * 4.6) * 0.8;
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={SITTING_UNIT}
                        skin={skin}
                        mouth={MOUTH.rest}
                        gaze={
                            rich
                                ? (t) => {
                                      'worklet';
                                      // Eyes hold the horizon while the body moves under
                                      // them — the same idea as the neck, one level further
                                      // in, and the thing that sells it as deliberate.
                                      return {
                                          x: -sway(t) * 0.035,
                                          y: Math.sin(t * 0.7) * 0.2,
                                      };
                                  }
                                : undefined
                        }
                        {...part}
                    />
                </Joint>
            </Joint>
        </Nursery>
    );
};

export default HeadSteadyScene;
