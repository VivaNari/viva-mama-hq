/**
 * Types for the WHO Child Growth Standards calculation.
 *
 * The shapes here are the contract between the phone and the server. The percentile a
 * mother sees while she is typing and the percentile the server persists must come from
 * the same function over the same types — that is the entire point of this package.
 */

/** The four indicators VivaMama tracks, 0–24 months. */
export type Indicator =
  | "weight_for_age"
  | "length_for_age"
  | "head_circumference_for_age"
  | "weight_for_length";

/**
 * Sex as the WHO standards define it, matching the casing of `ESex` on the user schema
 * so a child's stored `sex` can be passed straight in.
 *
 * WHO publishes boys' and girls' tables only. A child recorded as `Other` has no WHO
 * reference to be scored against; callers get `NOT_APPLICABLE` rather than a guess.
 */
export type Sex = "Male" | "Female";

/**
 * What a table is indexed by.
 *
 * Three indicators are indexed by age; weight-for-length is indexed by the child's length,
 * which is why it needs two measurements from the same entry and why its chart's x-axis is
 * centimetres rather than months.
 */
export type KeyKind = "ageMonths" | "lengthCm";

/** `[key, L, M, S]` — the only four columns of a WHO z-score table that matter. */
export type LmsRow = readonly [key: number, L: number, M: number, S: number];

export interface LmsTable {
  indicator: Indicator;
  sex: Sex;
  keyKind: KeyKind;
  /** Unit of the measured quantity, i.e. of `M` and of any value scored against it. */
  valueUnit: "kg" | "cm";
  /** Inclusive `[min, max]` of the key column. Outside it, nothing is computed. */
  domain: readonly [number, number];
  rows: readonly LmsRow[];
}

/**
 * Why an indicator has no number.
 *
 * Kept as one discriminant rather than scattered null checks: four indicators across four
 * UI surfaces would otherwise each grow their own ad-hoc handling, and the states are not
 * interchangeable — they need different words in front of a parent.
 */
export type GrowthStatus =
  /** Scored. */
  | "OK"
  /**
   * The key falls outside the table. Common, not exotic: WHO weight-for-length starts at
   * 45 cm, so a newborn shorter than that has no weight-for-length until they grow.
   */
  | "OUT_OF_RANGE"
  /** A measurement this indicator needs was not taken — weight-for-length needs both. */
  | "MISSING_INPUT"
  /** No WHO reference exists for this child, e.g. sex recorded as Other. */
  | "NOT_APPLICABLE";

/**
 * The result of scoring one measurement against one indicator.
 *
 * A discriminated union, deliberately: the backend compiles with
 * `exactOptionalPropertyTypes`, under which `{ z?: number }` cannot be assigned an explicit
 * `undefined`. The union sidesteps that and makes exhaustive handling in the UI free.
 *
 * Mongoose cannot model a union, so the persisted document uses the flattened
 * `PersistedIndicatorResult` below and is mapped back at the service boundary.
 */
export type IndicatorResult =
  | {
      indicator: Indicator;
      status: "OK";
      /** The value scored, normalised to the table's unit (kg or cm). */
      value: number;
      /** Key the value was scored at — age in months, or length in cm. */
      key: number;
      /**
       * Z-score, after WHO's extreme-value adjustment where that applies.
       * This is the canonical number: signed, comparable, and exact.
       */
      z: number;
      /** Z-score straight from the LMS formula. Equal to `z` whenever |z| <= 3. */
      zRaw: number;
      /** 0–100. Derived from `z`; rounded only at render, never at write. */
      percentile: number;
    }
  | {
      indicator: Indicator;
      status: Exclude<GrowthStatus, "OK">;
      /** Present for OUT_OF_RANGE so the UI can say what was measured. */
      value: number | null;
      key: number | null;
      z: null;
      zRaw: null;
      percentile: null;
    };

/** Flat mirror of {@link IndicatorResult} for storage. Mongoose has no union type. */
export interface PersistedIndicatorResult {
  status: GrowthStatus;
  value: number | null;
  key: number | null;
  z: number | null;
  zRaw: number | null;
  percentile: number | null;
}

/** One set of measurements taken on one day. Always metric — convert at the boundary. */
export interface GrowthMeasurement {
  weight_kg?: number | null;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
}

/** Every indicator scored for one measurement. */
export type GrowthEvaluation = Record<Indicator, IndicatorResult>;

/** A point on a reference curve, or the child's own series. */
export interface CurvePoint {
  x: number;
  y: number;
}

/** One percentile's reference curve across an indicator's domain. */
export interface ReferenceCurve {
  percentile: number;
  points: CurvePoint[];
}
