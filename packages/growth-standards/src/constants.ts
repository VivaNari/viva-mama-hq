import { Indicator } from "./types";

/**
 * Mean days in a Gregorian month (365.25 / 12).
 *
 * This single constant decides whether our numbers match the client's reference. WHO
 * publishes age-indexed tables by month but a child's age is known in days, so the month
 * key is `days / 30.4375`. A 30.44 on one side of the wire and 30.4375 on the other is a
 * silent parity break, which is why nothing in this package re-derives it.
 */
export const DAYS_PER_MONTH = 30.4375;

export const GRAMS_PER_KG = 1000;

/** Exact by definition, for when imperial input is added. Never round before scoring. */
export const LB_TO_KG = 0.45359237;
export const IN_TO_CM = 2.54;

/** The five curves the reference chart draws. */
export const REFERENCE_PERCENTILES = [3, 15, 50, 85, 97] as const;

/**
 * Stamped onto every persisted result.
 *
 * Bump it whenever the tables, the CDF or the extreme-value rule change, so rows computed
 * under different rules can be told apart later. Without it, a change to the maths
 * silently reinterprets every number already written.
 */
export const STANDARD_VERSION = "who-2006.1";

export const STANDARD_SOURCE = "WHO-2006";

/**
 * Indicators WHO applies the extreme-value adjustment to.
 *
 * Weight-based only. Length and head circumference are not rescaled at the tails — their
 * distributions are near-normal, so the raw z stays meaningful out there.
 */
export const WEIGHT_BASED_INDICATORS: readonly Indicator[] = [
  "weight_for_age",
  "weight_for_length",
];

/**
 * Beyond these, stop quoting a number and show a band instead.
 *
 * "0.003rd percentile" is not information a parent can act on, and the precision is false
 * comfort: out there the value depends on the tail of a normal approximation, not on
 * anything WHO measured.
 */
export const PERCENTILE_DISPLAY_FLOOR = 0.1;
export const PERCENTILE_DISPLAY_CEILING = 99.9;

/** The upper bound of every chart in this product, per the PRD ("focus till 2 years"). */
export const MAX_CHART_AGE_MONTHS = 24;
