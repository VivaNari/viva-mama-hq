/**
 * Everything a milestone animator reaches on the UI thread must be a worklet.
 *
 * This file exists because of a bug that shipped past every other test in the suite. A gaze
 * animator built its return value with `vec(x, y)` — and `vec` was an ordinary arrow
 * function. On a device that throws on the first frame, once per frame, forever:
 *
 *     [Worklets] Tried to synchronously call a non-worklet function `vec` on the UI thread.
 *
 * Nothing caught it, and nothing *could* have. The Jest mock for Reanimated runs every
 * worklet on the JS thread, where any function is callable, so the scenes rendered perfectly,
 * animated correctly, and passed assertions about their motion. The thread boundary is the
 * one thing the mock cannot simulate.
 *
 * What makes it testable is that the Babel plugin leaves its work behind: a compiled worklet
 * carries a `__workletHash`, and a `__closure` holding everything it captured from its
 * surrounding scope. So the boundary can be checked without crossing it — walk each
 * animator's closure, and every function in there has to be a worklet too, recursively.
 *
 * Run:  npx jest milestoneWorklets
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { ANIMATED_SCENES } from '../src/components/milestone/MilestoneScene';
import * as motion from '../src/components/milestone/rig/motion';
import * as skeleton from '../src/components/milestone/rig/skeleton';
import { blendMouth } from '../src/components/milestone/rig/Head';

/** A function the Babel plugin has compiled into a worklet. */
interface CompiledWorklet {
    __workletHash?: number;
    __closure?: Record<string, unknown>;
}

const isFunction = (value: unknown): value is CompiledWorklet => typeof value === 'function';

const isWorklet = (value: unknown): boolean =>
    isFunction(value) && typeof value.__workletHash === 'number';

/**
 * Every function reachable from a worklet's captured scope, with the path that led there.
 *
 * Recursive, because a worklet that captures a worklet that captures a plain helper fails
 * just as hard as a direct call — and that is the shape the scenes actually have, where a
 * scene's animator calls a phase function which builds a point.
 */
const capturedFunctions = (
    root: unknown,
    path: string,
    seen = new Set<unknown>(),
): { path: string; fn: CompiledWorklet }[] => {
    if (!isFunction(root) || seen.has(root)) return [];
    seen.add(root);

    const found: { path: string; fn: CompiledWorklet }[] = [];
    const closure = root.__closure ?? {};

    for (const [name, value] of Object.entries(closure)) {
        if (isFunction(value)) {
            found.push({ path: `${path} -> ${name}`, fn: value });
            found.push(...capturedFunctions(value, `${path} -> ${name}`, seen));
        }
    }

    return found;
};

describe('the rig helpers', () => {
    /**
     * These are the functions scenes build values with inside their animators. Each one is
     * a worklet by intent; this asserts the directive is actually there and was actually
     * compiled, which is not the same thing as having typed it.
     */
    const workletCallable: Record<string, unknown> = {
        // geometry
        vec: skeleton.vec,
        distance: skeleton.distance,
        angleBetween: skeleton.angleBetween,
        rotateAbout: skeleton.rotateAbout,
        along: skeleton.along,
        lerpPoint: skeleton.lerpPoint,
        solve: skeleton.solve,
        bone: skeleton.bone,
        ball: skeleton.ball,
        oval: skeleton.oval,
        blobShape: skeleton.blobShape,

        // timing
        ease: motion.ease,
        clamp: motion.clamp,
        animate: motion.animate,
        interpolate: motion.interpolate,
        deg: motion.deg,

        // expression
        blendMouth,
    };

    it.each(Object.keys(workletCallable))('compiles %s as a worklet', (name) => {
        expect(isWorklet(workletCallable[name])).toBe(true);
    });

    /**
     * The plugin has to have run at all. Without this, a misconfigured Babel setup would
     * make every assertion above fail in a confusing way rather than an obvious one.
     */
    it('is running with the worklet plugin compiled in', () => {
        expect((skeleton.vec as CompiledWorklet).__closure).toBeDefined();
    });
});

describe('closure walking', () => {
    /**
     * The check itself has to be shown to work, or a bug in it reads as a clean pass. This
     * builds the exact shape of the bug that got through — a worklet capturing a plain
     * function — and confirms the walk finds it.
     */
    it('finds a plain function captured by a worklet', () => {
        const plain = (n: number) => n * 2;
        const animator = (t: number) => {
            'worklet';
            return plain(t);
        };

        const captured = capturedFunctions(animator, 'animator');
        const offenders = captured.filter((entry) => !isWorklet(entry.fn));

        expect(offenders.map((entry) => entry.path)).toContain('animator -> plain');
    });

    it('passes a worklet that captures only worklets', () => {
        const inner = (n: number) => {
            'worklet';
            return skeleton.vec(n, n);
        };
        const animator = (t: number) => {
            'worklet';
            return inner(t);
        };

        const offenders = capturedFunctions(animator, 'animator').filter(
            (entry) => !isWorklet(entry.fn),
        );

        expect(offenders).toEqual([]);
    });
});

describe('every animated scene', () => {
    /**
     * The sweep this file was written for.
     *
     * Each scene is rendered, the worklets it hands to `useAnimatedStyle` are captured, and
     * every function reachable through their closures has to be a worklet as well. That
     * chain is deep and entirely invisible at the call site — a card's animated style
     * captures the joint's animator, which captures the scene's angle function, which
     * captures a phase helper, which builds a point. Any link in it being a plain function
     * throws on the device and nowhere else.
     */
    const scenes = Object.keys(ANIMATED_SCENES);

    const workletsOf = (key: string): CompiledWorklet[] => {
        const Reanimated = require('react-native-reanimated');
        const captured: CompiledWorklet[] = [];

        const spy = jest
            .spyOn(Reanimated, 'useAnimatedStyle')
            .mockImplementation(((worklet: CompiledWorklet) => {
                captured.push(worklet);
                try {
                    return (worklet as unknown as () => object)() || {};
                } catch {
                    return {};
                }
            }) as never);

        try {
            const { Component } = ANIMATED_SCENES[key];
            render(
                <Component
                    clock={
                        {
                            time: { value: 1 },
                            duration: 10,
                            seek: () => undefined,
                            replay: () => undefined,
                        } as never
                    }
                    detail="full"
                />,
            );
        } finally {
            spy.mockRestore();
        }

        return captured;
    };

    it.each(scenes)('%s reaches only worklets on the UI thread', (key) => {
        const offenders: string[] = [];

        workletsOf(key).forEach((worklet, index) => {
            for (const entry of capturedFunctions(worklet, `${key}[${index}]`)) {
                if (!isWorklet(entry.fn)) offenders.push(entry.path);
            }
        });

        expect(offenders).toEqual([]);
    });

    /**
     * And the styles themselves have to be worklets, not plain callbacks that happen to
     * work because the mock runs them here.
     */
    it.each(scenes)('%s compiles its animated styles as worklets', (key) => {
        const worklets = workletsOf(key);

        expect(worklets.length).toBeGreaterThan(0);
        for (const worklet of worklets) {
            expect(isWorklet(worklet)).toBe(true);
        }
    });
});
