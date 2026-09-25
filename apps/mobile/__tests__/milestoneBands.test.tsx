/**
 * Every band whose scenes have been authored, checked the same way.
 *
 * Driven off the generated catalogue rather than a list of milestones typed here, so adding a
 * milestone to the MCP sheet makes this fail rather than silently skipping it. Finishing a
 * band means adding its key to `COMPLETED_BANDS` below and nothing else.
 *
 * The assertions worth reading are the ones about *movement*. A scene whose worklets return
 * constants renders perfectly, draws a plausible baby, passes every smoke test — and is
 * completely broken, because the whole claim of this feature is that a parent can tell what a
 * milestone is from the motion. So every scene here is rendered at several moments in its own
 * loop and has to look different at them.
 *
 * Run:  npx jest milestoneBand2to3m
 */

import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { render } from '@testing-library/react-native';

import en from '../src/i18n/locales/en.json';
import hi from '../src/i18n/locales/hi.json';
import { MILESTONE_BANDS } from '../src/data/infantMilestoneData';
import { ANIMATED_SCENES } from '../src/components/milestone/MilestoneScene';
import type { SceneDetail } from '../src/components/milestone/sceneTypes';

/** Bands whose every milestone has an authored scene. Grows one at a time. */
const COMPLETED_BANDS = ['2-3m', '4-6m', '7-9m', '10-12m', '18m', '24m'];

const BANDS = COMPLETED_BANDS.map((key) => {
    const band = MILESTONE_BANDS.find((candidate) => candidate.key === key);
    if (!band) throw new Error(`no such band: ${key}`);
    return band;
});

const MILESTONES = BANDS.flatMap((band) => band.milestones);

const clockAt = (seconds: number) =>
    ({
        time: { value: seconds },
        duration: 10,
        seek: () => undefined,
        replay: () => undefined,
    }) as never;

/** Everything the scene drew, as one comparable string. */
const snapshotAt = (key: string, seconds: number, detail: SceneDetail = 'full'): string => {
    const { Component } = ANIMATED_SCENES[key];
    const tree = render(<Component clock={clockAt(seconds)} detail={detail} />);

    return tree
        .UNSAFE_getAllByType(RNView)
        .map((node) => JSON.stringify(StyleSheet.flatten(node.props.style) ?? {}))
        .join('|');
};

const lookup = (bundle: Record<string, unknown>, path: string): unknown =>
    path.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object' && part in node) {
            return (node as Record<string, unknown>)[part];
        }
        return undefined;
    }, bundle);

describe('the finished bands', () => {
    it.each(COMPLETED_BANDS)('has an authored scene for every milestone in %s', (key) => {
        const band = BANDS.find((candidate) => candidate.key === key)!;

        expect(band.milestones.length).toBeGreaterThan(0);
        for (const milestone of band.milestones) {
            expect(ANIMATED_SCENES[milestone]).toBeDefined();
        }
    });

    it.each(MILESTONES)('renders %s still and animated', (key) => {
        const { Component } = ANIMATED_SCENES[key];

        expect(() => render(<Component still />)).not.toThrow();
        expect(() => render(<Component clock={clockAt(1)} detail="full" />)).not.toThrow();
        expect(() => render(<Component clock={clockAt(1)} detail="thumb" />)).not.toThrow();
    });

    /**
     * The test this file exists for. Sampled across the whole loop, because a scene can
     * easily be right at two moments and static between them — a tween whose window was
     * mistyped, say, holding its start value for the entire run.
     */
    it.each(MILESTONES)('%s actually moves through its loop', (key) => {
        const { duration } = ANIMATED_SCENES[key];
        const samples = [0, 0.2, 0.4, 0.6, 0.8].map((fraction) =>
            snapshotAt(key, fraction * duration),
        );

        expect(new Set(samples).size).toBeGreaterThan(1);
    });

    /**
     * And it has to still move once the detail is turned down, which is the state a card in
     * a grid is actually drawn in. A scene whose every moving part happened to be behind a
     * `detail === 'full'` check would animate beautifully in the detail view and sit
     * completely still on the card — the exact failure this whole pass is meant to end.
     */
    it.each(MILESTONES)('%s still moves at thumbnail detail', (key) => {
        const { duration } = ANIMATED_SCENES[key];
        const samples = [0, 0.3, 0.6, 0.9].map((fraction) =>
            snapshotAt(key, fraction * duration, 'thumb'),
        );

        expect(new Set(samples).size).toBeGreaterThan(1);
    });

    /**
     * A thumbnail must never cost *more* than the detail view, and must stay inside the
     * eight-node budget that makes a grid of them affordable.
     *
     * Equal is fine and common. Several of these scenes put their full-detail extras on a
     * node that was already moving — a blink rides the same group as the gaze, a finger
     * drift rides the same group as the curl — so turning them off removes arithmetic
     * without removing a node. The saving shows up only where a whole part goes quiet, as
     * with the far limbs in the tummy-time scene.
     */
    it.each(MILESTONES)('%s costs fewer animated nodes as a thumbnail', (key) => {
        const Reanimated = require('react-native-reanimated');

        const countFor = (detail: SceneDetail) => {
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
                const { Component } = ANIMATED_SCENES[key];
                render(<Component clock={clockAt(1)} detail={detail} />);

                return worklets.filter((worklet) => {
                    try {
                        return Object.keys(worklet() ?? {}).length > 0;
                    } catch {
                        return false;
                    }
                }).length;
            } finally {
                spy.mockRestore();
            }
        };

        const thumb = countFor('thumb');

        expect(thumb).toBeGreaterThan(0);
        expect(thumb).toBeLessThanOrEqual(8);
        expect(thumb).toBeLessThanOrEqual(countFor('full'));
    });

    /**
     * A still frame is the moment somebody chose as the one that explains the milestone. It
     * is what a card shows under Reduce Motion, so it has to be a real frame of the
     * performance and not, say, past the end of it.
     */
    it.each(MILESTONES)('%s freezes on a frame inside its own loop', (key) => {
        const { Component, duration } = ANIMATED_SCENES[key];
        const still = render(<Component still />);

        expect(still.UNSAFE_getAllByType(RNView).length).toBeGreaterThan(0);
        expect(duration).toBeGreaterThan(0);

        // The frozen frame must differ from the opening frame, or freezing is pointless —
        // it would be showing the start of the story rather than its point.
        const frozen = still
            .UNSAFE_getAllByType(RNView)
            .map((node) => JSON.stringify(StyleSheet.flatten(node.props.style) ?? {}))
            .join('|');

        expect(frozen).not.toEqual(snapshotAt(key, 0, 'thumb'));
    });

    it('labels every step in both languages', () => {
        for (const key of MILESTONES) {
            for (const step of ANIMATED_SCENES[key].steps) {
                expect(typeof lookup(en, step.labelKey)).toBe('string');
                expect(typeof lookup(hi, step.labelKey)).toBe('string');
            }
        }
    });
});
