import { lerpPoint, vec, type Vec } from './skeleton';

/**
 * What a baby is shaped like.
 *
 * The rig this replaces drew a head as a circle roughly the size of the torso with the eyes
 * above its midline — an adult face scaled down, which is the uncanny part of it. Infant
 * proportions are specific and they are most of what makes a drawing read as a baby rather
 * than as a small person:
 *
 *  - The **cranium is tall**. Measuring from the eyes, there is half again as much head
 *    above as there is face below. In an adult those are about equal.
 *  - The **eyes sit below the midline** of the head, not on or above it.
 *  - The **widest point of the head is the cheeks**, not the temples.
 *  - The head is a quarter of total height at birth and about a fifth at three years — so
 *    the same body drawn at two ages differs by proportion alone, with no other change.
 *  - **Limbs are short and soft**, carrying mass at mid-forearm and mid-thigh and narrowing
 *    at the wrist and ankle. That constriction is what reads as baby fat.
 *
 * Everything here is expressed in **head heights**. One number sets the age and the size of
 * the drawing together, and a scene never contains a magic coordinate.
 */

/** Every proportion below is a multiple of the head's height. */
export interface Proportions {
    /** Head height in stage pixels. Everything else follows from it. */
    head: number;
    /**
     * Total height in head heights: 4 at birth, nearer 5 by three years.
     *
     * Not used as a length directly — it drives limb length, which is where the difference
     * actually shows.
     */
    heads: number;
}

/**
 * Total height in head heights, which is the number that carries the age.
 *
 * A drawing is aged by proportion, not by size: the same body at 4 heads and at 4.9 heads
 * reads as a baby and as a three-year-old even rendered at identical pixel heights. The
 * head itself barely grows over this span, so all of the difference lands in the spine and
 * the limbs — which is exactly what `growthFactor` below distributes.
 */
export const AGE_PROPORTIONS = {
    /** 2-9 months. */
    infant: 4.0,
    /** 10-18 months: on their feet, a little longer in the leg. */
    toddler: 4.4,
    /** 24 months - 3 years. */
    child: 4.9,
    /**
     * A grown-up, for the scenes with one in them.
     *
     * Seven and a half heads is the figure-drawing convention and close enough to true. What
     * matters is that it is nowhere near the child's five: standing side by side, the
     * difference in *proportion* does more to say "adult and child" than the difference in
     * height, because a child scaled up is still unmistakably a child.
     *
     * Pair it with `ADULT_HEAD`, or the body will be a grown-up's under a baby's face.
     */
    adult: 7.5,
} as const;

/** The segment table below is authored for a four-head infant. */
export const BASE_HEADS = AGE_PROPORTIONS.infant;

/**
 * How much longer the non-head segments get at a given age.
 *
 * Derived from the target height rather than typed in beside it, so the two cannot drift:
 * the head is one head tall whatever the age, so every extra head of height has to come out
 * of the remaining `total - 1`.
 */
export const growthFactor = (age: AgeShape): number =>
    (AGE_PROPORTIONS[age] - 1) / (BASE_HEADS - 1);

export type AgeShape = keyof typeof AGE_PROPORTIONS;

/**
 * The head's internal landmarks, all relative to the centre of the skull.
 *
 * Multiples of head height. `eyeLine` being positive is the single most important number
 * here: it puts the eyes below centre, which is the infant marker.
 */
export interface HeadProportions {
    skullWidth: number;
    skullHeight: number;
    eyeLine: number;
    eyeSpacing: number;
    eyeSize: number;
    browLine: number;
    noseLine: number;
    mouthLine: number;
    cheekLine: number;
    cheekSpread: number;
    earLine: number;
    earSpread: number;
    chin: number;
    crown: number;
    hairline: number;
}

export const HEAD = {
    skullWidth: 0.94,
    skullHeight: 1.0,

    /** Below centre — the tall-cranium rule. */
    eyeLine: 0.1,
    eyeSpacing: 0.42,
    eyeSize: 0.13,

    browLine: -0.04,
    noseLine: 0.24,
    mouthLine: 0.36,

    /**
     * The widest point of the face.
     *
     * The cheek forms have to sit far enough out to break the skull's own outline — a baby's
     * head is widest across the cheeks, and cheeks drawn inside the silhouette leave a circle
     * with some shapes painted on it, which is what the previous head was. There is a test on
     * the margin.
     */
    cheekLine: 0.25,
    cheekSpread: 0.305,

    earLine: 0.08,
    earSpread: 0.47,

    chin: 0.5,
    crown: -0.5,

    /** How far the hairline comes down the forehead. */
    hairline: -0.06,
} as const satisfies HeadProportions;

/**
 * A grown-up's head, for the caregiver who appears in five of these milestones.
 *
 * The same landmarks with the infant markers removed, which is all it takes: the eyes come
 * up to the midline, the face below them lengthens, the cheeks stop being the widest point
 * and the skull narrows. Drawn beside a baby the contrast is the whole point — several of
 * these milestones are about responding *to someone*, and a second baby-shaped head would
 * read as a sibling.
 */
export const ADULT_HEAD = {
    skullWidth: 0.78,
    skullHeight: 1.0,

    /** On the midline, where an adult's are. */
    eyeLine: -0.02,
    eyeSpacing: 0.34,
    eyeSize: 0.1,

    browLine: -0.13,
    noseLine: 0.15,
    mouthLine: 0.31,

    cheekLine: 0.14,
    cheekSpread: 0.2,

    earLine: -0.01,
    earSpread: 0.39,

    chin: 0.5,
    crown: -0.5,

    hairline: -0.2,
} as const satisfies HeadProportions;

/** Body segment lengths, in head heights. */
export const BODY = {
    /** Barely a neck at all on an infant. */
    neck: 0.14,
    shoulderSpread: 0.42,
    /** Shoulder to hip. */
    spine: 1.25,
    hipSpread: 0.3,

    /** Widest part of the torso, and how far down the spine it sits. */
    bellyWidth: 1.02,
    bellyAt: 0.58,
    chestWidth: 0.86,

    upperArm: 0.62,
    forearm: 0.55,
    hand: 0.26,

    thigh: 0.8,
    shin: 0.7,
    foot: 0.3,

    /** Limb thicknesses, which taper toward the joints they end at. */
    armWidth: 0.2,
    forearmWidth: 0.175,
    thighWidth: 0.27,
    shinWidth: 0.22,
} as const;

/**
 * The named points a body is drawn between.
 *
 * A scene positions these once, at rest, and from then on moves the body by turning joints
 * rather than by moving points — so an arm swings without the elbow needing to be
 * recalculated, which is the failure the old rig was built on.
 */
export interface Skeleton {
    /** Head height in pixels, so parts can size themselves from it. */
    unit: number;

    headCentre: Vec;
    chin: Vec;
    neckBase: Vec;

    shoulderL: Vec;
    shoulderR: Vec;
    elbowL: Vec;
    elbowR: Vec;
    wristL: Vec;
    wristR: Vec;

    chest: Vec;
    belly: Vec;
    hipCentre: Vec;
    hipL: Vec;
    hipR: Vec;

    kneeL: Vec;
    kneeR: Vec;
    ankleL: Vec;
    ankleR: Vec;
}

export interface SkeletonOptions {
    /** Where the centre of the head sits on the stage. */
    headAt: Vec;
    /** Head height in stage pixels. */
    unit: number;
    age?: AgeShape;
    /**
     * How far the arms hang from the body at rest, in degrees.
     *
     * Babies rest with their arms out, not pinned to their sides; 22° reads as relaxed
     * rather than at attention.
     */
    armSpread?: number;
    /**
     * Hip abduction — the frog-leg splay young infants rest in.
     *
     * Larger for the younger bands, which is a real developmental difference and one a
     * parent will recognise without being able to name it.
     */
    legSpread?: number;
}

/**
 * The rest skeleton, face-on and upright.
 *
 * Every posture in the app is this skeleton with joints turned, not a second set of
 * coordinates. The one thing joint angles cannot do is change the camera — a flat shape
 * cannot rotate into a side view — so scenes seen from the side build their own landmarks
 * with `sideSkeleton` below.
 */
export const frontSkeleton = ({
    headAt,
    unit,
    age = 'infant',
    armSpread = 22,
    legSpread = 16,
}: SkeletonOptions): Skeleton => {
    const growth = growthFactor(age);
    const limb = (multiple: number) => multiple * unit * growth;

    const chin = vec(headAt.x, headAt.y + HEAD.chin * unit);
    const neckBase = vec(chin.x, chin.y + BODY.neck * unit);

    const shoulderL = vec(neckBase.x - (BODY.shoulderSpread / 2) * unit, neckBase.y);
    const shoulderR = vec(neckBase.x + (BODY.shoulderSpread / 2) * unit, neckBase.y);

    const hipCentre = vec(neckBase.x, neckBase.y + BODY.spine * unit * growth);
    const hipL = vec(hipCentre.x - (BODY.hipSpread / 2) * unit, hipCentre.y);
    const hipR = vec(hipCentre.x + (BODY.hipSpread / 2) * unit, hipCentre.y);

    // Arms and legs are laid out by angle from their sockets rather than by offset, so the
    // rest pose is already expressed the way every later movement will be.
    /**
     * A segment hanging from a socket, `degrees` away from straight down.
     *
     * Positive degrees swing toward stage left, matching the clockwise-on-screen convention
     * the rest of the rig uses; each side therefore passes the opposite sign to spread
     * outward. Getting this backwards folds both arms across the chest, which still draws a
     * body and so is easy to miss by eye — there is a test on it.
     */
    const hang = (from: Vec, length: number, degrees: number): Vec => {
        const radians = ((90 - degrees) * Math.PI) / 180;
        return vec(from.x + Math.cos(radians) * length, from.y + Math.sin(radians) * length);
    };

    const elbowL = hang(shoulderL, limb(BODY.upperArm), -armSpread);
    const elbowR = hang(shoulderR, limb(BODY.upperArm), armSpread);
    const wristL = hang(elbowL, limb(BODY.forearm), -armSpread * 0.5);
    const wristR = hang(elbowR, limb(BODY.forearm), armSpread * 0.5);

    const kneeL = hang(hipL, limb(BODY.thigh), -legSpread);
    const kneeR = hang(hipR, limb(BODY.thigh), legSpread);
    const ankleL = hang(kneeL, limb(BODY.shin), -legSpread * 0.4);
    const ankleR = hang(kneeR, limb(BODY.shin), legSpread * 0.4);

    return {
        unit,
        headCentre: headAt,
        chin,
        neckBase,
        shoulderL,
        shoulderR,
        elbowL,
        elbowR,
        wristL,
        wristR,
        chest: lerpPoint(neckBase, hipCentre, 0.3),
        belly: lerpPoint(neckBase, hipCentre, BODY.bellyAt),
        hipCentre,
        hipL,
        hipR,
        kneeL,
        kneeR,
        ankleL,
        ankleR,
    };
};

/**
 * The rest skeleton seen from the side, lying along the ground.
 *
 * Tummy time, rolling and crawling are all side-on, and a front-facing body cannot be
 * turned into one by rotating joints — the silhouette itself is different. So this is a
 * second set of landmarks rather than a transform of the first: the spine runs horizontally,
 * the near limbs sit slightly below the far ones, and the head is at the leading end.
 *
 * `facing` is +1 for a baby facing stage right, -1 for stage left.
 */
export const sideSkeleton = ({
    headAt,
    unit,
    age = 'infant',
    facing = 1,
}: Omit<SkeletonOptions, 'armSpread' | 'legSpread'> & { facing?: 1 | -1 }): Skeleton => {
    const growth = growthFactor(age);
    const limb = (multiple: number) => multiple * unit * growth;

    const chin = vec(headAt.x + facing * HEAD.chin * unit * 0.55, headAt.y + HEAD.chin * unit * 0.7);
    const neckBase = vec(headAt.x - facing * 0.18 * unit, headAt.y + (HEAD.chin + BODY.neck) * unit);

    // Seen side-on both shoulders sit at nearly the same place; the far one is nudged back
    // and drawn in the shade colour, which is the whole of the depth cue at this scale.
    const shoulderR = vec(neckBase.x - facing * 0.04 * unit, neckBase.y + 0.06 * unit);
    const shoulderL = vec(neckBase.x - facing * 0.16 * unit, neckBase.y + 0.02 * unit);

    const hipCentre = vec(neckBase.x - facing * BODY.spine * unit * growth * 0.92, neckBase.y + 0.3 * unit);
    const hipR = vec(hipCentre.x, hipCentre.y + 0.06 * unit);
    const hipL = vec(hipCentre.x - facing * 0.1 * unit, hipCentre.y - 0.04 * unit);

    const reach = (from: Vec, length: number, dx: number, dy: number): Vec => {
        const scale = length / Math.sqrt(dx * dx + dy * dy);
        return vec(from.x + dx * scale, from.y + dy * scale);
    };

    const elbowR = reach(shoulderR, limb(BODY.upperArm), facing * 0.5, 1);
    const elbowL = reach(shoulderL, limb(BODY.upperArm), facing * 0.45, 1);
    const wristR = reach(elbowR, limb(BODY.forearm), facing * 0.9, 0.5);
    const wristL = reach(elbowL, limb(BODY.forearm), facing * 0.85, 0.45);

    const kneeR = reach(hipR, limb(BODY.thigh), -facing * 0.75, 0.7);
    const kneeL = reach(hipL, limb(BODY.thigh), -facing * 0.8, 0.6);
    const ankleR = reach(kneeR, limb(BODY.shin), -facing * 0.2, 0.98);
    const ankleL = reach(kneeL, limb(BODY.shin), -facing * 0.15, 0.98);

    return {
        unit,
        headCentre: headAt,
        chin,
        neckBase,
        shoulderL,
        shoulderR,
        elbowL,
        elbowR,
        wristL,
        wristR,
        chest: lerpPoint(neckBase, hipCentre, 0.32),
        belly: lerpPoint(neckBase, hipCentre, BODY.bellyAt),
        hipCentre,
        hipL,
        hipR,
        kneeL,
        kneeR,
        ankleL,
        ankleR,
    };
};

/**
 * The rest skeleton on hands and knees.
 *
 * A third camera, and a third silhouette. Crawling is not the prone side view with different
 * angles — the trunk is lifted clear of the floor, the arms are columns under the shoulders
 * and the legs are folded under the hips, so the landmarks have to be laid out for it rather
 * than derived by turning joints on something else.
 *
 * `facing` is +1 for a baby crawling toward stage right.
 */
export const crawlSkeleton = ({
    headAt,
    unit,
    age = 'toddler',
    facing = 1,
}: Omit<SkeletonOptions, 'armSpread' | 'legSpread'> & { facing?: 1 | -1 }): Skeleton => {
    const growth = growthFactor(age);
    const limb = (multiple: number) => multiple * unit * growth;

    const chin = vec(headAt.x + facing * HEAD.chin * unit * 0.5, headAt.y + HEAD.chin * unit * 0.72);
    const neckBase = vec(headAt.x - facing * 0.22 * unit, headAt.y + (HEAD.chin + BODY.neck) * unit * 0.92);

    // The trunk runs roughly level, sloping a little down toward the shoulders — a crawling
    // baby carries their hips slightly higher than their chest.
    const shoulderR = vec(neckBase.x - facing * 0.06 * unit, neckBase.y + 0.1 * unit);
    const shoulderL = vec(neckBase.x - facing * 0.2 * unit, neckBase.y + 0.04 * unit);

    const hipCentre = vec(
        neckBase.x - facing * BODY.spine * unit * growth * 0.86,
        neckBase.y - 0.06 * unit,
    );
    const hipR = vec(hipCentre.x, hipCentre.y + 0.08 * unit);
    const hipL = vec(hipCentre.x - facing * 0.12 * unit, hipCentre.y - 0.02 * unit);

    /** Straight down from a socket to the floor, with a small forward or backward set. */
    const column = (from: Vec, length: number, lean: number): Vec =>
        vec(from.x + facing * lean * length, from.y + Math.sqrt(Math.max(0, 1 - lean * lean)) * length);

    const elbowR = column(shoulderR, limb(BODY.upperArm), 0.12);
    const elbowL = column(shoulderL, limb(BODY.upperArm), 0.06);
    const wristR = column(elbowR, limb(BODY.forearm), 0.06);
    const wristL = column(elbowL, limb(BODY.forearm), 0.02);

    // Knees under the hips, shins running back to the feet.
    const kneeR = column(hipR, limb(BODY.thigh), -0.3);
    const kneeL = column(hipL, limb(BODY.thigh), -0.36);
    const ankleR = vec(kneeR.x - facing * limb(BODY.shin) * 0.92, kneeR.y + limb(BODY.shin) * 0.18);
    const ankleL = vec(kneeL.x - facing * limb(BODY.shin) * 0.94, kneeL.y + limb(BODY.shin) * 0.14);

    return {
        unit,
        headCentre: headAt,
        chin,
        neckBase,
        shoulderL,
        shoulderR,
        elbowL,
        elbowR,
        wristL,
        wristR,
        chest: lerpPoint(neckBase, hipCentre, 0.3),
        belly: lerpPoint(neckBase, hipCentre, BODY.bellyAt),
        hipCentre,
        hipL,
        hipR,
        kneeL,
        kneeR,
        ankleL,
        ankleR,
    };
};

/**
 * The rest skeleton upright and seen from the side, for walking.
 *
 * The fourth camera. A walk cannot be drawn from the front — legs swinging forward and back
 * become legs swinging left and right, which is a different and much less legible movement —
 * so a travelling scene needs its own silhouette with the near and far limbs almost on top of
 * one another and separated by shading alone.
 *
 * The stance is a toddler's, not an adult's: feet apart, knees soft, and the centre of mass
 * carried forward of the ankles. That wide base is most of what makes a new walker look like
 * one, and narrowing it would quietly draw a four-year-old.
 *
 * `facing` is +1 for a child walking toward stage right.
 */
export const walkSkeleton = ({
    headAt,
    unit,
    age = 'toddler',
    facing = 1,
}: Omit<SkeletonOptions, 'armSpread' | 'legSpread'> & { facing?: 1 | -1 }): Skeleton => {
    const growth = growthFactor(age);
    const limb = (multiple: number) => multiple * unit * growth;

    const chin = vec(headAt.x + facing * 0.06 * unit, headAt.y + HEAD.chin * unit);
    const neckBase = vec(chin.x - facing * 0.05 * unit, chin.y + BODY.neck * unit);

    // Side-on, the shoulders sit almost on top of each other; the far one is set back and
    // drawn in shade, which at this scale is the entire depth cue.
    const shoulderR = vec(neckBase.x + facing * 0.03 * unit, neckBase.y + 0.02 * unit);
    const shoulderL = vec(neckBase.x - facing * 0.11 * unit, neckBase.y);

    const hipCentre = vec(
        neckBase.x - facing * 0.06 * unit,
        neckBase.y + BODY.spine * unit * growth,
    );
    const hipR = vec(hipCentre.x + facing * 0.03 * unit, hipCentre.y);
    const hipL = vec(hipCentre.x - facing * 0.09 * unit, hipCentre.y - 0.01 * unit);

    /** Down from a socket, with a forward or backward set as a fraction of the length. */
    const drop = (from: Vec, length: number, lean: number): Vec =>
        vec(
            from.x + facing * lean * length,
            from.y + Math.sqrt(Math.max(0, 1 - lean * lean)) * length,
        );

    // Arms in high guard — hands up around chest height, elbows out. Every new walker does
    // this, and it is the clearest single sign that the walking is recent.
    const elbowR = drop(shoulderR, limb(BODY.upperArm), -0.42);
    const elbowL = drop(shoulderL, limb(BODY.upperArm), -0.46);
    const wristR = drop(elbowR, limb(BODY.forearm), 0.72);
    const wristL = drop(elbowL, limb(BODY.forearm), 0.68);

    const kneeR = drop(hipR, limb(BODY.thigh), 0.12);
    const kneeL = drop(hipL, limb(BODY.thigh), -0.1);
    const ankleR = drop(kneeR, limb(BODY.shin), 0.06);
    const ankleL = drop(kneeL, limb(BODY.shin), -0.04);

    return {
        unit,
        headCentre: headAt,
        chin,
        neckBase,
        shoulderL,
        shoulderR,
        elbowL,
        elbowR,
        wristL,
        wristR,
        chest: lerpPoint(neckBase, hipCentre, 0.3),
        belly: lerpPoint(neckBase, hipCentre, BODY.bellyAt),
        hipCentre,
        hipL,
        hipR,
        kneeL,
        kneeR,
        ankleL,
        ankleR,
    };
};

/**
 * A point partway along a limb, for the soft mass a baby's arms and legs carry.
 *
 * Drawn as a widening at mid-segment rather than by tapering the capsule, which React
 * Native cannot do — a View has one width, so a limb that narrows toward the wrist has to
 * be two shapes. The bone plus a slightly wider rounded swell at mid-segment reads as one
 * soft limb and costs no animated nodes, since neither of them moves independently.
 */
export const midLimb = (from: Vec, to: Vec, at = 0.45): Vec => lerpPoint(from, to, at);
