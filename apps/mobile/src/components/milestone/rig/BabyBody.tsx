import React from 'react';
import { View } from 'react-native';

import { BODY, midLimb, type Skeleton } from './anatomy';
import BabyHand, { type HandShape } from './BabyHand';
import { Joint } from './Joint';
import { SCENE, type SkinPalette } from './palette';
import { angleBetween, ball, blobShape, bone, lerpPoint, oval } from './skeleton';
import type { SceneClock } from './useSceneClock';

/**
 * The trunk and limbs.
 *
 * Two things here are doing the work that the previous rig's flat capsules could not. The
 * torso is **two overlapping ovals** rather than one rounded rectangle, because an infant's
 * chest is narrow and the belly below it is not — that pot-bellied silhouette is one of the
 * strongest age cues there is, and a single rounded box erases it. And every limb carries a
 * **swell at mid-segment and a narrowing at the joint**, since React Native cannot taper a
 * View; a limb of constant width reads as a tube, and baby limbs are anything but.
 *
 * Limbs are wrapped in joints, so a scene moves an arm by naming two angles over time and
 * never touches a coordinate.
 */

interface PartTiming {
    clock?: SceneClock;
    frozenAt?: number;
}

export interface TorsoProps extends PartTiming {
    skeleton: Skeleton;
    skin: SkinPalette;
    /** Clothed by default; bare for a close-up or a nappy-only scene. */
    romper?: boolean;
    /**
     * Gentle breathing, as a scale about the base of the neck. A worklet.
     *
     * Worth one animated node on almost any scene: a body that is completely still reads as
     * a diagram, and a chest that never stops moving reads as alive even when the milestone
     * itself is about holding steady.
     */
    breathe?: (t: number) => number;
}

export const Torso: React.FC<TorsoProps> = ({
    skeleton,
    skin,
    romper = true,
    breathe,
    clock,
    frozenAt,
}) => {
    const { unit, neckBase, hipCentre, shoulderL, shoulderR } = skeleton;
    const u = (multiple: number) => multiple * unit;

    const trunk = Math.hypot(hipCentre.x - neckBase.x, hipCentre.y - neckBase.y);
    const lean = angleBetween(neckBase, hipCentre) - 90;

    const chest = lerpPoint(neckBase, hipCentre, 0.3);
    const belly = lerpPoint(neckBase, hipCentre, 0.68);

    const skinColor = romper ? SCENE.romper : skin.skin;

    const body = (
        <>
            {/* neck — barely a segment, but its absence is what made the old head a ball on a box */}
            <View style={bone(skeleton.chin, neckBase, u(0.26), skin.shade)} />

            {/* shoulders, rounded off so the trunk does not end in a corner */}
            <View style={ball(shoulderL, u(0.24), skinColor)} />
            <View style={ball(shoulderR, u(0.24), skinColor)} />

            <View style={oval(chest, u(BODY.chestWidth), trunk * 0.66, skinColor, lean)} />
            <View
                style={blobShape(
                    belly,
                    u(BODY.bellyWidth),
                    trunk * 0.68,
                    skinColor,
                    // Rounder below than above, so the belly hangs the way a baby's does
                    // rather than sitting in the middle of a symmetrical oval.
                    [44, 44, 50, 50],
                    lean,
                )}
            />

            {romper && (
                <View
                    style={oval(
                        lerpPoint(neckBase, hipCentre, 0.92),
                        u(BODY.bellyWidth * 0.94),
                        trunk * 0.36,
                        SCENE.romperShade,
                        lean,
                    )}
                />
            )}
        </>
    );

    if (!breathe) return body;

    return (
        <Joint pivot={skeleton.neckBase} clock={clock} frozenAt={frozenAt} grow={breathe}>
            {body}
        </Joint>
    );
};

export interface LimbProps extends PartTiming {
    skeleton: Skeleton;
    skin: SkinPalette;
    side: 'left' | 'right';
    /** Shoulder or hip angle over time, in degrees. A worklet. */
    root?: (t: number) => number;
    /** Elbow or knee angle over time, in degrees. A worklet. */
    joint?: (t: number) => number;
    /** Static angles, for a limb that holds a pose. */
    rootAngle?: number;
    jointAngle?: number;
    /** Draw in the shade colour — the limb on the far side of the body. */
    far?: boolean;
}

export interface ArmProps extends LimbProps {
    hand?: HandShape;
}

/**
 * A limb segment with its mass in the right place.
 *
 * The bone gives the length, the swell at mid-segment gives the pudge, and the ball at the
 * far end covers the seam where the next segment starts and doubles as the knee or elbow.
 * Three shapes, no animated nodes, and the whole thing turns as one inside its joint.
 */
const Segment: React.FC<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    width: number;
    color: string;
    /** How much thicker the mid-segment swell is. */
    swell?: number;
}> = ({ from, to, width, color, swell = 1.1 }) => (
    <>
        <View style={bone(from, to, width, color)} />
        <View style={ball(midLimb(from, to), width * swell, color)} />
        <View style={ball(to, width * 0.92, color)} />
    </>
);

export const Arm: React.FC<ArmProps> = ({
    skeleton,
    skin,
    side,
    root,
    joint,
    rootAngle = 0,
    jointAngle = 0,
    far = false,
    hand = 'open',
    clock,
    frozenAt,
}) => {
    const left = side === 'left';
    const shoulder = left ? skeleton.shoulderL : skeleton.shoulderR;
    const elbow = left ? skeleton.elbowL : skeleton.elbowR;
    const wrist = left ? skeleton.wristL : skeleton.wristR;

    const color = far ? skin.shade : skin.skin;
    const timing = { clock, frozenAt };
    const u = (multiple: number) => multiple * skeleton.unit;

    return (
        <Joint pivot={shoulder} angle={rootAngle} turn={root} {...timing}>
            <Segment from={shoulder} to={elbow} width={u(BODY.armWidth)} color={color} />

            <Joint pivot={elbow} angle={jointAngle} turn={joint} {...timing}>
                <Segment
                    from={elbow}
                    to={wrist}
                    width={u(BODY.forearmWidth)}
                    color={color}
                    // The forearm's mass sits high and the wrist pinches in, which is the
                    // shape that reads as a baby's arm rather than a tube.
                    swell={1.16}
                />
                <BabyHand
                    at={wrist}
                    unit={skeleton.unit}
                    skin={skin}
                    shape={hand}
                    angle={angleBetween(elbow, wrist) - 90}
                    far={far}
                />
            </Joint>
        </Joint>
    );
};

export const Leg: React.FC<LimbProps> = ({
    skeleton,
    skin,
    side,
    root,
    joint,
    rootAngle = 0,
    jointAngle = 0,
    far = false,
    clock,
    frozenAt,
}) => {
    const left = side === 'left';
    const hip = left ? skeleton.hipL : skeleton.hipR;
    const knee = left ? skeleton.kneeL : skeleton.kneeR;
    const ankle = left ? skeleton.ankleL : skeleton.ankleR;

    const color = far ? skin.shade : skin.skin;
    const timing = { clock, frozenAt };
    const u = (multiple: number) => multiple * skeleton.unit;

    return (
        <Joint pivot={hip} angle={rootAngle} turn={root} {...timing}>
            <Segment from={hip} to={knee} width={u(BODY.thighWidth)} color={color} swell={1.14} />

            <Joint pivot={knee} angle={jointAngle} turn={joint} {...timing}>
                <Segment from={knee} to={ankle} width={u(BODY.shinWidth)} color={color} />

                {/* the foot, turned to sit flat rather than continue the shin's line */}
                <View
                    style={oval(
                        {
                            x: ankle.x + (left ? -1 : 1) * u(0.06),
                            y: ankle.y + u(0.06),
                        },
                        u(BODY.foot * 0.78),
                        u(0.17),
                        color,
                        angleBetween(knee, ankle) - 90,
                    )}
                />
            </Joint>
        </Joint>
    );
};
