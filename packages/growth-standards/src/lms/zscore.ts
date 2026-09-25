import { Lms } from "./interpolate";

/**
 * The LMS transformation, both directions.
 *
 * WHO models each measurement as a Box-Cox normal distribution described by three
 * parameters: L (skew), M (median) and S (coefficient of variation). Given those, a
 * measurement maps to a z-score and back.
 */

/**
 * Z-score of a measured value.
 *
 * The L = 0 branch is not defensive padding — it is the limit of the Box-Cox transform as L
 * approaches zero, and WHO publishes L = 0 rows in some standards. Without it that row
 * divides by zero and yields Infinity.
 */
export const zFromValue = (lms: Lms, value: number): number => {
    const { L, M, S } = lms;

    if (L === 0) return Math.log(value / M) / S;

    return (Math.pow(value / M, L) - 1) / (L * S);
};

/**
 * The measurement at a given z-score — the inverse of {@link zFromValue}.
 *
 * This is what draws the chart: the 3rd percentile curve is this evaluated at z = -1.881
 * across the indicator's domain.
 */
export const valueFromZ = (lms: Lms, z: number): number => {
    const { L, M, S } = lms;

    if (L === 0) return M * Math.exp(S * z);

    return M * Math.pow(1 + L * S * z, 1 / L);
};
