import React from 'react';
import { View } from 'react-native';

import { Arm, Leg, Torso } from '../rig/BabyBody';
import Head, { MOUTH, blendMouth } from '../rig/Head';
import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { frontSkeleton } from '../rig/anatomy';
import { animate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { oval, vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Moves both arms and both legs when excited" (2-3 months).
 *
 * The word the card is checking is **both**. What a health worker is looking for is symmetry
 * — four limbs that all work — because a limb that stays behind is the sign worth catching.
 * So all four have to be moving and all four have to be *visible*, which settles the camera
 * before anything else does: this one is seen from above, looking down at a baby on a
 * blanket. A side view would hide an arm and a leg behind the body and quietly lose half of
 * what the milestone is about.
 *
 * The other thing it needs is to look like excitement rather than exercise. Two things do
 * that: the limbs run slightly out of phase with each other, and the whole thing arrives in
 * a burst and subsides. A baby windmilling at a steady rate reads as a mechanism.
 */

export const KICKS_AND_WAVES_DURATION = 7.0;

export const KICKS_AND_WAVES_CUES = {
    /** Awake, moving a little, nothing much happening. */
    calm: 0,
    /** Something delightful. */
    excited: 1.3,
    /** Everything going at once. */
    peak: 2.9,
    /** And down again. */
    settle: 4.7,
} as const;

/** Mid-burst, limbs at full spread. */
export const KICKS_AND_WAVES_STILL = 2.9;

const C = KICKS_AND_WAVES_CUES;

const UNIT = 92;

/** How excited, 0 to 1. */
function excitement(t: number): number {
    'worklet';

    const up = animate(t, { start: C.excited, end: C.peak, ease: 'easeOutCubic' });
    const down = animate(t, { start: C.settle, end: C.settle + 1.5, ease: 'easeInOutSine' });

    return up * (1 - down);
}

const KicksAndWavesScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const skeleton = frontSkeleton({
        headAt: vec(352, 134),
        unit: UNIT,
        // Wide at rest, because this is a baby on their back rather than standing up, and
        // because the spread is what the burst then exaggerates.
        armSpread: 32,
        legSpread: 30,
    });
    const frozenAt = still ? KICKS_AND_WAVES_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /**
     * One limb's swing.
     *
     * `beat` offsets each limb along the same wave so they never line up — the arms lead the
     * legs slightly, and left leads right by less. Perfectly synchronised limbs are the
     * single clearest tell that something was drawn rather than observed.
     */
    const swing = (beat: number, amplitude: number, rate: number) => (t: number) => {
        'worklet';
        const go = excitement(t);
        return Math.sin(t * rate + beat) * (amplitude * (0.22 + 0.78 * go));
    };

    return (
        <Nursery mat={false}>
            {/*
              * A blanket rather than the shared play mat. The mat belongs to a room drawn in
              * elevation, and this is the only scene in the band looking straight down.
              */}
            <View
                style={oval(vec(356, 262), 496, 432, SCENE.matStripeB, -6)}
            />
            <View style={oval(vec(356, 262), 424, 366, SCENE.matInner, -6)} />

            <Leg
                skeleton={skeleton}
                skin={skin}
                side="left"
                root={swing(0.0, 26, 6.1)}
                joint={rich ? swing(0.6, 18, 6.1) : undefined}
                {...part}
            />
            <Leg
                skeleton={skeleton}
                skin={skin}
                side="right"
                root={swing(2.1, -26, 5.7)}
                joint={rich ? swing(2.7, -18, 5.7) : undefined}
                {...part}
            />

            <Torso
                skeleton={skeleton}
                skin={skin}
                breathe={(t) => {
                    'worklet';
                    return 1 + 0.015 * Math.sin(t * 2.5) + 0.012 * Math.sin(t * 7.4) * excitement(t);
                }}
                {...part}
            />

            <Arm
                skeleton={skeleton}
                skin={skin}
                side="left"
                hand="open"
                root={swing(1.1, 30, 6.6)}
                joint={rich ? swing(1.7, 20, 6.6) : undefined}
                {...part}
            />
            <Arm
                skeleton={skeleton}
                skin={skin}
                side="right"
                hand="open"
                root={swing(3.3, -30, 6.9)}
                joint={rich ? swing(3.9, -20, 6.9) : undefined}
                {...part}
            />

            <Joint
                pivot={skeleton.neckBase}
                turn={(t) => {
                    'worklet';
                    // The head rocks side to side with the rest of it. Left out, the body
                    // looks like it is being operated rather than moving itself.
                    return Math.sin(t * 3.2) * 7 * excitement(t);
                }}
                {...part}
            >
                <Head
                    at={skeleton.headCentre}
                    unit={UNIT}
                    skin={skin}
                    // Excitement at this age comes with an open mouth; a squeal is the sound
                    // the card names beside the movement.
                    mouth={MOUTH.laugh}
                    mouthAt={
                        rich
                            ? (t) => {
                                  'worklet';
                                  return blendMouth(MOUTH.smile, MOUTH.laugh, excitement(t));
                              }
                            : undefined
                    }
                    {...part}
                />
            </Joint>
        </Nursery>
    );
};

export default KicksAndWavesScene;
