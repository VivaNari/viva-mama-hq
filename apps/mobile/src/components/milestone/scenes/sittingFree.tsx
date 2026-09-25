import { frontSkeleton, type Skeleton } from '../rig/anatomy';
import { vec } from '../rig/skeleton';

/**
 * The framing the 10-12 month band sits in.
 *
 * Two things separate it from the 4-6 month sitting framing, and both are the point of the
 * cards it serves.
 *
 * **There is no cushion.** At four months the card says "can sit *with support*"; at ten it
 * says "sits *without* support". A prop behind the back would draw the earlier milestone, so
 * the only thing holding this baby up is the baby.
 *
 * **The proportions are a toddler's.** `age: 'toddler'` lengthens the spine and the limbs and
 * leaves the head alone, so the same rig measures four and a half heads tall instead of four.
 * Nothing else changes — and that is the whole design of `anatomy.ts` paying off: a baby half
 * a year older, from one word.
 *
 * The posture is different too. A supported baby slumps into what is holding them; an
 * unsupported one sits up over their hips with their legs forward and their arms free, which
 * is what makes the reaching in item 18 risky enough to be a milestone.
 */

/** Head height in stage pixels. Smaller than the 4-6 month unit — they are taller now. */
export const FREE_UNIT = 118;

export const freeSittingSkeleton = (): Skeleton =>
    frontSkeleton({
        headAt: vec(306, 148),
        unit: FREE_UNIT,
        age: 'toddler',
        // Arms clear of the body and legs out in front, which is the tripod an unsupported
        // sitter actually holds.
        armSpread: 26,
        legSpread: 64,
    });
