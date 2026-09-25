import { frontSkeleton, type Skeleton } from '../rig/anatomy';
import { vec } from '../rig/skeleton';

/**
 * The framing the face milestones share.
 *
 * Four of the six milestones in the 2-3 month band are about the face — recognising a
 * parent, smiling back at one, meeting a gaze, relaxing the hands. At that age there is
 * almost no gross motor skill to draw, so the camera comes in close and the whole
 * performance happens in the eyes and the mouth.
 *
 * Shared rather than repeated so the four read as the same baby at the same distance. A
 * parent flipping between the cards should feel they are watching one child, not four
 * drawings that happen to be in the same style.
 */

/** Head height in stage pixels for a face-filling close-up. */
export const CLOSE_UNIT = 268;

/** Further back, with room beside the baby for somebody else to lean in. */
export const PAIR_UNIT = 186;

/** A face filling the frame, shoulders cropped at the bottom. */
export const closeUpSkeleton = (): Skeleton =>
    frontSkeleton({ headAt: vec(352, 214), unit: CLOSE_UNIT, armSpread: 26 });

/**
 * The baby set low and left, leaving the top right for a parent leaning in.
 *
 * Deliberately not centred: the empty corner is what makes the arrival of a face read as
 * somebody entering the scene rather than as a second character who was always there.
 */
export const pairSkeleton = (): Skeleton =>
    frontSkeleton({ headAt: vec(252, 268), unit: PAIR_UNIT, armSpread: 24 });

/** Where the parent's face settles once she has leaned all the way in. */
export const PARENT_AT = vec(536, 128);

/** How far above the frame she starts. */
export const PARENT_ENTRY = -300;
