import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, solve, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Attempts to reach and grasp an object" (4-6 months).
 *
 * The word the card chose is **attempts**, and it is not padding. At four months reaching is
 * new and badly calibrated: the arm goes out, lands somewhere near the toy, comes back, and
 * goes again. A scene where the hand travels straight to the object and closes on it is
 * drawing a seven-month-old.
 *
 * So the performance is reach, **miss**, adjust, reach again, and get it. The first attempt
 * falling short is the single most important beat in it.
 *
 * The hand stays open throughout, deliberately. How the fingers close is the content of a
 * *different* milestone — "grasps a toy using all fingers" at 7-9 months — and drawing a
 * proper palmar grip here would blur the two. What says "grasp" here is that the toy starts
 * moving when the hand arrives.
 *
 * ## The toy is attached by kinematics, not by hand
 *
 * Once caught, the toy's position is `solve()`d through the shoulder and elbow — the same
 * arithmetic that positions the arm. It therefore sits in the hand at every frame by
 * construction, including mid-swing. Typing in a path for it that happened to look right
 * would drift the moment any angle in the arm changed, which is exactly the class of bug the
 * jointed rig was built to end.
 */

export const REACHES_DURATION = 8.8;

export const REACHES_CUES = {
    /** Propped, and something across the mat is interesting. */
    sees: 0,
    /** First go. */
    reach: 1.5,
    /** Short. */
    miss: 2.7,
    /** Second go, and this one lands. */
    again: 3.9,
} as const;

/** Hand on the toy, arm extended, toy just starting to move. */
export const REACHES_STILL = 5.1;

const C = REACHES_CUES;

/** Where the toy sits when nobody is holding it — just past the edge of reach. */
const TOY_REST = vec(496, 302);
const TOY_SIZE = 46;

/**
 * How far the arm is extended, 0 at rest to 1 fully out.
 *
 * Three overlapping tweens: out, back (not all the way), out again further. The dip between
 * them is the miss.
 */
function extension(t: number): number {
    'worklet';

    const first = animate(t, { start: C.reach, end: C.reach + 0.75, ease: 'easeOutCubic' });
    const pullBack = animate(t, { start: C.miss, end: C.miss + 0.55, ease: 'easeInOutSine' });
    const second = animate(t, { start: C.again, end: C.again + 0.8, ease: 'easeOutBack' });
    const home = animate(t, {
        start: REACHES_DURATION - 1.6,
        end: REACHES_DURATION - 0.2,
        ease: 'easeInOutSine',
    });

    // The first attempt tops out at 0.72 — near the toy, not on it — drops back to about a
    // quarter, and only the second gets all the way to 1. The three weights have to add up
    // that way or the "second" reach lands no further out than the first did, and the whole
    // point of the scene quietly disappears.
    const reached = clamp(first * 0.72 - pullBack * 0.45 + second * 0.73, 0, 1);
    return reached * (1 - home);
}

/** Whether the toy is in the hand, 0 to 1. */
function holding(t: number): number {
    'worklet';

    const grabbed = animate(t, { start: C.again + 0.7, end: C.again + 0.95, ease: 'easeOutQuad' });
    const released = animate(t, {
        start: REACHES_DURATION - 1.9,
        end: REACHES_DURATION - 1.4,
        ease: 'easeInOutSine',
    });

    return clamp(grabbed - released, 0, 1);
}

const ReachesAndGraspsScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? REACHES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const { shoulderR, elbowR, wristR } = skeleton;

    /** Degrees the shoulder has swung to aim the arm at the toy. */
    const shoulderAngle = (t: number) => {
        'worklet';
        return -44 * extension(t);
    };

    /** And the elbow straightening the rest of the way. */
    const elbowAngle = (t: number) => {
        'worklet';
        return -15 * extension(t);
    };

    return (
        <Nursery>
            <Cushion skeleton={skeleton} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // Leans into the reach. A baby reaching at this age commits their whole
                    // trunk to it, which is also why they are so easy to topple.
                    return 1 + 0.013 * Math.sin(t * 2.4) + 0.012 * extension(t);
                }}
                {...part}
            />

            <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />

            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={shoulderAngle}
                joint={elbowAngle}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              return -9 * extension(t);
                          }
                        : undefined
                }
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={SITTING_UNIT}
                    skin={skin}
                    mouth={MOUTH.rest}
                    gaze={(t) => {
                        'worklet';
                        // On the toy from the first frame and staying there through both
                        // attempts — looking at what you are reaching for is what separates
                        // a reach from a flail, and at this age it is the part that already
                        // works. The eyes do come in as the toy is drawn closer, because
                        // they are tracking the toy rather than pointing at a fixed spot.
                        const held = holding(t);
                        return vec(0.9 - 0.35 * held, 0.35 + 0.25 * held);
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * The toy. Sitting still until the hand reaches it, then carried by the same
              * joint chain that carries the hand.
              */}
            <Part
                {...part}
                style={ball(TOY_REST, TOY_SIZE, SCENE.toyPink)}
                animate={(t) => {
                    'worklet';
                    const held = holding(t);
                    if (held === 0) return {};

                    const hand = solve(wristR, [
                        { pivot: shoulderR, angle: shoulderAngle(t) },
                        { pivot: elbowR, angle: elbowAngle(t) },
                    ]);

                    return {
                        transform: [
                            { translateX: (hand.x - TOY_REST.x) * held },
                            { translateY: (hand.y - TOY_REST.y) * held },
                            // A small wobble while it is being held — it is a rattle, and a
                            // four-month-old does not hold anything steadily.
                            { rotate: `${Math.sin(t * 9) * 7 * held}deg` },
                        ],
                    };
                }}
            >
                <View style={ball(vec(TOY_SIZE / 2, TOY_SIZE / 2), TOY_SIZE * 0.42, SCENE.toyLilac)} />
            </Part>
        </Nursery>
    );
};

export default ReachesAndGraspsScene;
