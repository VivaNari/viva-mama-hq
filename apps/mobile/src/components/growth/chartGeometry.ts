import {
    CurvePoint,
    Indicator,
    ReferenceCurve,
    Sex,
    curveDomain,
    curveExtent,
    referenceCurves,
    tableFor,
} from '@vivamama/growth-standards';

import { createLinearScale, LinearScale, niceTicks, padDomain } from './scales';

/**
 * Everything the chart needs to draw, computed as plain data.
 *
 * The renderer below this is deliberately dumb: it receives path strings and coordinates
 * and knows nothing about WHO, LMS or percentiles. That split is what lets the geometry —
 * where the real bugs live — be tested without a renderer.
 */

/** One of the child's own measurements, placed on the chart. */
export interface ChildPoint {
    /** Age in months, or length in cm for weight-for-length. */
    x: number;
    /** The measured value, in the indicator's unit. */
    y: number;
    /** ISO date the measurement was taken, for the tooltip. */
    measuredOn?: string;
}

export interface ChartPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface BuildGeometryParams {
    indicator: Indicator;
    sex: Sex;
    width: number;
    height: number;
    padding: ChartPadding;
    /** The child's series, oldest first. Empty is valid — the curves still draw. */
    childPoints: ChildPoint[];
}

export interface ChartGeometry {
    x: LinearScale;
    y: LinearScale;
    plot: { left: number; top: number; right: number; bottom: number };
    /** One SVG path per reference percentile, outermost first. */
    curves: { percentile: number; d: string }[];
    /** The child's trajectory, and each point's pixel position. */
    childPath: string;
    childPixels: { cx: number; cy: number; point: ChildPoint }[];
    /** The most recent point — the one the design labels. */
    latest: { cx: number; cy: number; point: ChildPoint } | null;
    xTicks: { value: number; px: number }[];
    yTicks: { value: number; py: number }[];
    /** Unit of the plotted value, for axis and label text. */
    valueUnit: 'kg' | 'cm';
    /** What the x-axis measures, which differs for weight-for-length. */
    xKind: 'ageMonths' | 'lengthCm';
}

/** SVG path for a polyline. Straight segments: WHO's curve is defined by its own points. */
export const buildLinePath = (
    points: readonly CurvePoint[],
    x: LinearScale,
    y: LinearScale,
): string => {
    if (points.length === 0) return '';

    return points
        .map((point, index) => {
            const command = index === 0 ? 'M' : 'L';
            return `${command}${x.scale(point.x).toFixed(2)} ${y.scale(point.y).toFixed(2)}`;
        })
        .join(' ');
};

/**
 * The y-range the chart should cover.
 *
 * Driven by the reference curves, then widened if the child sits outside them — a baby
 * below the 3rd percentile must still appear on their own chart, which is exactly the
 * case where a parent most needs to see the point.
 */
const valueDomain = (
    curves: ReferenceCurve[],
    childPoints: ChildPoint[],
): readonly [number, number] => {
    const [curveMin, curveMax] = curveExtent(curves);

    let min = curveMin;
    let max = curveMax;

    for (const point of childPoints) {
        if (point.y < min) min = point.y;
        if (point.y > max) max = point.y;
    }

    return padDomain([min, max]);
};

export const buildChartGeometry = ({
    indicator,
    sex,
    width,
    height,
    padding,
    childPoints,
}: BuildGeometryParams): ChartGeometry | null => {
    const table = tableFor(indicator, sex);
    if (!table) return null;

    const curves = referenceCurves(indicator, sex);
    if (curves.length === 0) return null;

    const plot = {
        left: padding.left,
        top: padding.top,
        right: width - padding.right,
        bottom: height - padding.bottom,
    };

    const keyDomain = curveDomain(table);

    const x = createLinearScale({ domain: keyDomain, range: [plot.left, plot.right] });
    // Range is inverted: SVG's y grows downward, values grow upward.
    const y = createLinearScale({
        domain: valueDomain(curves, childPoints),
        range: [plot.bottom, plot.top],
    });

    // Only points inside the chart's key range can be placed. A measurement outside it is
    // reported by the standards package as OUT_OF_RANGE and explained in words instead —
    // drawing it clamped to the edge would be a lie about where the child sits.
    const visible = childPoints.filter(
        (point) => point.x >= keyDomain[0] && point.x <= keyDomain[1],
    );

    const childPixels = visible.map((point) => ({
        cx: x.scale(point.x),
        cy: y.scale(point.y),
        point,
    }));

    return {
        x,
        y,
        plot,
        curves: curves.map((curve) => ({
            percentile: curve.percentile,
            d: buildLinePath(curve.points, x, y),
        })),
        childPath: buildLinePath(visible, x, y),
        childPixels,
        latest: childPixels.length > 0 ? childPixels[childPixels.length - 1]! : null,
        xTicks: niceTicks(keyDomain, 5).map((value) => ({ value, px: x.scale(value) })),
        yTicks: niceTicks(y.domain, 5).map((value) => ({ value, py: y.scale(value) })),
        valueUnit: table.valueUnit,
        xKind: table.keyKind,
    };
};

/**
 * The reference values at a given x, for the tooltip.
 *
 * Reads the curves rather than recomputing from LMS: the tooltip must report what the
 * chart actually drew, so a rendering and a reading of the same position can never
 * disagree.
 */
export const curveValuesAt = (
    geometry: ChartGeometry,
    curves: ReferenceCurve[],
    xValue: number,
): { percentile: number; value: number }[] =>
    curves
        .map((curve) => {
            const nearest = curve.points.reduce<CurvePoint | null>((best, point) => {
                if (!best) return point;
                return Math.abs(point.x - xValue) < Math.abs(best.x - xValue) ? point : best;
            }, null);

            return nearest ? { percentile: curve.percentile, value: nearest.y } : null;
        })
        .filter((entry): entry is { percentile: number; value: number } => entry !== null);
