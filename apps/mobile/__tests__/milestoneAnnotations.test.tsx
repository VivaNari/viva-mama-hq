/**
 * The marks that are not anatomy.
 *
 * About half of these milestones have no distinctive posture — a baby responding to their
 * name and a baby saying their first word both look like a baby sitting down. What tells
 * them apart is what arrives at the body or leaves it, so these annotations carry the
 * meaning, and the assertions below are mostly about meaning rather than about drawing:
 * that two words are two blobs, that three blobs can be seen to join into one, that a
 * grown-up does not read as a second baby.
 *
 * Run:  npx jest milestoneAnnotations
 */

import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import { render } from '@testing-library/react-native';

import {
    CaregiverFace,
    CaregiverHand,
    HighlightRing,
    SoundArcs,
    Sparkles,
    SpeechBubble,
} from '../src/components/milestone/rig/annotations';
import { ADULT_HEAD, HEAD } from '../src/components/milestone/rig/anatomy';
import { SCENE, SKIN } from '../src/components/milestone/rig/palette';
import { vec } from '../src/components/milestone/rig/skeleton';

const UNIT = 100;
const AT = vec(360, 200);

/** A clock parked at a moment, so every frame under test is the same one. */
const clockAt = (seconds: number) =>
    ({
        time: { value: seconds },
        duration: 10,
        seek: () => undefined,
        replay: () => undefined,
    }) as never;

const flattenedStyles = (tree: ReturnType<typeof render>) =>
    tree.UNSAFE_getAllByType(RNView).map((node) => StyleSheet.flatten(node.props.style) ?? {});

/** The word blobs, which are the only things painted in the mark colour. */
const wordBars = (tree: ReturnType<typeof render>) =>
    flattenedStyles(tree).filter((style) => style.backgroundColor === SCENE.accent);

describe('SpeechBubble', () => {
    it('draws exactly as many blobs as there are words', () => {
        for (const words of [1, 2, 3, 4]) {
            const tree = render(
                <SpeechBubble at={AT} width={240} words={words} clock={clockAt(0)} />,
            );
            expect(wordBars(tree)).toHaveLength(words);
        }
    });

    /**
     * Milestone 21 is "one or two words", and the count is the entire content of it. The
     * blobs have to arrive one at a time or the drawing says "some words".
     */
    it('brings the words in one at a time', () => {
        const tree = render(
            <SpeechBubble
                at={AT}
                width={240}
                words={3}
                spoken={() => 1.5}
                clock={clockAt(0)}
            />,
        );

        const opacities = wordBars(tree).map((style) => style.opacity);

        expect(opacities[0]).toBe(1);
        expect(opacities[1]).toBeCloseTo(0.5, 5);
        expect(opacities[2]).toBe(0);
    });

    /**
     * Milestone 33 is "joins three or more words into a sentence", and the joining is the
     * milestone — item 21 already covers having words at all. So at full join the blobs have
     * to be touching, with no daylight left between them; anything less is still a list.
     */
    it('closes the gaps between words as they join into one run', () => {
        const separated = wordBars(
            render(
                <SpeechBubble at={AT} width={240} words={3} join={() => 0} clock={clockAt(0)} />,
            ),
        );
        const joined = wordBars(
            render(
                <SpeechBubble at={AT} width={240} words={3} join={() => 1} clock={clockAt(0)} />,
            ),
        );

        const gaps = (bars: Record<string, any>[]) =>
            bars.slice(1).map((bar, i) => bar.left - (bars[i].left + bars[i].width));

        for (const gap of gaps(separated)) expect(gap).toBeGreaterThan(1);
        for (const gap of gaps(joined)) expect(Math.abs(gap)).toBeLessThan(0.001);
    });

    it('spans the same width joined as apart, so the bubble does not change size', () => {
        const total = (join: number) => {
            const bars = wordBars(
                render(
                    <SpeechBubble
                        at={AT}
                        width={240}
                        words={3}
                        join={() => join}
                        clock={clockAt(0)}
                    />,
                ),
            );
            const first = bars[0];
            const last = bars[bars.length - 1];
            return last.left + last.width - first.left;
        };

        expect(total(1)).toBeCloseTo(total(0), 4);
    });

    it('renders still, with no clock, for a frozen thumbnail', () => {
        expect(() => render(<SpeechBubble at={AT} width={240} words={2} />)).not.toThrow();
    });
});

describe('SoundArcs', () => {
    it('draws a three-arc wavefront', () => {
        const tree = render(<SoundArcs at={AT} size={40} clock={clockAt(0)} />);
        const arcs = flattenedStyles(tree).filter(
            (style) => style.borderRightColor === SCENE.accent,
        );

        expect(arcs).toHaveLength(3);
        // Concentric and growing outward, which is what makes it read as travelling.
        expect(arcs[1].width).toBeGreaterThan(arcs[0].width);
        expect(arcs[2].width).toBeGreaterThan(arcs[1].width);
    });

    it('aims where it is pointed', () => {
        const tree = render(<SoundArcs at={AT} size={40} towards={180} />);
        const arcs = flattenedStyles(tree).filter(
            (style) => style.borderRightColor === SCENE.accent,
        );

        expect(arcs[0].transform).toEqual([{ rotate: '180deg' }]);
    });

    /**
     * Sound has to leave and be gone, not sit there at full strength — a static wavefront
     * reads as a decoration rather than as something arriving.
     */
    it('fades out at both ends of its pulse', () => {
        const groupOpacity = (progress: number) => {
            const tree = render(
                <SoundArcs at={AT} size={40} pulse={() => progress} clock={clockAt(0)} />,
            );
            return flattenedStyles(tree).find((style) => style.transformOrigin)?.opacity;
        };

        expect(groupOpacity(0)).toBeCloseTo(0, 5);
        expect(groupOpacity(0.5)).toBeCloseTo(1, 5);
        expect(groupOpacity(1)).toBeCloseTo(0, 5);
    });
});

describe('Sparkles and HighlightRing', () => {
    it('render at any point in their pop', () => {
        for (const progress of [0, 0.5, 1]) {
            expect(() =>
                render(
                    <Sparkles at={AT} size={30} pop={() => progress} clock={clockAt(0)} />,
                ),
            ).not.toThrow();
            expect(() =>
                render(
                    <HighlightRing at={AT} size={60} pulse={() => progress} clock={clockAt(0)} />,
                ),
            ).not.toThrow();
        }
    });

    it('draws the ring as an outline, not a disc', () => {
        const tree = render(<HighlightRing at={AT} size={60} />);
        const ring = flattenedStyles(tree).find((style) => style.borderColor === SCENE.accent);

        expect(ring?.borderWidth).toBeGreaterThan(0);
        expect(ring?.backgroundColor).toBeUndefined();
    });
});

describe('the caregiver', () => {
    /**
     * The adult has to be visibly an adult. A baby's eyes sit below the midline of a tall
     * cranium and a grown-up's sit on it — that single difference is most of what separates
     * the two, and without it the caregiver reads as an enormous second baby.
     */
    it('is built on adult proportions, not a scaled-up baby', () => {
        expect(HEAD.eyeLine).toBeGreaterThan(0);
        expect(ADULT_HEAD.eyeLine).toBeLessThanOrEqual(0);
        expect(ADULT_HEAD.skullWidth).toBeLessThan(HEAD.skullWidth);
        expect(ADULT_HEAD.cheekSpread).toBeLessThan(HEAD.cheekSpread);
    });

    it('draws a face larger than the baby it leans over', () => {
        const babyHeadWidth = HEAD.skullWidth * UNIT;
        const adultHeadWidth = ADULT_HEAD.skullWidth * UNIT * 1.34;

        expect(adultHeadWidth).toBeGreaterThan(babyHeadWidth);
    });

    it('renders every gesture', () => {
        for (const gesture of ['open', 'beckon', 'reach', 'point'] as const) {
            expect(() =>
                render(
                    <CaregiverHand at={AT} unit={UNIT} skin={SKIN.warm} gesture={gesture} />,
                ),
            ).not.toThrow();
        }
    });

    /**
     * A hand with no arm behind it reads as a floating prop. Several of these milestones are
     * specifically about there being another person in the room.
     */
    it('carries a forearm running off out of frame', () => {
        const withArm = render(
            <CaregiverHand at={AT} unit={UNIT} skin={SKIN.warm} from={vec(360, -80)} />,
        );
        const without = render(<CaregiverHand at={AT} unit={UNIT} skin={SKIN.warm} />);

        expect(flattenedStyles(withArm).length).toBeGreaterThan(
            flattenedStyles(without).length,
        );
    });

    it('renders a face', () => {
        expect(() =>
            render(<CaregiverFace at={AT} unit={UNIT} skin={SKIN.light} />),
        ).not.toThrow();
    });
});
