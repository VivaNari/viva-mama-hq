/**
 * What the milestone grid costs to put on screen.
 *
 * These illustrations are built from plain Views — no images, no SVG, no Lottie — which is what
 * lets them scale, scrub and render offline. The bill for that is node count, and node count is
 * the one property of this feature that can regress *invisibly*: a mat rebuilt from a stack of
 * bars, or a handler moved back inline, draws exactly the same picture and simply takes longer
 * to appear. Nothing else in the suite would notice.
 *
 * So the assertions here are all about work rather than appearance:
 *
 *  - the play mat is a background, not a pile of bars;
 *  - a band does not exceed a view budget;
 *  - logging a milestone re-renders one card, not the whole grid.
 *
 * Run:  npx jest milestoneRenderCost
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MILESTONE_BANDS } from '../src/data/infantMilestoneData';
import { Nursery } from '../src/components/milestone/rig/Nursery';
import { diagonalStripes } from '../src/components/milestone/rig/parts';

let mockSceneRenders: string[] = [];

// The real scene, wrapped so the test can see how often each one is rebuilt. Counting scene
// renders rather than card renders is deliberate: the scene is the expensive half, and it sits
// *inside* the memo, so it is the thing the memo is there to protect.
jest.mock('../src/components/milestone/MilestoneScene', () => {
    const actual = jest.requireActual('../src/components/milestone/MilestoneScene');
    const react = require('react');

    return {
        ...actual,
        __esModule: true,
        default: (props: { milestoneKey: string }) => {
            mockSceneRenders.push(props.milestoneKey);
            return react.createElement(actual.default, props);
        },
    };
});

let mockRouteParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mockRouteParams }),
    useNavigation: () => ({ navigate: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) =>
        require('react').useEffect(effect, [effect]),
}));

type Wrapper = { children?: React.ReactNode } & Record<string, unknown>;

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: Wrapper) => <View {...props}>{children}</View>,
        SafeAreaProvider: ({ children }: Wrapper) => <>{children}</>,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

jest.mock('../src/api/infantMilestone.api', () => ({
    getMilestoneLogs: jest.fn().mockResolvedValue([]),
    achieveMilestone: jest.fn(),
    forgetMilestone: jest.fn().mockResolvedValue(undefined),
}));

const { getMilestoneLogs, achieveMilestone } = require('../src/api/infantMilestone.api');
import MilestoneLog from '../src/screens/MilestoneLog';

/** Host Views in a rendered tree — what actually reaches the platform. */
const views = (element: React.ReactElement): number => {
    const tree = render(element);
    const count = (JSON.stringify(tree.toJSON()).match(/"type":"View"/g) ?? []).length;
    tree.unmount();
    return count;
};

describe('the play mat', () => {
    /**
     * The mat used to be 60 rotated bars clipped inside a rounded box — about 40% of every
     * scene that stood on a floor, none of it moving. It is now one View with a repeating hard
     * stop gradient. This is the assertion that keeps it that way.
     */
    it('costs the room almost nothing', () => {
        const withMat = views(<Nursery />);
        const without = views(<Nursery mat={false} />);

        // The stripe and the inner oval. If this ever creeps, someone has rebuilt the mat out
        // of Views again.
        expect(withMat - without).toBeLessThanOrEqual(2);
    });

    it('lays the stripes out where the rotated bars were', () => {
        const css = diagonalStripes(556, 138, ['#AAAAAA', '#BBBBBB'], 12);

        expect(css.startsWith('linear-gradient(135deg,')).toBe(true);

        const stops = [...css.matchAll(/([\d.]+)%/g)].map((match) => Number(match[1]));

        // Positions run along the gradient line and must never go backwards: stops out of
        // order are not a wrong colour, they are an undefined gradient.
        for (let i = 1; i < stops.length; i++) {
            expect(stops[i]).toBeGreaterThanOrEqual(stops[i - 1]);
        }

        expect(stops[0]).toBe(0);
        expect(stops[stops.length - 1]).toBe(100);
        expect(Math.min(...stops)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...stops)).toBeLessThanOrEqual(100);

        // The geometry the bars had: 12px across the stripe, spaced band * sqrt(2) apart,
        // on a gradient line of (w + h) / sqrt(2).
        const line = (556 + 138) * Math.SQRT1_2;
        // Stops come in pairs — a hard stop repeats the colour at both ends of its run — so
        // the stripe is [0]..[1] and the next stripe starts at [3].
        expect(stops[1] - stops[0]).toBeCloseTo((12 * 100) / line, 2);
        expect(stops[3] - stops[0]).toBeCloseTo((12 * Math.SQRT2 * 100) / line, 2);
    });

    it('never emits a gradient with no stops', () => {
        expect(diagonalStripes(0, 0, ['#AAAAAA', '#BBBBBB'], 12)).toContain('#AAAAAA');
        expect(diagonalStripes(556, 138, ['#AAAAAA', '#BBBBBB'], 0)).toContain('#AAAAAA');
    });
});

describe('a band on screen', () => {
    /**
     * Switching band tears down every card and builds the next set in one commit, so this
     * number is very close to what a parent waits for when they tap a chip.
     */
    it('stays inside a view budget', () => {
        const MilestoneScene = jest.requireActual(
            '../src/components/milestone/MilestoneScene',
        ).default;

        for (const band of MILESTONE_BANDS) {
            const total = band.milestones.reduce(
                (sum, key) =>
                    sum +
                    views(<MilestoneScene milestoneKey={key} width={170} detail="thumb" />),
                0,
            );

            // Measured at ~480 for the heaviest band (10-12m). The headroom is for a scene
            // being reworked; a band crossing this has gained a few hundred nodes, which is
            // the kind of thing that only shows up as a slow tab.
            expect(total).toBeLessThanOrEqual(560);
        }
    });
});

describe('logging a milestone', () => {
    beforeEach(() => {
        mockRouteParams = { childId: 'child-1' };
        mockSceneRenders = [];
        getMilestoneLogs.mockClear();
        achieveMilestone.mockClear();
        getMilestoneLogs.mockResolvedValue([]);
        achieveMilestone.mockImplementation(
            async ({ milestoneKey }: { milestoneKey: string }) => ({
                _id: `log-${milestoneKey}`,
                childId: 'child-1',
                milestoneKey,
                achievedOn: '2026-09-14',
                createdAt: '',
                updatedAt: '',
            }),
        );
    });

    /**
     * The optimistic toggle replaces the screen's logs, which re-renders the grid. Only one
     * card changed, and rebuilding the other five means rebuilding five whole illustrations
     * for nothing.
     *
     * This fails the moment a handler goes back to being built inside the map, because a new
     * function per render defeats the memo on its own and does it silently.
     */
    it('rebuilds only the card that changed', async () => {
        const band = MILESTONE_BANDS[0];
        const screen = render(<MilestoneLog />);

        await waitFor(() => expect(getMilestoneLogs).toHaveBeenCalledWith('child-1'));
        await waitFor(() => expect(mockSceneRenders.length).toBeGreaterThanOrEqual(band.milestones.length));

        mockSceneRenders = [];

        await act(async () => {
            fireEvent.press(screen.getAllByText('Log this')[0]);
        });

        await waitFor(() => expect(achieveMilestone).toHaveBeenCalled());

        expect(mockSceneRenders).toEqual([band.milestones[0]]);
    });
});
