import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { ContactShadow, Nursery } from '../rig/Nursery';
import { ADULT_HEAD, frontSkeleton, type Skeleton } from '../rig/anatomy';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN, type SkinPalette } from '../rig/palette';
import { bone, oval, vec } from '../rig/skeleton';
import type { SceneClock } from '../rig/useSceneClock';
import type { SceneProps } from '../sceneTypes';

/**
 * "Imitates household chores" (24 months).
 *
 * The trap in this card is that a child sweeping is not the milestone. A child sweeping is a
 * child with a broom. **Imitation** needs two people and a relationship between them, and the
 * relationship has to be visible in the movement itself.
 *
 * What makes it read is the **rhythm**: the adult sweeps on a beat, and the child sweeps on
 * the *same* beat, about a third of a second behind. Copying is a matter of timing more than
 * of posture — two people doing the same thing at unrelated moments look like two people
 * doing their own thing, and two people in perfect unison look like a dance. A consistent
 * short lag is what the eye reads as one person following another.
 *
 * The child's sweep is also slightly bigger and less tidy than the adult's, which is the
 * other half of it. A copy that matched exactly would look like a reflection rather than an
 * attempt.
 *
 * ## The first whole adult in the catalogue
 *
 * Everywhere else a grown-up is a face or a pair of hands at the frame's edge. Here one has
 * to be standing in the room, so `AGE_PROPORTIONS` gained an `adult` entry at seven and a
 * half heads. Paired with `ADULT_HEAD`, the difference in *proportion* — not merely in height
 * — is what stops the pair reading as two children of different sizes.
 */

export const IMITATES_DURATION = 8.4;

export const IMITATES_CUES = {
    /** Somebody is sweeping. */
    watching: 0,
    /** The child picks up a small broom. */
    joins: 1.6,
    /** And sweeps along with them. */
    together: 3.0,
} as const;

/** Both mid-sweep, the child a beat behind. */
export const IMITATES_STILL = 4.6;

const C = IMITATES_CUES;

const CHILD_UNIT = 104;
const ADULT_UNIT = 96;

/** The shared beat. Everything in the scene is a function of it. */
function beat(t: number): number {
    'worklet';
    return Math.sin(t * 3.2);
}

/** How far the child has joined in, 0 watching to 1 sweeping. */
function joining(t: number): number {
    'worklet';

    const inn = animate(t, { start: C.joins, end: C.together, ease: 'easeInOutSine' });
    const out = animate(t, {
        start: IMITATES_DURATION - 1.2,
        end: IMITATES_DURATION - 0.2,
        ease: 'easeInOutSine',
    });

    return clamp(inn - out, 0, 1);
}

/** A broom: a shaft and a head, drawn from the hand that holds it. */
const Broom: React.FC<{ from: { x: number; y: number }; to: { x: number; y: number }; width: number }> = ({
    from,
    to,
    width,
}) => (
    <>
        <View style={bone(from, to, width, SCENE.toyLilac)} />
        <View
            style={oval(vec(to.x, to.y + width * 0.9), width * 4.6, width * 1.9, SCENE.furniture, -8)}
        />
    </>
);

/** One figure sweeping. Shared so the adult and the child are demonstrably the same motion. */
const Sweeper: React.FC<{
    skeleton: Skeleton;
    skin: SkinPalette;
    unit: number;
    /** Seconds behind the beat. Zero for whoever is being copied. */
    lag: number;
    /** How much of the sweep to do, 0 to 1. */
    amount: (t: number) => number;
    /** Sweep size. The copy is a little larger and less tidy than the original. */
    reach: number;
    adult?: boolean;
    clock?: SceneClock;
    frozenAt?: number;
    rich: boolean;
}> = ({ skeleton, skin, unit, lag, amount, reach, adult = false, clock, frozenAt, rich }) => {
    const part = { clock, frozenAt };

    const armAngle = (t: number) => {
        'worklet';
        return (-34 + beat(t - lag) * reach) * amount(t);
    };

    return (
        <>
            <Leg skeleton={skeleton} skin={skin} side="left" far {...part} />
            <Leg skeleton={skeleton} skin={skin} side="right" {...part} />

            <Joint
                pivot={skeleton.hipCentre}
                turn={(t) => {
                    'worklet';
                    // The whole body leans into the stroke. Sweeping from the shoulders
                    // alone reads as waving a stick about.
                    return beat(t - lag) * reach * 0.16 * amount(t);
                }}
                {...part}
            >
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    romper={!adult}
                    breathe={(t) => {
                        'worklet';
                        return 1 + 0.01 * Math.sin(t * 2.5);
                    }}
                    {...part}
                />

                <Arm skeleton={skeleton} skin={skin} side="left" far hand="palmar" root={armAngle} {...part} />

                <Joint pivot={skeleton.shoulderR} turn={armAngle} {...part}>
                    <Arm skeleton={skeleton} skin={skin} side="right" hand="palmar" {...part} />
                    <Broom
                        from={skeleton.wristR}
                        to={vec(
                            skeleton.wristR.x + unit * 1.25,
                            skeleton.wristR.y + unit * 1.45,
                        )}
                        width={unit * 0.07}
                    />
                </Joint>

                <Joint
                    pivot={skeleton.neckBase}
                    turn={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return (6 + beat(t - lag) * 2.5) * amount(t);
                              }
                            : undefined
                    }
                    {...part}
                >
                    <Head
                        at={skeleton.headCentre}
                        unit={unit}
                        skin={skin}
                        shape={adult ? ADULT_HEAD : undefined}
                        facing={0.42}
                        mouth={adult ? MOUTH.rest : MOUTH.smile}
                        {...part}
                    />
                </Joint>
            </Joint>
        </>
    );
};

const ImitatesChoresScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const frozenAt = still ? IMITATES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const adult = frontSkeleton({
        headAt: vec(178, 96),
        unit: ADULT_UNIT,
        age: 'adult',
        armSpread: 16,
        legSpread: 8,
    });

    const child = frontSkeleton({
        headAt: vec(452, 178),
        unit: CHILD_UNIT,
        age: 'child',
        armSpread: 20,
        legSpread: 12,
    });

    return (
        <Nursery>
            <ContactShadow left={96} top={430} width={190} height={26} />
            <ContactShadow left={366} top={430} width={176} height={26} />

            <Sweeper
                skeleton={adult}
                skin={skin}
                unit={ADULT_UNIT}
                lag={0}
                amount={() => {
                    'worklet';
                    return 1;
                }}
                reach={18}
                adult
                rich={rich}
                {...part}
            />

            {/*
              * A third of a second behind, and sweeping a little wider. The lag is what the
              * eye reads as following; the extra size is what keeps it an attempt rather
              * than a reflection.
              */}
            <Sweeper
                skeleton={child}
                skin={skin}
                unit={CHILD_UNIT}
                lag={0.34}
                amount={joining}
                reach={23}
                rich={rich}
                {...part}
            />
        </Nursery>
    );
};

export default ImitatesChoresScene;
