import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { crawlSkeleton } from '../rig/anatomy';
import { clamp, interpolate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, blobShape, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Crawls to get desired toys without bumping into objects" (10-12 months).
 *
 * The card is not checking whether the baby can crawl — that is assumed by the wording. It is
 * checking the clause after it: **without bumping into objects**. This is a milestone about
 * seeing a thing, understanding that it is in the way, and going round it. Vision and planning
 * dressed up as a motor skill.
 *
 * So the crawl is the setting and the **steering is the subject**, and the scene is arranged
 * to keep it that way. The baby stays put in the middle of the frame and the room travels past
 * them — which is both cheaper and truer to how the milestone reads, since what changes is the
 * baby's relationship to the obstacle rather than to the room. As the stool arrives they drop
 * toward the camera, tilt into the new line, look at the thing they are avoiding, and come
 * back up once it is behind them.
 *
 * The crawl itself is contralateral — right arm with left leg — because that is what a real
 * crawl is, and a baby moving same-side limbs together is a sign worth not drawing by
 * accident.
 */

export const CRAWLS_DURATION = 8.0;

export const CRAWLS_CUES = {
    /** Off across the floor, a toy in sight. */
    setsOff: 0,
    /** Something in the way. */
    obstacle: 2.4,
    /** Round it. */
    steers: 3.4,
    /** And on to the toy. */
    arrives: 6.0,
} as const;

/** Mid-steer: body off the straight line, head turned to the stool it is passing. */
export const CRAWLS_STILL = 4.1;

const C = CRAWLS_CUES;

const UNIT = 112;

/** Everything in the room travels leftward past a baby who stays where they are. */
function scroll(t: number): number {
    'worklet';
    return -t * 96;
}

/**
 * How far off the straight line the baby has swung, 0 to 1.
 *
 * Down the screen is toward the camera, which in this flat world is the way round an
 * obstacle. Out, along, and back.
 */
function steering(t: number): number {
    'worklet';

    return clamp(
        interpolate(
            t,
            [C.obstacle, C.steers, C.steers + 1.4, C.arrives - 0.4, C.arrives + 0.4],
            [0, 1, 1, 1, 0],
            'easeInOutSine',
        ),
        0,
        1,
    );
}

const CrawlsAroundScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = crawlSkeleton({ headAt: vec(392, 246), unit: UNIT, facing: 1 });
    const frozenAt = still ? CRAWLS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** The crawl cycle: one limb's swing, `beat` apart from its diagonal partner. */
    const stride = (beat: number, amplitude: number) => (t: number) => {
        'worklet';
        return Math.sin(t * 4.4 + beat) * amplitude;
    };

    return (
        <Nursery>
            {/*
              * The obstacle and the goal, travelling leftward. Both on one animated node,
              * since they share a timeline — the room is one thing moving, not two.
              */}
            <Part
                {...part}
                style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                animate={(t) => {
                    'worklet';
                    return { transform: [{ translateX: scroll(t) % 1200 }] };
                }}
            >
                {/* a low stool, in the way */}
                <View
                    style={blobShape(vec(920, 300), 128, 96, SCENE.furniture, [30, 30, 18, 18])}
                />
                <View style={ball(vec(920, 352), 112, SCENE.skirting, { height: 22 })} />

                {/* and the toy it is between them and */}
                <View style={ball(vec(1240, 342), 56, SCENE.toyPink)} />
                <View style={ball(vec(1232, 332), 24, SCENE.toyLilac)} />
            </Part>

            <ContactShadow left={250} top={386} width={300} height={34} />

            {/*
              * The whole baby, swung off the straight line and back. This joint is the
              * milestone; everything inside it is the crawl.
              */}
            <Joint
                pivot={skeleton.hipCentre}
                shift={(t) => {
                    'worklet';
                    const off = steering(t);
                    // Toward the camera to clear the stool, and a small rise and fall from
                    // the gait on top of it.
                    return vec(0, 44 * off + Math.sin(t * 8.8) * 3.5);
                }}
                turn={(t) => {
                    'worklet';
                    // Tilts into the new line as they come off the straight, and out of it
                    // again afterwards — the body points where it is going.
                    const off = steering(t);
                    return 7 * off * (1 - off) * 4;
                }}
                {...part}
            >
                {/* far side limbs first, so the near ones read in front */}
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    hand="open"
                    root={stride(Math.PI, 26)}
                    joint={rich ? stride(Math.PI + 0.5, -12) : undefined}
                    {...part}
                />
                <Leg
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    root={stride(0, -24)}
                    {...part}
                />

                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.012 * Math.sin(t * 3.2);
                    }}
                    {...part}
                />

                {/*
                  * Right arm with left leg, half a cycle from their partners. Contralateral —
                  * same-side limbs moving together is a different thing entirely, and not
                  * one to draw by accident.
                  */}
                <Leg skeleton={skeleton} skin={skin} side="right" root={stride(Math.PI, -24)} {...part} />
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="right"
                    hand="open"
                    root={stride(0, 26)}
                    joint={rich ? stride(0.5, -12) : undefined}
                    {...part}
                />

                <Joint
                    pivot={skeleton.neckBase}
                    turn={(t) => {
                        'worklet';
                        return -6 * steering(t) + Math.sin(t * 4.4) * 2;
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={UNIT}
                        skin={skin}
                        facing={0.78}
                        mouth={MOUTH.rest}
                        gaze={
                            // Ahead at the toy most of the time, and on the stool while
                            // going round it — looking at the obstacle is what says the
                            // detour was a decision rather than a wander.
                            //
                            // Full detail only. This scene has more moving parts than any
                            // other in the catalogue (a scrolling room, four limbs on a
                            // crawl cycle, and the steering itself), and at thumbnail size
                            // the eyes are three pixels across. The head still turns, which
                            // carries the same idea at the size it can be seen at.
                            rich
                                ? (t) => {
                                      'worklet';
                                      const off = steering(t);
                                      return vec(
                                          0.8 - 1.3 * off * (1 - off) * 4,
                                          -0.1 + 0.5 * off,
                                      );
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

export default CrawlsAroundScene;
