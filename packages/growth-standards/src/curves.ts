import { MAX_CHART_AGE_MONTHS, REFERENCE_PERCENTILES } from "./constants";
import { TABLES } from "./data";
import { lmsAt } from "./lms/interpolate";
import { valueFromZ } from "./lms/zscore";
import { zFromPercentile } from "./stats/normal";
import { CurvePoint, Indicator, LmsTable, ReferenceCurve, Sex } from "./types";

/**
 * The backward direction: percentile -> expected measurement, across an indicator's domain.
 *
 * This is what the chart draws. Keeping it here rather than in the chart component means
 * the component never touches LMS data — it receives points and renders them, which is
 * what makes the geometry testable without a renderer.
 */

export interface CurveOptions {
    /**
     * Spacing between sampled points, in the table's key unit. Defaults to 1.
     *
     * One unit means one point per row for the age-based tables (rows are monthly), so the
     * rendered polyline *is* the WHO curve rather than an approximation of it. For
     * weight-for-length, whose rows are every 0.5 cm, it deliberately samples every second
     * row — five curves over 131 rows makes long path strings for a difference invisible at
     * phone width.
     */
    step?: number;
    /** Clamp the upper end of the key range. Defaults to 24 months for age-based tables. */
    maxKey?: number;
}

const DEFAULT_STEP = 1;

/** The key range a chart should cover for this indicator. */
export const curveDomain = (
    table: LmsTable,
    maxKey?: number,
): readonly [number, number] => {
    const [min, max] = table.domain;

    // Age-based charts stop at two years — the product's stated focus, and for
    // length-for-age it is also where WHO's table ends, because the standard switches from
    // recumbent length to standing height at 24 months.
    const ceiling =
        maxKey ?? (table.keyKind === "ageMonths" ? Math.min(max, MAX_CHART_AGE_MONTHS) : max);

    return [min, Math.min(max, ceiling)];
};

/** One percentile's curve across the domain. */
export const referenceCurve = (
    indicator: Indicator,
    sex: Sex,
    percentile: number,
    options: CurveOptions = {},
): ReferenceCurve | null => {
    const table = TABLES[`${indicator}:${sex}`];
    if (!table) return null;

    const [min, max] = curveDomain(table, options.maxKey);
    const step = options.step ?? DEFAULT_STEP;
    const z = zFromPercentile(percentile);

    const points: CurvePoint[] = [];

    for (let key = min; key <= max + 1e-9; key += step) {
        // Guard the accumulated float drift rather than trusting `key` at the top end.
        const x = Math.min(key, max);
        const lms = lmsAt(table, x);
        if (!lms) continue;

        const y = valueFromZ(lms, z);
        if (Number.isFinite(y)) points.push({ x, y });
    }

    return { percentile, points };
};

/**
 * All five reference curves for an indicator.
 *
 * Memoised at module scope: these are constants of the WHO standard, so they should be
 * computed once per app launch rather than on every render of a chart the parent is
 * switching tabs on.
 */
const curveCache = new Map<string, ReferenceCurve[]>();

export const referenceCurves = (
    indicator: Indicator,
    sex: Sex,
    options: CurveOptions = {},
): ReferenceCurve[] => {
    const cacheKey = `${indicator}:${sex}:${options.step ?? ""}:${options.maxKey ?? ""}`;
    const cached = curveCache.get(cacheKey);
    if (cached) return cached;

    const curves = REFERENCE_PERCENTILES.map((percentile) =>
        referenceCurve(indicator, sex, percentile, options),
    ).filter((curve): curve is ReferenceCurve => curve !== null);

    curveCache.set(cacheKey, curves);
    return curves;
};

/** The y-range the five curves span, for sizing a chart's value axis. */
export const curveExtent = (curves: ReferenceCurve[]): readonly [number, number] => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const curve of curves) {
        for (const point of curve.points) {
            if (point.y < min) min = point.y;
            if (point.y > max) max = point.y;
        }
    }

    return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : [0, 1];
};
