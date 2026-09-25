/**
 * @vivamama/growth-standards — WHO Child Growth Standards (2006).
 *
 * LMS reference tables plus the z-score and percentile maths, shared by
 * `services/backend` and `apps/mobile`. Both consumers import this one module so the
 * percentile a mother sees while she is typing and the percentile the server persists are
 * produced by the same function — a duplicated implementation would be free to drift, and
 * the drift would be invisible.
 *
 * Everything here is metric (kg, cm) and free of Node and browser APIs.
 *
 * Attribution: WHO Child Growth Standards, https://www.who.int/tools/child-growth-standards
 * Not a medical device. Percentiles are informational and are not a clinical assessment.
 */

export {
    DAYS_PER_MONTH,
    GRAMS_PER_KG,
    IN_TO_CM,
    LB_TO_KG,
    MAX_CHART_AGE_MONTHS,
    PERCENTILE_DISPLAY_CEILING,
    PERCENTILE_DISPLAY_FLOOR,
    REFERENCE_PERCENTILES,
    STANDARD_SOURCE,
    STANDARD_VERSION,
    WEIGHT_BASED_INDICATORS,
} from "./constants";

export type {
    CurvePoint,
    GrowthEvaluation,
    GrowthMeasurement,
    GrowthStatus,
    Indicator,
    IndicatorResult,
    KeyKind,
    LmsRow,
    LmsTable,
    PersistedIndicatorResult,
    ReferenceCurve,
    Sex,
} from "./types";

export { ageInDaysUtc, ageMonths } from "./age";

export {
    birthMeasurementsToGrowthPoint,
    gramsToKg,
    inToCm,
    kgToGrams,
    lbToKg,
} from "./units";

export { INDICATORS, evaluateGrowth, evaluateIndicator } from "./evaluate";
export type { EvaluateParams } from "./evaluate";

export { curveDomain, curveExtent, referenceCurve, referenceCurves } from "./curves";
export type { CurveOptions } from "./curves";

export { bandForZ, isPercentileQuotable } from "./classification";
export type { GrowthBand } from "./classification";

export { TABLES, tableFor } from "./data";
export type { TableKey } from "./data";

// Lower-level pieces, exported for tests and for callers that need to work a table
// directly. Prefer evaluateGrowth / referenceCurves.
export { lmsAt } from "./lms/interpolate";
export type { Lms } from "./lms/interpolate";
export { valueFromZ, zFromValue } from "./lms/zscore";
export { adjustExtremeZ } from "./lms/extremes";
export { normalCdf, percentileFromZ, zFromPercentile } from "./stats/normal";
