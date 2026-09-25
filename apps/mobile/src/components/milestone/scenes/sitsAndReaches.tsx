import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, solve, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';
import { FREE_UNIT, freeSittingSkeleton } from './sittingFree';

/**
 * "Sits without support and reaches for toys without falling" (10-12 months).
 *
 * The card puts two things in one sentence and the second is the one being tested. Sitting
 * unaided is itself a few months old by now; what is new is being able to **spend** that
 * balance — to lean out past the base of support, take the toy, and come back up.
 *
 * So the milestone is the **recovery**, and the recovery has to be visible. The first pass at
 * this scene reached and returned smoothly, which drew a baby who was never in any danger and
 * therefore demonstrated nothing. Here the reach goes far enough to tip them: the torso
 * overshoots, the free arm comes out as a counterweight, and the trunk pulls back through
 * vertical and settles. Without the wobble there is no milestone, only a reach.
 *
 * Rebuilt on the jointed rig, and on toddler proportions — see `sittingFree.tsx`.
 */

export const SITS_REACHES_DURATION = 8.6;

export const SITS_REACHES_CUES = {
    /** Sitting up, unaided, steady. */
    sitting: 0,
    /** Leaning out for the toy. */
    reach: 1.6,
    /** Too far — the tip. */
    wobble: 3.3,
    /** Caught, and back upright. */
    recovers: 4.2,
} as const;

/** The moment of the tip: out over the toy, free arm flung wide, not yet corrected. */
export const SITS_REACHES_STILL = 3.6;

const C = SITS_REACHES_CUES;

const TOY_AT = vec(520, 344);

/** How far out the trunk is leaning, in degrees. Positive tips toward the toy. */
function lean(t: number): number {
    'worklet';

    const out = animate(t, { start: C.reach, end: C.wobble, ease: 'easeInOutSine' });
    // The overshoot past the safe angle — this is the part that has to look like a mistake.
    const tip = animate(t, { start: C.wobble, end: C.wobble + 0.45, ease: 'easeOutQuad' });
    const back = animate(t, { start: C.recovers, end: C.recovers + 1.1, ease: 'easeOutBack' });
    const home = animate(t, {
        start: SITS_REACHES_DURATION - 1.5,
        end: SITS_REACHES_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    const angle = 18 * out + 11 * tip - 29 * back;
    return angle * (1 - home);
}

/** How far the arm is extended toward the toy, 0 to 1. */
function reaching(t: number): number {
    'worklet';

    const out = animate(t, { start: C.reach, end: C.wobble + 0.3, ease: 'easeOutCubic' });
    const home = animate(t, {
        start: SITS_REACHES_DURATION - 1.8,
        end: SITS_REACHES_DURATION - 0.4,
        ease: 'easeInOutSine',
    });

    return clamp(out - home, 0, 1);
}

/** How hard the balance is being fought for, 0 steady to 1 nearly over. */
function peril(t: number): number {
    'worklet';

    const rise = animate(t, { start: C.wobble - 0.3, end: C.wobble + 0.45, ease: 'easeOutQuad' });
    const gone = animate(t, { start: C.recovers, end: C.recovers + 0.9, ease: 'easeInOutSine' });

    return clamp(rise - gone, 0, 1);
}

const SitsAndReachesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = freeSittingSkeleton();
    const frozenAt = still ? SITS_REACHES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const { shoulderR, elbowR, wristR } = skeleton;

    const shoulderAngle = (t: number) => {
        'worklet';
        return -46 * reaching(t);
    };
    const elbowAngle = (t: number) => {
        'worklet';
        return -18 * reaching(t);
    };

    return (
        <Nursery>
            <ContactShadow left={210} top={392} width={250} height={36} />

            <View style={ball(TOY_AT, 50, SCENE.toyPink)} />
            <View style={ball(vec(TOY_AT.x - 7, TOY_AT.y - 8), 21, SCENE.toyLilac)} />

            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            {/*
              * Everything above the hips leans, tips, and is pulled back. The pivot is the
              * hips because that is the edge a sitting baby topples over.
              */}
            <Joint pivot={skeleton.hipCentre} turn={lean} {...part}>
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={(t) => {
                        'worklet';
                        // A catch of breath at the moment of the tip.
                        return 1 + 0.012 * Math.sin(t * 2.4) + 0.018 * peril(t);
                    }}
                    {...part}
                />

                {/*
                  * The free arm. Flung out and up as the balance goes — a counterweight, and
                  * the clearest single sign in the drawing that this is being *saved* rather
                  * than performed.
                  */}
                <Arm
                    skeleton={skeleton}
                    skin={skin}
                    side="left"
                    far
                    hand="open"
                    root={(t) => {
                        'worklet';
                        return 42 * peril(t);
                    }}
                    {...part}
                />

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
                    turn={(t) => {
                        'worklet';
                        // The head stays more level than the trunk — the same reflex the
                        // 4-6 month card is entirely about, now in service of something else.
                        return -lean(t) * 0.45 + Math.sin(t * 9) * 1.6 * peril(t);
                    }}
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={FREE_UNIT}
                        skin={skin}
                        mouth={MOUTH.rest}
                        facing={0.3}
                        gaze={(t) => {
                            'worklet';
                            return vec(0.85, 0.35 + 0.25 * reaching(t));
                        }}
                        {...part}
                    />
                </Joint>
            </Joint>

            {/* the toy, carried once the hand is on it */}
            <Part
                {...part}
                style={{ position: 'absolute', left: 0, top: 0, width: 720, height: 480 }}
                animate={(t) => {
                    'worklet';
                    const got = clamp((reaching(t) - 0.85) / 0.15, 0, 1);
                    if (got === 0) return { opacity: 0 };

                    const hand = solve(wristR, [
                        { pivot: skeleton.hipCentre, angle: lean(t) },
                        { pivot: shoulderR, angle: shoulderAngle(t) },
                        { pivot: elbowR, angle: elbowAngle(t) },
                    ]);

                    return {
                        opacity: got,
                        transform: [
                            { translateX: hand.x - TOY_AT.x },
                            { translateY: hand.y - TOY_AT.y },
                        ],
                    };
                }}
            >
                <View style={ball(TOY_AT, 50, SCENE.toyPink)} />
                <View style={ball(vec(TOY_AT.x - 7, TOY_AT.y - 8), 21, SCENE.toyLilac)} />
            </Part>
        </Nursery>
    );
};

export default SitsAndReachesScene;
