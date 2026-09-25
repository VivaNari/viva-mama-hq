import React from 'react';
import { View } from 'react-native';

import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { SKIN, type SkinPalette } from '../rig/palette';
import { ball, bone, oval, rotateAbout, vec, type Vec } from '../rig/skeleton';
import type { SceneClock } from '../rig/useSceneClock';
import type { SceneProps } from '../sceneTypes';

/**
 * "Keeps hands open and relaxed" (2-3 months).
 *
 * The only milestone in the band with no face in it. That is deliberate: the card is about
 * the hands, and at the size a thumbnail is drawn there is room for a face or for hands, not
 * for both at a readable scale.
 *
 * It is also the one milestone here that is a **state rather than an event**. Everything else
 * in this band happens — a head rises, a smile arrives, a parent is recognised — and can be
 * drawn as a beginning, a middle and an end. This one is the continuous absence of something:
 * the newborn's clenched fist has gone, and what is left is a hand that rests open.
 *
 * So the loop deliberately never makes a fist. An animation that clenched and opened would
 * read as "opens their hands", which is a different claim, and worse, it would look like the
 * warning sign printed on the same page of the card — *persistently holds thumb inside the
 * palm* — which is the one thing this drawing must never accidentally depict. Instead the
 * hands breathe between softly curved and fully splayed, which is what a relaxed hand
 * actually does when nobody is asking anything of it.
 *
 * ## Why the fingers are built here rather than taken from the rig
 *
 * `BabyHand` draws a hand in one of five named shapes, and a shape is static geometry — you
 * cannot tween between two of them. Here the fingers live inside a joint that scales about
 * the palm, so one animated value carries them smoothly from curled to extended. One node
 * per hand, and the thumb tucks behind the palm as it shortens, which is exactly what a
 * relaxing hand looks like.
 */

export const HANDS_OPEN_DURATION = 6.4;

export const HANDS_OPEN_CUES = {
    /** Fingers softly curved, the way a hand rests. */
    soft: 0,
    /** Open, splayed, weightless. */
    open: 1.9,
} as const;

/** Fully open, fingers spread. */
export const HANDS_OPEN_STILL = 1.9;

/**
 * The scale the hands are drawn at.
 *
 * Not a head height — there is no head in this scene. It is the same unit the rest of the
 * rig measures fingers in, turned up until a hand fills a third of the frame.
 */
const HAND_UNIT = 560;

/** Knuckle line and fingertips, in hand units below the wrist. */
const KNUCKLES = 0.115;
const TIPS = 0.235;
const FINGER_X = [-0.054, -0.018, 0.018, 0.054];

interface RelaxingHandProps {
    /** The wrist, in stage coordinates. */
    at: Vec;
    /** Degrees clockwise from fingers-pointing-down. */
    angle: number;
    skin: SkinPalette;
    /** Where the forearm runs off to, below the frame. */
    from: Vec;
    /** 0 softly curled, 1 fully extended. A worklet. */
    openness: (t: number) => number;
    /**
     * A slow drift, in degrees *away from* `angle`. A worklet.
     *
     * A delta, not an absolute bearing — the fingers are laid out already rotated by
     * `angle`, so the joint's job is only to nudge them from there.
     */
    drift?: (t: number) => number;
    clock?: SceneClock;
    frozenAt?: number;
}

const RelaxingHand: React.FC<RelaxingHandProps> = ({
    at,
    angle,
    skin,
    from,
    openness,
    drift,
    clock,
    frozenAt,
}) => {
    const u = (multiple: number) => multiple * HAND_UNIT;
    const p = (x: number, y: number): Vec =>
        rotateAbout(vec(at.x + u(x), at.y + u(y)), at, angle);

    const palm = p(0, 0.08);

    return (
        <>
            <View style={bone(from, at, u(0.25), skin.skin)} />

            {/*
              * Fingers, scaling about the palm. Shrinking them toward it draws them back
              * under the palm shape that covers this group, which reads as a curl; growing
              * them extends the hand. One value, one node, and no two drawings to tween
              * between.
              */}
            <Joint
                pivot={palm}
                clock={clock}
                frozenAt={frozenAt}
                grow={(t) => {
                    'worklet';
                    // Never below 0.62 — a hand that shrank further would be a fist, and a
                    // fist is the thing this milestone is the absence of.
                    return 0.62 + 0.38 * openness(t);
                }}
                turn={drift}
            >
                {FINGER_X.map((x, index) => {
                    // Fingers splay outward as they extend, and the outer two are shorter,
                    // which is what stops four capsules reading as a comb.
                    const spread = (index - 1.5) * 0.03;
                    const shorten = Math.abs(index - 1.5) * 0.012;

                    return (
                        <View
                            key={index}
                            style={bone(
                                p(x, KNUCKLES),
                                p(x + spread, TIPS - shorten),
                                u(0.038),
                                skin.skin,
                            )}
                        />
                    );
                })}

                {/*
                  * The thumb. It shortens back behind the palm along with everything else,
                  * so at the curled end of the loop it reads as tucked in and at the open
                  * end it is clearly out to the side — which is the distinction the card is
                  * actually making.
                  */}
                <View style={bone(p(-0.085, 0.055), p(-0.14, 0.135), u(0.044), skin.skin)} />
            </Joint>

            <View style={oval(palm, u(0.155), u(0.175), skin.skin, angle)} />
            {/* the wrist's own narrowing, which is what makes a hand look like a baby's */}
            <View style={ball(at, u(0.115), skin.skin)} />
        </>
    );
};

const HandsOpenAndRelaxedScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const frozenAt = still ? HANDS_OPEN_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /**
     * The breath the hands open and soften on.
     *
     * A full cycle over the scene's length, so the loop closes on itself with no seam — the
     * last frame is the first. Nothing here is an event, so there is nothing to start.
     */
    const breath = (offset: number) => (t: number) => {
        'worklet';
        return 0.5 + 0.5 * Math.sin(((t + offset) / HANDS_OPEN_DURATION) * Math.PI * 2 - Math.PI / 2);
    };

    return (
        <Nursery mat={false}>
            <RelaxingHand
                at={vec(248, 300)}
                angle={168}
                from={vec(214, 496)}
                skin={skin}
                openness={breath(0)}
                drift={
                    rich
                        ? (t) => {
                              'worklet';
                              return Math.sin(t * 0.9) * 4.5;
                          }
                        : undefined
                }
                {...part}
            />

            <RelaxingHand
                at={vec(470, 300)}
                angle={192}
                from={vec(506, 496)}
                skin={skin}
                // A beat behind the other one. Two hands moving in perfect unison is the
                // clearest possible sign of a drawing rather than a child.
                openness={breath(0.55)}
                drift={
                    rich
                        ? (t) => {
                              'worklet';
                              return Math.sin(t * 0.78 + 1.9) * 4.5;
                          }
                        : undefined
                }
                {...part}
            />
        </Nursery>
    );
};

export default HandsOpenAndRelaxedScene;
