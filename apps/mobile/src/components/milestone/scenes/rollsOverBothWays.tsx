import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { frontSkeleton } from '../rig/anatomy';
import { animate, interpolate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Rolls over in both directions" (7-9 months).
 *
 * The card says **both**, and it means it — rolling one way is an earlier skill, and rolling
 * back again is the one being checked here. So the loop has to show the return trip, which is
 * what the first pass at this scene did not.
 *
 * ## Turning a flat drawing over
 *
 * Nothing here has a third dimension to rotate in, so the roll is carried by squashing the
 * body horizontally through zero and out the other side. At the midpoint the baby is edge-on
 * and nearly invisible, which is exactly what a real roll looks like from above for a tenth
 * of a second; past it, the drawing is mirrored, and mirrored *is* the other side.
 *
 * The face has to go, though. Mirroring a face gives you a face, and a baby on their tummy
 * does not have one pointing at the ceiling — so the face and the back of the head cross-fade
 * through the edge-on moment, when neither is visible anyway and the swap cannot be seen.
 * That cross-fade is the whole illusion; without it the baby flips like a printed card.
 *
 * Seen from above, because that is the only camera where both the start and the end of a roll
 * are legible. From the side, a baby rolling towards you mostly just gets wider.
 */

export const ROLLS_BOTH_WAYS_DURATION = 9.6;

export const ROLLS_BOTH_WAYS_CUES = {
    /** On their back, kicking. */
    onBack: 0,
    /** Over onto the tummy. */
    rollOver: 1.8,
    /** A moment face-down, head up. */
    onTummy: 4.2,
    /** And back again, the other way. */
    rollBack: 5.8,
} as const;

/** Face-down, head lifted — the far end of the journey, and the clearer of the two poses. */
export const ROLLS_BOTH_WAYS_STILL = 4.8;

const C = ROLLS_BOTH_WAYS_CUES;

const UNIT = 94;

/**
 * Where the body is in its roll: 0 on the back, 1 on the tummy, and back to 0.
 *
 * A single number driving everything — the squash, the face, the limb shading — so the
 * drawing cannot get into a state where half of it has rolled and half has not.
 */
function rolled(t: number): number {
    'worklet';

    return interpolate(
        t,
        [C.rollOver, C.rollOver + 1.5, C.onTummy, C.rollBack, C.rollBack + 1.5, ROLLS_BOTH_WAYS_DURATION],
        [0, 1, 1, 1, 0, 0],
        'easeInOutSine',
    );
}

/**
 * The horizontal squash. 1 flat-on, 0 edge-on, -1 flat-on the other way.
 *
 * Never quite reaches zero: a body scaled to exactly nothing vanishes for a frame and reads
 * as a dropped frame rather than as a turn.
 */
function across(t: number): number {
    'worklet';

    const raw = 1 - 2 * rolled(t);
    const sign = raw < 0 ? -1 : 1;

    // Held off zero by magnitude rather than by an equality check, which floating point
    // would almost never satisfy — the body would still pass through nothing.
    return Math.abs(raw) < 0.05 ? sign * 0.05 : raw;
}

const RollsOverBothWaysScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = frontSkeleton({
        headAt: vec(352, 140),
        unit: UNIT,
        armSpread: 30,
        legSpread: 26,
    });
    const frozenAt = still ? ROLLS_BOTH_WAYS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** A kick, bigger just before each roll — that is what starts one. */
    const kick = (beat: number, amplitude: number) => (t: number) => {
        'worklet';
        const wind =
            animate(t, { start: C.rollOver - 0.8, end: C.rollOver, ease: 'easeInOutSine' }) *
            (1 - rolled(t));
        return Math.sin(t * 3.4 + beat) * amplitude * (0.5 + 0.9 * wind);
    };

    return (
        <Nursery mat={false}>
            {/* the blanket they are on, as in the other floor-level scene */}
            <View style={oval(vec(356, 266), 512, 438, SCENE.matStripeB, -5)} />
            <View style={oval(vec(356, 266), 438, 370, SCENE.matInner, -5)} />

            {/*
              * Everything turns together. One joint, pivoting on the spine, squashing
              * through the profile and out the far side.
              */}
            <Joint
                pivot={skeleton.chest}
                flatten={across}
                turn={(t) => {
                    'worklet';
                    // A slight in-plane swing as well. A body that only squashed would read
                    // as being crushed rather than turning.
                    return Math.sin(rolled(t) * Math.PI) * 9;
                }}
                {...part}
            >
                <Leg
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    root={rich ? kick(0, 20) : undefined}
                    {...part}
                />
                <Leg skeleton={skeleton} skin={skin} side="right" root={kick(2.2, -20)} {...part} />

                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.014 * Math.sin(t * 2.5);
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
                                  // The leading arm reaches across the body, which is what
                                  // actually pulls a baby over.
                                  return -34 * Math.sin(rolled(t) * Math.PI);
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
                        return 30 * Math.sin(rolled(t) * Math.PI) + 8;
                    }}
                    {...part}
                />

                {/*
                  * The face, on while they are on their back. Fading out through the
                  * edge-on moment, when there is nothing to see anyway.
                  */}
                <Part
                    {...part}
                    style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                    animate={(t) => {
                        'worklet';
                        return { opacity: 1 - rolled(t) };
                    }}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={UNIT}
                        skin={skin}
                        mouth={MOUTH.smile}
                    />
                </Part>

                {/*
                  * And the back of the head, on while they are face-down. Skull, hair, ears
                  * and nothing else — which is the entire difference, and all it needs to be.
                  */}
                <Part
                    {...part}
                    style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                    animate={(t) => {
                        'worklet';
                        return { opacity: rolled(t) };
                    }}
                >
                    <View style={oval(skeleton.headCentre, UNIT * 0.94, UNIT, skin.skin)} />
                    <View
                        style={oval(
                            vec(skeleton.headCentre.x - UNIT * 0.47, skeleton.headCentre.y + UNIT * 0.08),
                            UNIT * 0.14,
                            UNIT * 0.19,
                            skin.shade,
                        )}
                    />
                    <View
                        style={oval(
                            vec(skeleton.headCentre.x + UNIT * 0.47, skeleton.headCentre.y + UNIT * 0.08),
                            UNIT * 0.14,
                            UNIT * 0.19,
                            skin.shade,
                        )}
                    />
                    <View
                        style={oval(
                            vec(skeleton.headCentre.x, skeleton.headCentre.y - UNIT * 0.06),
                            UNIT * 0.9,
                            UNIT * 0.78,
                            skin.hair,
                        )}
                    />
                </Part>
            </Joint>
        </Nursery>
    );
};

export default RollsOverBothWaysScene;
