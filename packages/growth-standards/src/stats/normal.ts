/**
 * Standard normal distribution: CDF and its inverse.
 *
 * Accuracy matters more here than anywhere else in the package. A three-term approximation
 * is good to about 1e-3, which lands a displayed percentile up to half a point away from
 * the reference — and that discrepancy is expensive to diagnose, because it looks exactly
 * like an LMS bug and only shows up after the LMS maths has been cleared. Both routines
 * below are accurate to roughly double precision.
 */

const SQRT_2PI = 2.5066282746310002;

/**
 * P(Z <= z) for a standard normal.
 *
 * Hart's rational approximation (1968), the same one behind most statistical libraries.
 * Accurate to ~1e-15 across the whole range; beyond |z| = 37 the result is 0 or 1 to
 * within double precision anyway.
 */
export const normalCdf = (z: number): number => {
    if (!Number.isFinite(z)) return z > 0 ? 1 : 0;

    const abs = Math.abs(z);
    if (abs > 37) return z > 0 ? 1 : 0;

    const exponential = Math.exp(-0.5 * abs * abs);
    let tail: number;

    if (abs < 7.071067811865475) {
        tail =
            (exponential *
                ((((((3.526249659989109e-2 * abs + 0.7003830644436881) * abs +
                    6.37396220353165) *
                    abs +
                    33.912866078383) *
                    abs +
                    112.0792914978709) *
                    abs +
                    221.2135961699311) *
                    abs +
                    220.2068679123761)) /
            ((((((((8.838834764831844e-2 * abs + 1.755667163182642) * abs +
                16.06417757920695) *
                abs +
                86.78073220294608) *
                abs +
                296.5642487796737) *
                abs +
                637.3336333788311) *
                abs +
                793.8265125199484) *
                abs +
                440.4137358247522));
    } else {
        tail =
            exponential /
            (abs + 1 / (abs + 2 / (abs + 3 / (abs + 4 / (abs + 0.65))))) /
            SQRT_2PI;
    }

    return z > 0 ? 1 - tail : tail;
};

/** Percentile (0–100) for a z-score. The number a parent actually reads. */
export const percentileFromZ = (z: number): number => normalCdf(z) * 100;

// Acklam's rational approximation for the normal quantile — good to ~1.15e-9 before the
// refinement step below takes it to full double precision. Coefficients are named rather
// than held in arrays because `noUncheckedIndexedAccess` would otherwise bury the
// polynomials under `?? 0` on every term.
const A0 = -3.969683028665376e1;
const A1 = 2.209460984245205e2;
const A2 = -2.759285104469687e2;
const A3 = 1.38357751867269e2;
const A4 = -3.066479806614716e1;
const A5 = 2.506628277459239;

const B0 = -5.447609879822406e1;
const B1 = 1.615858368580409e2;
const B2 = -1.556989798598866e2;
const B3 = 6.680131188771972e1;
const B4 = -1.328068155288572e1;

const C0 = -7.784894002430293e-3;
const C1 = -3.223964580411365e-1;
const C2 = -2.400758277161838;
const C3 = -2.549732539343734;
const C4 = 4.374664141464968;
const C5 = 2.938163982698783;

const D0 = 7.784695709041462e-3;
const D1 = 3.224671290700398e-1;
const D2 = 2.445134137142996;
const D3 = 3.754408661907416;

const P_LOW = 0.02425;
const P_HIGH = 1 - P_LOW;

/** The tail branch of Acklam's approximation, shared by both tails. */
const tailQuantile = (q: number): number =>
    (((((C0 * q + C1) * q + C2) * q + C3) * q + C4) * q + C5) /
    ((((D0 * q + D1) * q + D2) * q + D3) * q + 1);

/**
 * The inverse: the z-score whose CDF is `p` (0 < p < 1).
 *
 * This is what turns "the 3rd percentile" into a z of -1.881, which is what lets the chart
 * draw its five reference curves. Acklam's approximation plus one Halley refinement
 * against {@link normalCdf}.
 */
export const zFromPercentile = (percentile: number): number => {
    const p = percentile / 100;

    if (!(p > 0 && p < 1)) {
        throw new RangeError(`percentile must be strictly between 0 and 100, got ${percentile}`);
    }

    let z: number;

    if (p < P_LOW) {
        z = tailQuantile(Math.sqrt(-2 * Math.log(p)));
    } else if (p <= P_HIGH) {
        const q = p - 0.5;
        const r = q * q;
        z =
            ((((((A0 * r + A1) * r + A2) * r + A3) * r + A4) * r + A5) * q) /
            (((((B0 * r + B1) * r + B2) * r + B3) * r + B4) * r + 1);
    } else {
        z = -tailQuantile(Math.sqrt(-2 * Math.log(1 - p)));
    }

    // One Halley step. Cheap, and it is what takes the result from ~1e-9 to exact.
    const error = normalCdf(z) - p;
    const slope = error * SQRT_2PI * Math.exp((z * z) / 2);
    return z - slope / (1 + (z * slope) / 2);
};
