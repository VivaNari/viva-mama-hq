import { LmsTable } from "../types";

/** The three parameters that describe the distribution of a measurement at one key. */
export interface Lms {
    L: number;
    M: number;
    S: number;
}

/**
 * L, M and S at an arbitrary key, linearly interpolated between the bracketing rows.
 *
 * Interpolation is not a refinement here, it is required. WHO's tables are indexed by whole
 * months but a child's age is known in days, and rounding to the nearest month moves the
 * result: the reference case (183 days, 7.80 kg) is the 43.6th percentile interpolated and
 * the 43.8th at month 6 exactly.
 *
 * Returns null outside the table's domain. Never extrapolates — beyond the published range
 * there is no standard to extrapolate from, and a plausible-looking invented number is
 * worse than an honest blank.
 */
export const lmsAt = (table: LmsTable, key: number): Lms | null => {
    const [min, max] = table.domain;
    if (!Number.isFinite(key) || key < min || key > max) return null;

    const { rows } = table;

    // Binary search for the last row at or below `key`. The tables are small enough that a
    // scan would do, but the chart resolves a key on every touch move.
    let lo = 0;
    let hi = rows.length - 1;

    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const row = rows[mid];
        if (row === undefined) break;

        if (row[0] <= key) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }

    const lower = rows[lo];
    if (lower === undefined) return null;

    // Exact hit, or the final row.
    if (lower[0] === key || lo === rows.length - 1) {
        return { L: lower[1], M: lower[2], S: lower[3] };
    }

    const upper = rows[lo + 1];
    if (upper === undefined) return { L: lower[1], M: lower[2], S: lower[3] };

    const span = upper[0] - lower[0];
    const fraction = span === 0 ? 0 : (key - lower[0]) / span;

    return {
        L: lower[1] + (upper[1] - lower[1]) * fraction,
        M: lower[2] + (upper[2] - lower[2]) * fraction,
        S: lower[3] + (upper[3] - lower[3]) * fraction,
    };
};
