/**
 * The chart's arithmetic, tested without rendering anything.
 *
 * This is the reason the chart is hand-rolled SVG rather than a chart library: the
 * geometry is ours, so it can be asserted directly. A library would have forced these
 * checks through a renderer and a mock of the library itself.
 *
 * Run:  npx jest growthChartGeometry
 */
import {
    buildChartGeometry,
    buildLinePath,
    curveValuesAt,
} from '../src/components/growth/chartGeometry';
import { createLinearScale, niceTicks, padDomain } from '../src/components/growth/scales';
import { referenceCurves } from '@vivamama/growth-standards';

const PADDING = { top: 16, right: 16, bottom: 34, left: 38 };

const geometryFor = (
    indicator: Parameters<typeof buildChartGeometry>[0]['indicator'],
    childPoints: { x: number; y: number }[] = [],
) =>
    buildChartGeometry({
        indicator,
        sex: 'Male',
        width: 340,
        height: 260,
        padding: PADDING,
        childPoints,
    });

describe('createLinearScale', () => {
    it('maps the domain onto the range and back', () => {
        const scale = createLinearScale({ domain: [0, 24], range: [0, 240] });

        expect(scale.scale(0)).toBe(0);
        expect(scale.scale(12)).toBe(120);
        expect(scale.scale(24)).toBe(240);
        expect(scale.invert(120)).toBeCloseTo(12, 10);
    });

    /** SVG's y grows downward, so value axes are built with an inverted range. */
    it('handles an inverted range, which is how the value axis is built', () => {
        const scale = createLinearScale({ domain: [0, 10], range: [200, 0] });

        expect(scale.scale(0)).toBe(200);
        expect(scale.scale(10)).toBe(0);
        expect(scale.invert(100)).toBeCloseTo(5, 10);
    });

    it('does not divide by zero on a degenerate domain', () => {
        const scale = createLinearScale({ domain: [5, 5], range: [0, 100] });

        expect(Number.isFinite(scale.scale(5))).toBe(true);
        expect(Number.isFinite(scale.invert(50))).toBe(true);
    });
});

describe('niceTicks', () => {
    it('chooses round steps rather than dividing the span exactly', () => {
        expect(niceTicks([0, 24], 5)).toEqual([0, 5, 10, 15, 20]);
        expect(niceTicks([0, 10], 5)).toEqual([0, 2, 4, 6, 8, 10]);
    });

    it('does not accumulate float drift across a fractional step', () => {
        // Repeated addition of 0.1 drifts to 0.30000000000000004 without rounding.
        expect(niceTicks([0, 0.5], 5)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('survives a zero-width domain', () => {
        expect(niceTicks([3, 3], 5)).toEqual([3]);
    });
});

describe('padDomain', () => {
    it('widens a range symmetrically so curves are not flush with the frame', () => {
        expect(padDomain([0, 100], 0.1)).toEqual([-10, 110]);
    });
});

describe('buildLinePath', () => {
    it('emits a moveto followed by linetos', () => {
        const x = createLinearScale({ domain: [0, 2], range: [0, 200] });
        const y = createLinearScale({ domain: [0, 2], range: [200, 0] });

        expect(buildLinePath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], x, y)).toBe(
            'M0.00 200.00 L100.00 100.00 L200.00 0.00',
        );
    });

    it('returns an empty path for no points, rather than a broken one', () => {
        const scale = createLinearScale({ domain: [0, 1], range: [0, 1] });
        expect(buildLinePath([], scale, scale)).toBe('');
    });
});

describe('buildChartGeometry', () => {
    it('lays out five curves inside the padded plot area', () => {
        const geometry = geometryFor('weight_for_age')!;

        expect(geometry.curves).toHaveLength(5);
        expect(geometry.plot).toEqual({ left: 38, top: 16, right: 324, bottom: 226 });
        expect(geometry.curves.every((curve) => curve.d.startsWith('M'))).toBe(true);
    });

    it('spans 0–24 months for an age-based indicator', () => {
        const geometry = geometryFor('weight_for_age')!;

        expect(geometry.x.domain).toEqual([0, 24]);
        expect(geometry.xKind).toBe('ageMonths');
        expect(geometry.valueUnit).toBe('kg');
    });

    /** The axis that a library with index-based x could not express. */
    it('spans 45–110 cm for weight-for-length', () => {
        const geometry = geometryFor('weight_for_length')!;

        expect(geometry.x.domain).toEqual([45, 110]);
        expect(geometry.xKind).toBe('lengthCm');
    });

    it('places a child point at its exact fractional age', () => {
        const geometry = geometryFor('weight_for_age', [{ x: 6.0123, y: 7.8 }])!;

        expect(geometry.childPixels).toHaveLength(1);
        expect(geometry.childPixels[0].cx).toBeCloseTo(geometry.x.scale(6.0123), 10);
        expect(geometry.latest!.point.y).toBe(7.8);
    });

    /**
     * A baby below the 3rd percentile must still appear on their own chart — that is
     * exactly the case where a parent most needs to see the point.
     */
    it('widens the value axis to include a child outside the reference curves', () => {
        const geometry = geometryFor('weight_for_age', [{ x: 12, y: 2.5 }])!;

        expect(geometry.y.domain[0]).toBeLessThan(2.5);
        expect(geometry.childPixels).toHaveLength(1);
    });

    /**
     * Out-of-range points are dropped, never clamped to the edge: drawing one at the frame
     * would put the child somewhere they are not.
     */
    it('drops a point outside the chart rather than clamping it', () => {
        const geometry = geometryFor('weight_for_length', [{ x: 43, y: 2.4 }])!;

        expect(geometry.childPixels).toHaveLength(0);
        expect(geometry.latest).toBeNull();
        // The reference curves still draw — an empty card would read as a failure.
        expect(geometry.curves).toHaveLength(5);
    });

    it('draws the curves alone when a child has no measurements yet', () => {
        const geometry = geometryFor('weight_for_age', [])!;

        expect(geometry.childPath).toBe('');
        expect(geometry.latest).toBeNull();
        expect(geometry.curves).toHaveLength(5);
    });

    it('connects a series in the order it was measured', () => {
        const geometry = geometryFor('weight_for_age', [
            { x: 0, y: 3.3 },
            { x: 6, y: 7.8 },
            { x: 12, y: 9.6 },
        ])!;

        expect(geometry.childPixels).toHaveLength(3);
        expect(geometry.latest!.point.y).toBe(9.6);
        expect(geometry.childPath.split('L')).toHaveLength(3);
    });
});

describe('curveValuesAt', () => {
    it('reports each curve value at the nearest sampled age', () => {
        const geometry = geometryFor('weight_for_age')!;
        const curves = referenceCurves('weight_for_age', 'Male');

        const values = curveValuesAt(geometry, curves, 6.2);

        expect(values).toHaveLength(5);
        expect(values.map((entry) => entry.percentile)).toEqual([3, 15, 50, 85, 97]);
        // Ordered low to high, as the curves themselves are.
        for (let i = 1; i < values.length; i++) {
            expect(values[i].value).toBeGreaterThan(values[i - 1].value);
        }
    });

    /** The 50th curve is the WHO median, so its value at month 0 is the table's M. */
    it('reads the median as the table median', () => {
        const geometry = geometryFor('weight_for_age')!;
        const curves = referenceCurves('weight_for_age', 'Male');

        const median = curveValuesAt(geometry, curves, 0).find(
            (entry) => entry.percentile === 50,
        );

        expect(median!.value).toBeCloseTo(3.3464, 4);
    });
});
