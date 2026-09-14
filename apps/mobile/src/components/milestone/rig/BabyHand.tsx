import React from 'react';
import { View } from 'react-native';

import type { SkinPalette } from './palette';
import { ball, bone, oval, rotateAbout, vec, type Vec } from './skeleton';

/**
 * A baby's hand, in the shape it needs to be in.
 *
 * The rig this replaces drew a hand as a circle. A third of these milestones are about what
 * hands do — holding with the whole fist at 7-9 months, picking a pebble up with finger and
 * thumb at 18, pointing at a named body part at two years, keeping the fingers open and
 * relaxed at three months — and a circle can show none of them. Worse, the two grips are a
 * developmental pair: the card is drawing a distinction between them, so a drawing that
 * cannot tell them apart loses the content of both milestones.
 *
 * Shapes are laid out with the fingers pointing along +Y from the wrist and then rotated
 * about it, so a hand is pure geometry: no animated nodes, no extra grouping views, and it
 * composes inside whatever joints are above it.
 */

export type HandShape =
    /** Fingers straight and slightly splayed. Relaxed, and the default. */
    | 'open'
    /** Curled in. A newborn's rest, and the thing that should have relaxed by 3 months. */
    | 'fist'
    /** The whole hand closing as one around an object — the 7-9 month grasp. */
    | 'palmar'
    /** Finger and thumb, the 18-month grip that can pick up a pebble. */
    | 'pincer'
    /** Index extended, the rest tucked. */
    | 'point';

export interface BabyHandProps {
    /** The wrist, in stage coordinates. */
    at: Vec;
    /** Head height in stage pixels. */
    unit: number;
    skin: SkinPalette;
    shape?: HandShape;
    /**
     * Where the fingers point, in degrees clockwise from straight down.
     *
     * Usually the direction the forearm was already travelling, which a scene gets from
     * `angleBetween(elbow, wrist) - 90`.
     */
    angle?: number;
    /** Draw in the shade colour, for a hand on the far side of the body. */
    far?: boolean;
}

/** Finger geometry in head-height multiples, fingers pointing down from the wrist. */
const PALM = { cx: 0, cy: 0.075, w: 0.15, h: 0.165 };
const FINGER_W = 0.037;
const FINGER_X = [-0.052, -0.0175, 0.0175, 0.052];

export const BabyHand: React.FC<BabyHandProps> = ({
    at,
    unit,
    skin,
    shape = 'open',
    angle = 0,
    far = false,
}) => {
    const color = far ? skin.shade : skin.skin;
    const u = (multiple: number) => multiple * unit;

    /** A local point (in head-height multiples) placed and rotated into stage space. */
    const p = (x: number, y: number): Vec =>
        rotateAbout(vec(at.x + u(x), at.y + u(y)), at, angle);

    const palmCentre = p(PALM.cx, PALM.cy);

    /** A finger as a capsule between two local points. */
    const finger = (
        key: string,
        from: [number, number],
        to: [number, number],
        width = FINGER_W,
    ) => (
        <View key={key} style={bone(p(from[0], from[1]), p(to[0], to[1]), u(width), color)} />
    );

    const fingers: React.ReactNode[] = [];

    switch (shape) {
        case 'fist':
            // Curled under, so the silhouette is a ball with knuckles rather than digits.
            FINGER_X.forEach((x, i) => {
                fingers.push(finger(`f${i}`, [x * 0.8, 0.11], [x * 0.6, 0.155]));
            });
            fingers.push(finger('thumb', [-0.085, 0.055], [-0.045, 0.105], 0.042));
            break;

        case 'palmar': {
            // Every finger wrapping together around one object. Laid along an arc rather
            // than pointing away, which is what makes the hand read as closed around
            // something instead of merely bent — and is the whole difference from a pincer.
            const centre = vec(0, 0.105);
            const radius = 0.098;

            FINGER_X.forEach((_, i) => {
                const a = (-58 + i * 34) * (Math.PI / 180);
                const b = (-58 + i * 34 + 30) * (Math.PI / 180);
                fingers.push(
                    finger(
                        `f${i}`,
                        [centre.x + Math.sin(a) * radius, centre.y - Math.cos(a) * radius],
                        [centre.x + Math.sin(b) * radius, centre.y - Math.cos(b) * radius],
                        0.042,
                    ),
                );
            });

            fingers.push(finger('thumb', [-0.085, 0.045], [-0.02, 0.085], 0.044));
            break;
        }

        case 'pincer':
            // Two prongs with daylight between them. At thumbnail size the gap is the
            // readable feature, so the tucked fingers stay well clear of it.
            fingers.push(finger('index', [0.03, 0.1], [0.052, 0.205], 0.036));
            fingers.push(finger('thumb', [-0.055, 0.075], [0.012, 0.19], 0.04));
            FINGER_X.slice(0, 2).forEach((x, i) => {
                fingers.push(finger(`t${i}`, [x - 0.01, 0.105], [x - 0.02, 0.145], 0.032));
            });
            break;

        case 'point':
            fingers.push(finger('index', [0.0, 0.1], [0.012, 0.235], 0.038));
            FINGER_X.slice(0, 3).forEach((x, i) => {
                fingers.push(finger(`t${i}`, [x * 0.7 - 0.01, 0.115], [x * 0.5 - 0.02, 0.16]));
            });
            fingers.push(finger('thumb', [-0.08, 0.06], [-0.05, 0.115], 0.04));
            break;

        case 'open':
        default:
            // Splayed a little, because a relaxed baby hand is not a flat paddle.
            FINGER_X.forEach((x, i) => {
                const splay = (i - 1.5) * 0.016;
                fingers.push(finger(`f${i}`, [x, 0.11], [x + splay, 0.225]));
            });
            fingers.push(finger('thumb', [-0.082, 0.05], [-0.125, 0.125], 0.042));
            break;
    }

    return (
        <>
            {/*
              * Fingers behind the palm, so the palm covers where they meet it and the hand
              * reads as one piece rather than a fan of separate capsules.
              */}
            {fingers}
            <View
                style={oval(
                    palmCentre,
                    u(shape === 'fist' ? PALM.w * 1.14 : PALM.w),
                    u(shape === 'fist' ? PALM.h * 1.1 : PALM.h),
                    color,
                    angle,
                )}
            />
            {/* the wrist's own constriction, which is what makes a hand look like a baby's */}
            <View style={ball(at, u(0.11), color)} />
        </>
    );
};

export default BabyHand;
