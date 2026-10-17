import {
    GrowthMeasurement,
    INDICATORS,
    Indicator,
    IndicatorResult,
    Sex,
    ageInDaysUtc,
    ageMonths,
    evaluateGrowth,
} from "@vivamama/growth-standards";

import { ChildPoint } from "../components/growth/chartGeometry";
import { IGrowthLog } from "../types/growthLog.types";

/**
 * Turns growth logs into the per-indicator series the chart plots.
 *
 * Two things make this less trivial than it looks:
 *
 *  - the x-axis differs per indicator. Three are plotted against age; weight-for-length is
 *    plotted against the child's length, so a log with no length contributes nothing to it
 *    even though it contributes to the other three.
 *  - an entry that could not be scored must be dropped rather than plotted at zero.
 */

export type SeriesByIndicator = Record<Indicator, ChildPoint[]>;
export type ResultsByIndicator = Record<Indicator, IndicatorResult>;

const emptySeries = (): SeriesByIndicator => ({
    weight_for_age: [],
    length_for_age: [],
    head_circumference_for_age: [],
    weight_for_length: [],
});

/** What a log contributes to one indicator, or null if it contributes nothing. */
const pointFor = (indicator: Indicator, entry: IGrowthLog): ChildPoint | null => {
    const { weight_kg, length_cm, head_circumference_cm } = entry.measurements;
    const x = ageMonths(entry.ageInDays);

    switch (indicator) {
        case "weight_for_age":
            return typeof weight_kg === "number"
                ? { x, y: weight_kg, measuredOn: entry.measuredOn }
                : null;

        case "length_for_age":
            return typeof length_cm === "number"
                ? { x, y: length_cm, measuredOn: entry.measuredOn }
                : null;

        case "head_circumference_for_age":
            return typeof head_circumference_cm === "number"
                ? { x, y: head_circumference_cm, measuredOn: entry.measuredOn }
                : null;

        // Keyed on length, not age — and it needs both numbers from the same entry.
        case "weight_for_length":
            return typeof weight_kg === "number" && typeof length_cm === "number"
                ? { x: length_cm, y: weight_kg, measuredOn: entry.measuredOn }
                : null;
    }
};

/** Build every indicator's series from a child's logs. */
export const buildSeries = (logs: IGrowthLog[]): SeriesByIndicator => {
    const ordered = [...logs].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
    const series = emptySeries();

    for (const entry of ordered) {
        for (const indicator of INDICATORS) {
            const point = pointFor(indicator, entry);
            if (point) series[indicator].push(point);
        }
    }

    // Weight-for-length is plotted against length, which does not have to increase
    // monotonically with time once measurement noise is involved. Sorting by x keeps the
    // connecting line from doubling back on itself.
    series.weight_for_length.sort((a, b) => a.x - b.x);

    return series;
};

/**
 * The stored results of the most recent log that actually scored each indicator.
 *
 * Per indicator rather than per log: a mother who recorded only a weight today should still
 * see her last head-circumference percentile rather than "not measured".
 */
export const latestResults = (logs: IGrowthLog[]): ResultsByIndicator => {
    const ordered = [...logs].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));

    const missing = (indicator: Indicator): IndicatorResult => ({
        indicator,
        status: "MISSING_INPUT",
        value: null,
        key: null,
        z: null,
        zRaw: null,
        percentile: null,
    });

    const results = {
        weight_for_age: missing("weight_for_age"),
        length_for_age: missing("length_for_age"),
        head_circumference_for_age: missing("head_circumference_for_age"),
        weight_for_length: missing("weight_for_length"),
    } as ResultsByIndicator;

    for (const entry of ordered) {
        for (const indicator of INDICATORS) {
            const stored = entry.percentiles?.[indicator];
            if (!stored) continue;

            // Keep the newest result that carries information: a scored one always wins,
            // and a later "not measured" never overwrites an earlier real number.
            if (stored.status === "OK") {
                results[indicator] = {
                    indicator,
                    status: "OK",
                    value: stored.value ?? 0,
                    key: stored.key ?? 0,
                    z: stored.z ?? 0,
                    zRaw: stored.zRaw ?? stored.z ?? 0,
                    percentile: stored.percentile ?? 0,
                };
            } else if (results[indicator].status !== "OK") {
                results[indicator] = {
                    indicator,
                    status: stored.status,
                    value: stored.value,
                    key: stored.key,
                    z: null,
                    zRaw: null,
                    percentile: null,
                };
            }
        }
    }

    return results;
};

/**
 * Score a set of measurements on the device, for the live preview while typing.
 *
 * The same function the server runs, from the same package — which is the whole reason the
 * calculation was extracted rather than implemented twice.
 */
export const previewResults = ({
    sex,
    dateOfBirth,
    measuredOn,
    measurement,
}: {
    sex: Sex | string | null | undefined;
    dateOfBirth: Date | string | null | undefined;
    measuredOn: Date;
    measurement: GrowthMeasurement;
}): ResultsByIndicator =>
    evaluateGrowth({
        sex,
        ageInDays: dateOfBirth ? ageInDaysUtc(dateOfBirth, measuredOn) : null,
        measurement,
    }) as ResultsByIndicator;
