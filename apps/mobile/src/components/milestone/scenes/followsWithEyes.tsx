import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { interpolate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { Cushion, SITTING_UNIT, sittingSkeleton } from './sitting';

/**
 * "Turns head to visually follow familiar faces or toys" (7-9 months).
 *
 * The second of the catalogue's three head turns, and the one defined by being **smooth**.
 *
 *  - Turning to a sound (item 8, 4-6 months) is a snap: the source is behind or beside them,
 *    unseen, and the head arrives in a third of a second with a startle in it.
 *  - This is the opposite in every respect. The toy is visible the whole time, so there is
 *    nothing to be startled by and nothing to find — the head simply stays with it, at the
 *    speed the toy is moving, for as long as it keeps moving.
 *
 * Smooth pursuit is a real and separate piece of development, and the giveaway that a drawing
 * has got it wrong is any discrete step in the motion. So the head angle here is a **direct
 * function of where the toy is**, not a tween of its own: the toy is the only thing with a
 * timeline, and the eyes and head are read off it. They cannot lag, jump or overshoot, because
 * there is nothing for them to do that independently of.
 */

export const FOLLOWS_DURATION = 8.4;

export const FOLLOWS_CUES = {
    /** The toy comes into view on the left. */
    appears: 0,
    /** Travelling. */
    across: 1.4,
    /** And back the other way. */
    returns: 4.6,
} as const;

/** Mid-sweep, head well round, eyes ahead of it. */
export const FOLLOWS_STILL = 3.0;

const C = FOLLOWS_CUES;

/** Where the toy is, -1 far left to +1 far right. */
function toyAt(t: number): number {
    'worklet';

    return interpolate(
        t,
        [C.appears, C.across, C.returns - 0.5, C.returns + 0.4, FOLLOWS_DURATION - 0.6, FOLLOWS_DURATION],
        [-1, -1, 1, 1, -1, -1],
        'easeInOutSine',
    );
}

/** The arc the toy travels along — up in the middle, so it is a sweep and not a slide. */
const TOY_MID = vec(392, 214);
const TOY_SPAN = 196;
const TOY_LIFT = 46;

const FollowsWithEyesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = sittingSkeleton();
    const frozenAt = still ? FOLLOWS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

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
                    return 1 + 0.013 * Math.sin(t * 2.4);
                }}
                {...part}
            />

            <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" {...part} />
            <Arm skeleton={skeleton} skin={skin} side="right" hand="open" {...part} />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    // Read straight off the toy. No easing of its own, which is what stops
                    // the pursuit developing a step in it.
                    return toyAt(t) * 7;
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={SITTING_UNIT}
                    skin={skin}
                    mouth={MOUTH.rest}
                    turnTo={(t) => {
                        'worklet';
                        return toyAt(t) * 0.82;
                    }}
                    gaze={(t) => {
                        'worklet';
                        // The eyes run slightly ahead of the head, which is what pursuit
                        // actually looks like — you lead with your eyes and the neck catches
                        // up. A sixth of a second is enough to see and not enough to notice.
                        return vec(toyAt(t + 0.16), -0.35);
                    }}
                    {...part}
                />
            </Joint>

            {/*
              * The toy, on its arc. The only thing in the scene with a timeline of its own.
              */}
            <Part
                {...part}
                style={ball(TOY_MID, 52, SCENE.toyLilac)}
                animate={(t) => {
                    'worklet';
                    const x = toyAt(t);
                    return {
                        transform: [
                            { translateX: x * TOY_SPAN },
                            // Highest in the middle of the sweep.
                            { translateY: -TOY_LIFT * (1 - x * x) },
                            { rotate: `${x * 40}deg` },
                        ],
                    };
                }}
            >
                {rich && <View style={ball(vec(26, 26), 20, SCENE.toyPink)} />}
            </Part>
        </Nursery>
    );
};

export default FollowsWithEyesScene;
