import React, { ReactNode } from 'react';

import { Part, STAGE_HEIGHT, STAGE_WIDTH } from './parts';
import type { SceneClock } from './useSceneClock';
import type { Vec } from './skeleton';

/**
 * One articulation of the body.
 *
 * A joint fills the whole stage and does nothing but pivot about a point, so everything
 * drawn inside it keeps its ordinary stage coordinates and simply comes along for the turn.
 * That is the property the old rig lacked: a limb's position was typed in, so moving the
 * shoulder meant re-typing the elbow, the wrist and the hand to match, and any animation
 * that forgot one pulled the arm apart.
 *
 * Nest them the way a body is built — shoulder wraps elbow wraps wrist — and the nesting
 * composes the transforms for free. A scene then describes angles over time and never
 * positions, which is both far shorter to write and impossible to get out of joint.
 *
 * ```tsx
 * <Joint pivot={SHOULDER} turn={(t) => { 'worklet'; return -20 + 40 * Math.sin(t); }} {...part}>
 *     <View style={bone(SHOULDER, ELBOW, 30, skin.skin)} />
 *     <Joint pivot={ELBOW} turn={elbowAngle} {...part}>
 *         <View style={bone(ELBOW, WRIST, 26, skin.skin)} />
 *         <Hand at={WRIST} shape="open" />
 *     </Joint>
 * </Joint>
 * ```
 *
 * **One joint is one animated node**, which makes the per-thumbnail motion budget something
 * you can count off the markup rather than measure.
 */
export interface JointProps {
    /** The point it turns about, in stage coordinates. */
    pivot: Vec;
    /** A fixed angle, for a pose that does not move. Degrees, clockwise. */
    angle?: number;
    /** Degrees over time. A worklet. Replaces `angle` when given. */
    turn?: (t: number) => number;
    /**
     * Stage-space displacement over time. A worklet.
     *
     * For a body that travels — a walk crossing the frame, a crawl — where the whole rig
     * moves and the joints below keep articulating inside it.
     */
    shift?: (t: number) => Vec;
    /**
     * Uniform scale about the pivot over time. A worklet.
     *
     * A breath, a bounce of excitement, a camera pushing in. Rides the same animated node as
     * the rotation, so a joint that turns *and* breathes still costs one.
     */
    grow?: (t: number) => number;
    /**
     * Horizontal scale about the pivot, over time. A worklet.
     *
     * How a flat drawing turns over. Squashing to nothing and back out negative carries a
     * body through its own profile and onto its other side — which is the only way to draw a
     * roll without a third dimension to rotate in. Rides the same animated node as the
     * rotation, so a body that rolls *and* turns still costs one.
     */
    flatten?: (t: number) => number;

    clock?: SceneClock;
    /** Hold this moment instead of animating. See `Part`. */
    frozenAt?: number;
    children?: ReactNode;
}

export const Joint: React.FC<JointProps> = ({
    pivot,
    angle = 0,
    turn,
    shift,
    grow,
    flatten,
    clock,
    frozenAt,
    children,
}) => {
    const animate =
        turn || shift || grow || flatten
            ? (t: number) => {
                  'worklet';
                  const offset = shift ? shift(t) : undefined;
                  const rotate = turn ? turn(t) : angle;
                  const scale = grow ? grow(t) : 1;
                  const across = flatten ? flatten(t) : 1;

                  // Translate first in the list so the rotation and scale happen in the
                  // body's own frame and the displacement is applied to the result — a
                  // walking baby swings its arm about its shoulder, not about where it
                  // started.
                  return {
                      transform: [
                          { translateX: offset ? offset.x : 0 },
                          { translateY: offset ? offset.y : 0 },
                          { rotate: `${rotate}deg` },
                          { scale },
                          { scaleX: across },
                      ],
                  };
              }
            : undefined;

    return (
        <Part
            clock={clock}
            frozenAt={frozenAt}
            animate={animate}
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: STAGE_WIDTH,
                height: STAGE_HEIGHT,
                // The pivot, in pixels. RN resolves a numeric transformOrigin as a pixel
                // offset from the element's top left, and the element is the whole stage,
                // so this is simply the landmark's stage coordinate.
                transformOrigin: [pivot.x, pivot.y, 0],
                transform: [{ rotate: `${angle}deg` }],
            }}
        >
            {children}
        </Part>
    );
};

export default Joint;
