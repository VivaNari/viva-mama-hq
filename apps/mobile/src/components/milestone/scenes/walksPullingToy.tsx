import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { walkSkeleton } from '../rig/anatomy';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, bone, oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Walks steadily, even while pulling a toy" (24 months).
 *
 * The card is not asking whether they can walk — item 23 covered that six months ago. It is
 * asking whether walking has become **automatic enough to do something else at the same
 * time**. Pulling a toy is the test: it is an uneven, changing load behind you that you
 * cannot see, and staying steady through it means the walking no longer needs attention.
 *
 * So this scene is deliberately built as the *answer* to item 23, and the two should be
 * legibly different side by side:
 *
 * | | 18 months | 24 months |
 * |---|---|---|
 * | arms | high guard, up by the chest | down, one of them holding a string |
 * | stance | wide, feet well apart | narrow |
 * | roll | tips onto each planted foot | barely any |
 * | head | rides the roll | **level** |
 *
 * The head line is the milestone. It is held near-level by counter-rotating the neck against
 * what little roll is left — the same trick as the 4-6 month head-steady card, three cards on
 * and now in service of something else. Any lurch here reads as failure rather than as
 * character, which is why the gait is tuned lower and smoother than the 18-month one.
 *
 * Drawn at `age: 'child'`, so the body is a fifth of a head longer in the leg than the
 * 18-month walker beside it.
 */

export const PULLS_TOY_DURATION = 8.0;

export const PULLS_TOY_CUES = {
    /** Standing, the string already in hand. */
    holds: 0,
    /** Walking, and the toy comes along. */
    walks: 1.2,
    /** Steady, all the way across. */
    steady: 3.4,
} as const;

/** Mid-stride, head level, toy trailing and tilted. */
export const PULLS_TOY_STILL = 4.4;

const C = PULLS_TOY_CUES;

const UNIT = 104;

/** How much walking is happening, 0 to 1. */
function walking(t: number): number {
    'worklet';

    const go = animate(t, { start: C.walks, end: C.walks + 1.0, ease: 'easeInOutSine' });
    const halt = animate(t, {
        start: PULLS_TOY_DURATION - 1.5,
        end: PULLS_TOY_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    return clamp(go - halt, 0, 1);
}

/** The gait. Slower and smoother than the 18-month one — this walk is settled. */
function gait(t: number): number {
    'worklet';
    return (t - C.walks) * 7.0;
}

const WalksPullingToyScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = walkSkeleton({
        headAt: vec(386, 120),
        unit: UNIT,
        age: 'child',
        facing: 1,
    });
    const frozenAt = still ? PULLS_TOY_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** The hand holding the string, and where the toy trails behind it. */
    const handAt = vec(skeleton.wristR.x - 6, skeleton.wristR.y + 10);
    const TOY_AT = vec(176, 396);

    const step = (phase: number) => (t: number) => {
        'worklet';
        return Math.sin(gait(t) + phase) * 24 * walking(t);
    };

    /** What little roll is left, which the neck then takes back out. */
    const roll = (t: number) => {
        'worklet';
        return Math.sin(gait(t)) * 2.4 * walking(t);
    };

    return (
        <Nursery>
            <Part
                {...part}
                style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                animate={(t) => {
                    'worklet';
                    return { transform: [{ translateX: (-t * 68) % 640 }] };
                }}
            >
                <View style={oval(vec(780, 434), 110, 18, SCENE.skirting)} />
                <View style={oval(vec(1120, 440), 84, 15, SCENE.skirting)} />
            </Part>

            {/*
              * The toy, trailing. It lags the walker, wanders a little from side to side and
              * tips on its wheels — an uneven load, which is the point of the test.
              */}
            <Part
                {...part}
                style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                animate={(t) => {
                    'worklet';
                    const go = walking(t);
                    return {
                        transform: [
                            { translateY: -Math.abs(Math.sin(gait(t) - 0.9)) * 4 * go },
                            { rotate: `${Math.sin(gait(t) - 1.2) * 5 * go}deg` },
                        ],
                        transformOrigin: [TOY_AT.x, TOY_AT.y, 0],
                    };
                }}
            >
                <View style={bone(handAt, vec(TOY_AT.x + 44, TOY_AT.y - 16), 5, SCENE.toyLilac)} />
                <View
                    style={oval(TOY_AT, 108, 62, SCENE.toyPink, 0, {
                        borderTopLeftRadius: 22,
                        borderTopRightRadius: 22,
                    })}
                />
                <View style={ball(vec(TOY_AT.x - 30, TOY_AT.y + 30), 30, SCENE.toyLilac)} />
                <View style={ball(vec(TOY_AT.x + 30, TOY_AT.y + 30), 30, SCENE.toyLilac)} />
            </Part>

            <Joint
                pivot={skeleton.hipCentre}
                shift={(t) => {
                    'worklet';
                    // Half the rise of the 18-month walk. Smoother is the whole point.
                    return vec(0, -Math.abs(Math.sin(gait(t))) * 3.5 * walking(t));
                }}
                turn={roll}
                {...part}
            >
                <Leg
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    root={step(Math.PI)}
                    joint={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return (10 + Math.sin(gait(t) + Math.PI - 1.2) * 14) * walking(t);
                              }
                            : undefined
                    }
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
                                  // A real arm swing now, where the 18-month walker's arms
                                  // were locked up by the chest. The free arm swinging is
                                  // itself a sign the walking has stopped being work.
                                  return Math.sin(gait(t)) * 16 * walking(t);
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
                        return 1 + 0.011 * Math.sin(t * 2.6);
                    }}
                    {...part}
                />

                <Leg skeleton={skeleton} skin={skin} side="right" root={step(0)} {...part} />

                {/*
                  * The arm on the string. It does *not* swing — it is holding something, and
                  * that asymmetry between the two arms is what makes the walking read as
                  * happening alongside a second task rather than on its own.
                  */}
                <Arm skeleton={skeleton} skin={skin} side="right" hand="palmar" {...part} />

                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        // The milestone. Whatever the trunk does, the head comes back to
                        // level — a lurch here would read as failure, not as character.
                        return -roll(t) * 0.92;
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={UNIT}
                        skin={skin}
                        facing={0.84}
                        mouth={MOUTH.smile}
                        {...part}
                    />
                </Joint>
            </Joint>
        </Nursery>
    );
};

export default WalksPullingToyScene;
