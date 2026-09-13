import { Schema } from "mongoose";

import { GrowthStatus, Indicator } from "@vivamama/growth-standards";

/**
 * One set of infant measurements taken on one day, with the WHO percentiles they produce.
 *
 * Percentiles are stored rather than recomputed on read, for two reasons: the client should
 * not have to carry a normal CDF to render a history, and a stored number can be traced back
 * to the rules that produced it via `standard.version`.
 */

/**
 * Flat mirror of the package's `IndicatorResult`, which is a discriminated union that
 * Mongoose cannot express. Mapped back to the union at the service boundary.
 */
export interface IPersistedIndicatorResult {
    status: GrowthStatus;
    /** The measurement scored, in the indicator's unit (kg or cm). */
    value: number | null;
    /** What it was scored against — age in months, or length in cm for weight-for-length. */
    key: number | null;
    /** Canonical score, after WHO's extreme-value adjustment where it applies. */
    z: number | null;
    /** Straight from the LMS formula. Equal to `z` whenever |z| <= 3. */
    zRaw: number | null;
    percentile: number | null;
}

export type IGrowthPercentiles = Record<Indicator, IPersistedIndicatorResult>;

export interface IGrowthLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    /**
     * Matches `users.childs[]._id`. Deliberately not a Mongoose `ref` — children are
     * embedded subdocuments, so there is no collection to populate from.
     */
    childId: Schema.Types.ObjectId;

    /** IST start-of-day. One editable log per child per calendar day. */
    measuredOn: Date;

    /**
     * Snapshots of the inputs that produced the percentiles below.
     *
     * Storing an output without its inputs is what makes a number unexplainable six months
     * later — and it is what lets a corrected date of birth trigger a recompute that can be
     * checked against what was there before.
     */
    ageInDays: number;
    sex: "Male" | "Female";

    measurements: {
        weight_kg?: number | null;
        length_cm?: number | null;
        head_circumference_cm?: number | null;
    };

    percentiles: IGrowthPercentiles;

    standard: {
        source: string;
        version: string;
    };

    createdAt: Date;
    updatedAt: Date;
}
