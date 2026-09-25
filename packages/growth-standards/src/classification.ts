import { PERCENTILE_DISPLAY_CEILING, PERCENTILE_DISPLAY_FLOOR } from "./constants";

/**
 * WHO band a z-score falls into.
 *
 * The cut-offs are WHO's own (±2 SD ≈ the 3rd and 97th percentiles, ±3 SD the outer
 * flags). Band names here are deliberately clinical and neutral — they are identifiers,
 * not copy. Each consumer maps them to wording appropriate for its audience; nothing in
 * this package decides what a mother reads.
 */
export type GrowthBand =
    | "far_below"   // z < -3
    | "below"       // -3 <= z < -2
    | "within"      // -2 <= z <= 2   — the reference range, roughly the 3rd to 97th percentile
    | "above"       // 2 < z <= 3
    | "far_above";  // z > 3

export const bandForZ = (z: number): GrowthBand => {
    if (z < -3) return "far_below";
    if (z < -2) return "below";
    if (z <= 2) return "within";
    if (z <= 3) return "above";
    return "far_above";
};

/**
 * Whether a percentile is worth quoting as a number.
 *
 * Out in the tails the digits are false precision — "the 0.003rd percentile" is not
 * something a parent can act on, and the value there depends on the tail of a normal
 * approximation rather than on anything WHO measured. Past these bounds, show the band
 * instead of the number.
 */
export const isPercentileQuotable = (percentile: number): boolean =>
    percentile >= PERCENTILE_DISPLAY_FLOOR && percentile <= PERCENTILE_DISPLAY_CEILING;
