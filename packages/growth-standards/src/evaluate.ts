import { ageMonths } from "./age";
import { WEIGHT_BASED_INDICATORS } from "./constants";
import { TABLES } from "./data";
import { adjustExtremeZ } from "./lms/extremes";
import { lmsAt } from "./lms/interpolate";
import { zFromValue } from "./lms/zscore";
import { percentileFromZ } from "./stats/normal";
import {
    GrowthEvaluation,
    GrowthMeasurement,
    Indicator,
    IndicatorResult,
    LmsTable,
    Sex,
} from "./types";

export const INDICATORS: readonly Indicator[] = [
    "weight_for_age",
    "length_for_age",
    "head_circumference_for_age",
    "weight_for_length",
];

export interface EvaluateParams {
    /**
     * Widened past `Sex` on purpose: a child's stored sex may be "Other" or absent, and
     * WHO publishes no reference for either. Those cases come back NOT_APPLICABLE rather
     * than being quietly scored against the boys' table.
     */
    sex: Sex | string | null | undefined;
    /** From `ageInDaysUtc`. Null when the date of birth is unknown or unparseable. */
    ageInDays: number | null;
    measurement: GrowthMeasurement;
}

const unscored = (
    indicator: Indicator,
    status: Exclude<IndicatorResult["status"], "OK">,
    value: number | null = null,
    key: number | null = null,
): IndicatorResult => ({ indicator, status, value, key, z: null, zRaw: null, percentile: null });

const isSex = (value: unknown): value is Sex => value === "Male" || value === "Female";

const finite = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);

/** Which measurement an indicator scores, and what it is keyed by. */
const inputsFor = (
    indicator: Indicator,
    measurement: GrowthMeasurement,
    ageInDays: number | null,
): { value: number | null; key: number | null } => {
    switch (indicator) {
        case "weight_for_age":
            return {
                value: measurement.weight_kg ?? null,
                key: ageInDays === null ? null : ageMonths(ageInDays),
            };

        case "length_for_age":
            return {
                value: measurement.length_cm ?? null,
                key: ageInDays === null ? null : ageMonths(ageInDays),
            };

        case "head_circumference_for_age":
            return {
                value: measurement.head_circumference_cm ?? null,
                key: ageInDays === null ? null : ageMonths(ageInDays),
            };

        // The only indicator keyed by a measurement rather than by age — which is why it
        // needs weight AND length from the same entry, and why its chart's x-axis is cm.
        case "weight_for_length":
            return {
                value: measurement.weight_kg ?? null,
                key: measurement.length_cm ?? null,
            };
    }
};

/** Score one measurement against one indicator. */
export const evaluateIndicator = (
    indicator: Indicator,
    params: EvaluateParams,
): IndicatorResult => {
    const { sex, ageInDays, measurement } = params;

    if (!isSex(sex)) return unscored(indicator, "NOT_APPLICABLE");

    const table: LmsTable | undefined = TABLES[`${indicator}:${sex}`];
    if (!table) return unscored(indicator, "NOT_APPLICABLE");

    const { value, key } = inputsFor(indicator, measurement, ageInDays);

    if (!finite(value) || value <= 0 || !finite(key)) {
        return unscored(indicator, "MISSING_INPUT", finite(value) ? value : null, finite(key) ? key : null);
    }

    const lms = lmsAt(table, key);
    // Outside the published domain. Never extrapolated — see lmsAt. The value and key are
    // still reported so the UI can say what was measured and why it is off the chart.
    if (!lms) return unscored(indicator, "OUT_OF_RANGE", value, key);

    const zRaw = zFromValue(lms, value);
    if (!Number.isFinite(zRaw)) return unscored(indicator, "OUT_OF_RANGE", value, key);

    const z = WEIGHT_BASED_INDICATORS.includes(indicator)
        ? adjustExtremeZ(lms, value, zRaw)
        : zRaw;

    return {
        indicator,
        status: "OK",
        value,
        key,
        z,
        zRaw,
        percentile: percentileFromZ(z),
    };
};

/** Score one day's measurements against all four indicators. */
export const evaluateGrowth = (params: EvaluateParams): GrowthEvaluation => ({
    weight_for_age: evaluateIndicator("weight_for_age", params),
    length_for_age: evaluateIndicator("length_for_age", params),
    head_circumference_for_age: evaluateIndicator("head_circumference_for_age", params),
    weight_for_length: evaluateIndicator("weight_for_length", params),
});
