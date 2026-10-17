import { GrowthStatus, Indicator } from "@vivamama/growth-standards";

/**
 * Growth logs as the API returns them.
 *
 * Percentiles arrive computed rather than being derived on the client, so a history
 * renders without the phone rescoring rows it did not enter. Live preview while typing
 * still runs the same calculation locally through @vivamama/growth-standards — both sides
 * import one module precisely so the two can never disagree.
 */

/** Flat mirror of the package's IndicatorResult union — Mongoose cannot store a union. */
export interface IPersistedIndicatorResult {
  status: GrowthStatus;
  value: number | null;
  key: number | null;
  z: number | null;
  zRaw: number | null;
  percentile: number | null;
}

export interface IGrowthLog {
  _id: string;
  childId: string;
  /** "YYYY-MM-DD". */
  measuredOn: string;
  ageInDays: number;
  sex: "Male" | "Female";
  measurements: {
    weight_kg?: number | null;
    length_cm?: number | null;
    head_circumference_cm?: number | null;
  };
  percentiles: Record<Indicator, IPersistedIndicatorResult>;
  standard: { source: string; version: string };
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /growth-logs. Metric only; the server rejects anything else. */
export interface IGrowthLogUpsert {
  childId: string;
  measuredOn: string;
  weight_kg?: number | null;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
}
