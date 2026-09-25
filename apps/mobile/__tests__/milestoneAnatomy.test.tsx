/**
 * Infant proportions, and the head built from them.
 *
 * The complaint this answers was that the bodies did not look like babies. That is not a
 * matter of taste — it is a short list of measurable things the previous rig got wrong: the
 * head was a circle about the size of the torso, the eyes sat above its midline, and the
 * limbs were laid out by hand rather than by proportion. What follows pins the corrections
 * so that a later tidy-up cannot quietly undo them, because every one of these numbers looks
 * arbitrary if you do not know why it is what it is.
 *
 * Run:  npx jest milestoneAnatomy
 */

import React from 'react';
import { AccessibilityInfo, StyleSheet, View as RNView } from 'react-native';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';

import {
    AGE_PROPORTIONS,
    BODY,
    HEAD,
    frontSkeleton,
    growthFactor,
    sideSkeleton,
    type AgeShape,
} from '../src/components/milestone/rig/anatomy';
import { distance, vec } from '../src/components/milestone/rig/skeleton';
import Head, { MOUTH } from '../src/components/milestone/rig/Head';
import BabyHand from '../src/components/milestone/rig/BabyHand';
import { Arm, Leg, Torso } from '../src/components/milestone/rig/BabyBody';
import { Joint } from '../src/components/milestone/rig/Joint';
import { ScenePhase } from '../src/components/milestone/rig/parts';
import { useReduceMotion } from '../src/components/milestone/rig/useReduceMotion';
import { SKIN } from '../src/components/milestone/rig/palette';

const UNIT = 100;
const HEAD_AT = vec(360, 140);

/** Crown to sole, in head heights. */
const totalHeads = (age: AgeShape): number => {
    const s = frontSkeleton({ headAt: HEAD_AT, unit: UNIT, age });
    const crown = s.headCentre.y + HEAD.crown * UNIT;
    const sole = Math.max(s.ankleL.y, s.ankleR.y) + BODY.foot * UNIT * 0.4;
    return (sole - crown) / UNIT;
};

describe('the infant head', () => {
    /**
     * The single most important number in the file. In a baby there is half again as much
     * skull above the eyes as there is face below them; in an adult the two are about equal.
     * Putting the eyes on or above the midline is what made the old head read as a small
     * adult, and it is an easy thing to "correct" back.
     */
    it('puts the eyes below the midline, under a tall cranium', () => {
        expect(HEAD.eyeLine).toBeGreaterThan(0);

        const aboveEyes = HEAD.eyeLine - HEAD.crown;
        const belowEyes = HEAD.chin - HEAD.eyeLine;

        expect(aboveEyes / belowEyes).toBeGreaterThan(1.35);
    });

    it('carries its widest point at the cheeks, below the eyes', () => {
        expect(HEAD.cheekLine).toBeGreaterThan(HEAD.eyeLine);

        // The cheeks have to break the skull's own outline, or the face is a circle with
        // some shapes drawn inside it. The skull is an ellipse, so what they have to clear
        // is its half-width *at the cheek line* — which is narrower than its widest point,
        // and is the comparison that actually says whether the silhouette bulges.
        const skullAtCheeks =
            (HEAD.skullWidth / 2) *
            Math.sqrt(1 - (HEAD.cheekLine / (HEAD.skullHeight / 2)) ** 2);
        const cheekEdge = HEAD.cheekSpread + 0.3 / 2;

        expect(cheekEdge).toBeGreaterThan(skullAtCheeks + 0.03);
    });

    it('is taller than it is wide', () => {
        expect(HEAD.skullHeight).toBeGreaterThan(HEAD.skullWidth);
    });

    it('sets the ears on the eye line, where they belong', () => {
        expect(Math.abs(HEAD.earLine - HEAD.eyeLine)).toBeLessThan(0.06);
    });
});

describe('growth', () => {
    /**
     * Ageing the drawing has to come out of the body, because the head is one head tall at
     * every age by definition. So every extra head of total height is distributed across the
     * spine and limbs alone — which is why `growthFactor` is derived from the target rather
     * than typed in next to it.
     */
    it('leaves the infant table untouched and lengthens everything else', () => {
        expect(growthFactor('infant')).toBeCloseTo(1, 6);
        expect(growthFactor('toddler')).toBeGreaterThan(1);
        expect(growthFactor('child')).toBeGreaterThan(growthFactor('toddler'));
    });

    /**
     * Measured crown-to-sole, not asserted from the table — the legs rest splayed, so the
     * vertical extent is a little short of the segment lengths laid end to end. Within a
     * fifth of a head is the tolerance that buys.
     */
    it('measures out at roughly its target height at every age', () => {
        for (const age of ['infant', 'toddler', 'child'] as const) {
            expect(totalHeads(age)).toBeCloseTo(AGE_PROPORTIONS[age], 0);
            expect(Math.abs(totalHeads(age) - AGE_PROPORTIONS[age])).toBeLessThan(0.2);
        }
    });

    it('reads as a different age from proportion alone', () => {
        expect(totalHeads('child') - totalHeads('infant')).toBeGreaterThan(0.6);
    });
});

describe('frontSkeleton', () => {
    const skeleton = frontSkeleton({ headAt: HEAD_AT, unit: UNIT });

    /**
     * A positive spread has to take each limb *outward*. The sign convention makes it easy
     * to get backwards, and backwards still draws a body — one with both arms folded across
     * its chest and its knees crossed — so it survives a look but not this.
     */
    it('hangs the arms and legs away from the body, not across it', () => {
        expect(skeleton.elbowL.x).toBeLessThan(skeleton.shoulderL.x);
        expect(skeleton.elbowR.x).toBeGreaterThan(skeleton.shoulderR.x);
        expect(skeleton.kneeL.x).toBeLessThan(skeleton.hipL.x);
        expect(skeleton.kneeR.x).toBeGreaterThan(skeleton.hipR.x);
    });

    it('keeps every segment the length the proportion table gives it', () => {
        expect(distance(skeleton.shoulderL, skeleton.elbowL)).toBeCloseTo(BODY.upperArm * UNIT, 4);
        expect(distance(skeleton.elbowL, skeleton.wristL)).toBeCloseTo(BODY.forearm * UNIT, 4);
        expect(distance(skeleton.hipL, skeleton.kneeL)).toBeCloseTo(BODY.thigh * UNIT, 4);
        expect(distance(skeleton.kneeL, skeleton.ankleL)).toBeCloseTo(BODY.shin * UNIT, 4);
    });

    it('builds downward: head, neck, shoulders, hips, knees, ankles', () => {
        const chain = [
            skeleton.headCentre.y,
            skeleton.chin.y,
            skeleton.neckBase.y,
            skeleton.hipCentre.y,
            skeleton.kneeL.y,
            skeleton.ankleL.y,
        ];

        for (let i = 1; i < chain.length; i++) {
            expect(chain[i]).toBeGreaterThan(chain[i - 1]);
        }
    });

    it('gives a baby barely any neck', () => {
        expect(distance(skeleton.chin, skeleton.neckBase)).toBeLessThan(0.2 * UNIT);
    });

    it('is symmetric about the spine', () => {
        const spine = skeleton.neckBase.x;
        expect(spine - skeleton.shoulderL.x).toBeCloseTo(skeleton.shoulderR.x - spine, 6);
        expect(spine - skeleton.elbowL.x).toBeCloseTo(skeleton.elbowR.x - spine, 6);
    });
});

describe('sideSkeleton', () => {
    /**
     * A second set of landmarks rather than a rotation of the first, because a flat shape
     * cannot turn into a side view — tummy time, rolling and crawling need a different
     * silhouette, not different angles.
     */
    it('lays the spine out along the ground with the head leading', () => {
        const right = sideSkeleton({ headAt: HEAD_AT, unit: UNIT, facing: 1 });
        expect(right.hipCentre.x).toBeLessThan(right.neckBase.x);

        const left = sideSkeleton({ headAt: HEAD_AT, unit: UNIT, facing: -1 });
        expect(left.hipCentre.x).toBeGreaterThan(left.neckBase.x);
    });

    it('keeps the same segment lengths as the front view', () => {
        const side = sideSkeleton({ headAt: HEAD_AT, unit: UNIT });
        expect(distance(side.shoulderR, side.elbowR)).toBeCloseTo(BODY.upperArm * UNIT, 4);
        expect(distance(side.hipR, side.kneeR)).toBeCloseTo(BODY.thigh * UNIT, 4);
    });
});

describe('the head', () => {
    const renderHead = (props: Partial<React.ComponentProps<typeof Head>> = {}) =>
        render(<Head at={HEAD_AT} unit={UNIT} skin={SKIN.warm} {...props} />);

    it('renders without a clock, for a still thumbnail', () => {
        expect(() => renderHead()).not.toThrow();
    });

    it('renders at every facing without throwing', () => {
        for (const facing of [-1, -0.5, 0, 0.5, 1]) {
            expect(() => renderHead({ facing })).not.toThrow();
        }
    });

    /**
     * A smile and an open mouth are the same shape at different settings — the flat top edge
     * is the entire difference. Items 2, 10 and 11 all turn on it.
     */
    it('separates a smile from an open mouth by its top edge alone', () => {
        expect(MOUTH.smile.curve).toBe(1);
        expect(MOUTH.laugh.curve).toBeLessThan(0.5);
        expect(MOUTH.ah.curve).toBe(0);
    });

    it('gives the three babble vowels three distinct mouth shapes', () => {
        const shapes = [MOUTH.ah, MOUTH.ee, MOUTH.oo];
        const ratios = shapes.map((s) => s.w / s.h);

        // Wide, wider still, and small and round — no two alike.
        expect(new Set(ratios.map((r) => r.toFixed(2))).size).toBe(3);
    });
});

describe('a whole baby', () => {
    const skeleton = frontSkeleton({ headAt: HEAD_AT, unit: 90 });
    const skin = SKIN.warm;

    /** A clock that never advances, so every frame under test is the same one. */
    const clock = {
        time: { value: 1.5 } as { value: number },
        duration: 4,
        seek: () => undefined,
        replay: () => undefined,
    };

    const Baby: React.FC<{ animated: boolean }> = ({ animated }) => {
        const timing = animated ? { clock: clock as never } : {};
        const wave = animated ? (t: number) => 12 * Math.sin(t) : undefined;

        return (
            <>
                <Torso
                    skeleton={skeleton}
                    skin={skin}
                    breathe={animated ? (t: number) => 1 + 0.01 * Math.sin(t * 2.4) : undefined}
                    {...timing}
                />
                <Leg skeleton={skeleton} skin={skin} side="left" far root={wave} {...timing} />
                <Leg skeleton={skeleton} skin={skin} side="right" root={wave} {...timing} />
                <Arm skeleton={skeleton} skin={skin} side="left" far hand="open" root={wave} {...timing} />
                <Arm skeleton={skeleton} skin={skin} side="right" hand="pincer" root={wave} {...timing} />
                <Head
                    at={skeleton.headCentre}
                    unit={skeleton.unit}
                    skin={skin}
                    turnTo={animated ? (t: number) => Math.sin(t) : undefined}
                    blink={animated ? () => 0 : undefined}
                    {...timing}
                />
            </>
        );
    };

    it('assembles from head to foot without throwing, still or animated', () => {
        expect(() => render(<Baby animated={false} />)).not.toThrow();
        expect(() => render(<Baby animated />)).not.toThrow();
    });

    it('draws every hand shape', () => {
        for (const shape of ['open', 'fist', 'palmar', 'pincer', 'point'] as const) {
            expect(() =>
                render(<BabyHand at={vec(300, 300)} unit={90} skin={skin} shape={shape} />),
            ).not.toThrow();
        }
    });

    /**
     * The two grips the card actually distinguishes between. A palmar grasp closes every
     * finger together around an object; a pincer is finger and thumb with daylight between
     * them. If their silhouettes were the same, milestones 14 and 25 would be the same
     * picture — so the shapes have to differ in more than a label.
     */
    it('gives the palmar grasp and the pincer grip different silhouettes', () => {
        const shapesOf = (shape: 'palmar' | 'pincer') =>
            render(<BabyHand at={vec(300, 300)} unit={90} skin={skin} shape={shape} />)
                .UNSAFE_getAllByType(RNView)
                .map((node) => JSON.stringify(node.props.style))
                .join('|');

        expect(shapesOf('palmar')).not.toEqual(shapesOf('pincer'));
    });

    /**
     * The motion budget, measured rather than promised.
     *
     * Thirty-three thumbnails animating at once is only affordable if each one moves a small
     * number of groups, so the budget is 8 animated nodes per thumbnail. `Part` only does
     * per-frame work when it has both a clock and an animator — the rest evaluate once and
     * then sit still — so what is counted here is the ones that actually cost something.
     */
    it('costs a countable number of animated nodes', () => {
        const Reanimated = require('react-native-reanimated');
        const worklets: (() => object)[] = [];

        const spy = jest
            .spyOn(Reanimated, 'useAnimatedStyle')
            .mockImplementation(((worklet: () => object) => {
                worklets.push(worklet);
                try {
                    return worklet() || {};
                } catch {
                    return {};
                }
            }) as never);

        try {
            render(<Baby animated />);

            const moving = worklets.filter((worklet) => {
                try {
                    return Object.keys(worklet() ?? {}).length > 0;
                } catch {
                    return false;
                }
            }).length;

            // Breath, four limb roots, the head's face plate, its eye group, and the
            // profile fade — a baby moving everything it has, exactly at the budget. If
            // this number climbs, a thumbnail grid gets more expensive, so it is pinned
            // rather than bounded.
            expect(moving).toBe(8);
        } finally {
            spy.mockRestore();
        }
    });

    it('costs nothing per frame when nothing is given a worklet', () => {
        const Reanimated = require('react-native-reanimated');
        const worklets: (() => object)[] = [];

        const spy = jest
            .spyOn(Reanimated, 'useAnimatedStyle')
            .mockImplementation(((worklet: () => object) => {
                worklets.push(worklet);
                return {};
            }) as never);

        try {
            render(<Baby animated={false} />);
            const moving = worklets.filter(
                (worklet) => Object.keys(worklet() ?? {}).length > 0,
            ).length;

            expect(moving).toBe(0);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('scene phase', () => {
    /**
     * One clock drives every card in a band, which keeps six moving thumbnails to a single
     * timing loop. Left alone that also means six babies performing the identical frame at
     * the identical moment — which reads as a rendering fault rather than as six children.
     * A phase per card buys the difference for nothing: the same clock, read elsewhere.
     */
    const Spinner: React.FC<{ clock: never }> = ({ clock }) => (
        <Joint
            pivot={vec(100, 100)}
            clock={clock}
            turn={(t: number) => {
                'worklet';
                return t * 10;
            }}
        />
    );

    const angleUnder = (phase: number, at: number): string => {
        const clock = {
            time: { value: at },
            duration: 10,
            seek: () => undefined,
            replay: () => undefined,
        } as never;

        const tree = render(
            <ScenePhase.Provider value={phase}>
                <Spinner clock={clock} />
            </ScenePhase.Provider>,
        );

        const style = tree
            .UNSAFE_getAllByType(RNView)
            .map((node) => StyleSheet.flatten(node.props.style) ?? {})
            .find((flat) => flat.transformOrigin);

        return (style?.transform as { rotate: string }[])
            .find((entry) => 'rotate' in entry)!
            .rotate;
    };

    it('reads the shared clock at a different moment per card', () => {
        expect(angleUnder(0, 1)).not.toEqual(angleUnder(1.618, 1));
    });

    it('defaults to no offset, so a lone scene is unshifted', () => {
        expect(angleUnder(0, 2)).toBe('20deg');
    });

    /**
     * A scene's tweens hold their final value past the end of its duration, so an unwrapped
     * offset would park the last card at the end of the performance and leave it there.
     */
    it('wraps at the duration rather than running off the end', () => {
        // Phase 4 at t=8 wraps to 2, which is the same frame as phase 0 at t=2.
        expect(angleUnder(4, 8)).toBe(angleUnder(0, 2));
    });
});

describe('reduce motion', () => {
    /**
     * A grid of babies all moving at once is what this setting exists for, and vestibular
     * disorders and migraine are not rare among the mothers this app serves. Scenes need no
     * special case: withholding the clock gives every card the still frame it had already
     * chosen as its most legible, so the screen loses its movement and none of its meaning.
     */
    afterEach(() => jest.restoreAllMocks());

    it('starts off and reports what the system says', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
            remove: () => undefined,
        } as never);

        const { result } = renderHook(() => useReduceMotion());

        expect(result.current).toBe(false);
        await waitFor(() => expect(result.current).toBe(true));
    });

    it('stays off when the system says nothing is set', async () => {
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
            remove: () => undefined,
        } as never);

        const { result } = renderHook(() => useReduceMotion());
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('follows the setting being changed while the screen is open', async () => {
        let notify: ((enabled: boolean) => void) | undefined;

        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
            _event: string,
            handler: (enabled: boolean) => void,
        ) => {
            notify = handler;
            return { remove: () => undefined };
        }) as never);

        const { result } = renderHook(() => useReduceMotion());
        await waitFor(() => expect(result.current).toBe(false));

        act(() => notify?.(true));
        expect(result.current).toBe(true);
    });

    it('unsubscribes when the screen goes away', async () => {
        const remove = jest.fn();
        jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove } as never);

        const { unmount, result } = renderHook(() => useReduceMotion());
        await waitFor(() => expect(result.current).toBe(false));

        unmount();
        expect(remove).toHaveBeenCalled();
    });
});
