/**
 * The milestone illustration rig: the timing arithmetic and the pose catalogue.
 *
 * Tested as pure functions, with no rendering. Every visible value in a scene is derived
 * from `animate`/`ease`/`interpolate` and a single clock, so if those are right the picture
 * is right; a snapshot of the rendered output would freeze hundreds of coordinates without
 * checking any of the behaviour that produced them.
 *
 * Run:  npx jest milestoneRig
 */

import { MILESTONE_BANDS, MILESTONE_KEYS } from '../src/data/infantMilestoneData';
import { MILESTONE_POSES } from '../src/components/milestone/rig/poses';
import { ANIMATED_SCENES } from '../src/components/milestone/MilestoneScene';
import { animate, clamp, ease, interpolate } from '../src/components/milestone/rig/motion';

describe('ease', () => {
    it('pins every curve to 0 and 1 at its ends', () => {
        const curves = [
            'linear',
            'easeInQuad',
            'easeOutQuad',
            'easeInOutQuad',
            'easeOutCubic',
            'easeInOutCubic',
            'easeInSine',
            'easeOutSine',
            'easeInOutSine',
            'easeOutBack',
            'easeOutElastic',
        ] as const;

        for (const name of curves) {
            expect(ease(name, 0)).toBeCloseTo(0, 5);
            expect(ease(name, 1)).toBeCloseTo(1, 5);
        }
    });

    /**
     * The overshoot is the point of this curve — it is what makes a head lift read as
     * effort rather than a slide. A version that stayed inside 0..1 would look wrong and
     * still pass the endpoint test above.
     */
    it('overshoots on easeOutBack', () => {
        const peak = Math.max(
            ...Array.from({ length: 101 }, (_, i) => ease('easeOutBack', i / 100)),
        );
        expect(peak).toBeGreaterThan(1);
    });

    it('oscillates on easeOutElastic', () => {
        const samples = Array.from({ length: 101 }, (_, i) => ease('easeOutElastic', i / 100));
        expect(Math.max(...samples)).toBeGreaterThan(1);
        expect(Math.min(...samples)).toBeLessThan(0.05);
    });

    it('is monotonic where it should be', () => {
        let previous = -Infinity;
        for (let i = 0; i <= 100; i++) {
            const value = ease('easeInOutSine', i / 100);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
    });
});

describe('animate', () => {
    const tween = { from: 10, to: 20, start: 2, end: 4, ease: 'linear' } as const;

    /**
     * Holding outside the window is what lets a scene be a pile of independent tweens
     * rather than a state machine — each one simply does nothing until its moment.
     */
    it('holds before the start and after the end', () => {
        expect(animate(0, tween)).toBe(10);
        expect(animate(2, tween)).toBe(10);
        expect(animate(4, tween)).toBe(20);
        expect(animate(99, tween)).toBe(20);
    });

    it('interpolates across the window', () => {
        expect(animate(3, tween)).toBeCloseTo(15, 5);
        expect(animate(2.5, tween)).toBeCloseTo(12.5, 5);
    });

    it('defaults to a 0..1 tween', () => {
        expect(animate(0, { start: 0, end: 1 })).toBe(0);
        expect(animate(1, { start: 0, end: 1 })).toBe(1);
    });

    /** A zero-length window would otherwise divide by zero and paint NaN. */
    it('survives a zero-length window', () => {
        expect(animate(5, { from: 0, to: 1, start: 5, end: 5 })).toBe(0);
        expect(animate(6, { from: 0, to: 1, start: 5, end: 5 })).toBe(1);
    });
});

describe('interpolate', () => {
    it('maps through its stops', () => {
        expect(interpolate(0, [0, 1, 2], [0, 100, 50])).toBe(0);
        expect(interpolate(1, [0, 1, 2], [0, 100, 50])).toBe(100);
        expect(interpolate(2, [0, 1, 2], [0, 100, 50])).toBe(50);
        expect(interpolate(0.5, [0, 1, 2], [0, 100, 50])).toBeCloseTo(50, 5);
        expect(interpolate(1.5, [0, 1, 2], [0, 100, 50])).toBeCloseTo(75, 5);
    });

    it('clamps outside its range', () => {
        expect(interpolate(-5, [0, 1], [7, 9])).toBe(7);
        expect(interpolate(99, [0, 1], [7, 9])).toBe(9);
    });
});

describe('clamp', () => {
    it('bounds on both sides', () => {
        expect(clamp(5, 0, 1)).toBe(1);
        expect(clamp(-5, 0, 1)).toBe(0);
        expect(clamp(0.5, 0, 1)).toBe(0.5);
    });
});

describe('the pose catalogue', () => {
    /**
     * Every milestone needs a drawing. A key with no pose still renders — it falls back to
     * a sitting baby — so a gap would be invisible in the app and only visible here.
     */
    it('poses every milestone in the catalogue', () => {
        const missing = MILESTONE_KEYS.filter((key) => !MILESTONE_POSES[key]);
        expect(missing).toEqual([]);
    });

    it('has no poses for milestones that do not exist', () => {
        const stale = Object.keys(MILESTONE_POSES).filter(
            (key) => !MILESTONE_KEYS.includes(key),
        );
        expect(stale).toEqual([]);
    });
});

describe('the generated catalogue', () => {
    /**
     * Six bands, not the card's seven. The 3-year band is transcribed by the generator and
     * then deliberately excluded — see the `exclude` flag in
     * `scripts/generate-milestone-catalogue.mjs`, which is where that decision lives so that
     * regenerating cannot quietly bring it back.
     */
    it('carries six of the card\'s seven bands, through two years', () => {
        expect(MILESTONE_BANDS.map((band) => band.key)).toEqual([
            '2-3m',
            '4-6m',
            '7-9m',
            '10-12m',
            '18m',
            '24m',
        ]);

        expect(MILESTONE_BANDS.map((band) => band.key)).not.toContain('3y');
    });

    it('carries 29 milestones and 33 warning signs', () => {
        const milestones = MILESTONE_BANDS.flatMap((band) => band.milestones);
        const warnings = MILESTONE_BANDS.flatMap((band) => band.warnings);

        // The card has 33 and 39; the 3-year band's four and six are excluded.
        expect(milestones).toHaveLength(29);
        expect(warnings).toHaveLength(33);
        expect(new Set(milestones).size).toBe(29);
    });

    /** The flat list the API validates against has to be the same set the screen renders. */
    it('keeps MILESTONE_KEYS in step with the bands', () => {
        expect(MILESTONE_KEYS).toEqual(MILESTONE_BANDS.flatMap((band) => band.milestones));
    });

    it('gives every band at least one milestone and one warning sign', () => {
        for (const band of MILESTONE_BANDS) {
            expect(band.milestones.length).toBeGreaterThan(0);
            expect(band.warnings.length).toBeGreaterThan(0);
        }
    });
});

describe('the animated scenes', () => {
    /**
     * The bands whose scenes have all been authored.
     *
     * The goal is every one of the 33 milestones animating, band by band. Listing the
     * finished ones here rather than counting scenes makes the next step obvious and makes
     * a regression loud: a scene dropping out of the registry degrades *invisibly*, because
     * the card falls back to a still pose and still draws — it just stops moving, which no
     * other test would notice.
     */
    const COMPLETED_BANDS = ['2-3m', '4-6m', '7-9m', '10-12m', '18m', '24m'];

    it('animates every milestone in the bands that are finished', () => {
        for (const bandKey of COMPLETED_BANDS) {
            const band = MILESTONE_BANDS.find((candidate) => candidate.key === bandKey);
            expect(band).toBeDefined();

            const missing = band!.milestones.filter((key) => !(key in ANIMATED_SCENES));
            expect(missing).toEqual([]);
        }
    });

    /**
     * Every milestone that ships has an authored scene, and the still-pose fallback is now
     * unreachable in practice.
     *
     * It is kept anyway, and this is why: a milestone added to the sheet later would come
     * through the generator without a scene, and the fallback is what keeps its card drawing
     * something rather than nothing. This assertion is what makes that a caught condition
     * instead of a silent one.
     */
    it('has an authored scene for every milestone that ships', () => {
        const waiting = MILESTONE_KEYS.filter((key) => !(key in ANIMATED_SCENES));
        expect(waiting).toEqual([]);
    });

    it('animates a milestone that is actually on the card', () => {
        for (const key of Object.keys(ANIMATED_SCENES)) {
            expect(MILESTONE_KEYS).toContain(key);
        }
    });

    it('gives every scene a positive duration and steps inside it', () => {
        for (const [key, scene] of Object.entries(ANIMATED_SCENES)) {
            expect(scene.duration).toBeGreaterThan(0);
            expect(scene.steps.length).toBeGreaterThan(0);

            for (const step of scene.steps) {
                // A chip that seeks past the end of the loop would jump the clock to a
                // frame the scene never plays.
                expect(step.at).toBeGreaterThanOrEqual(0);
                expect(step.at).toBeLessThan(scene.duration);
                expect(step.labelKey).toMatch(/^infant\.milestone\.steps\./);
            }
            expect(key).toBeTruthy();
        }
    });

    /**
     * Every scene needs its own still frame, because that is what a card shows when the
     * viewer has asked the system to reduce motion. A scene without one would fall back to
     * whatever the pose happens to be at t=0, which is the start of the performance and
     * almost never the moment that explains the milestone.
     */
    it('gives every step a distinct moment to seek to', () => {
        for (const scene of Object.values(ANIMATED_SCENES)) {
            const moments = scene.steps.map((step) => step.at);
            expect(new Set(moments).size).toBe(moments.length);

            // In order, so the chips read left to right as the performance runs.
            for (let i = 1; i < moments.length; i++) {
                expect(moments[i]).toBeGreaterThan(moments[i - 1]);
            }
        }
    });

    /**
     * Two of the six 2-3 month scenes are a baby and a parent, and they would be the same
     * drawing if their timing were not deliberately different — one tracks a face through a
     * movement, the other is noticed and then replies. Different durations is a weak proxy
     * for that, but it does catch the specific mistake of copying one scene to make the
     * other and forgetting to change what it does.
     */
    it('does not give the two parent scenes the same timing', () => {
        const recognises = ANIMATED_SCENES.begins_to_recognize_the_mothers_face;
        const smiles = ANIMATED_SCENES.develops_a_social_smile;

        expect(recognises.duration).not.toBe(smiles.duration);
        expect(recognises.steps.map((s) => s.labelKey)).not.toEqual(
            smiles.steps.map((s) => s.labelKey),
        );
    });
});
