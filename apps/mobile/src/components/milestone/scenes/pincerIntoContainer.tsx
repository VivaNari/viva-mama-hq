import React from 'react';
import { View } from 'react-native';

import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { Part } from '../rig/parts';
import { animate, clamp, interpolate } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, blobShape, bone, oval, rotateAbout, vec, type Vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Puts pebbles / small objects in a container" (18 months).
 *
 * The developmental pair to item 14, and the two cards have to be told apart at thumbnail
 * size. The rig makes that structural rather than decorative:
 *
 *  - **Item 14, the palmar grasp**, gives all four fingers *one shared joint*. They cannot
 *    arrive separately; the whole hand closes at once, which is why that grip cannot pick up
 *    anything small.
 *  - **Here, the pincer**, the index and the thumb each have **their own joint** and close
 *    toward each other. Everything else is tucked out of the way. The silhouette is two
 *    prongs with daylight between them, and it is a different shape from across the room.
 *
 * The other half of the card is the **release**, and it is the harder half. Picking something
 * up is months old by now; opening your fingers at a chosen moment over a chosen place is
 * not — letting go on purpose is a later skill than grabbing. So the opening of the hand is
 * the clearest, slowest beat in the scene, and the pebble is watched all the way down.
 *
 * Two pebbles, because one could be luck.
 */

export const PINCER_DURATION = 9.6;

export const PINCER_CUES = {
    /** Hand open above the pebbles. */
    ready: 0,
    /** Finger and thumb close on one. */
    pinches: 1.3,
    /** Carried over the pot. */
    carries: 2.8,
    /** And let go. */
    releases: 4.0,
} as const;

/** The release: fingers open, pebble just falling, hand still over the pot. */
export const PINCER_STILL = 4.5;

const C = PINCER_CUES;

/** Hand scale. Not a head height — there is no head in this scene. */
const HAND = 560;

const WRIST_REST = vec(238, 366);
const HAND_ANGLE = 150;

const POT_AT = vec(506, 344);
const POT_W = 176;
const POT_H = 132;

/** Where the loose pebbles sit. */
const PEBBLE_A = vec(250, 424);
const PEBBLE_B = vec(318, 434);
const PEBBLE_R = 26;

/** How closed the pinch is, 0 open to 1 holding. Twice, once per pebble. */
function pinched(t: number): number {
    'worklet';

    const half = PINCER_DURATION / 2;
    const local = t % half;

    const close = animate(local, { start: C.pinches, end: C.pinches + 0.4, ease: 'easeOutCubic' });
    // The release is slower than the close, deliberately. Letting go on purpose is the
    // skill, so it gets the time.
    const open = animate(local, { start: C.releases, end: C.releases + 0.6, ease: 'easeInOutSine' });

    return clamp(close - open, 0, 1);
}

/** Where the hand is along its carry, 0 over the pebbles to 1 over the pot. */
function carried(t: number): number {
    'worklet';

    const half = PINCER_DURATION / 2;
    const local = t % half;

    return clamp(
        interpolate(
            local,
            [C.pinches + 0.4, C.carries, C.releases + 0.7, half - 0.4],
            [0, 1, 1, 0],
            'easeInOutSine',
        ),
        0,
        1,
    );
}

/** How far the released pebble has fallen into the pot, 0 to 1. */
function falling(t: number): number {
    'worklet';

    const half = PINCER_DURATION / 2;
    const local = t % half;

    return animate(local, { start: C.releases + 0.25, end: C.releases + 0.7, ease: 'easeInQuad' });
}

const PincerIntoContainerScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const frozenAt = still ? PINCER_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    /** Hand-frame units to stage pixels. A worklet because `p` below is one. */
    const u = (multiple: number) => {
        'worklet';
        return multiple * HAND;
    };

    /**
     * A point in the hand's own frame, placed and rotated onto the stage.
     *
     * A worklet, because the falling pebble's animator calls it to find the fingertip at each
     * frame — and an ordinary function called from the UI thread throws there and nowhere
     * else. `milestoneWorklets.test.tsx` caught this one; the same helper in the other hand
     * scenes is only ever called while rendering, which is why they do not need it.
     */
    const p = (x: number, y: number): Vec => {
        'worklet';
        return rotateAbout(vec(WRIST_REST.x + u(x), WRIST_REST.y + u(y)), WRIST_REST, HAND_ANGLE);
    };

    const palm = p(0, 0.085);
    const indexBase = p(0.02, 0.115);
    const thumbBase = p(-0.08, 0.055);

    /** Where the hand travels: up and across to the pot, and back. */
    const handShift = (t: number) => {
        'worklet';
        const along = carried(t);
        return vec(
            (POT_AT.x - WRIST_REST.x - 40) * along,
            (POT_AT.y - WRIST_REST.y - 130) * along,
        );
    };

    return (
        <Nursery mat={false}>
            {/* the loose pebbles */}
            <View style={ball(PEBBLE_A, PEBBLE_R * 2, SCENE.toyLilac)} />
            <View style={ball(PEBBLE_B, PEBBLE_R * 1.7, SCENE.toyPink)} />

            {/* the pot, drawn open at the top so things can be seen going in */}
            <View
                style={blobShape(POT_AT, POT_W, POT_H, SCENE.furniture, [16, 16, 42, 42])}
            />
            <View
                style={oval(
                    vec(POT_AT.x, POT_AT.y - POT_H / 2),
                    POT_W,
                    POT_H * 0.26,
                    SCENE.matInner,
                )}
            />

            {/* the pebble in flight, and then in the pot */}
            <Part
                {...part}
                style={ball(vec(0, 0), PEBBLE_R * 2, SCENE.toyLilac, { opacity: 0 })}
                animate={(t) => {
                    'worklet';
                    const held = pinched(t);
                    const drop = falling(t);
                    const shift = handShift(t);

                    if (held === 0 && drop === 0) return { opacity: 0 };

                    // In the fingers while held, then falling to the bottom of the pot.
                    const fingerTip = p(0.05, 0.24);
                    const from = vec(fingerTip.x + shift.x, fingerTip.y + shift.y);
                    const to = vec(POT_AT.x - 18, POT_AT.y + POT_H * 0.22);

                    return {
                        opacity: 1,
                        left: from.x + (to.x - from.x) * drop - PEBBLE_R,
                        top: from.y + (to.y - from.y) * drop - PEBBLE_R,
                    };
                }}
            />

            {/* the whole hand, travelling */}
            <Joint pivot={WRIST_REST} shift={handShift} {...part}>
                <View style={bone(vec(150, 500), WRIST_REST, u(0.24), skin.skin)} />

                {/*
                  * The three fingers that are not doing anything, tucked back out of the
                  * way. Keeping them clear is what leaves daylight between the two that are.
                  */}
                {[-0.052, -0.018, 0.016].map((x, index) => (
                    <View
                        key={index}
                        style={bone(p(x, 0.115), p(x - 0.012, 0.165), u(0.032), skin.shade)}
                    />
                ))}

                {/*
                  * The index. Its own joint — this is the structural difference from item 14,
                  * where all four fingers share one and cannot move independently.
                  */}
                <Joint
                    pivot={indexBase}
                    turn={(t) => {
                        'worklet';
                        return -26 * pinched(t);
                    }}
                    {...part}
                >
                    <View style={bone(indexBase, p(0.05, 0.245), u(0.036), skin.skin)} />
                </Joint>

                {/* and the thumb, closing to meet it */}
                <Joint
                    pivot={thumbBase}
                    turn={(t) => {
                        'worklet';
                        return 30 * pinched(t);
                    }}
                    {...part}
                >
                    <View style={bone(thumbBase, p(-0.02, 0.2), u(0.04), skin.skin)} />
                </Joint>

                <View style={oval(palm, u(0.16), u(0.18), skin.skin, HAND_ANGLE)} />
                <View style={ball(WRIST_REST, u(0.115), skin.skin)} />
            </Joint>

            {/* the pebbles already in the pot, so the loop reads as getting somewhere */}
            {rich && (
                <Part
                    {...part}
                    style={ball(vec(POT_AT.x + 26, POT_AT.y + POT_H * 0.2), PEBBLE_R * 1.7, SCENE.toyPink)}
                    animate={(t) => {
                        'worklet';
                        // Appears once the first pebble has been dropped, on the second pass.
                        return { opacity: t > PINCER_DURATION / 2 ? 1 : 0 };
                    }}
                />
            )}
        </Nursery>
    );
};

export default PincerIntoContainerScene;
