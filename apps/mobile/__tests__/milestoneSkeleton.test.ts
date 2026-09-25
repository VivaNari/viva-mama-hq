/**
 * The jointed skeleton the milestone illustrations are built on.
 *
 * This exists because of a specific failure in the rig it replaces. Limbs there were
 * independently positioned capsules, each rotating about its own centre, with nothing
 * connecting them: an arm's elbow was a coordinate typed in beside the shoulder rather than
 * derived from it, so any rotation past a few degrees pulled the arm apart. The scenes
 * authored on it could only move things slightly, which is most of why the bodies read as
 * parts laid out rather than as a baby.
 *
 * So the invariant worth testing is not "does it look right" — it is that a limb's segments
 * keep their lengths no matter how far the joints above them turn. Everything below is a
 * pure function, deliberately: the same arithmetic drives the rendered transforms, and
 * testing it directly is both sharper and independent of the Reanimated mock.
 *
 * Run:  npx jest milestoneSkeleton
 */

import {
    along,
    angleBetween,
    ball,
    blobShape,
    bone,
    distance,
    lerpPoint,
    oval,
    rotateAbout,
    solve,
    vec,
    type Vec,
} from '../src/components/milestone/rig/skeleton';

/** Recover a drawn bone's two ends from the style it produced. */
const endsOf = (style: Record<string, any>): [Vec, Vec] => {
    const length = style.width as number;
    const width = style.height as number;
    const degrees = parseFloat(
        (style.transform as { rotate: string }[])[0].rotate.replace('deg', ''),
    );

    const centre = vec((style.left as number) + length / 2, (style.top as number) + width / 2);
    const radians = (degrees * Math.PI) / 180;
    const half = vec((Math.cos(radians) * length) / 2, (Math.sin(radians) * length) / 2);

    return [
        vec(centre.x - half.x, centre.y - half.y),
        vec(centre.x + half.x, centre.y + half.y),
    ];
};

const expectPoint = (actual: Vec, expected: Vec, precision = 6) => {
    expect(actual.x).toBeCloseTo(expected.x, precision);
    expect(actual.y).toBeCloseTo(expected.y, precision);
};

describe('angleBetween', () => {
    /**
     * Y grows downward on a screen, so the raw atan2 is already the clockwise angle React
     * Native's `rotate` wants. Pinning the four cardinals here is what stops someone
     * "fixing" that with a sign flip and inverting every limb in the app.
     */
    it('measures clockwise from the positive x axis', () => {
        const origin = vec(100, 100);

        expect(angleBetween(origin, vec(200, 100))).toBeCloseTo(0, 6);
        expect(angleBetween(origin, vec(100, 200))).toBeCloseTo(90, 6);
        expect(angleBetween(origin, vec(100, 0))).toBeCloseTo(-90, 6);
        expect(Math.abs(angleBetween(origin, vec(0, 100)))).toBeCloseTo(180, 6);
    });
});

describe('rotateAbout', () => {
    it('turns clockwise on screen', () => {
        // Pointing right, turned a quarter turn, should point down.
        expectPoint(rotateAbout(vec(200, 100), vec(100, 100), 90), vec(100, 200));
    });

    it('leaves the pivot itself where it is', () => {
        expectPoint(rotateAbout(vec(100, 100), vec(100, 100), 137), vec(100, 100));
    });

    it('preserves the distance from the pivot at every angle', () => {
        const pivot = vec(360, 240);
        const point = vec(430, 198);
        const radius = distance(pivot, point);

        for (let degrees = -360; degrees <= 360; degrees += 7) {
            expect(distance(pivot, rotateAbout(point, pivot, degrees))).toBeCloseTo(radius, 9);
        }
    });
});

describe('bone', () => {
    /**
     * The whole premise of drawing limbs between landmarks: if a capsule's ends do not land
     * exactly on the two points, the joint pivoting at the far point is attached to nothing
     * and the seam opens as soon as it turns.
     */
    it('lands its ends exactly on the landmarks it is drawn between', () => {
        const cases: [Vec, Vec][] = [
            [vec(300, 200), vec(380, 260)],
            [vec(120, 400), vec(120, 300)],
            [vec(500, 150), vec(420, 150)],
            [vec(640, 90), vec(310, 470)],
        ];

        for (const [from, to] of cases) {
            const [start, end] = endsOf(bone(from, to, 28, '#000') as Record<string, any>);
            expectPoint(start, from, 4);
            expectPoint(end, to, 4);
        }
    });

    it('rounds a limb fully, so a rectangle reads as a limb', () => {
        const style = bone(vec(0, 0), vec(100, 0), 30, '#000') as Record<string, any>;
        expect(style.borderRadius).toBe(15);
    });

    it('survives a zero-length segment without producing NaN', () => {
        const style = bone(vec(10, 10), vec(10, 10), 20, '#000') as Record<string, any>;
        expect(style.width).toBe(0);
        expect(Number.isNaN(style.left)).toBe(false);
    });
});

describe('solve', () => {
    // A left arm at rest: shoulder, elbow below and out, wrist below that.
    const SHOULDER = vec(300, 220);
    const ELBOW = vec(268, 288);
    const WRIST = vec(250, 352);

    const UPPER = distance(SHOULDER, ELBOW);
    const FORE = distance(ELBOW, WRIST);

    /**
     * The reason this module exists.
     *
     * Sweeping the shoulder through 120° while the elbow bends through 90°, the two segments
     * must keep their lengths at every single sample. On the rig this replaces the same
     * sweep changed both distances continuously, because each capsule was positioned
     * independently and only the shoulder's own rotation was ever applied.
     */
    it('keeps every segment its own length through a full sweep', () => {
        for (let shoulder = -60; shoulder <= 60; shoulder += 2) {
            for (let elbow = 0; elbow <= 90; elbow += 5) {
                // Each landmark is solved through the joints it is nested inside, and no
                // others. The elbow's own turn is applied to what hangs below it, not to
                // the elbow itself, exactly as the rendered hierarchy composes.
                const upperChain = [{ pivot: SHOULDER, angle: shoulder }];
                const foreChain = [...upperChain, { pivot: ELBOW, angle: elbow }];

                const movedElbow = solve(ELBOW, upperChain);
                const movedWrist = solve(WRIST, foreChain);

                // The shoulder is the root pivot, so it stays put however far the arm goes.
                expectPoint(solve(SHOULDER, upperChain), SHOULDER, 9);
                expect(distance(SHOULDER, movedElbow)).toBeCloseTo(UPPER, 9);
                expect(distance(movedElbow, movedWrist)).toBeCloseTo(FORE, 9);
            }
        }
    });

    /**
     * Chains are written outermost-first so they can be read straight off the JSX nesting.
     * Getting that order backwards still produces plausible-looking motion — the limb moves,
     * it just bends about the wrong end — which is exactly the kind of bug that survives
     * review by eye.
     */
    it('reads outermost first, so an inner joint cannot move an outer pivot', () => {
        const chain = [
            { pivot: SHOULDER, angle: 0 },
            { pivot: ELBOW, angle: 45 },
        ];

        // Only the elbow turns, so the elbow itself stays put and the wrist swings about it.
        expectPoint(solve(ELBOW, chain), ELBOW, 9);
        expect(distance(solve(WRIST, chain), WRIST)).toBeGreaterThan(1);
        expect(distance(ELBOW, solve(WRIST, chain))).toBeCloseTo(FORE, 9);
    });

    it('carries an outer turn down to everything below it', () => {
        const chain = [{ pivot: SHOULDER, angle: 30 }];

        expectPoint(solve(ELBOW, chain), rotateAbout(ELBOW, SHOULDER, 30), 9);
        expectPoint(solve(WRIST, chain), rotateAbout(WRIST, SHOULDER, 30), 9);
    });

    it('composes to the identity when nothing turns', () => {
        const chain = [
            { pivot: SHOULDER, angle: 0 },
            { pivot: ELBOW, angle: 0 },
        ];

        expectPoint(solve(WRIST, chain), WRIST, 9);
    });

    it('is a no-op on an empty chain', () => {
        expectPoint(solve(WRIST, []), WRIST, 9);
    });
});

describe('along and lerpPoint', () => {
    it('steps along a direction by a distance', () => {
        expectPoint(along(vec(100, 100), vec(200, 100), 30), vec(130, 100));
    });

    it('does not divide by zero when the two points coincide', () => {
        expectPoint(along(vec(50, 50), vec(50, 50), 20), vec(50, 50));
    });

    it('blends between two landmarks', () => {
        expectPoint(lerpPoint(vec(0, 0), vec(100, 200), 0.25), vec(25, 50));
    });
});

describe('rounded shapes', () => {
    /**
     * React Native 0.81 stores each corner as a {vertical, horizontal} pair, so a percentage
     * radius resolves per axis and gives a true ellipse on a non-square box. An earlier pass
     * recorded RN's corners as circular — true of the numeric form only — and approximated
     * every round shape with numeric radii, which is a large part of why the bodies read as
     * stock shapes. These two tests hold that ground.
     */
    it('makes ovals elliptical rather than capsule-shaped', () => {
        const style = oval(vec(100, 100), 80, 140, '#000') as Record<string, any>;

        expect(style.borderRadius).toBe('50%');
        expect(style.width).toBe(80);
        expect(style.height).toBe(140);
    });

    it('gives a blob four independent percentage corners', () => {
        const style = blobShape(
            vec(0, 0),
            100,
            80,
            '#000',
            [52, 46, 44, 54],
        ) as Record<string, any>;

        expect(style.borderTopLeftRadius).toBe('52%');
        expect(style.borderTopRightRadius).toBe('46%');
        expect(style.borderBottomRightRadius).toBe('44%');
        expect(style.borderBottomLeftRadius).toBe('54%');
    });

    it('centres a ball on its landmark', () => {
        const style = ball(vec(200, 300), 40, '#000') as Record<string, any>;

        expect(style.left).toBe(180);
        expect(style.top).toBe(280);
        expect(style.borderRadius).toBe(20);
    });
});
