import type { ViewStyle } from 'react-native';

/**
 * The geometry a jointed body is built from.
 *
 * The rig this replaces had no skeleton: every limb was an independently positioned capsule
 * rotating about its own centre, so nothing was attached to anything. A shoulder turned more
 * than a few degrees and the arm simply left the body — which is why the scenes authored on
 * it could only ever move things slightly, and why the still poses read as parts laid out
 * rather than as a baby.
 *
 * The fix is to stop describing limbs by position and start describing them by their ends.
 * Everything here works in **stage coordinates** (the 720x480 authoring space), and a body is
 * written as a handful of named landmarks — shoulder, elbow, wrist — with bones drawn between
 * them and joints pivoting at them. A bone ends where the next joint pivots because it is
 * literally the same point, so an arm cannot come apart no matter how far it swings.
 *
 * Angles are degrees, clockwise on screen, which is what React Native's `rotate` takes.
 */

export interface Vec {
    x: number;
    y: number;
}

/**
 * A point.
 *
 * Marked as a worklet, which it has to be: gaze targets and body displacements are built
 * inside animators that run on the UI thread, and a plain function called from there fails
 * at runtime with "tried to synchronously call a non-worklet function". Nothing under test
 * catches that, because the Jest mock runs every worklet on the JS thread where any function
 * is callable — see `milestoneWorklets.test.tsx`, which exists for exactly this.
 */
export const vec = (x: number, y: number): Vec => {
    'worklet';
    return { x, y };
};

const RAD = Math.PI / 180;

/** Straight-line distance. */
export function distance(a: Vec, b: Vec): number {
    'worklet';
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * The on-screen angle of `a -> b`, in degrees.
 *
 * Y grows downward on a screen, so `atan2(dy, dx)` already gives the clockwise angle React
 * Native's `rotate` expects; no sign flip, deliberately.
 */
export function angleBetween(a: Vec, b: Vec): number {
    'worklet';
    return Math.atan2(b.y - a.y, b.x - a.x) / RAD;
}

/** Rotate `point` about `pivot` by `degrees`, clockwise on screen. */
export function rotateAbout(point: Vec, pivot: Vec, degrees: number): Vec {
    'worklet';

    const rad = degrees * RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;

    return {
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
    };
}

/** Move along the direction `from -> to`, `by` pixels past `from`. */
export function along(from: Vec, to: Vec, by: number): Vec {
    'worklet';

    const length = distance(from, to);
    if (length === 0) return { x: from.x, y: from.y };

    return {
        x: from.x + ((to.x - from.x) / length) * by,
        y: from.y + ((to.y - from.y) / length) * by,
    };
}

/** Straight-line blend, for easing a landmark between two rest poses. */
export function lerpPoint(a: Vec, b: Vec, amount: number): Vec {
    'worklet';
    return {
        x: a.x + (b.x - a.x) * amount,
        y: a.y + (b.y - a.y) * amount,
    };
}

export interface JointTurn {
    pivot: Vec;
    /** Degrees, clockwise. */
    angle: number;
}

/**
 * Where a point ends up once the joints above it have turned.
 *
 * `chain` is ordered **outermost first** — the same order the joints are nested in the JSX,
 * so it can be read straight off the markup. Nesting composes a leaf point as
 * `root(parent(leaf(p)))`, so the turns are applied from the end of the list backwards.
 *
 * Pass a landmark only the joints it is actually nested *inside*. An elbow sits inside the
 * shoulder joint but above its own, so it is solved through the shoulder alone; the wrist
 * below it is solved through both. Handing every landmark the whole chain would have the
 * elbow's rotation moving the elbow, which is not what the rendered hierarchy does.
 *
 * Scenes need this whenever something has to meet the body in world space: a toy held in a
 * hand, sound arcs leaving a mouth, a highlight ring on the ear being pointed at. Those are
 * exactly the places the old rig drifted, because the prop's position was typed in by hand
 * next to a limb whose real position was a different calculation entirely.
 */
export function solve(point: Vec, chain: readonly JointTurn[]): Vec {
    'worklet';

    let current = point;

    for (let i = chain.length - 1; i >= 0; i--) {
        current = rotateAbout(current, chain[i].pivot, chain[i].angle);
    }

    return current;
}

/**
 * A limb segment drawn between two landmarks.
 *
 * Positioned by its midpoint and rotated about its own centre, so the capsule's ends land
 * exactly on `from` and `to`. The corner radius is half the width, which is what makes a
 * rectangle read as a limb.
 */
export function bone(
    from: Vec,
    to: Vec,
    width: number,
    color: string,
    extra?: ViewStyle,
): ViewStyle {
    'worklet';

    const length = distance(from, to);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    return {
        position: 'absolute',
        left: midX - length / 2,
        top: midY - width / 2,
        width: length,
        height: width,
        borderRadius: width / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angleBetween(from, to)}deg` }],
        ...extra,
    };
}

/**
 * A circle centred on a landmark.
 *
 * Two uses, both structural. At a joint it is the knuckle: drawn at the bone's own width it
 * covers the seam where two capsules meet, and drawn slightly wider it becomes the knee and
 * elbow mass a baby's limbs actually have. Elsewhere it is a hand, a foot, a cheek.
 */
export function ball(centre: Vec, size: number, color: string, extra?: ViewStyle): ViewStyle {
    'worklet';

    return {
        position: 'absolute',
        left: centre.x - size / 2,
        top: centre.y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        ...extra,
    };
}

/**
 * An oval centred on a landmark, optionally tilted.
 *
 * A true ellipse, not a capsule. React Native 0.81 stores each corner as a `{vertical,
 * horizontal}` pair, so a percentage radius resolves per axis exactly as CSS does and
 * `'50%'` on a non-square box gives a real ellipse. The earlier pass through this rig
 * recorded RN corners as circular and approximated round shapes with numeric radii, which
 * is true of the numeric form only — and is a good part of why the bodies read as stock
 * shapes. Nothing on a baby is a perfect circle: the cranium is taller than it is wide, a
 * cheek wider than it is tall, a belly rounder than either.
 */
export function oval(
    centre: Vec,
    width: number,
    height: number,
    color: string,
    rotate = 0,
    extra?: ViewStyle,
): ViewStyle {
    'worklet';

    return {
        position: 'absolute',
        left: centre.x - width / 2,
        top: centre.y - height / 2,
        width,
        height,
        borderRadius: '50%',
        backgroundColor: color,
        transform: [{ rotate: `${rotate}deg` }],
        ...extra,
    };
}

/**
 * A soft asymmetric shape — the design artifact's four-value percentage `border-radius`.
 *
 * Each corner takes its own percentage and resolves elliptically, so this is the artifact's
 * original CSS rather than a stand-in for it. Torsos, cheeks, and anything else that should
 * look grown rather than drawn.
 *
 * Corners are clockwise from the top left, as in CSS.
 */
export function blobShape(
    centre: Vec,
    width: number,
    height: number,
    color: string,
    corners: [number, number, number, number],
    rotate = 0,
    extra?: ViewStyle,
): ViewStyle {
    'worklet';

    return {
        position: 'absolute',
        left: centre.x - width / 2,
        top: centre.y - height / 2,
        width,
        height,
        borderTopLeftRadius: `${corners[0]}%`,
        borderTopRightRadius: `${corners[1]}%`,
        borderBottomRightRadius: `${corners[2]}%`,
        borderBottomLeftRadius: `${corners[3]}%`,
        backgroundColor: color,
        transform: [{ rotate: `${rotate}deg` }],
        ...extra,
    };
}
