import React from 'react';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { frontSkeleton } from '../rig/anatomy';
import { interpolate } from '../rig/motion';
import { SKIN } from '../rig/palette';
import { vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Uses a variety of familiar gestures, like waving and clapping" (18 months).
 *
 * **A variety.** The card is not checking that a child can wave — it is checking that they
 * have a *set* of gestures they use on purpose, which is a different and later thing. So the
 * loop cannot show one gesture, however well drawn. It has to show three, with a clear beat
 * between them, and a viewer has to be able to count them.
 *
 * Wave, clap, namaste. The third is deliberate: this catalogue is the India MCP card, and
 * namaste is as familiar a gesture to the children it describes as the other two. Drawing
 * only the two the English text names would quietly narrow the milestone to the examples
 * rather than the thing being measured.
 *
 * Standing, front-on, at toddler proportions. Front-on because gestures are made *at*
 * somebody: a profile would put the hands edge-on and lose the shapes entirely.
 */

export const GESTURES_DURATION = 10.4;

export const GESTURES_CUES = {
    /** Standing, hands down. */
    still: 0,
    /** Waving. */
    wave: 1.2,
    /** Clapping. */
    clap: 4.2,
    /** Namaste. */
    namaste: 7.2,
} as const;

/** Mid-clap: both hands together in front, unmistakable at any size. */
export const GESTURES_STILL = 5.0;

const C = GESTURES_CUES;

const UNIT = 112;

/**
 * How far into each gesture, 0 to 1, with a gap between them.
 *
 * Three separate ramps rather than one running value. The gap matters as much as the
 * gestures: without a pause where the hands come down, three movements run together into one
 * long arm-waving and the count is lost.
 */
function waving(t: number): number {
    'worklet';
    return interpolate(t, [C.wave - 0.4, C.wave, C.clap - 1.0, C.clap - 0.5], [0, 1, 1, 0], 'easeInOutSine');
}

function clapping(t: number): number {
    'worklet';
    return interpolate(t, [C.clap - 0.4, C.clap, C.namaste - 1.0, C.namaste - 0.5], [0, 1, 1, 0], 'easeInOutSine');
}

function namaste(t: number): number {
    'worklet';
    return interpolate(
        t,
        [C.namaste - 0.4, C.namaste, GESTURES_DURATION - 1.2, GESTURES_DURATION - 0.5],
        [0, 1, 1, 0],
        'easeInOutSine',
    );
}

const GesturesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = frontSkeleton({
        headAt: vec(354, 136),
        unit: UNIT,
        age: 'toddler',
        armSpread: 20,
        legSpread: 12,
    });
    const frozenAt = still ? GESTURES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /**
     * One arm's shoulder angle across all three gestures.
     *
     * `side` is +1 for the arm that should swing outward on a positive angle. The three
     * gestures are summed rather than switched between, which is what lets them overlap
     * cleanly at the edges instead of snapping from one to the next.
     */
    const shoulder = (side: 1 | -1) => (t: number) => {
        'worklet';

        // Waving: the right arm goes up, the left stays down.
        const up = side > 0 ? -104 * waving(t) : 0;
        // Clapping: both arms come in across the body.
        const inward = -side * 62 * clapping(t);
        // Namaste: both arms in and up, hands meeting at the chest.
        const together = -side * 54 * namaste(t);

        return up + inward + together;
    };

    const elbow = (side: 1 | -1) => (t: number) => {
        'worklet';

        // The wave's elbow is bent so the hand is beside the head rather than straight up.
        const waveBend = side > 0 ? -46 * waving(t) : 0;
        const clapBend = -side * 52 * clapping(t);
        // Namaste holds the deepest bend — palms at the chest, forearms nearly vertical.
        const namasteBend = -side * 70 * namaste(t);

        // The clap's in-and-out. Only the hands move; the shoulders hold their place.
        const beat = Math.sin(t * 11) * 12 * clapping(t) * -side;

        return waveBend + clapBend + namasteBend + beat;
    };

    return (
        <Nursery>
            <ContactShadow left={252} top={424} width={210} height={30} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    // A bounce on each clap. Toddlers clap with their whole body.
                    return 1 + 0.012 * Math.sin(t * 2.5) + 0.016 * Math.abs(Math.sin(t * 11)) * clapping(t);
                }}
                {...part}
            />

            <Arm
                skeleton={skeleton}
                skin={skin}
                side="left"
                far
                hand="open"
                root={shoulder(-1)}
                joint={elbow(-1)}
                {...part}
            />
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={shoulder(1)}
                joint={elbow(1)}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              // A tilt into the wave and a small bow with the namaste — the
                              // gestures are addressed to somebody, and the head says so.
                              return -5 * waving(t) + 4 * namaste(t);
                          }
                        : undefined
                }
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={UNIT}
                    skin={skin}
                    mouth={MOUTH.smile}
                    gaze={
                        rich
                            ? (t) => {
                                  'worklet';
                                  // Out at whoever is being greeted, dropping to the hands
                                  // during the clap — which is where a toddler looks.
                                  return vec(0, 0.4 * clapping(t));
                              }
                            : undefined
                    }
                    {...part}
                />
            </Joint>
        </Nursery>
    );
};

export default GesturesScene;
