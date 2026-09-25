import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, blobShape, solve, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Looks for toys that have been hidden in front of them" (7-9 months).
 *
 * This is object permanence, and it is a milestone about what a baby *believes* rather than
 * what they can do with their body. Before it, a covered toy has stopped existing and the
 * baby looks away. After it, the toy is understood to still be there, under that cloth, and
 * they go and get it.
 *
 * The only way to draw a belief is to draw the gap it fills. So the beat that matters here is
 * **the pause**: the cloth goes over, and for a second and a half nothing happens except that
 * the baby keeps looking at the spot. That is the whole milestone. Cut it and the scene is a
 * baby pulling a cloth off something, which is a motor skill they had months earlier.
 *
 * The gaze stays locked on the cloth through the pause. It must not wander, because a baby
 * whose eyes drift away during the gap is a baby demonstrating the *opposite* of this card.
 */

export const HIDDEN_TOY_DURATION = 9.2;

export const HIDDEN_TOY_CUES = {
    /** A toy on the mat, being looked at. */
    inView: 0,
    /** A cloth is drawn over it. */
    covered: 1.6,
    /** Nothing happens. The baby keeps looking at the cloth. */
    waits: 2.6,
    /** And then goes for it. */
    reaches: 4.2,
} as const;

/** Mid-pause: toy covered, eyes still on the cloth, hand not yet moving. */
export const HIDDEN_TOY_STILL = 3.4;

const C = HIDDEN_TOY_CUES;

const TOY_AT = vec(494, 330);
const TOY_SIZE = 48;

/** How covered the toy is, 0 to 1. */
function covered(t: number): number {
    'worklet';

    const over = animate(t, { start: C.covered, end: C.covered + 0.55, ease: 'easeInOutSine' });
    const lifted = animate(t, { start: C.reaches + 0.75, end: C.reaches + 1.2, ease: 'easeOutCubic' });
    const backOver = animate(t, {
        start: HIDDEN_TOY_DURATION - 1.1,
        end: HIDDEN_TOY_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    return clamp(over - lifted + backOver, 0, 1);
}

/** How far the arm is out, 0 at rest to 1 on the cloth. */
function reaching(t: number): number {
    'worklet';

    const out = animate(t, { start: C.reaches, end: C.reaches + 0.8, ease: 'easeOutCubic' });
    const home = animate(t, {
        start: HIDDEN_TOY_DURATION - 2.0,
        end: HIDDEN_TOY_DURATION - 0.8,
        ease: 'easeInOutSine',
    });

    return clamp(out - home, 0, 1);
}

const FindsHiddenToyScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? HIDDEN_TOY_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const { shoulderR, elbowR, wristR } = skeleton;

    const shoulderAngle = (t: number) => {
        'worklet';
        return -42 * reaching(t);
    };
    const elbowAngle = (t: number) => {
        'worklet';
        return -16 * reaching(t);
    };

    return (
        <Nursery>
            <Cushion skeleton={skeleton} />

            {/* the toy, always there — it is only ever hidden, never removed */}
            <View style={ball(TOY_AT, TOY_SIZE, SCENE.toyPink)} />
            <View style={ball(vec(TOY_AT.x - 6, TOY_AT.y - 8), TOY_SIZE * 0.4, SCENE.toyLilac)} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.013 * Math.sin(t * 2.4) + 0.011 * reaching(t);
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
                joint={rich ? elbowAngle : undefined}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              return 5 + 4 * reaching(t);
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
                    // A fixed turn, so it is a static style rather than a worklet doing the
                    // same arithmetic sixty times a second to produce the same number.
                    facing={0.42}
                    gaze={(t) => {
                        'worklet';
                        // Locked on the spot, before, during and after the cover. The one
                        // thing this scene must never do is let the eyes wander during the
                        // pause — that would be a baby who thinks the toy has gone, which is
                        // the state this milestone is the end of.
                        //
                        // They do drop a little to follow the cloth down as it lands, and
                        // come back up with it when it is lifted. Tracking the cloth is not
                        // wandering; it is the same belief, still pointed at the same place.
                        return vec(0.95, 0.44 + 0.12 * covered(t));
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * The cloth. Slides over the toy, waits, and is dragged off by the hand — which
              * it follows through the joint chain rather than along a path of its own, so it
              * stays in the fingers however the arm moves.
              */}
            <Part
                {...part}
                style={blobShape(
                    vec(TOY_AT.x, TOY_AT.y - 6),
                    TOY_SIZE * 2.5,
                    TOY_SIZE * 1.9,
                    SCENE.toyLilac,
                    [52, 44, 40, 48],
                    -4,
                )}
                animate={(t) => {
                    'worklet';
                    const on = covered(t);
                    const pull = reaching(t);

                    if (on > 0.99 && pull === 0) return {};

                    // Off to the right when not covering; carried by the hand once grabbed.
                    const hand = solve(wristR, [
                        { pivot: shoulderR, angle: shoulderAngle(t) },
                        { pivot: elbowR, angle: elbowAngle(t) },
                    ]);

                    const parked = vec(TOY_AT.x + 112, TOY_AT.y - 4);
                    const held = 1 - on;

                    return {
                        opacity: 1,
                        transform: [
                            {
                                translateX:
                                    (parked.x - TOY_AT.x) * held * (1 - pull) +
                                    (hand.x - TOY_AT.x) * held * pull,
                            },
                            {
                                translateY:
                                    (parked.y - TOY_AT.y) * held * (1 - pull) +
                                    (hand.y - TOY_AT.y) * held * pull,
                            },
                        ],
                    };
                }}
            />
        </Nursery>
    );
};

export default FindsHiddenToyScene;
