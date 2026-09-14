import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { walkSkeleton } from '../rig/anatomy';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Stands and takes several independent steps" (18 months).
 *
 * Two words are doing the work. **Several** — the previous scene for this milestone rose and
 * took a single step, which is a twelve-month skill; four or five in a row is an eighteen-
 * month one, so this is a travelling walk cycle rather than one lurch. And **independent** —
 * nothing is held, nobody is nearby, and the frame is deliberately empty of furniture at
 * hand height so there is nothing they could be using.
 *
 * A walk cannot be drawn from the front: legs swinging forward and back become legs swinging
 * left and right, which is a different movement. So this is the first scene on
 * `walkSkeleton`, side-on, with the near and far limbs separated by shading alone.
 *
 * What makes it read as a *new* walker rather than a small adult is the stance. Feet wide,
 * knees soft, arms up in high guard, and a roll from side to side on each step because the
 * hips are not yet strong enough to hold the pelvis level. Take any of that away and the
 * drawing quietly ages a couple of years.
 */

export const STANDS_WALKS_DURATION = 8.2;

export const STANDS_WALKS_CUES = {
    /** Standing, balanced, nothing held. */
    stands: 0,
    /** The first step. */
    firstStep: 1.5,
    /** And several more. */
    walking: 3.0,
    /** Stopping, still upright. */
    stops: 6.2,
} as const;

/** Mid-stride, one foot clear of the floor, arms up. */
export const STANDS_WALKS_STILL = 4.2;

const C = STANDS_WALKS_CUES;

const UNIT = 108;

/** How much walking is happening, 0 standing still to 1 in full stride. */
function walking(t: number): number {
    'worklet';

    const go = animate(t, { start: C.firstStep, end: C.walking, ease: 'easeInOutSine' });
    const halt = animate(t, { start: C.stops, end: C.stops + 1.1, ease: 'easeInOutSine' });

    return clamp(go - halt, 0, 1);
}

/** The gait's phase. About one step every three-quarters of a second — a toddler's cadence. */
function gait(t: number): number {
    'worklet';
    return (t - C.firstStep) * 8.4;
}

const StandsAndWalksScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = walkSkeleton({ headAt: vec(330, 128), unit: UNIT, facing: 1 });
    const frozenAt = still ? STANDS_WALKS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** One leg's swing. The far leg runs half a cycle behind the near one. */
    const step = (phase: number) => (t: number) => {
        'worklet';
        return Math.sin(gait(t) + phase) * 26 * walking(t);
    };

    /** Knees stay soft and bend through the swing rather than locking. */
    const knee = (phase: number) => (t: number) => {
        'worklet';
        return (14 + Math.sin(gait(t) + phase - 1.2) * 16) * walking(t);
    };

    return (
        <Nursery>
            {/*
              * The floor travelling past, so the walk goes somewhere. Nothing at hand height
              * anywhere in it — the card says *independent*, and a chair back in reach would
              * undercut the whole claim.
              */}
            <Part
                {...part}
                style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                animate={(t) => {
                    'worklet';
                    return { transform: [{ translateX: (-t * 74) % 640 }] };
                }}
            >
                <View style={oval(vec(760, 432), 120, 20, SCENE.skirting)} />
                <View style={oval(vec(1080, 438), 90, 16, SCENE.skirting)} />
                <View style={oval(vec(1400, 430), 130, 22, SCENE.skirting)} />
            </Part>

            {/*
              * The body's rise, fall and roll. A pelvis that stayed level would be an adult
              * walking; a new walker tips over each planted foot in turn.
              */}
            <Joint
                pivot={skeleton.hipCentre}
                shift={(t) => {
                    'worklet';
                    // Two rises per stride — the body is highest as it passes over each
                    // supporting leg.
                    return vec(0, -Math.abs(Math.sin(gait(t))) * 7 * walking(t));
                }}
                turn={(t) => {
                    'worklet';
                    return Math.sin(gait(t)) * 4.5 * walking(t);
                }}
                {...part}
            >
                {/* far side first */}
                <Leg
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    root={step(Math.PI)}
                    joint={rich ? knee(Math.PI) : undefined}
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
                                  // High guard, swinging only a little. New walkers hold
                                  // their arms up and nearly still; a full adult arm swing
                                  // is one of the loudest wrong notes available here.
                                  return Math.sin(gait(t)) * 7 * walking(t);
                              }
                            : undefined
                    }
                    {...part}
                />

                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.012 * Math.sin(t * 2.6);
                    }}
                    {...part}
                />

                <Leg
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    root={step(0)}
                    joint={rich ? knee(0) : undefined}
                    {...part}
                />
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    hand="open"
                    root={(t) => {
                        'worklet';
                        return -Math.sin(gait(t)) * 7 * walking(t);
                    }}
                    {...part}
                />

                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        // The head stays level while the trunk rolls under it — the same
                        // reflex the 4-6 month card is about, now doing a job.
                        return -Math.sin(gait(t)) * 3 * walking(t);
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={UNIT}
                        skin={skin}
                        facing={0.86}
                        mouthAt={
                            rich
                                ? (t) => {
                                      'worklet';
                                      // Walking is thrilling at this age and they know it.
                                      return blendMouth(MOUTH.smile, MOUTH.bigSmile, walking(t));
                                  }
                                : undefined
                        }
                        mouth={MOUTH.smile}
                        {...part}
                    />
                </Joint>
            </Joint>
        </Nursery>
    );
};

export default StandsAndWalksScene;
