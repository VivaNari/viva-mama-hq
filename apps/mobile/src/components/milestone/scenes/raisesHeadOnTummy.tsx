import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { sideSkeleton } from '../rig/anatomy';
import { animate } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { lerpPoint, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Raises head at times, when on tummy" (2-3 months).
 *
 * A rebuild of the scene this whole rig was first modelled on. The performance is the same
 * one — the cue times and the curves are carried over unchanged, because they were right —
 * but the body underneath it is the jointed one, and that buys the thing the original could
 * not do.
 *
 * **The hands stay planted.** A press-up is not a head tilting; it is a chest driven upward
 * off the mat by the forearms, and what makes that legible is that the hands do not move
 * while everything above them does. On the old rig each limb was an independent capsule, so
 * arms could only be nudged a few degrees before they left the body — the lift had to be
 * mostly neck. Here the arms hang inside the lifting group and counter-rotate against it, so
 * the hands hold their place on the mat and the effort goes where it belongs.
 *
 * The wobble at the top is the other half of it. A two-month-old holds their head up for a
 * moment and it costs them; a head that rose smoothly and stayed level would be a four-month
 * milestone, which is a different card.
 */

export const RAISES_HEAD_DURATION = 9.6;

export const RAISES_HEAD_CUES = {
    /** Face down on the mat, arms out. */
    tummy: 0,
    /** Pushing through the forearms. */
    lift: 2.2,
    /** Up, and working to stay there. */
    hold: 4.8,
    /** Down again — "at times" is in the wording of the card for a reason. */
    rest: 7.6,
} as const;

/** Mid-hold, head at its highest, looking out. */
export const RAISES_HEAD_STILL = 5.6;

const C = RAISES_HEAD_CUES;

/** Head height in stage pixels. */
const UNIT = 106;

/**
 * The phases the whole scene reads from.
 *
 * Recomputed inside each part rather than shared through a derived value: it is a handful of
 * sines, and it keeps every part a pure function of time with no ordering between them —
 * which is what lets a step chip drop the clock anywhere in the run and have the picture
 * simply be correct.
 */
function phases(t: number) {
    'worklet';

    const rise = animate(t, { start: C.lift + 0.25, end: C.lift + 1.55, ease: 'easeOutBack' });
    const fall = animate(t, { start: C.rest + 0.25, end: C.rest + 1.5, ease: 'easeInOutSine' });
    const tuck = animate(t, { start: C.lift - 0.4, end: C.lift + 0.2, ease: 'easeInOutSine' });

    const holding =
        animate(t, { start: C.hold - 0.5, end: C.hold + 0.4, ease: 'easeInOutSine' }) *
        (1 - fall);

    const lift = rise * (1 - fall);

    return {
        lift,
        holding,
        /** The wind-up before the push, which is what makes the lift read as effort. */
        anticipation: tuck * (1 - rise),
        /** The tremor of a head only just being held up. */
        wobble: Math.sin((t - C.hold) * 7.2) * 2.1 * holding,
        /** Idle kicking, bigger while she is working. */
        kick: Math.sin(t * 3.1) * (5 + 3 * lift),
    };
}

const RaisesHeadOnTummyScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sideSkeleton({ headAt: vec(462, 302), unit: UNIT, facing: 1 });
    const frozenAt = still ? RAISES_HEAD_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** The body folds about the low belly, not the neck — that is what makes it a push. */
    const fold = lerpPoint(skeleton.hipCentre, skeleton.neckBase, 0.18);

    /** How far the chest has come off the mat, in degrees. Negative lifts the head end. */
    const chestAngle = (t: number) => {
        'worklet';
        const { lift, anticipation, wobble } = phases(t);
        return -27 * lift + 3.5 * anticipation + wobble * 0.45;
    };

    return (
        <Nursery>
            <ContactShadow left={196} top={368} width={286} height={40} />

            {/*
              * Legs, outside the lifting group. They stay on the mat through the whole
              * performance, which is half of what makes the top half read as rising.
              */}
            <Leg
                skeleton={skeleton}
                skin={skin}
                side="left"
                far
                root={
                    rich
                        ? (t) => {
                              'worklet';
                              return phases(t).kick * 0.5;
                          }
                        : undefined
                }
                {...part}
            />
            <Leg
                skeleton={skeleton}
                skin={skin}
                side="right"
                root={(t) => {
                    'worklet';
                    return phases(t).kick * 0.8;
                }}
                {...part}
            />

            {/* everything from the low belly up, pivoting off the mat as one */}
            <Joint pivot={fold} turn={chestAngle} {...part}>
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        const { lift } = phases(t);
                        // Breathing quickens with the effort, which is a small thing nobody
                        // will notice and everybody would notice the absence of.
                        return 1 + 0.014 * Math.sin(t * (2.4 + 1.6 * lift));
                    }}
                    {...part}
                />

                {/*
                  * The arms counter-rotate against the lift, so the hands stay where they
                  * were planted while the shoulders travel up and back over them. This is
                  * the whole difference between a press-up and a head tilt.
                  */}
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
                                  return -chestAngle(t) * 0.86 + 14 * phases(t).lift;
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
                        const { lift, anticipation } = phases(t);
                        // Tucks in under the chest on the wind-up, then props.
                        return -chestAngle(t) * 0.9 + 16 * lift + 6 * anticipation;
                    }}
                    joint={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return -12 * phases(t).lift;
                              }
                            : undefined
                    }
                    {...part}
                />

                {/* the neck's own lift, on top of the chest's */}
                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        const { lift, anticipation, wobble } = phases(t);
                        return -21 * lift + 7 * anticipation + wobble;
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={UNIT}
                        skin={skin}
                        // Near profile: she is lying side-on to us and looking out ahead.
                        facing={0.82}
                        mouth={MOUTH.rest}
                        gaze={
                            rich
                                ? (t) => {
                                      'worklet';
                                      const { lift } = phases(t);
                                      // Eyes come up from the mat to the room as she rises.
                                      return vec(0.35 * lift, 0.8 - 1.5 * lift);
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

export default RaisesHeadOnTummyScene;
