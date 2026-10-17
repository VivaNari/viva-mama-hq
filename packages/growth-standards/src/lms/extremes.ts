import { Lms } from "./interpolate";
import { valueFromZ } from "./zscore";

/**
 * WHO's extreme-value adjustment for weight-based indicators.
 *
 * Past ±3 SD the Box-Cox tail stops describing real children: for weight it collapses so
 * fast that a plausible measurement scores −7 SD and a percentile of 0.0000003. WHO's
 * standard fix (the same one WHO Anthro applies) is to stop trusting the curve out there
 * and extend it linearly, using the width of the outermost published SD interval as the
 * unit:
 *
 *     z > 3   ->  3 + (x - SD3pos) / (SD3pos - SD2pos)
 *     z < -3  -> -3 + (x - SD3neg) / (SD2neg - SD3neg)
 *
 * The SD cut-offs come from the LMS parameters themselves, so the SD* columns in the source
 * workbooks stay unused as the brief specifies.
 *
 * This is a no-op for |z| <= 3, which covers ~99.7% of measurements and every value the
 * reference site was checked against — so it cannot move our parity with InfantChart. It
 * applies only where the unadjusted number would be absurd, which is precisely the tail a
 * parent is most likely to act on.
 */
export const adjustExtremeZ = (lms: Lms, value: number, rawZ: number): number => {
    if (rawZ > 3) {
        const sd3pos = valueFromZ(lms, 3);
        const sd2pos = valueFromZ(lms, 2);
        const interval = sd3pos - sd2pos;

        if (interval <= 0) return rawZ;
        return 3 + (value - sd3pos) / interval;
    }

    if (rawZ < -3) {
        const sd3neg = valueFromZ(lms, -3);
        const sd2neg = valueFromZ(lms, -2);
        const interval = sd2neg - sd3neg;

        if (interval <= 0) return rawZ;
        return -3 + (value - sd3neg) / interval;
    }

    return rawZ;
};
