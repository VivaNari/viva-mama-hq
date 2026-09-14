import React from 'react';
import { View } from 'react-native';

import { Joint } from '../rig/Joint';
import { Nursery } from '../rig/Nursery';
import { animate, clamp } from '../rig/motion';
import { SCENE, SKIN } from '../rig/palette';
import { ball, bone, oval, rotateAbout, vec, type Vec } from '../rig/skeleton';
import type { SceneProps } from '../sceneTypes';

/**
 * "Grasps a toy using all fingers" (7-9 months).
 *
 * The card is drawing a distinction, not just noting that a baby can hold something. At seven
 * to nine months the hand closes as **one unit** — the palmar grasp, every finger arriving
 * together, the thumb along for the ride rather than opposing anything. The finger-and-thumb
 * pincer that can pick up a pebble is a separate milestone eighteen months in, and a health
 * worker reading this card is checking which of the two they are looking at.
 *
 * So the difference is built into the structure here rather than drawn on top of it: **all
 * four fingers live in a single joint and rotate together**, and there is no way for them to
 * arrive independently. The pincer scene at item 25 will give the thumb and index their own
 * joints, and its whole silhouette is two prongs with daylight between them. The two cards
 * cannot be confused because the two hands are not built the same way.
 *
 * Close-up, because a hand at card-thumbnail size inside a whole-body scene is about twenty
 * pixels across and none of this would survive.
 */

export const GRASPS_DURATION = 6.8;

export const GRASPS_CUES = {
    /** Open hand, block in front of it. */
    open: 0,
    /** The hand comes down over it. */
    close: 1.6,
    /** Held, and turned to look at. */
    holds: 3.2,
} as const;

/** Closed around the block, fingers wrapped, the block turning in the hand. */
export const GRASPS_STILL = 3.9;

const C = GRASPS_CUES;

/** Hand scale. Not a head height — there is no head in this scene. */
const HAND = 620;

/** Where the wrist sits, with the fingers reaching up and over the block. */
const WRIST = vec(300, 392);
const HAND_ANGLE = 158;

const BLOCK_AT = vec(408, 250);
const BLOCK = 132;

/** How closed the hand is, 0 open to 1 wrapped. */
function closed(t: number): number {
    'worklet';

    const shut = animate(t, { start: C.close, end: C.close + 0.55, ease: 'easeOutCubic' });
    const release = animate(t, {
        start: GRASPS_DURATION - 1.3,
        end: GRASPS_DURATION - 0.3,
        ease: 'easeInOutSine',
    });

    return clamp(shut - release, 0, 1);
}

const GraspsScene: React.FC<SceneProps> = ({
    clock,
    skinTone = 'warm',
    still,
    detail = 'thumb',
}) => {
    const skin = SKIN[skinTone];
    const frozenAt = still ? GRASPS_STILL : undefined;
    const part = { clock, frozenAt };
    const rich = detail === 'full';

    const u = (multiple: number) => multiple * HAND;
    const p = (x: number, y: number): Vec =>
        rotateAbout(vec(WRIST.x + u(x), WRIST.y + u(y)), WRIST, HAND_ANGLE);

    const palm = p(0, 0.085);
    const knuckles = p(0, 0.12);

    return (
        <Nursery mat={false}>
            {/* the block, behind the fingers so they close in front of it */}
            <Joint
                pivot={BLOCK_AT}
                turn={(t) => {
                    'worklet';
                    // Turned over to be looked at once it is held — which is what a baby
                    // does with anything they have just managed to pick up.
                    const held = closed(t);
                    return -14 * held + Math.sin(t * 1.6) * 5 * held;
                }}
                {...part}
            >
                <View
                    style={{
                        position: 'absolute',
                        left: BLOCK_AT.x - BLOCK / 2,
                        top: BLOCK_AT.y - BLOCK / 2,
                        width: BLOCK,
                        height: BLOCK,
                        borderRadius: 22,
                        backgroundColor: SCENE.toyPink,
                    }}
                />
                <View
                    style={oval(
                        vec(BLOCK_AT.x - BLOCK * 0.16, BLOCK_AT.y - BLOCK * 0.16),
                        BLOCK * 0.3,
                        BLOCK * 0.3,
                        SCENE.toyLilac,
                    )}
                />
            </Joint>

            {/* forearm, running off the bottom of the frame */}
            <View style={bone(vec(238, 500), WRIST, u(0.26), skin.skin)} />

            {/*
              * All four fingers, in one joint.
              *
              * This is the milestone. They cannot close one at a time because there is only
              * one angle between them — a palmar grasp is the whole hand arriving at once,
              * and the rig says so rather than the drawing merely suggesting it.
              */}
            <Joint
                pivot={knuckles}
                turn={(t) => {
                    'worklet';
                    return -96 * closed(t);
                }}
                {...part}
            >
                {[-0.055, -0.019, 0.019, 0.055].map((x, index) => {
                    const shorten = Math.abs(index - 1.5) * 0.014;
                    return (
                        <View
                            key={index}
                            style={bone(p(x, 0.12), p(x, 0.255 - shorten), u(0.04), skin.skin)}
                        />
                    );
                })}
            </Joint>

            {/*
              * The thumb, in its own joint but turning *with* the fingers and by less. At
              * this age it comes along rather than opposing them, which is exactly why this
              * grip cannot pick up anything small.
              */}
            <Joint
                pivot={p(-0.085, 0.06)}
                turn={
                    rich
                        ? (t) => {
                              'worklet';
                              return -54 * closed(t);
                          }
                        : undefined
                }
                {...part}
            >
                <View style={bone(p(-0.085, 0.06), p(-0.15, 0.15), u(0.046), skin.skin)} />
            </Joint>

            <View style={oval(palm, u(0.17), u(0.19), skin.skin, HAND_ANGLE)} />
            <View style={ball(WRIST, u(0.12), skin.skin)} />
        </Nursery>
    );
};

export default GraspsScene;
