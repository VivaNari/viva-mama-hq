import React from 'react';
import { View } from 'react-native';

import { frontSkeleton, type Skeleton } from '../rig/anatomy';
import { SCENE } from '../rig/palette';
import { blobShape, oval, vec } from '../rig/skeleton';

/**
 * The framing the 4-6 month band sits in.
 *
 * At this age a baby is upright but not independent — the card says so in the milestone
 * itself, "can sit **with support**" — so four of these six scenes are a baby propped
 * against a cushion. That prop is not decoration: an unsupported sitting baby at four months
 * would be drawing a ten-month milestone, and the difference between the two cards is
 * precisely whether anything is holding them up.
 *
 * Shared so the four read as one child in one corner of one room.
 */

/** Head height in stage pixels for a propped, upright baby. */
export const SITTING_UNIT = 132;

/**
 * Propped upright, set left of centre.
 *
 * The empty right-hand side is where this band's world goes — a toy at the edge of reach, a
 * mirror, a sound arriving. Centring the baby would leave nowhere for any of it.
 */
export const sittingSkeleton = (): Skeleton =>
    frontSkeleton({
        headAt: vec(300, 168),
        unit: SITTING_UNIT,
        // Arms low and forward, legs folded out — the splayed, slightly slumped shape of a
        // baby who is being held up rather than holding themselves up.
        armSpread: 30,
        legSpread: 58,
    });

/**
 * The cushion behind and around them.
 *
 * Drawn before the body so the baby sits *in* it. A cushion behind the shoulders alone reads
 * as a headrest; one that comes up around the hips reads as support, which is the word on
 * the card.
 */
export const Cushion: React.FC<{ skeleton: Skeleton }> = ({ skeleton }) => {
    const { unit, hipCentre } = skeleton;

    return (
        <>
            <View
                style={blobShape(
                    vec(hipCentre.x + unit * 0.04, hipCentre.y - unit * 0.42),
                    unit * 3.0,
                    unit * 2.2,
                    SCENE.furniture,
                    [46, 44, 38, 40],
                    -3,
                )}
            />
            {/* a softer inner face, so the cushion has some depth rather than being a slab */}
            <View
                style={oval(
                    vec(hipCentre.x + unit * 0.02, hipCentre.y - unit * 0.3),
                    unit * 2.35,
                    unit * 1.6,
                    SCENE.matInner,
                    -3,
                )}
            />
        </>
    );
};
